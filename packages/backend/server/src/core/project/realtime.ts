import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { AuthenticationRequired, EventBus, JobQueue, OnJob } from '../../base';
import { Models } from '../../models';
import {
  RealtimePublisher,
  RealtimeRegistry,
  realtimeUserRoom,
  registerRealtimeLiveQuery,
} from '../realtime';

declare global {
  interface Jobs {
    'notification.projectRealtime': Record<string, never>;
  }
}

export const projectLeaseRoom = (projectId: string) =>
  `project:${projectId}:lease`;

@Injectable()
export class ProjectRealtimeProvider implements OnModuleInit {
  private readonly logger = new Logger(ProjectRealtimeProvider.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly models: Models,
    private readonly registry: RealtimeRegistry,
    private readonly publisher: RealtimePublisher,
    private readonly events: EventBus,
    private readonly queue: JobQueue
  ) {}

  onModuleInit() {
    const input = z.object({}).strict();
    const room = (scope: string) => (user: { id: string } | null) => {
      if (!user) throw new AuthenticationRequired();
      return realtimeUserRoom(user.id, scope);
    };
    registerRealtimeLiveQuery(this.registry, {
      request: {
        name: 'project.list.get',
        input,
        handle: async user => {
          if (!user) throw new AuthenticationRequired();
          const projects = await this.models.copilotContextMemory.listProjects({
            userId: user.id,
          });
          return {
            projects: projects.map(project => ({
              id: project.id,
              name: project.name,
              status: project.status,
              aiPolicy: project.aiPolicy,
              role:
                project.members.find(member => member.userId === user.id)
                  ?.role ?? 'member',
            })),
          };
        },
      },
      topic: {
        name: 'project.list.changed',
        input,
        authorize: async () => {},
        room: room('project-list'),
      },
    });
    registerRealtimeLiveQuery(this.registry, {
      request: {
        name: 'project.task.get',
        input,
        handle: async user => {
          if (!user) throw new AuthenticationRequired();
          const panel =
            await this.models.intelligenceWorkbenchTaskProjection.listPanel({
              userId: user.id,
            });
          return {
            tasks: [panel.todo, panel.inProgress, panel.done].flatMap(segment =>
              segment.items.map(item => ({
                id: item.id,
                projectId: item.projectId,
                status: item.status,
                segment: item.segment,
              }))
            ),
          };
        },
      },
      topic: {
        name: 'project.task.changed',
        input,
        authorize: async () => {},
        room: room('project-task'),
      },
    });
    const leaseInput = z
      .object({ projectId: z.string().min(1).max(512) })
      .strict();
    registerRealtimeLiveQuery(this.registry, {
      request: {
        name: 'project.lease.get',
        input: leaseInput,
        handle: async (user, input) => {
          if (!user) throw new AuthenticationRequired();
          const leases = await this.models.projectResourceEditLease.list({
            projectId: input.projectId,
            actorId: user.id,
          });
          return {
            leases: leases.map(lease => ({
              resourceId: lease.resourceId,
              projectId: lease.projectId,
              kind: lease.kind,
              holderId: lease.holderId,
              holderName: lease.holder.name || lease.holder.email,
              acquiredAt: lease.acquiredAt,
              expiresAt: lease.expiresAt,
            })),
          };
        },
      },
      topic: {
        name: 'project.lease.changed',
        input: leaseInput,
        authorize: async (user, input) => {
          if (!user) throw new AuthenticationRequired();
          await this.models.projectResource.assertMember({
            projectId: input.projectId,
            actorId: user.id,
          });
        },
        room: (_user, input) => projectLeaseRoom(input.projectId),
      },
    });
  }

  @Cron('* * * * * *')
  async schedule() {
    await this.queue.add(
      'notification.projectRealtime',
      {},
      { jobId: 'project-realtime-deliver' }
    );
  }

  @OnJob('notification.projectRealtime')
  async deliver() {
    await this.models.projectResourceEditLease.expire();
    const rows = await this.db.projectRealtimeOutbox.findMany({
      orderBy: { id: 'asc' },
      take: 200,
    });
    for (const row of rows) {
      try {
        let published = false;
        if (row.topic === 'project.resource.changed' && row.resourceId) {
          await this.events.emitAsync('project.resource.changed', {
            projectId: row.scopeId,
            resourceId: row.resourceId,
          });
          published = true;
        } else if (
          row.topic === 'project.list.changed' ||
          row.topic === 'project.task.changed'
        ) {
          published = this.publisher.publish(
            row.topic,
            {},
            { changed: true, reason: 'committed' },
            {
              room: realtimeUserRoom(
                row.scopeId,
                row.topic === 'project.list.changed'
                  ? 'project-list'
                  : 'project-task'
              ),
            }
          );
        } else if (row.topic === 'project.lease.changed') {
          published = this.publisher.publish(
            row.topic,
            { projectId: row.scopeId },
            { changed: true, reason: 'committed' }
          );
          const resumed =
            await this.models.copilotProjectAgentRuntime.resumeWaitingLeases(
              row.scopeId,
              row.resourceId ?? undefined
            );
          for (const run of resumed)
            await this.queue.add('copilot.projectAgentRuntime.run', {
              projectId: row.scopeId,
              runId: run.id,
            });
        }
        if (published)
          await this.db.projectRealtimeOutbox.deleteMany({
            where: { id: row.id },
          });
      } catch {
        this.logger.warn('Project realtime delivery will retry');
      }
    }
  }
}

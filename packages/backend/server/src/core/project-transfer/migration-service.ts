import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { JOB_SIGNAL, JobQueue, OnJob } from '../../base';
import { Models } from '../../models';
import { ProjectImportService } from './import-service';

declare global {
  interface Jobs {
    'doc.projectResources.migrate': { migrationId?: string };
  }
}

@Injectable()
export class ProjectResourceMigrationService {
  constructor(
    private readonly models: Models,
    private readonly imports: ProjectImportService,
    private readonly jobs: JobQueue
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async schedule() {
    await this.jobs.add(
      'doc.projectResources.migrate',
      {},
      { jobId: 'project-resource-migration-scan' }
    );
  }

  @OnJob('doc.projectResources.migrate')
  async run(input: Jobs['doc.projectResources.migrate']) {
    if (input.migrationId) {
      await this.migrate(input.migrationId);
    } else {
      await this.models.projectResourceMigration.discover();
      for (const row of await this.models.projectResourceMigration.queued())
        await this.jobs.add(
          'doc.projectResources.migrate',
          { migrationId: row.id },
          { jobId: `project-migration-${row.id}` }
        );
    }
    return JOB_SIGNAL.Done;
  }

  async migrate(id: string) {
    const row = await this.models.projectResourceMigration.acquire(id);
    if (!row?.leaseId) return;
    const lease = { id: row.id, leaseId: row.leaseId, attempt: row.attempt };
    let authorized = false;
    try {
      await this.models.projectResourceMigration.execute(
        lease,
        async current => {
          const input = {
            projectId: current.projectId,
            actorId: current.actorId,
            workspaceId: current.sourceWorkspaceId,
            sourceResourceId: current.sourceResourceId,
          };
          await this.imports.authorizeSource(input);
          authorized = true;
          const office = await this.models.officeArtifact.get(
            input.workspaceId,
            input.sourceResourceId
          );
          const metadata = office
            ? null
            : await this.models.doc.getMeta(
                input.workspaceId,
                input.sourceResourceId
              );
          return this.imports.import({
            ...input,
            requestKey: `legacy-reference:${row.id}`,
            kind: office?.kind ?? (metadata?.mode === 1 ? 'edgeless' : 'page'),
          });
        }
      );
    } catch {
      await this.models.projectResourceMigration.fail(
        lease,
        authorized ? 'source_or_copy_unavailable' : 'authorization_required'
      );
    }
  }
}

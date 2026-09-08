import { Injectable } from '@nestjs/common';
import { type OfficeArtifactKind, Prisma } from '@prisma/client';
import { z } from 'zod';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import type { ProjectActor } from './project-resource';

export const PROJECT_WORKSPACE_IMPORT_WORKFLOW =
  'agent_runtime_project_workspace_import';
export const projectWorkspaceImportCommand = z
  .object({
    version: z.literal('project-workspace-import/v1'),
    workspaceId: z.string().min(1).max(256),
    sourceResourceId: z.string().min(1).max(256),
    parentId: z.string().min(1).max(256).nullable(),
    kind: z.enum([
      'page',
      'edgeless',
      'file',
      'document',
      'workbook',
      'presentation',
      'pdf',
    ]),
    title: z.string().max(512),
    accessRequestId: z.string().nullable(),
    requestHash: z.string().length(64),
  })
  .strict();

@Injectable()
export class ProjectWorkspaceImportModel extends BaseModel {
  workspaces(actorId: string, after: string, limit: number) {
    return this.db.$queryRaw<{ id: string; name: string | null }[]>`
      SELECT id, name FROM workspaces workspace
      WHERE id COLLATE "C" > ${after}
        AND (EXISTS (SELECT 1 FROM workspace_members member
          WHERE member.workspace_id = workspace.id AND member.user_id = ${actorId} AND member.state = 'active')
        OR EXISTS (SELECT 1 FROM doc_grants grant_row
          WHERE grant_row.workspace_id = workspace.id AND grant_row.principal_type = 'user' AND grant_row.principal_id = ${actorId} AND grant_row.role <> 'none'))
      ORDER BY id COLLATE "C" LIMIT ${limit}
    `;
  }

  sources(
    workspaceId: string,
    after: string,
    limit: number,
    readable: Prisma.Sql
  ) {
    return this.db.$queryRaw<
      {
        id: string;
        title: string | null;
        mode: number;
        kind: OfficeArtifactKind | null;
      }[]
    >(Prisma.sql`
      WITH candidates AS (
        SELECT guid AS id FROM snapshots WHERE workspace_id = ${workspaceId}
        UNION SELECT guid AS id FROM updates WHERE workspace_id = ${workspaceId}
        UNION SELECT id FROM office_artifacts WHERE workspace_id = ${workspaceId}
      )
      SELECT candidate.id, COALESCE(office.title, meta.title) AS title,
        COALESCE(meta.mode, 0) AS mode, office.kind::text AS kind
      FROM candidates candidate
      LEFT JOIN workspace_pages meta ON meta.workspace_id = ${workspaceId} AND meta.page_id = candidate.id
      LEFT JOIN office_artifacts office ON office.workspace_id = ${workspaceId} AND office.id = candidate.id
      WHERE candidate.id <> ${workspaceId} AND candidate.id COLLATE "C" > ${after}
        AND COALESCE(meta.blocked, false) = false AND ${readable}
      ORDER BY candidate.id COLLATE "C" LIMIT ${limit}
    `);
  }

  async list(
    input: ProjectActor & { parentId: string | null; cursor?: string }
  ) {
    await this.models.projectResource.assertMember(input);
    const cursor = input.cursor
      ? await this.models.copilotProjectAgentRuntime.get({
          ...input,
          runId: input.cursor,
        })
      : null;
    if (
      cursor &&
      (cursor.workflow !== PROJECT_WORKSPACE_IMPORT_WORKFLOW ||
        projectWorkspaceImportCommand.parse(
          cursor.steps.find(step => step.stepKey === 'execute')?.input
        ).parentId !== input.parentId)
    )
      throw new BadRequest('Invalid import history cursor');
    const rows = await this.db.aiAgentRun.findMany({
      where: {
        projectId: input.projectId,
        actorId: input.actorId,
        workflow: PROJECT_WORKSPACE_IMPORT_WORKFLOW,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
        steps: {
          some: {
            stepKey: 'execute',
            input: {
              path: ['parentId'],
              equals: input.parentId ?? Prisma.AnyNull,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
    });
    return {
      items: await Promise.all(
        rows.slice(0, 30).map(row =>
          this.models.copilotProjectAgentRuntime.get({
            ...input,
            runId: row.id,
          })
        )
      ),
      nextCursor: rows.length > 30 ? rows[29].id : null,
    };
  }
}

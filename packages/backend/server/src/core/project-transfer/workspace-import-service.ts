import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { type OfficeArtifactKind, Prisma } from '@prisma/client';
import { chunk } from 'lodash-es';
import { z } from 'zod';

import { BadRequest } from '../../base';
import { Models } from '../../models';
import type { ProjectAgentRun } from '../../models/copilot-project-agent-runtime';
import {
  type ProjectActor,
  projectResourceHash,
} from '../../models/project-resource';
import {
  PROJECT_WORKSPACE_IMPORT_WORKFLOW,
  projectWorkspaceImportCommand,
} from '../../models/project-workspace-import';
import { DocReader } from '../doc';
import { readFileCopySnapshot } from '../doc/copy-snapshot';
import { PermissionAccess, PermissionService } from '../permission';
import { ProjectImportService } from './import-service';

const selectionSchema = z
  .object({
    projectId: z.string().min(1).max(256),
    actorId: z.string().min(1).max(256),
    workspaceId: z.string().min(1).max(256),
    sourceResourceId: z.string().min(1).max(256),
    parentId: z.string().min(1).max(256).nullable(),
    requestKey: z.string().trim().min(1).max(256),
    requestApproval: z.boolean(),
  })
  .strict();
const cursorSchema = z
  .object({ scope: z.string(), query: z.string(), after: z.string().max(256) })
  .strict();
function page(scope: string, query = '', cursor?: string | null) {
  query = query.trim();
  if (query.length > 128 || (cursor?.length ?? 0) > 2048)
    throw new BadRequest('Invalid import page');
  if (!cursor) return { query, after: '' };
  try {
    const value = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    );
    if (value.scope !== scope || value.query !== query) throw new Error();
    return { query, after: value.after };
  } catch {
    throw new BadRequest('Invalid import page cursor');
  }
}
function next(scope: string, query: string, after: string) {
  return Buffer.from(JSON.stringify({ scope, query, after })).toString(
    'base64url'
  );
}

@Injectable()
export class ProjectWorkspaceImportService {
  constructor(
    private readonly models: Models,
    private readonly ac: PermissionAccess,
    private readonly permissions: PermissionService,
    private readonly reader: DocReader,
    private readonly imports: ProjectImportService
  ) {}

  async workspaces(input: ProjectActor & { cursor?: string | null }) {
    await this.models.projectResource.assertMember(input);
    const scope = `${input.projectId}:workspaces`;
    const { after } = page(scope, '', input.cursor);
    const rows = await this.models.projectWorkspaceImport.workspaces(
      input.actorId,
      after,
      30
    );
    const items: { id: string; name: string }[] = [];
    for (const row of rows) {
      if (
        await this.ac
          .user(input.actorId)
          .workspace(row.id)
          .can('Workspace.Read')
      )
        items.push({
          id: row.id,
          name:
            row.name ||
            (await this.reader.getWorkspaceContent(row.id))?.name ||
            '',
        });
    }
    await this.models.projectResource.assertMember(input);
    return {
      items,
      nextCursor: rows.length === 30 ? next(scope, '', rows[29].id) : null,
    };
  }

  async sources(
    input: ProjectActor & {
      workspaceId: string;
      query?: string;
      cursor?: string | null;
    }
  ) {
    await this.models.projectResource.assertMember(input);
    await this.ac
      .user(input.actorId)
      .workspace(input.workspaceId)
      .assert('Workspace.Read');
    const scope = `${input.projectId}:${input.workspaceId}`;
    const { query, after } = page(scope, input.query, input.cursor);
    const rows = await this.models.projectWorkspaceImport.sources(
      input.workspaceId,
      after,
      30,
      this.permissions.docReadableSqlPredicate({
        userId: input.actorId,
        workspaceId: input.workspaceId,
        action: 'Doc.Read',
        projectId: null,
        docIdColumn: Prisma.sql`candidate.id`,
      })
    );
    const decisions = await this.permissions.batchDocPermissions({
      userId: input.actorId,
      workspaceId: input.workspaceId,
      projectId: null,
      docs: rows.map(row => ({
        docId: row.id,
        actions: ['Doc.Read', 'Doc.Copy', 'Doc.Duplicate'],
      })),
    });
    const allowed = new Map(
      decisions.map(doc => [
        doc.docId,
        new Set(
          doc.decisions.filter(item => item.allowed).map(item => item.action)
        ),
      ])
    );
    const sharing = await this.models.workspace.allowSharing(input.workspaceId);
    const items = [];
    // Bound document reads without serializing the whole page behind every file.
    for (const batch of chunk(rows, 4)) {
      const sources = await Promise.all(
        batch.map(async row => {
          const actions = allowed.get(row.id);
          if (!actions?.has('Doc.Read')) return null;
          const sourceInput = { ...input, sourceResourceId: row.id };
          const source = await this.describeResource(sourceInput, row);
          if (
            !source?.title
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase())
          )
            return null;
          let permission: 'direct' | 'approval' | 'blocked' = 'blocked';
          if (
            sharing &&
            actions.has('Doc.Copy') &&
            actions.has('Doc.Duplicate')
          ) {
            try {
              await this.models.intelligenceWorkbenchAuthorization.inspectProjectCopyPermission(
                {
                  ...sourceInput,
                  docId: row.id,
                }
              );
              permission = 'direct';
            } catch (error) {
              if (!(error instanceof BadRequest)) throw error;
              permission = 'approval';
            }
          }
          return { ...source, permission };
        })
      );
      items.push(...sources.filter(source => source !== null));
    }
    // Recheck all returned documents together after reading content, without caching ACL.
    const readable = await this.permissions.filterReadableDocs({
      userId: input.actorId,
      workspaceId: input.workspaceId,
      projectId: null,
      docs: items.map(item => ({ ...item, docId: item.id })),
    });
    await this.ac
      .user(input.actorId)
      .workspace(input.workspaceId)
      .assert('Workspace.Read');
    await this.models.projectResource.assertMember(input);
    return {
      items: readable.map(({ docId: _, ...source }) => source),
      nextCursor: rows.length === 30 ? next(scope, query, rows[29].id) : null,
    };
  }

  private async describe(
    input: ProjectActor & { workspaceId: string; sourceResourceId: string }
  ) {
    if (input.workspaceId === input.sourceResourceId)
      throw new BadRequest('Workspace root documents cannot be imported');
    const access = this.ac
      .user(input.actorId)
      .doc(input.workspaceId, input.sourceResourceId)
      .projectScope(null);
    await access.assert('Doc.Read');
    const meta = await this.models.doc.getMeta(
      input.workspaceId,
      input.sourceResourceId
    );
    if (meta?.blocked) throw new BadRequest('Source document is unavailable');
    const native = await this.models.officeArtifact.get(
      input.workspaceId,
      input.sourceResourceId
    );
    const source = await this.describeResource(input, {
      kind: native?.kind ?? null,
      title: native?.title ?? meta?.title ?? null,
      mode: meta?.mode ?? 0,
    });
    if (!source) return null;
    let permission: 'direct' | 'approval' | 'blocked' = 'blocked';
    if (
      (await this.models.workspace.allowSharing(input.workspaceId)) &&
      (await access.can('Doc.Copy')) &&
      (await access.can('Doc.Duplicate'))
    ) {
      try {
        await this.models.intelligenceWorkbenchAuthorization.projectCopyPermission(
          { ...input, docId: input.sourceResourceId }
        );
        permission = 'direct';
      } catch (error) {
        if (!(error instanceof BadRequest)) throw error;
        permission = 'approval';
      }
    }
    await access.assert('Doc.Read');
    return { ...source, permission };
  }

  private async describeResource(
    input: { workspaceId: string; sourceResourceId: string },
    meta: {
      title: string | null;
      mode: number;
      kind: OfficeArtifactKind | null;
    }
  ) {
    let kind: z.infer<typeof projectWorkspaceImportCommand>['kind'] =
      meta.kind ?? 'page';
    let title = meta.title;
    if (!meta.kind) {
      const doc = await this.reader.getDoc(
        input.workspaceId,
        input.sourceResourceId
      );
      if (!doc || doc.bin.byteLength > 16 * 1024 * 1024) return null;
      // Workspace storage also contains metadata and incomplete document snapshots.
      // An unsupported snapshot must not prevent selecting other readable files.
      try {
        kind = readFileCopySnapshot(doc.bin)
          ? 'file'
          : meta.mode === 1
            ? 'edgeless'
            : 'page';
        title =
          meta.title ||
          this.reader.parseDocContent(doc.bin)?.title ||
          'Untitled';
      } catch {
        return null;
      }
    }
    return {
      id: input.sourceResourceId,
      title: (title || 'Untitled').slice(0, 512),
      kind,
    };
  }

  @Transactional()
  async submit(raw: z.input<typeof selectionSchema>) {
    const input = selectionSchema.parse(raw);
    await this.models.intelligenceWorkbenchAuthorization.lockProjectDocumentAuthorization(
      { ...input, docId: input.sourceResourceId }
    );
    await this.models.projectResource.assertMember(input, true);
    const requestKey = `workspace-import:${projectResourceHash([input.actorId, input.requestKey])}`;
    const requestHash = projectResourceHash({
      workspaceId: input.workspaceId,
      sourceResourceId: input.sourceResourceId,
      parentId: input.parentId,
      requestApproval: input.requestApproval,
    });
    const existing = await this.models.copilotProjectAgentRuntime.findRequest({
      ...input,
      sourceType: 'project_import',
      requestKey,
    });
    if (existing) {
      const command = projectWorkspaceImportCommand.parse(
        existing.steps.find(step => step.stepKey === 'execute')?.input
      );
      if (command.requestHash !== requestHash)
        throw new BadRequest('Import request was reused with different input');
      return existing;
    }
    if (input.parentId) {
      const parent = await this.models.projectResource.get({
        ...input,
        resourceId: input.parentId,
      });
      if (parent.kind !== 'folder' || parent.trashedAt)
        throw new BadRequest('Choose an available Project folder');
    }
    await this.ac
      .user(input.actorId)
      .workspace(input.workspaceId)
      .assert('Workspace.Read');
    const source = await this.describe(input);
    if (!source)
      throw new BadRequest(
        'Source document is unavailable or cannot be copied'
      );
    if (source.permission === 'blocked')
      throw new BadRequest('Source policy does not allow copying this file');
    if (source.permission === 'approval' && !input.requestApproval)
      throw new BadRequest(
        'Source permission changed; reload and request approval'
      );
    const approval =
      source.permission === 'approval'
        ? await this.models.intelligenceWorkbenchAuthorization.requestProjectCopy(
            {
              ...input,
              docId: input.sourceResourceId,
              requestKey,
              requestedTitle: source.title,
              expiresAt: new Date(Date.now() + 7 * 86400000),
            }
          )
        : null;
    return this.models.copilotProjectAgentRuntime.prepare({
      ...input,
      requestKey,
      sourceType: 'project_import',
      workflow: PROJECT_WORKSPACE_IMPORT_WORKFLOW,
      title: source.title,
      status: approval ? 'waiting_approval' : 'queued',
      command: {
        version: 'project-workspace-import/v1',
        workspaceId: input.workspaceId,
        sourceResourceId: input.sourceResourceId,
        parentId: input.parentId,
        kind: source.kind,
        title: source.title,
        accessRequestId: approval?.request.id ?? null,
        requestHash,
      },
    });
  }

  async retry(input: ProjectActor & { runId: string }) {
    const run = await this.models.copilotProjectAgentRuntime.get(input);
    if (run.workflow !== PROJECT_WORKSPACE_IMPORT_WORKFLOW)
      throw new BadRequest('Import task is unavailable');
    const command = projectWorkspaceImportCommand.parse(
      run.steps.find(step => step.stepKey === 'execute')?.input
    );
    await this.ac
      .user(input.actorId)
      .workspace(command.workspaceId)
      .assert('Workspace.Read');
    await this.ac
      .user(input.actorId)
      .doc(command.workspaceId, command.sourceResourceId)
      .projectScope(null)
      .assert('Doc.Read');
    await this.imports.authorizeSource({ ...input, ...command });
    return this.models.copilotProjectAgentRuntime.retryWorkspaceImport(input);
  }

  async execute(run: ProjectAgentRun) {
    const command = projectWorkspaceImportCommand.parse(
      run.steps.find(step => step.stepKey === 'execute')?.input
    );
    const input = {
      projectId: run.projectId,
      actorId: run.actorId,
      ...command,
    };
    await this.ac
      .user(run.actorId)
      .workspace(command.workspaceId)
      .assert('Workspace.Read');
    // An approved Project grant must not replace the importer's personal read access.
    await this.ac
      .user(run.actorId)
      .doc(command.workspaceId, command.sourceResourceId)
      .projectScope(null)
      .assert('Doc.Read');
    const resource = await this.imports.import({
      ...input,
      requestKey: `import-task:${run.id}`,
    });
    await this.ac
      .user(run.actorId)
      .doc(command.workspaceId, command.sourceResourceId)
      .projectScope(null)
      .assert('Doc.Read');
    await this.ac
      .user(run.actorId)
      .workspace(command.workspaceId)
      .assert('Workspace.Read');
    return {
      version: 'project-workspace-import-receipt/v1',
      resourceId: resource.id,
      accessRequestId: command.accessRequestId,
    };
  }
}

import { Logger } from '@nestjs/common';
import { z } from 'zod';

import type {
  WorkspaceDataOperation,
  WorkspaceDataTable,
  WorkspaceOrganizationService,
  WorkspaceRootOperation,
} from '../../../core/doc';
import type {
  PermissionAccess,
  PermissionService,
} from '../../../core/permission';
import { createReadableDocIdsLoader } from '../tools/doc-keyword-search';
import {
  defineTool,
  DESTRUCTIVE_WRITE_TOOL,
  READ_ONLY_TOOL,
  RESULT_OUTPUT_SCHEMA,
  toolError,
  toolResult,
  type WorkspaceMcpToolDefinition,
  WRITE_TOOL,
} from './types';

type WorkspaceToolDependencies = {
  ac: PermissionAccess;
  permission: PermissionService;
  organization: WorkspaceOrganizationService;
  logger: Logger;
};

const jsonObject = z.record(z.string(), z.unknown());

const rootOperation = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('set_workspace_profile'),
      name: z.string().min(1).max(256).optional(),
      avatar: z.string().max(512).nullable().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('set_document_trashed'),
      docId: z.string().min(1),
      trashed: z.boolean(),
    })
    .strict(),
  z
    .object({
      op: z.literal('create_tag'),
      id: z.string().min(1).optional(),
      value: z.string().min(1).max(256),
      color: z.string().min(1).max(64),
      parentId: z.string().min(1).nullable().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update_tag'),
      tagId: z.string().min(1),
      value: z.string().min(1).max(256).optional(),
      color: z.string().min(1).max(64).optional(),
      parentId: z.string().min(1).nullable().optional(),
    })
    .strict(),
  z.object({ op: z.literal('delete_tag'), tagId: z.string().min(1) }).strict(),
  z
    .object({
      op: z.literal('set_document_tags'),
      docId: z.string().min(1),
      tagIds: z.array(z.string().min(1)).max(100),
    })
    .strict(),
  z
    .object({
      op: z.literal('create_collection'),
      id: z.string().min(1).optional(),
      name: z.string().max(256),
      rules: jsonObject.optional(),
      allowList: z.array(z.string().min(1)).max(1000).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update_collection'),
      collectionId: z.string().min(1),
      name: z.string().max(256).optional(),
      rules: jsonObject.optional(),
      allowList: z.array(z.string().min(1)).max(1000).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('delete_collection'),
      collectionId: z.string().min(1),
    })
    .strict(),
]);

const dataTable = z.enum([
  'folders',
  'document_properties',
  'workspace_properties',
  'pinned_collections',
  'explorer_icons',
  'favorites',
  'user_settings',
]);

const dataOperation = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('upsert'),
      key: z.string().min(1).max(512),
      values: jsonObject,
    })
    .strict(),
  z
    .object({ op: z.literal('delete'), key: z.string().min(1).max(512) })
    .strict(),
]);

function asObjects(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function filterOrganization(
  raw: Record<string, unknown>,
  readableDocIds: Set<string>
) {
  const documents = asObjects(raw.documents).filter(
    document =>
      typeof document.id === 'string' && readableDocIds.has(document.id)
  );
  const collections = asObjects(raw.collections).map(collection => ({
    ...collection,
    allowList: Array.isArray(collection.allowList)
      ? collection.allowList.filter(
          docId => typeof docId === 'string' && readableDocIds.has(docId)
        )
      : [],
  }));
  const folders = asObjects(raw.folders).filter(folder => {
    if (folder.type !== 'doc') return true;
    return typeof folder.data === 'string' && readableDocIds.has(folder.data);
  });
  const documentProperties = asObjects(raw.documentProperties).filter(
    record => typeof record.id === 'string' && readableDocIds.has(record.id)
  );
  const favorites = asObjects(raw.favorites).filter(record => {
    if (typeof record.key !== 'string' || !record.key.startsWith('doc:')) {
      return true;
    }
    return readableDocIds.has(record.key.slice(4));
  });
  const explorerIcons = asObjects(raw.explorerIcons).filter(record => {
    if (typeof record.id !== 'string' || !record.id.startsWith('doc:')) {
      return true;
    }
    return readableDocIds.has(record.id.slice(4));
  });
  return {
    ...raw,
    documents,
    collections,
    folders,
    documentProperties,
    favorites,
    explorerIcons,
  };
}

export function createWorkspaceMcpTools(
  dependencies: WorkspaceToolDependencies,
  userId: string,
  workspaceId: string
) {
  const { ac, logger, organization, permission } = dependencies;
  const loadReadableDocIds = createReadableDocIdsLoader(permission);

  const assertReadableReferences = async (docIds: string[]) => {
    const readable = new Set(await loadReadableDocIds({ userId, workspaceId }));
    for (const docId of docIds) {
      if (!readable.has(docId)) {
        throw new Error(`Document ${docId} is not readable.`);
      }
    }
  };

  const assertRootOperations = async (operations: WorkspaceRootOperation[]) => {
    for (const operation of operations) {
      switch (operation.op) {
        case 'set_workspace_profile':
          if (operation.name === undefined && operation.avatar === undefined) {
            throw new Error('name or avatar is required.');
          }
          await ac
            .user(userId)
            .workspace(workspaceId)
            .assert('Workspace.Settings.Update');
          break;
        case 'set_document_trashed':
          await ac
            .user(userId)
            .workspace(workspaceId)
            .doc(operation.docId)
            .assert(operation.trashed ? 'Doc.Trash' : 'Doc.Restore');
          break;
        case 'set_document_tags':
          await ac
            .user(userId)
            .workspace(workspaceId)
            .doc(operation.docId)
            .assert('Doc.Properties.Update');
          break;
        case 'create_tag':
          await ac
            .user(userId)
            .workspace(workspaceId)
            .assert('Workspace.Properties.Create');
          break;
        case 'update_tag':
          await ac
            .user(userId)
            .workspace(workspaceId)
            .assert('Workspace.Properties.Update');
          break;
        case 'delete_tag':
          await ac
            .user(userId)
            .workspace(workspaceId)
            .assert('Workspace.Properties.Delete');
          break;
        case 'create_collection':
        case 'update_collection':
        case 'delete_collection':
          await ac.user(userId).workspace(workspaceId).assert('Workspace.Sync');
          if (operation.op !== 'delete_collection' && operation.allowList) {
            await assertReadableReferences(operation.allowList);
          }
          break;
      }
    }
  };

  const assertDataOperations = async (
    table: WorkspaceDataTable,
    operations: WorkspaceDataOperation[]
  ) => {
    if (table === 'favorites' || table === 'user_settings') {
      await ac.user(userId).workspace(workspaceId).assert('Workspace.Read');
      if (table === 'favorites') {
        const docIds = operations.flatMap(operation =>
          operation.key.startsWith('doc:') ? [operation.key.slice(4)] : []
        );
        await assertReadableReferences(docIds);
      }
      return;
    }
    if (table === 'document_properties') {
      for (const operation of operations) {
        await ac
          .user(userId)
          .workspace(workspaceId)
          .doc(operation.key)
          .assert('Doc.Properties.Update');
      }
      return;
    }
    if (table === 'workspace_properties') {
      for (const operation of operations) {
        await ac
          .user(userId)
          .workspace(workspaceId)
          .assert(
            operation.op === 'delete'
              ? 'Workspace.Properties.Delete'
              : 'Workspace.Properties.Update'
          );
      }
      return;
    }
    await ac.user(userId).workspace(workspaceId).assert('Workspace.Sync');
    if (table === 'folders') {
      const docIds = operations.flatMap(operation =>
        operation.op === 'upsert' && operation.values.type === 'doc'
          ? [operation.values.data]
          : []
      );
      if (docIds.some(docId => typeof docId !== 'string')) {
        throw new Error('Folder document links require a string data id.');
      }
      await assertReadableReferences(docIds as string[]);
    }
  };

  const readTools: WorkspaceMcpToolDefinition[] = [
    defineTool({
      name: 'read_workspace_organization',
      title: 'Read Workspace Organization',
      description:
        'Read the authorized workspace profile, document metadata, trash state, tags, collections, favorites, folders, document/custom properties, pinned collections, explorer icons, and personal workspace settings.',
      parser: z.object({}).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async () => {
        await ac
          .user(userId)
          .workspace(workspaceId)
          .assert('Workspace.Organize.Read');
        const readableDocIds = new Set(
          await loadReadableDocIds({ userId, workspaceId })
        );
        const result = await organization.readOrganization(workspaceId, userId);
        return toolResult(
          filterOrganization(
            result as unknown as Record<string, unknown>,
            readableDocIds
          )
        );
      },
    }),
  ];

  const writeTools: WorkspaceMcpToolDefinition[] = [
    defineTool({
      name: 'apply_workspace_organization_operations',
      title: 'Apply Workspace Organization Operations',
      description:
        'Atomically update workspace profile metadata, trash/restore documents, create/update/delete tags, assign document tags, and create/update/delete collections using the native workspace root CRDT.',
      parser: z
        .object({ operations: z.array(rootOperation).min(1).max(100) })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ operations }) => {
        try {
          await assertRootOperations(operations as WorkspaceRootOperation[]);
          return toolResult(
            await organization.withAiSourceCheck(
              { workspaceId, actorId: userId },
              () =>
                organization.applyRootOperations(
                  workspaceId,
                  userId,
                  operations as WorkspaceRootOperation[]
                )
            )
          );
        } catch (error) {
          logger.warn(
            `Rejected workspace organization update ${workspaceId}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return toolError(
            error instanceof Error
              ? `Workspace organization update rejected: ${error.message}`
              : 'Workspace organization update rejected.'
          );
        }
      },
    }),
    defineTool({
      name: 'apply_workspace_data_operations',
      title: 'Apply Workspace Data Operations',
      description:
        'Upsert or delete records in one supported LocalMind workspace data table: folders, document properties, workspace properties, pinned collections, explorer icons, personal favorites, or personal workspace settings.',
      parser: z
        .object({
          table: dataTable,
          operations: z.array(dataOperation).min(1).max(100),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: WRITE_TOOL,
      execute: async ({ table, operations }) => {
        try {
          await assertDataOperations(
            table as WorkspaceDataTable,
            operations as WorkspaceDataOperation[]
          );
          const apply = () =>
            organization.applyDataOperations(
              workspaceId,
              userId,
              userId,
              table as WorkspaceDataTable,
              operations as WorkspaceDataOperation[]
            );
          return toolResult(
            await (table === 'favorites' || table === 'user_settings'
              ? apply()
              : organization.withAiSourceCheck(
                  { workspaceId, actorId: userId },
                  apply
                ))
          );
        } catch (error) {
          logger.warn(
            `Rejected workspace data update ${workspaceId}/${table}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return toolError(
            error instanceof Error
              ? `Workspace data update rejected: ${error.message}`
              : 'Workspace data update rejected.'
          );
        }
      },
    }),
  ];

  return { readTools, writeTools };
}

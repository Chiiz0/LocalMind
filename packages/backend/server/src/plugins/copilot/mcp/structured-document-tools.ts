import { Logger } from '@nestjs/common';
import { z } from 'zod';

import type {
  BlockOperation,
  DatabaseOperation,
  StructuredDocService,
  WhiteboardOperation,
} from '../../../core/doc/structured';
import type { DocWriter } from '../../../core/doc/writer';
import type { PermissionAccess } from '../../../core/permission';
import type { Models } from '../../../models';
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

type StructuredToolDependencies = {
  ac: PermissionAccess;
  logger: Logger;
  structured: StructuredDocService;
  models: Models;
  writer: DocWriter;
};

const jsonObject = z.record(z.string(), z.unknown());

const blockOperation = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('add'),
      flavour: z.string().min(1),
      id: z.string().min(1).optional(),
      parentId: z.string().min(1).optional(),
      index: z.number().int().min(0).optional(),
      props: jsonObject.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update'),
      blockId: z.string().min(1),
      props: jsonObject,
    })
    .strict(),
  z
    .object({
      op: z.literal('move'),
      blockIds: z.array(z.string().min(1)).min(1).max(100),
      parentId: z.string().min(1),
      targetSiblingId: z.string().min(1).optional(),
      before: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      op: z.literal('delete'),
      blockId: z.string().min(1),
      deleteChildren: z.boolean().optional(),
      bringChildrenTo: z.string().min(1).optional(),
    })
    .strict(),
]);

const whiteboardOperation = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('add_element'),
      surfaceId: z.string().min(1).optional(),
      type: z.enum([
        'brush',
        'connector',
        'group',
        'highlighter',
        'mindmap',
        'shape',
        'text',
      ]),
      props: jsonObject.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update_element'),
      surfaceId: z.string().min(1).optional(),
      elementId: z.string().min(1),
      props: jsonObject,
    })
    .strict(),
  z
    .object({
      op: z.literal('delete_element'),
      surfaceId: z.string().min(1).optional(),
      elementId: z.string().min(1),
    })
    .strict(),
]);

const databaseOperation = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('add_column'),
      id: z.string().min(1).optional(),
      index: z.number().int().min(0).optional(),
      name: z.string(),
      type: z.string().min(1),
      data: jsonObject.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update_column'),
      columnId: z.string().min(1),
      name: z.string().optional(),
      type: z.string().min(1).optional(),
      data: jsonObject.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('delete_column'),
      columnId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      op: z.literal('add_row'),
      id: z.string().min(1).optional(),
      index: z.number().int().min(0).optional(),
      title: z.string().optional(),
      cells: jsonObject.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update_row_title'),
      rowId: z.string().min(1),
      title: z.string(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update_cell'),
      rowId: z.string().min(1),
      columnId: z.string().min(1),
      value: z.unknown(),
    })
    .strict(),
  z.object({ op: z.literal('delete_row'), rowId: z.string().min(1) }).strict(),
  z
    .object({
      op: z.literal('add_view'),
      view: jsonObject,
      index: z.number().int().min(0).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('update_view'),
      viewId: z.string().min(1),
      patch: jsonObject,
    })
    .strict(),
  z
    .object({ op: z.literal('delete_view'), viewId: z.string().min(1) })
    .strict(),
]);

export function createStructuredDocumentMcpTools(
  dependencies: StructuredToolDependencies,
  userId: string,
  workspaceId: string
) {
  const { ac, logger, structured, models } = dependencies;

  const canRead = async (docId: string) =>
    await ac.user(userId).workspace(workspaceId).doc(docId).can('Doc.Read');
  const canUpdate = async (docId: string) =>
    await ac.user(userId).workspace(workspaceId).doc(docId).can('Doc.Update');

  const executeRead = async (
    docId: string,
    operation: () => Promise<unknown>
  ) => {
    if (!(await canRead(docId))) {
      return toolError(`Doc with id ${docId} not found.`);
    }
    try {
      return toolResult(await operation());
    } catch (error) {
      logger.warn(
        `Failed to read structured document ${workspaceId}/${docId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return toolError('Failed to read structured document content.');
    }
  };

  const executeWrite = async (
    docId: string,
    operation: () => Promise<unknown>
  ) => {
    if (!(await canUpdate(docId))) {
      return toolError(`Doc with id ${docId} not found.`);
    }
    try {
      return toolResult(
        await dependencies.writer.withDeferredBroadcasts(() =>
          models.copilotContext.withDocumentSourcesShared(
            {
              actorId: userId,
              sink: {
                type: 'tool_write',
                id: docId,
                documentId: docId,
                workspaceId,
                phase: 'execute',
              },
            },
            operation
          )
        )
      );
    } catch (error) {
      logger.warn(
        `Rejected structured document update ${workspaceId}/${docId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return toolError(
        error instanceof Error
          ? `Structured update rejected: ${error.message}`
          : 'Structured update rejected.'
      );
    }
  };

  const readTools: WorkspaceMcpToolDefinition[] = [
    defineTool({
      name: 'read_document_blocks',
      title: 'Read Document Blocks',
      description:
        'Read the complete authorized BlockSuite block tree with structured properties, including page, note, frame, embed, image, attachment, table, and database blocks.',
      parser: z.object({ docId: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ docId }) =>
        await executeRead(docId, () =>
          structured.readBlocks(workspaceId, docId)
        ),
    }),
    defineTool({
      name: 'read_whiteboard',
      title: 'Read Whiteboard',
      description:
        'Read all whiteboard surfaces, shapes, text, connectors, brushes, groups, mind maps, notes, frames, and edgeless text in an authorized document.',
      parser: z.object({ docId: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ docId }) =>
        await executeRead(docId, () =>
          structured.readWhiteboard(workspaceId, docId)
        ),
    }),
    defineTool({
      name: 'read_databases',
      title: 'Read Databases',
      description:
        'Read database blocks, columns, views, rows, and cells from an authorized document.',
      parser: z.object({ docId: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ docId }) =>
        await executeRead(docId, () =>
          structured.readDatabases(workspaceId, docId)
        ),
    }),
  ];

  const writeTools: WorkspaceMcpToolDefinition[] = [
    defineTool({
      name: 'apply_document_block_operations',
      title: 'Apply Document Block Operations',
      description:
        'Atomically add, update, move, or delete BlockSuite blocks through structured operations. Use read_document_blocks first to inspect ids and properties.',
      parser: z
        .object({
          docId: z.string().min(1),
          operations: z.array(blockOperation).min(1).max(100),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ docId, operations }) =>
        await executeWrite(docId, () =>
          structured.applyBlockOperations(
            workspaceId,
            docId,
            userId,
            operations as BlockOperation[]
          )
        ),
    }),
    defineTool({
      name: 'apply_whiteboard_operations',
      title: 'Apply Whiteboard Operations',
      description:
        'Atomically add, update, or delete whiteboard shapes, text, connectors, brushes, highlighters, groups, and mind maps. Notes and frames are ordinary blocks managed with apply_document_block_operations.',
      parser: z
        .object({
          docId: z.string().min(1),
          operations: z.array(whiteboardOperation).min(1).max(100),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ docId, operations }) =>
        await executeWrite(docId, () =>
          structured.applyWhiteboardOperations(
            workspaceId,
            docId,
            userId,
            operations as WhiteboardOperation[]
          )
        ),
    }),
    defineTool({
      name: 'apply_database_operations',
      title: 'Apply Database Operations',
      description:
        'Atomically add, update, or delete database columns, rows, cells, and views in an authorized document.',
      parser: z
        .object({
          docId: z.string().min(1),
          databaseId: z.string().min(1),
          operations: z.array(databaseOperation).min(1).max(100),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: { ...WRITE_TOOL, destructiveHint: true },
      execute: async ({ docId, databaseId, operations }) =>
        await executeWrite(docId, () =>
          structured.applyDatabaseOperations(
            workspaceId,
            docId,
            databaseId,
            userId,
            operations as DatabaseOperation[]
          )
        ),
    }),
  ];

  return { readTools, writeTools };
}

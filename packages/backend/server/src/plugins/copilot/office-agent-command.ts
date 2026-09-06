import {
  type OfficeAiContext,
  type OfficeCommand,
  type OfficeCommandBatch,
  parseOfficeAiContext,
  parseOfficeCommand,
  parseOfficeCommandBatch,
} from '@localmind/office';
import { expandCellRange } from '@localmind/office/xlsx';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { readBufferWithLimit } from '../../base';
import {
  OfficeArtifactService,
  OfficeCommandService,
  officeFingerprint,
  officeJsonFingerprint,
} from '../../core/office';
import { WorkspaceBlobStorage } from '../../core/storage';
import {
  Models,
  OFFICE_COMMAND_BLOB_MIME,
  OFFICE_COMMAND_MAX_BYTES,
} from '../../models';
import type {
  CopilotAgentRunRecord,
  CopilotAgentStepRecord,
} from '../../models/copilot-agent-runtime';
import {
  type CopilotAgentRuntimeWorkflowAdapterInput,
  CopilotAgentRuntimeWorkflowRegistry,
} from './agent-runtime-workflow-registry';

export const AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW =
  'agent_runtime_office_command';
export const AGENT_RUNTIME_OFFICE_COMMAND_REQUEST_VERSION =
  'agent-runtime-office-command-request/v1';

const MAX_AI_STATE_BYTES = 1024 * 1024;
const MAX_AI_READ_ITEMS = 200;

export const OfficeAiReadSelectorSchema = z.union([
  z
    .object({
      kind: z.literal('document'),
      block_ids: z.array(z.string().trim().min(1).max(512)).max(200).optional(),
      query: z.string().trim().min(1).max(512).optional(),
      include_styles: z.boolean().optional(),
      limit: z.number().int().min(1).max(MAX_AI_READ_ITEMS).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('workbook'),
      sheet_id: z.string().trim().min(1).max(512),
      range: z.string().trim().min(1).max(128).optional(),
      include_styles: z.boolean().optional(),
      limit: z.number().int().min(1).max(5000).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('presentation'),
      slide_id: z.string().trim().min(1).max(512),
      shape_ids: z.array(z.string().trim().min(1).max(512)).max(500).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('pdf'),
      page_index: z.number().int().min(0).max(1_000_000),
      include_form_fields: z.boolean().optional(),
    })
    .strict(),
]);

export type OfficeAiReadSelector = z.infer<typeof OfficeAiReadSelectorSchema>;

export type RequestOfficeAgentCommandInput = {
  workspaceId: string;
  actorId: string;
  sessionId?: string | null;
  command: unknown;
  title?: string | null;
  reason?: string | null;
};

export type RequestOfficeAgentCommandBatchInput = {
  workspaceId: string;
  actorId: string;
  sessionId?: string | null;
  batch: unknown;
  title?: string | null;
  reason?: string | null;
};

type OfficeAgentCommandPayload =
  | { kind: 'command'; command: OfficeCommand }
  | { kind: 'batch'; batch: OfficeCommandBatch };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function documentBlockChildren(block: Record<string, unknown>) {
  if (block.type === 'contentControl') return recordArray(block.blocks);
  if (block.type !== 'table') return [];
  return recordArray(block.rows).flatMap(row =>
    recordArray(row.cells).flatMap(cell => recordArray(cell.blocks))
  );
}

function walkDocumentBlocks(
  blocks: readonly Record<string, unknown>[],
  visit: (block: Record<string, unknown>) => boolean
) {
  for (const block of blocks) {
    if (!visit(block)) return false;
    if (!walkDocumentBlocks(documentBlockChildren(block), visit)) return false;
  }
  return true;
}

function officeStateIndex(state: Record<string, unknown>) {
  switch (state.schemaVersion) {
    case 'localmind-office-docx-state/v1': {
      const paragraphs: Array<{ id: string; text: string }> = [];
      walkDocumentBlocks(recordArray(state.body), block => {
        if (block.type === 'paragraph' && typeof block.id === 'string') {
          paragraphs.push({
            id: block.id,
            text:
              typeof block.text === 'string'
                ? block.text.replace(/\s+/g, ' ').slice(0, 240)
                : '',
          });
        }
        return paragraphs.length < MAX_AI_READ_ITEMS;
      });
      return {
        kind: 'document',
        sections: recordArray(state.sections),
        paragraphs,
        stats: state.stats,
      };
    }
    case 'localmind-office-xlsx-state/v1':
      return {
        kind: 'workbook',
        sheets: recordArray(state.sheets)
          .slice(0, MAX_AI_READ_ITEMS)
          .map(sheet => ({
            id: sheet.id,
            name: sheet.name,
            dimension: sheet.dimension,
            cells: recordArray(sheet.cells).length,
            tables: recordArray(sheet.tables).length,
            charts: recordArray(sheet.charts).length,
          })),
        stats: state.stats,
      };
    case 'localmind-office-pptx-state/v1':
      return {
        kind: 'presentation',
        slides: recordArray(state.slides)
          .slice(0, MAX_AI_READ_ITEMS)
          .map((slide, index) => ({
            id: slide.id,
            index,
            name: slide.name,
            shapes: recordArray(slide.shapes).length,
            notesPreview:
              typeof slide.notesText === 'string'
                ? slide.notesText.replace(/\s+/g, ' ').slice(0, 240)
                : undefined,
          })),
        stats: state.stats,
      };
    case 'localmind-office-pdf-state/v1':
      return {
        kind: 'pdf',
        pages: recordArray(state.pages)
          .slice(0, MAX_AI_READ_ITEMS)
          .map((page, index) => ({
            id: page.id,
            index,
            widthPt: page.widthPt,
            heightPt: page.heightPt,
            rotationDeg: page.rotationDeg,
            annotations: recordArray(page.annotations).length,
          })),
        formFields: recordArray(state.formFields).length,
        stats: state.stats,
      };
    default:
      throw new Error('Office semantic state schema is unsupported');
  }
}

function projectDocumentState(
  state: Record<string, unknown>,
  selector: Extract<OfficeAiReadSelector, { kind: 'document' }>
) {
  if (state.schemaVersion !== 'localmind-office-docx-state/v1') {
    throw new Error('Office read selector does not match document state');
  }
  const ids = new Set(selector.block_ids ?? []);
  const query = selector.query?.toLocaleLowerCase();
  const limit = selector.limit ?? 100;
  const blocks: Record<string, unknown>[] = [];
  const matches = (block: Record<string, unknown>) => {
    if (ids.size && typeof block.id === 'string' && ids.has(block.id)) {
      return true;
    }
    if (query && typeof block.text === 'string') {
      return block.text.toLocaleLowerCase().includes(query);
    }
    return !ids.size && !query && block.type === 'paragraph';
  };
  walkDocumentBlocks(recordArray(state.body), block => {
    if (matches(block)) blocks.push(block);
    return blocks.length < limit;
  });
  for (const story of recordArray(state.stories)) {
    if (blocks.length >= limit) break;
    walkDocumentBlocks(recordArray(story.blocks), block => {
      if (matches(block)) {
        blocks.push({
          ...block,
          story: {
            kind: story.kind,
            type: story.type,
            part: story.part,
          },
        });
      }
      return blocks.length < limit;
    });
  }
  return {
    schemaVersion: state.schemaVersion,
    modelVersion: state.modelVersion,
    sections: state.sections,
    references: state.references,
    review: state.review,
    blocks,
    ...(selector.include_styles ? { styles: state.styles } : {}),
  };
}

function projectWorkbookState(
  state: Record<string, unknown>,
  selector: Extract<OfficeAiReadSelector, { kind: 'workbook' }>
) {
  if (state.schemaVersion !== 'localmind-office-xlsx-state/v1') {
    throw new Error('Office read selector does not match workbook state');
  }
  const sheet = recordArray(state.sheets).find(
    candidate => candidate.id === selector.sheet_id
  );
  if (!sheet)
    throw new Error(`Office worksheet not found: ${selector.sheet_id}`);
  const limit = selector.limit ?? 500;
  let addresses: Set<string> | undefined;
  if (selector.range) {
    const [start, end = start, extra] = selector.range.split(':');
    if (extra)
      throw new Error(`Office worksheet range is invalid: ${selector.range}`);
    addresses = new Set(expandCellRange(start, end, 5000));
  }
  const cells = recordArray(sheet.cells)
    .filter(cell =>
      addresses && typeof cell.address === 'string'
        ? addresses.has(cell.address)
        : true
    )
    .slice(0, limit);
  const projectedSheet = { ...sheet, cells };
  return {
    schemaVersion: state.schemaVersion,
    modelVersion: state.modelVersion,
    sheet: projectedSheet,
    definedNames: state.definedNames,
    ...(selector.include_styles ? { styles: state.styles } : {}),
  };
}

function flattenShapes(
  shapes: readonly Record<string, unknown>[],
  output: Record<string, unknown>[]
) {
  for (const shape of shapes) {
    output.push(shape);
    flattenShapes(recordArray(shape.children), output);
  }
}

function projectPresentationState(
  state: Record<string, unknown>,
  selector: Extract<OfficeAiReadSelector, { kind: 'presentation' }>
) {
  if (state.schemaVersion !== 'localmind-office-pptx-state/v1') {
    throw new Error('Office read selector does not match presentation state');
  }
  const slide = recordArray(state.slides).find(
    candidate => candidate.id === selector.slide_id
  );
  if (!slide) throw new Error(`Office slide not found: ${selector.slide_id}`);
  const allShapes: Record<string, unknown>[] = [];
  flattenShapes(recordArray(slide.shapes), allShapes);
  const shapeIds = new Set(selector.shape_ids ?? []);
  const shapes = allShapes
    .filter(shape =>
      shapeIds.size && typeof shape.id === 'string'
        ? shapeIds.has(shape.id)
        : true
    )
    .slice(0, selector.limit ?? 200);
  return {
    schemaVersion: state.schemaVersion,
    modelVersion: state.modelVersion,
    slide: { ...slide, shapes },
    slideSize: state.slideSize,
    masters: state.masters,
  };
}

function projectPdfState(
  state: Record<string, unknown>,
  selector: Extract<OfficeAiReadSelector, { kind: 'pdf' }>
) {
  if (state.schemaVersion !== 'localmind-office-pdf-state/v1') {
    throw new Error('Office read selector does not match PDF state');
  }
  const page = recordArray(state.pages)[selector.page_index];
  if (!page)
    throw new Error(`Office PDF page not found: ${selector.page_index}`);
  return {
    schemaVersion: state.schemaVersion,
    modelVersion: state.modelVersion,
    pageIndex: selector.page_index,
    page,
    ...(selector.include_form_fields ? { formFields: state.formFields } : {}),
  };
}

function projectOfficeState(
  state: Record<string, unknown>,
  selector: OfficeAiReadSelector
) {
  switch (selector.kind) {
    case 'document':
      return projectDocumentState(state, selector);
    case 'workbook':
      return projectWorkbookState(state, selector);
    case 'presentation':
      return projectPresentationState(state, selector);
    case 'pdf':
      return projectPdfState(state, selector);
  }
}

function requireDocumentBlock(
  blocks: Map<string, Record<string, unknown>>,
  blockId: string
) {
  const block = blocks.get(blockId);
  if (!block) {
    throw new Error(`Office document selection target not found: ${blockId}`);
  }
  return block;
}

function validateDocumentSelection(
  state: Record<string, unknown>,
  context: OfficeAiContext
) {
  if (state.schemaVersion !== 'localmind-office-docx-state/v1') {
    throw new Error('Office AI context does not match document state');
  }
  const selection = context.selection;
  if (!selection || selection.kind !== 'document') return;
  const orderedBlocks: Record<string, unknown>[] = [];
  const addBlocks = (blocks: readonly Record<string, unknown>[]) => {
    walkDocumentBlocks(blocks, block => {
      orderedBlocks.push(block);
      return true;
    });
  };
  addBlocks(recordArray(state.body));
  for (const story of recordArray(state.stories)) {
    addBlocks(recordArray(story.blocks));
  }
  const blocks = new Map(
    orderedBlocks.flatMap(block =>
      typeof block.id === 'string' ? [[block.id, block] as const] : []
    )
  );
  const order = new Map(
    orderedBlocks.flatMap((block, index) =>
      typeof block.id === 'string' ? [[block.id, index] as const] : []
    )
  );
  const target = selection.target;
  switch (target.type) {
    case 'text_range': {
      const start = requireDocumentBlock(blocks, target.start.blockId);
      const end = requireDocumentBlock(blocks, target.end.blockId);
      if (start.type !== 'paragraph' || end.type !== 'paragraph') {
        throw new Error(
          'Office document text selection must target paragraphs'
        );
      }
      const startLength =
        typeof start.text === 'string' ? start.text.length : 0;
      const endLength = typeof end.text === 'string' ? end.text.length : 0;
      if (target.start.offset > startLength || target.end.offset > endLength) {
        throw new Error('Office document text selection offset is stale');
      }
      if (
        (order.get(target.start.blockId) ?? -1) >
        (order.get(target.end.blockId) ?? -1)
      ) {
        throw new Error('Office document text selection order is invalid');
      }
      return;
    }
    case 'paragraph': {
      const block = requireDocumentBlock(blocks, target.blockId);
      if (block.type !== 'paragraph') {
        throw new Error('Office document paragraph selection is invalid');
      }
      return;
    }
    case 'section': {
      if (!recordArray(state.sections)[target.sectionIndex]) {
        throw new Error(
          `Office document section selection not found: ${target.sectionIndex}`
        );
      }
      return;
    }
    case 'run': {
      const block = requireDocumentBlock(blocks, target.blockId);
      if (
        block.type !== 'paragraph' ||
        !recordArray(block.runs)[target.runIndex]
      ) {
        throw new Error('Office document run selection is stale');
      }
    }
  }
}

function validateWorkbookSelection(
  state: Record<string, unknown>,
  context: OfficeAiContext
) {
  if (state.schemaVersion !== 'localmind-office-xlsx-state/v1') {
    throw new Error('Office AI context does not match workbook state');
  }
  const selection = context.selection;
  if (!selection || selection.kind !== 'workbook') return;
  const target = selection.target;
  const sheetId = 'sheetId' in target ? target.sheetId : undefined;
  const sheet = recordArray(state.sheets).find(item => item.id === sheetId);
  if (!sheet) {
    throw new Error(`Office worksheet selection not found: ${sheetId}`);
  }
  if (
    target.type === 'table' &&
    !recordArray(sheet.tables).some(table => table.id === target.tableId)
  ) {
    throw new Error(`Office table selection not found: ${target.tableId}`);
  }
  if (
    target.type === 'chart' &&
    !recordArray(sheet.charts).some(chart => chart.id === target.chartId)
  ) {
    throw new Error(`Office chart selection not found: ${target.chartId}`);
  }
}

function validatePresentationSelection(
  state: Record<string, unknown>,
  context: OfficeAiContext
) {
  if (state.schemaVersion !== 'localmind-office-pptx-state/v1') {
    throw new Error('Office AI context does not match presentation state');
  }
  const selection = context.selection;
  if (!selection || selection.kind !== 'presentation') return;
  const target = selection.target;
  const slide = recordArray(state.slides).find(
    candidate => candidate.id === target.slideId
  );
  if (!slide) {
    throw new Error(`Office slide selection not found: ${target.slideId}`);
  }
  if (target.type === 'shape' || target.type === 'placeholder') {
    const shapes: Record<string, unknown>[] = [];
    flattenShapes(recordArray(slide.shapes), shapes);
    const shape = shapes.find(candidate => candidate.id === target.shapeId);
    if (!shape) {
      throw new Error(`Office shape selection not found: ${target.shapeId}`);
    }
    if (
      target.type === 'placeholder' &&
      target.placeholderType &&
      shape.placeholderType !== target.placeholderType
    ) {
      throw new Error('Office placeholder selection type is stale');
    }
  }
}

function validatePdfSelection(
  state: Record<string, unknown>,
  context: OfficeAiContext
) {
  if (state.schemaVersion !== 'localmind-office-pdf-state/v1') {
    throw new Error('Office AI context does not match PDF state');
  }
  const selection = context.selection;
  if (!selection || selection.kind !== 'pdf') return;
  const target = selection.target;
  if (target.type === 'form_field') {
    if (
      !recordArray(state.formFields).some(
        field => field.name === target.fieldName
      )
    ) {
      throw new Error(
        `Office PDF form selection not found: ${target.fieldName}`
      );
    }
    return;
  }
  const page = recordArray(state.pages)[target.pageIndex];
  if (!page) {
    throw new Error(`Office PDF page selection not found: ${target.pageIndex}`);
  }
  if (
    target.type === 'annotation' &&
    !recordArray(page.annotations).some(
      annotation => annotation.id === target.annotationId
    )
  ) {
    throw new Error(
      `Office PDF annotation selection not found: ${target.annotationId}`
    );
  }
}

function validateOfficeSelection(
  state: Record<string, unknown>,
  context: OfficeAiContext
) {
  switch (context.artifactKind) {
    case 'document':
      return validateDocumentSelection(state, context);
    case 'workbook':
      return validateWorkbookSelection(state, context);
    case 'presentation':
      return validatePresentationSelection(state, context);
    case 'pdf':
      return validatePdfSelection(state, context);
  }
}

function boundedAiStateResult(value: unknown) {
  const byteSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
  return byteSize <= MAX_AI_STATE_BYTES
    ? { truncated: false as const, byteSize, state: value }
    : {
        truncated: true as const,
        byteSize,
        message:
          'The selected Office state exceeds the bounded AI read limit. Narrow the selector by stable block, range, shape, or page identifiers.',
      };
}

@Injectable()
export class OfficeAgentCommandService {
  constructor(
    private readonly models: Models,
    private readonly storage: WorkspaceBlobStorage,
    private readonly commands: OfficeCommandService,
    private readonly artifacts: OfficeArtifactService
  ) {}

  async request(input: RequestOfficeAgentCommandInput) {
    const command = parseOfficeCommand(input.command);
    if (command.source !== 'ai') {
      throw new Error('Office Agent Runtime commands must use source=ai');
    }
    return await this.requestPayload(input, { kind: 'command', command });
  }

  async requestBatch(input: RequestOfficeAgentCommandBatchInput) {
    const batch = parseOfficeCommandBatch(input.batch);
    if (batch.source !== 'ai') {
      throw new Error(
        'Office Agent Runtime command batches must use source=ai'
      );
    }
    return await this.requestPayload(input, { kind: 'batch', batch });
  }

  async validateAiContext(input: {
    workspaceId: string;
    actorId: string;
    context: unknown;
  }) {
    const context = parseOfficeAiContext(input.context);
    if (context.workspaceId !== input.workspaceId) {
      throw new Error('Office AI context workspace does not match the session');
    }
    const current = await this.artifacts.get(
      input.workspaceId,
      input.actorId,
      context.artifactId
    );
    if (current.artifact.kind !== context.artifactKind) {
      throw new Error(
        'Office AI context resource kind does not match artifact'
      );
    }
    if (current.revision.id !== context.revisionId) {
      throw new Error(
        `Office AI context revision conflict: expected current revision ${current.revision.id}`
      );
    }
    if (context.selection) {
      const asset = await this.artifacts.readRevisionAsset(
        input.workspaceId,
        input.actorId,
        context.artifactId,
        context.revisionId,
        'state'
      );
      let state: unknown;
      try {
        state = JSON.parse(asset.bytes.toString('utf8'));
      } catch {
        throw new Error(
          `Office semantic state is not valid JSON: ${context.revisionId}`
        );
      }
      if (!isRecord(state)) {
        throw new Error(
          `Office semantic state is invalid: ${context.revisionId}`
        );
      }
      validateOfficeSelection(state, context);
    }
    return { context, ...current };
  }

  private async requestPayload(
    input: Omit<RequestOfficeAgentCommandInput, 'command'>,
    payload: OfficeAgentCommandPayload
  ) {
    const value = payload.kind === 'command' ? payload.command : payload.batch;
    await this.models.copilotContext.assertDocumentSourcesShared({
      sessionId: input.sessionId,
      actorId: input.actorId,
      sink: {
        type: 'tool_write',
        id: value.artifactId,
        documentId: value.artifactId,
        workspaceId: input.workspaceId,
        phase: 'prepare',
      },
    });
    const preview =
      payload.kind === 'command'
        ? await this.commands.preview({
            workspaceId: input.workspaceId,
            actorId: input.actorId,
            command: payload.command,
          })
        : await this.commands.previewBatch({
            workspaceId: input.workspaceId,
            actorId: input.actorId,
            batch: payload.batch,
          });
    const commandBytes = Buffer.from(JSON.stringify(value), 'utf8');
    if (
      !commandBytes.byteLength ||
      commandBytes.byteLength > OFFICE_COMMAND_MAX_BYTES
    ) {
      throw new Error('Office command request exceeds its byte limit');
    }
    const commandFingerprint = officeFingerprint(commandBytes);
    const commandBlobKey = `office/command/${commandFingerprint.slice(
      'sha256:'.length
    )}.json`;
    await this.storage.put(input.workspaceId, commandBlobKey, commandBytes, {
      contentType: OFFICE_COMMAND_BLOB_MIME,
      contentLength: commandBytes.byteLength,
    });
    const previewSummary = JSON.parse(
      JSON.stringify({
        version: 'localmind-office-command-preview-evidence/v1',
        operation:
          payload.kind === 'command'
            ? payload.command.operation
            : 'office.command.batch',
        commandCount:
          payload.kind === 'command' ? 1 : payload.batch.commands.length,
        stats: preview.stats,
        summary: preview.summary,
      })
    ) as Prisma.InputJsonObject;
    const persisted = await this.models.officeCommandRequest.createOrReuse({
      workspaceId: input.workspaceId,
      artifactId: value.artifactId,
      expectedRevisionId: value.expectedRevisionId,
      actorId: input.actorId,
      idempotencyKey: value.idempotencyKey,
      commandBlobKey,
      commandByteSize: commandBytes.byteLength,
      commandFingerprint,
      previewPackageFingerprint: preview.packageFingerprint,
      previewStateFingerprint: preview.stateFingerprint,
      previewSummary,
    });
    const requestFingerprint = officeJsonFingerprint({
      version: AGENT_RUNTIME_OFFICE_COMMAND_REQUEST_VERSION,
      requestId: persisted.request.id,
      workspaceId: persisted.request.workspaceId,
      artifactId: persisted.request.artifactId,
      expectedRevisionId: persisted.request.expectedRevisionId,
      commandFingerprint: persisted.request.commandFingerprint,
      previewPackageFingerprint: persisted.request.previewPackageFingerprint,
      previewStateFingerprint: persisted.request.previewStateFingerprint,
    });
    const run = await this.models.copilotAgentRuntime.createRun({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      sessionId: input.sessionId,
      workflow: AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW,
      sourceType: 'office_command_request',
      sourceId: persisted.request.id,
      status: 'waiting_approval',
      title:
        input.title ??
        `Approve ${
          payload.kind === 'command'
            ? payload.command.operation
            : `${payload.batch.commands.length} Office changes`
        }`,
      target: {
        version: 'agent-runtime-office-command-target/v1',
        artifactId: value.artifactId,
        artifactKind: preview.artifact.kind,
        artifactTitle: preview.artifact.title,
        sourceFileName: preview.artifact.sourceFileName,
        expectedRevisionId: value.expectedRevisionId,
        revisionSequence: preview.revision.sequence,
        requestKind: payload.kind,
        operation:
          payload.kind === 'command'
            ? payload.command.operation
            : 'office.command.batch',
        commandCount:
          payload.kind === 'command' ? 1 : payload.batch.commands.length,
      },
      evidence: {
        version: 'agent-runtime-office-command-evidence/v1',
        requestId: persisted.request.id,
        requestFingerprint,
        commandFingerprint,
        reason: input.reason?.trim() || null,
      },
      steps: [
        {
          stepKey: 'approve_office_command',
          stepType: 'approval',
          status: 'waiting_approval',
          title: 'Approve Office command',
          order: 0,
          outputSummary: {
            approvalRequest: {
              version: 'agent-runtime-office-command-approval/v1',
              requestId: persisted.request.id,
              artifactId: value.artifactId,
              artifactKind: preview.artifact.kind,
              artifactTitle: preview.artifact.title,
              sourceFileName: preview.artifact.sourceFileName,
              expectedRevisionId: value.expectedRevisionId,
              revisionSequence: preview.revision.sequence,
              requestKind: payload.kind,
              operation:
                payload.kind === 'command'
                  ? payload.command.operation
                  : 'office.command.batch',
              commandCount:
                payload.kind === 'command' ? 1 : payload.batch.commands.length,
              previewSummary,
              commandFingerprint,
              previewPackageFingerprint: preview.packageFingerprint,
              previewStateFingerprint: preview.stateFingerprint,
              requestFingerprint,
              reason: input.reason?.trim() || null,
            },
          },
        },
        {
          stepKey: 'execute_office_command',
          stepType: 'tool',
          status: 'waiting_approval',
          title: 'Execute Office command',
          order: 1,
          outputSummary: {
            officeCommandRequest: {
              version: AGENT_RUNTIME_OFFICE_COMMAND_REQUEST_VERSION,
              requestId: persisted.request.id,
              commandFingerprint,
              requestKind: payload.kind,
            },
          },
        },
      ],
    });
    return { run, request: persisted.request, preview, payload };
  }

  async readRequest(workspaceId: string, requestId: string) {
    const request = await this.models.officeCommandRequest.get(
      workspaceId,
      requestId
    );
    if (!request) {
      throw new Error(`Office command request not found: ${requestId}`);
    }
    const stored = await this.storage.get(workspaceId, request.commandBlobKey);
    if (!stored.body) {
      throw new Error(
        `Office command request bytes are not available: ${request.commandBlobKey}`
      );
    }
    if (
      stored.metadata &&
      (stored.metadata.contentLength !== request.commandByteSize ||
        stored.metadata.contentType !== OFFICE_COMMAND_BLOB_MIME)
    ) {
      stored.body.destroy();
      throw new Error(
        `Office command request object metadata does not match: ${request.id}`
      );
    }
    const bytes = await readBufferWithLimit(
      stored.body,
      OFFICE_COMMAND_MAX_BYTES
    );
    if (bytes.byteLength !== request.commandByteSize) {
      throw new Error(
        `Office command request byte size does not match: ${request.id}`
      );
    }
    if (officeFingerprint(bytes) !== request.commandFingerprint) {
      throw new Error(
        `Office command request fingerprint does not match: ${request.id}`
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new Error(
        `Office command request is not valid JSON: ${request.id}`
      );
    }
    const payload: OfficeAgentCommandPayload =
      isRecord(value) && value.version === 'localmind-office-command-batch/v1'
        ? { kind: 'batch', batch: parseOfficeCommandBatch(value) }
        : { kind: 'command', command: parseOfficeCommand(value) };
    const identity =
      payload.kind === 'command' ? payload.command : payload.batch;
    if (
      identity.source !== 'ai' ||
      identity.artifactId !== request.artifactId ||
      identity.expectedRevisionId !== request.expectedRevisionId ||
      identity.idempotencyKey !== request.idempotencyKey
    ) {
      throw new Error(
        `Office command request identity does not match: ${request.id}`
      );
    }
    return {
      request,
      payload,
      ...(payload.kind === 'command' ? { command: payload.command } : {}),
    };
  }

  async readStateForAi(input: {
    workspaceId: string;
    actorId: string;
    artifactId: string;
    revisionId?: string | null;
    selector?: OfficeAiReadSelector;
  }) {
    const revision = await this.artifacts.getRevision(
      input.workspaceId,
      input.actorId,
      input.artifactId,
      input.revisionId ?? undefined
    );
    const asset = await this.artifacts.readRevisionAsset(
      input.workspaceId,
      input.actorId,
      input.artifactId,
      revision.id,
      'state'
    );
    let state: unknown;
    try {
      state = JSON.parse(asset.bytes.toString('utf8'));
    } catch {
      throw new Error(
        `Office semantic state is not valid JSON: ${revision.id}`
      );
    }
    if (!isRecord(state)) {
      throw new Error(`Office semantic state is invalid: ${revision.id}`);
    }
    const selected = input.selector
      ? projectOfficeState(state, input.selector)
      : state;
    const bounded = boundedAiStateResult(selected);
    return {
      artifactId: input.artifactId,
      revisionId: revision.id,
      sequence: revision.sequence,
      stateFingerprint: revision.stateFingerprint,
      ...bounded,
      ...(!input.selector && bounded.truncated
        ? { index: officeStateIndex(state) }
        : {}),
    };
  }
}

function activeToolStep(run: CopilotAgentRunRecord) {
  const steps = run.steps.filter(
    step =>
      step.stepType === 'tool' &&
      (step.status === 'pending' ||
        step.status === 'running' ||
        step.status === 'waiting_approval')
  );
  if (steps.length !== 1) {
    throw new Error(
      `Agent Runtime Office command requires exactly one active tool step, found ${steps.length}: ${run.id}`
    );
  }
  return steps[0];
}

function assertApproved(run: CopilotAgentRunRecord) {
  const approvals = run.steps.filter(step => step.stepType === 'approval');
  if (
    !approvals.length ||
    approvals.some(step => step.status !== 'completed')
  ) {
    throw new Error(`Agent Runtime Office command is not approved: ${run.id}`);
  }
}

function requestReference(step: CopilotAgentStepRecord) {
  const value = step.outputSummary.officeCommandRequest;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `Agent Runtime Office command step is missing its request reference: ${step.stepKey}`
    );
  }
  const request = value as Record<string, unknown>;
  if (
    request.version !== AGENT_RUNTIME_OFFICE_COMMAND_REQUEST_VERSION ||
    typeof request.requestId !== 'string' ||
    !request.requestId.trim() ||
    typeof request.commandFingerprint !== 'string' ||
    !request.commandFingerprint.trim()
  ) {
    throw new Error(
      `Agent Runtime Office command step has an invalid request reference: ${step.stepKey}`
    );
  }
  return {
    requestId: request.requestId.trim(),
    commandFingerprint: request.commandFingerprint.trim(),
  };
}

@Injectable()
export class CopilotAgentRuntimeOfficeCommandAdapter {
  private readonly logger = new Logger(
    CopilotAgentRuntimeOfficeCommandAdapter.name
  );

  constructor(
    private readonly models: Models,
    private readonly commands: OfficeCommandService,
    private readonly requests: OfficeAgentCommandService,
    private readonly workflowRegistry: CopilotAgentRuntimeWorkflowRegistry
  ) {
    this.workflowRegistry.register({
      workflow: AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['approval', 'tool'],
        sideEffectMode: 'workspace_write',
        summary:
          'Executes one immutable, previewed, approval-gated native Office command and records the resulting revision evidence.',
      },
      execute: input => this.execute(input),
    });
  }

  private async execute(input: CopilotAgentRuntimeWorkflowAdapterInput) {
    const { run, workerLeaseId, workerAttempt, checkCancellationRequested } =
      input;
    if (run.sourceType !== 'office_command_request') {
      throw new Error(
        `Agent Runtime Office command has an invalid source type: ${run.sourceType}`
      );
    }
    assertApproved(run);
    const reference = requestReference(activeToolStep(run));
    if (reference.requestId !== run.sourceId) {
      throw new Error(
        `Agent Runtime Office command source does not match request: ${run.id}`
      );
    }
    if (await checkCancellationRequested()) {
      this.logger.debug(
        `Agent Runtime Office command cancelled before request read: ${run.id}`
      );
      return;
    }
    const { request, payload } = await this.requests.readRequest(
      run.workspaceId,
      reference.requestId
    );
    if (
      request.requestedBy !== run.actorId ||
      request.commandFingerprint !== reference.commandFingerprint
    ) {
      throw new Error(
        `Agent Runtime Office command request evidence does not match run: ${run.id}`
      );
    }
    const preview =
      payload.kind === 'command'
        ? await this.commands.preview({
            workspaceId: run.workspaceId,
            actorId: run.actorId,
            command: payload.command,
          })
        : await this.commands.previewBatch({
            workspaceId: run.workspaceId,
            actorId: run.actorId,
            batch: payload.batch,
          });
    if (
      preview.packageFingerprint !== request.previewPackageFingerprint ||
      preview.stateFingerprint !== request.previewStateFingerprint
    ) {
      throw new Error(
        `Agent Runtime Office command preview evidence changed: ${request.id}`
      );
    }
    if (await checkCancellationRequested()) {
      this.logger.debug(
        `Agent Runtime Office command cancelled before side effect: ${run.id}`
      );
      return;
    }
    const result =
      payload.kind === 'command'
        ? await this.commands.execute({
            workspaceId: run.workspaceId,
            actorId: run.actorId,
            sourceSessionId: run.sessionId,
            command: payload.command,
          })
        : await this.commands.executeBatch({
            workspaceId: run.workspaceId,
            actorId: run.actorId,
            sourceSessionId: run.sessionId,
            batch: payload.batch,
          });
    const operation =
      payload.kind === 'command'
        ? payload.command.operation
        : 'office.command.batch';
    const commandCount =
      payload.kind === 'command' ? 1 : payload.batch.commands.length;
    const sideEffectFingerprint = officeJsonFingerprint({
      version: 'agent-runtime-office-command-side-effect/v1',
      requestId: request.id,
      artifactId: result.revision.artifactId,
      revisionId: result.revision.id,
      sequence: result.revision.sequence,
      packageFingerprint: result.packageFingerprint,
      stateFingerprint: result.stateFingerprint,
      operation,
      commandCount,
    });
    const sideEffectSummary = {
      version: 'agent-runtime-office-command-side-effect/v1',
      sideEffectKind: 'office_revision',
      sideEffectRecordId: result.revision.id,
      sideEffectFingerprint,
      requestId: request.id,
      artifactId: result.revision.artifactId,
      revisionId: result.revision.id,
      sequence: result.revision.sequence,
      packageFingerprint: result.packageFingerprint,
      stateFingerprint: result.stateFingerprint,
      operation,
      commandCount,
      idempotentReplay: !result.created,
    };
    await this.models.copilotAgentRuntime.completeStandaloneWorkerExecution({
      workspaceId: run.workspaceId,
      id: run.id,
      workerLeaseId,
      workerAttempt,
      adapterWorkflow: AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW,
      sideEffectMode: 'workspace_write',
      sideEffectsApplied: true,
      sideEffectSummary,
      summary: `Created Office revision ${result.revision.sequence} for ${result.revision.artifactId}.`,
      adapterResolution: this.workflowRegistry.completedAdapterResolution(
        run,
        AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW
      ),
    });
  }
}

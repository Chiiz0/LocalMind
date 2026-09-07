import {
  OFFICE_COMMAND_BATCH_MAX_BYTES,
  type OfficeAiContext,
  OfficeCommandBatchSchema,
  OfficeCommandSchema,
  parseOfficeCommand,
  parseOfficeCommandBatch,
} from '@localmind/office';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { OFFICE_COMMAND_MAX_BYTES } from '../../../models';
import {
  OfficeAgentCommandService,
  type OfficeAiReadSelector,
  OfficeAiReadSelectorSchema,
} from '../office-agent-command';
import type { ProjectOfficeAgentCommandService } from '../project-office-agent-command';
import { toolError } from './error';
import { type CopilotToolSet, defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const logger = new Logger('OfficeTools');

type OfficeReadProof = {
  artifactId: string;
  revisionId: string;
};

function jsonStringOrValueSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  options: { label: string; maxBytes: number }
) {
  const encodedSchema = z
    .string()
    .trim()
    .min(2)
    .max(options.maxBytes)
    .transform((value, refinement) => {
      if (Buffer.byteLength(value, 'utf8') > options.maxBytes) {
        refinement.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} JSON must not exceed ${options.maxBytes} bytes`,
        });
        return z.NEVER;
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(value);
      } catch {
        refinement.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} must be valid JSON`,
        });
        return z.NEVER;
      }
      const parsed = schema.safeParse(decoded);
      if (!parsed.success) {
        refinement.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} JSON must match the required Office schema`,
        });
        return z.NEVER;
      }
      return parsed.data;
    });
  return z.union([schema, encodedSchema]);
}

const OfficeAiReadSelectorToolSchema = jsonStringOrValueSchema(
  OfficeAiReadSelectorSchema.nullable(),
  { label: 'selector', maxBytes: 8192 }
);

const OfficeCommandToolSchema = jsonStringOrValueSchema(OfficeCommandSchema, {
  label: 'command',
  maxBytes: OFFICE_COMMAND_MAX_BYTES,
});

const OfficeCommandBatchToolSchema = jsonStringOrValueSchema(
  OfficeCommandBatchSchema,
  {
    label: 'batch',
    maxBytes: OFFICE_COMMAND_BATCH_MAX_BYTES,
  }
);

const OFFICE_COMMAND_DESCRIPTION = `A strict localmind-office-command/v1 command. Always copy artifactId, expectedRevisionId, and stable target IDs from office_read; use source=ai and new commandId/idempotencyKey values.
Docs operations: text.format, text.replace, paragraph.format, break.insert, section.insert, table.insert, page.layout.set, header_footer.text.set, content_control.text.set, review.resolve, mail_merge.apply, object.insert.
Sheets operations: cell.set, range.format, cells.merge.set, row.properties.set, column.properties.set, filter.set, validation.set, sheet.add, sheet.delete, sheet.rename, sheets.reorder, dimension.change, table.set, chart.add, chart.delete.
Slides operations: shape.text.set, shape.geometry.set, shape.add, shape.delete, image.add, slide.add, slide.duplicate, slide.delete, slides.reorder, notes.text.set, theme.color.set.
PDF operations: annotation.add, annotation.update, annotation.delete, form.set, page.rotate, page.delete, pages.reorder, signature.appearance.add, redaction.apply.
PDF is fixed-layout: never claim or attempt paragraph/body-text rewriting, reflow, or layout editing. Use only the supported annotation, form, page, signature appearance, and redaction commands.
Example for “make this text 14 pt, blue, italic, with a red underline and Heading 2”: operation=office.document.text.format with format={fontSizePt:14,textColor:"#0000FF",italic:true,underline:{style:"single",color:"#FF0000"},paragraphStyleId:"Heading2"}.`;

function assertContextIdentity(
  context: OfficeAiContext | undefined,
  identity: { artifactId: string; expectedRevisionId: string }
) {
  if (!context) return;
  if (identity.artifactId !== context.artifactId) {
    throw new Error('Office command must target the current Office artifact');
  }
  if (identity.expectedRevisionId !== context.revisionId) {
    throw new Error(
      'Office command must target the validated current revision'
    );
  }
}

function assertReadBeforeWrite(
  proof: OfficeReadProof | null,
  identity: { artifactId: string; expectedRevisionId: string }
) {
  if (!proof) {
    throw new Error('Call office_read successfully before requesting a write');
  }
  if (
    proof.artifactId !== identity.artifactId ||
    proof.revisionId !== identity.expectedRevisionId
  ) {
    throw new Error(
      'Office write target must match the artifact and revision returned by office_read'
    );
  }
}

export const buildOfficeReadHandler = (
  service: OfficeAgentCommandService,
  onRead?: (proof: OfficeReadProof) => void
) => {
  return async (
    options: NonNullable<CopilotChatOptions>,
    artifactId?: string,
    revisionId?: string,
    selector?: OfficeAiReadSelector
  ) => {
    if (!options.user || !options.workspace) {
      return toolError(
        'Office Read Failed',
        'Missing workspace or user context for office_read.'
      );
    }
    const context = options.officeContext;
    const resolvedArtifactId = context?.artifactId ?? artifactId;
    if (!resolvedArtifactId) {
      throw new Error('office_read requires a bound Office artifact');
    }
    if (context && artifactId && artifactId !== context.artifactId) {
      throw new Error('office_read must target the current Office artifact');
    }
    if (context && revisionId && revisionId !== context.revisionId) {
      throw new Error('office_read must target the validated current revision');
    }
    const result = await service.readStateForAi({
      workspaceId: options.workspace,
      actorId: options.user,
      artifactId: resolvedArtifactId,
      revisionId: revisionId ?? context?.revisionId,
      selector,
    });
    onRead?.({ artifactId: result.artifactId, revisionId: result.revisionId });
    return result;
  };
};

export const buildOfficeCommandRequestHandler = (
  service: OfficeAgentCommandService,
  getReadProof: () => OfficeReadProof | null
) => {
  return async (
    options: NonNullable<CopilotChatOptions>,
    command: unknown,
    title?: string,
    reason?: string
  ) => {
    if (!options.user || !options.workspace) {
      return toolError(
        'Office Command Request Failed',
        'Missing workspace or user context for office_command_request.'
      );
    }
    const parsed = parseOfficeCommand(command);
    assertContextIdentity(options.officeContext, parsed);
    assertReadBeforeWrite(getReadProof(), parsed);
    const result = await service.request({
      workspaceId: options.workspace,
      actorId: options.user,
      ...(options.session ? { sessionId: options.session } : {}),
      command: parsed,
      title,
      reason,
    });
    return {
      success: true,
      approvalRequired: result.run.status === 'waiting_approval',
      taskId: result.run.id,
      taskStatus: result.run.status,
      requestId: result.request.id,
      artifactId: result.request.artifactId,
      expectedRevisionId: result.request.expectedRevisionId,
      commandFingerprint: result.request.commandFingerprint,
      previewPackageFingerprint: result.preview.packageFingerprint,
      previewStateFingerprint: result.preview.stateFingerprint,
      previewSummary: result.preview.summary,
    };
  };
};

export const buildOfficeCommandBatchRequestHandler = (
  service: OfficeAgentCommandService,
  getReadProof: () => OfficeReadProof | null
) => {
  return async (
    options: NonNullable<CopilotChatOptions>,
    batch: unknown,
    title?: string,
    reason?: string
  ) => {
    if (!options.user || !options.workspace) {
      return toolError(
        'Office Command Batch Request Failed',
        'Missing workspace or user context for office_command_batch_request.'
      );
    }
    const parsed = parseOfficeCommandBatch(batch);
    assertContextIdentity(options.officeContext, parsed);
    assertReadBeforeWrite(getReadProof(), parsed);
    const result = await service.requestBatch({
      workspaceId: options.workspace,
      actorId: options.user,
      ...(options.session ? { sessionId: options.session } : {}),
      batch: parsed,
      title,
      reason,
    });
    return {
      success: true,
      approvalRequired: result.run.status === 'waiting_approval',
      taskId: result.run.id,
      taskStatus: result.run.status,
      requestId: result.request.id,
      artifactId: result.request.artifactId,
      expectedRevisionId: result.request.expectedRevisionId,
      commandFingerprint: result.request.commandFingerprint,
      commandCount: parsed.commands.length,
      previewPackageFingerprint: result.preview.packageFingerprint,
      previewStateFingerprint: result.preview.stateFingerprint,
      previewSummary: result.preview.summary,
    };
  };
};

export const createOfficeReadTool = (
  read: (selector?: OfficeAiReadSelector) => Promise<object>
) =>
  defineTool({
    description:
      'Read bounded native semantic state and immutable revision evidence for the current LocalMind Docs, Sheets, Slides, or PDF artifact and revision. Artifact identity is already bound by trusted chat context. First call with {"selector":null} (or omit selector) for the whole state or a lightweight index when large. Then use the returned stable IDs with a document block/query, workbook sheet/range, presentation slide/shape, or PDF page selector. Never guess IDs such as current, active, or sheet1.',
    inputSchema: z
      .object({
        selector: OfficeAiReadSelectorToolSchema.optional(),
      })
      .strict(),
    execute: async ({ selector }) => {
      try {
        return await read(selector ?? undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to read the bound Office artifact', error);
        return toolError('Office Read Failed', message);
      }
    },
  });

export const createOfficeCommandRequestTool = (
  request: (
    command: unknown,
    title?: string,
    reason?: string
  ) => Promise<object>
) =>
  defineTool({
    description:
      'Preview and persist one native LocalMind Office command for explicit user approval. It never edits immediately; execution rechecks live access, cancellation, the current revision, and preview evidence.',
    inputSchema: z
      .object({
        command: OfficeCommandToolSchema.describe(OFFICE_COMMAND_DESCRIPTION),
        title: z.string().trim().min(1).max(512).optional(),
        reason: z.string().trim().min(1).max(1024).optional(),
      })
      .strict(),
    execute: async ({ command, title, reason }) => {
      try {
        return await request(command, title, reason);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to request Office command approval', error);
        return toolError('Office Command Request Failed', message);
      }
    },
  });

export const createOfficeCommandBatchRequestTool = (
  request: (batch: unknown, title?: string, reason?: string) => Promise<object>
) =>
  defineTool({
    description:
      'Preview and persist one atomic localmind-office-command-batch/v1 for explicit user approval. Use it only when every command must succeed together against one artifact and one revision. It creates no revision until approval and successful worker revalidation.',
    inputSchema: z
      .object({
        batch: OfficeCommandBatchToolSchema.describe(
          `A strict localmind-office-command-batch/v1. Every nested command must use source=ai and exactly match the batch artifactId and expectedRevisionId. ${OFFICE_COMMAND_DESCRIPTION}`
        ),
        title: z.string().trim().min(1).max(512).optional(),
        reason: z.string().trim().min(1).max(1024).optional(),
      })
      .strict(),
    execute: async ({ batch, title, reason }) => {
      try {
        return await request(batch, title, reason);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to request Office command batch approval', error);
        return toolError('Office Command Batch Request Failed', message);
      }
    },
  });

export function createProjectOfficeTools(
  service: ProjectOfficeAgentCommandService,
  options: NonNullable<CopilotChatOptions>,
  projectId: string,
  allowWrites: boolean
): CopilotToolSet {
  if (
    !options.user ||
    !options.session ||
    options.workspace ||
    options.taskId ||
    options.delegatedExecution
  )
    throw new Error(
      'Project Office tools require an owned native conversation'
    );
  const scope = {
    projectId,
    actorId: options.user,
    sessionId: options.session,
  };
  const context = options.officeContext;
  if (!context || !('projectId' in context) || context.projectId !== projectId)
    throw new Error('Project Office tools require a matching Office context');
  let proof: OfficeReadProof | null = null;
  const tools: CopilotToolSet = {
    office_read: createOfficeReadTool(async selector => {
      const result = await service.read({
        ...scope,
        artifactId: context.artifactId,
        revisionId: context.revisionId,
        selector,
      });
      proof = { artifactId: result.artifactId, revisionId: result.revisionId };
      return result;
    }),
  };
  if (allowWrites) {
    tools.office_command_request = createOfficeCommandRequestTool(
      async (command, title) => {
        const parsed = parseOfficeCommand(command);
        assertContextIdentity(context, parsed);
        assertReadBeforeWrite(proof, parsed);
        return service.request({
          ...scope,
          command: parsed,
          title,
          readProof: proof,
        });
      }
    );
    tools.office_command_batch_request = createOfficeCommandBatchRequestTool(
      async (batch, title) => {
        const parsed = parseOfficeCommandBatch(batch);
        assertContextIdentity(context, parsed);
        assertReadBeforeWrite(proof, parsed);
        return service.request({
          ...scope,
          batch: parsed,
          title,
          readProof: proof,
        });
      }
    );
  }
  return tools;
}

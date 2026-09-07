import { z } from 'zod';

import {
  OfficeDocumentParagraphTargetSchema,
  OfficePresentationShapeTargetSchema,
  OfficeTextRangeSchema,
  OfficeWorkbookCellTargetSchema,
  OfficeWorkbookRangeTargetSchema,
} from './command';

const boundedString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);

const OfficeRectSchema = z
  .object({
    xPt: z.number().finite().min(-10_000_000).max(10_000_000),
    yPt: z.number().finite().min(-10_000_000).max(10_000_000),
    widthPt: z.number().finite().positive().max(10_000_000),
    heightPt: z.number().finite().positive().max(10_000_000),
  })
  .strict();

export const OfficeDocumentSelectionSchema = z
  .object({
    kind: z.literal('document'),
    target: z.union([
      OfficeTextRangeSchema,
      OfficeDocumentParagraphTargetSchema,
      z
        .object({
          type: z.literal('section'),
          sectionIndex: z.number().int().nonnegative().max(10_000),
        })
        .strict(),
      z
        .object({
          type: z.literal('run'),
          blockId: boundedString(512),
          runIndex: z.number().int().nonnegative().max(1_000_000),
        })
        .strict(),
    ]),
  })
  .strict();

export const OfficeWorkbookSelectionSchema = z
  .object({
    kind: z.literal('workbook'),
    target: z.union([
      OfficeWorkbookCellTargetSchema,
      OfficeWorkbookRangeTargetSchema,
      z
        .object({
          type: z.literal('sheet'),
          sheetId: boundedString(256),
        })
        .strict(),
      z
        .object({
          type: z.literal('table'),
          sheetId: boundedString(256),
          tableId: boundedString(512),
        })
        .strict(),
      z
        .object({
          type: z.literal('chart'),
          sheetId: boundedString(256),
          chartId: boundedString(512),
        })
        .strict(),
    ]),
  })
  .strict();

export const OfficePresentationSelectionSchema = z
  .object({
    kind: z.literal('presentation'),
    target: z.union([
      OfficePresentationShapeTargetSchema,
      z
        .object({
          type: z.literal('slide'),
          slideId: boundedString(256),
        })
        .strict(),
      z
        .object({
          type: z.literal('placeholder'),
          slideId: boundedString(256),
          shapeId: boundedString(256),
          placeholderType: boundedString(128).optional(),
        })
        .strict(),
      z
        .object({
          type: z.literal('notes'),
          slideId: boundedString(256),
        })
        .strict(),
    ]),
  })
  .strict();

export const OfficePdfSelectionSchema = z
  .object({
    kind: z.literal('pdf'),
    target: z.union([
      z
        .object({
          type: z.literal('page'),
          pageIndex: z.number().int().nonnegative().max(100_000),
        })
        .strict(),
      z
        .object({
          type: z.literal('annotation'),
          pageIndex: z.number().int().nonnegative().max(100_000),
          annotationId: boundedString(2048),
        })
        .strict(),
      z
        .object({
          type: z.literal('form_field'),
          fieldName: boundedString(2048),
        })
        .strict(),
      z
        .object({
          type: z.literal('page_region'),
          pageIndex: z.number().int().nonnegative().max(100_000),
          rect: OfficeRectSchema,
        })
        .strict(),
    ]),
  })
  .strict();

export const OfficeSelectionSchema = z.discriminatedUnion('kind', [
  OfficeDocumentSelectionSchema,
  OfficeWorkbookSelectionSchema,
  OfficePresentationSelectionSchema,
  OfficePdfSelectionSchema,
]);

const officeContextFields = {
  artifactId: boundedString(512),
  artifactKind: z.enum(['document', 'workbook', 'presentation', 'pdf']),
  revisionId: boundedString(512),
  selection: OfficeSelectionSchema.optional(),
};

export const OfficeAiContextSchema = z
  .discriminatedUnion('version', [
    z
      .object({
        ...officeContextFields,
        version: z.literal('localmind-office-ai-context/v1'),
        workspaceId: boundedString(512),
      })
      .strict(),
    z
      .object({
        ...officeContextFields,
        version: z.literal('localmind-project-office-ai-context/v1'),
        projectId: boundedString(512),
      })
      .strict(),
  ])
  .superRefine((context, refinement) => {
    if (context.selection && context.selection.kind !== context.artifactKind) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selection', 'kind'],
        message: 'Office selection kind must match artifact kind',
      });
    }
  });

export type OfficeDocumentSelection = z.infer<
  typeof OfficeDocumentSelectionSchema
>;
export type OfficeWorkbookSelection = z.infer<
  typeof OfficeWorkbookSelectionSchema
>;
export type OfficePresentationSelection = z.infer<
  typeof OfficePresentationSelectionSchema
>;
export type OfficePdfSelection = z.infer<typeof OfficePdfSelectionSchema>;
export type OfficeSelection = z.infer<typeof OfficeSelectionSchema>;
export type OfficeAiContext = z.infer<typeof OfficeAiContextSchema>;

export function parseOfficeAiContext(input: unknown): OfficeAiContext {
  return OfficeAiContextSchema.parse(input);
}

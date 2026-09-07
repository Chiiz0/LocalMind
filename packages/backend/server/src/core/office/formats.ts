import type { OfficeCommand } from '@localmind/office';
import {
  applyDocxCommand,
  DEFAULT_DOCX_PACKAGE_LIMITS,
  DOCX_MODEL_VERSION,
  type DocxSemanticState,
  openDocxPackage,
  readDocxSemanticState,
} from '@localmind/office/docx';
import { DEFAULT_OOXML_PACKAGE_LIMITS } from '@localmind/office/ooxml';
import {
  applyPdfCommand,
  DEFAULT_PDF_PACKAGE_LIMITS,
  openPdfPackage,
  PDF_MODEL_VERSION,
  type PdfSemanticState,
  readPdfSemanticState,
} from '@localmind/office/pdf';
import {
  applyPptxCommand,
  openPptxPackage,
  PPTX_MODEL_VERSION,
  type PptxSemanticState,
  readPptxSemanticState,
} from '@localmind/office/pptx';
import {
  applyXlsxCommand,
  openXlsxPackage,
  readXlsxSemanticState,
  XLSX_MODEL_VERSION,
  type XlsxSemanticState,
} from '@localmind/office/xlsx';
import { OfficeArtifactKind } from '@prisma/client';

import { pdfSearchText } from './pdf-search';

export type NativeOfficeFormat = 'docx' | 'xlsx' | 'pptx' | 'pdf';
export type NativeOfficeState =
  | DocxSemanticState
  | XlsxSemanticState
  | PptxSemanticState
  | PdfSemanticState;

export function officeStateSearchText(state: NativeOfficeState) {
  const parts: string[] = [];
  let remaining = 250000;
  const append = (value: string | number | boolean | null | undefined) => {
    if (value === undefined || value === null || remaining <= 0) return;
    const text = String(value).slice(0, remaining);
    remaining -= text.length + 1;
    parts.push(text);
  };
  if ('body' in state) {
    const pending = [
      ...state.body,
      ...state.stories.flatMap(story => story.blocks),
    ];
    while (pending.length && remaining > 0) {
      const block = pending.pop();
      if (!block) break;
      if (block.type === 'paragraph') append(block.text);
      else if (block.type === 'contentControl') pending.push(...block.blocks);
      else if (block.type === 'table')
        for (const row of block.rows)
          for (const cell of row.cells) pending.push(...cell.blocks);
    }
  } else if ('sheets' in state) {
    for (const sheet of state.sheets) {
      if (remaining <= 0) break;
      append(sheet.name);
      for (const cell of sheet.cells) {
        if (remaining <= 0) break;
        append(cell.value);
        append(cell.formula);
      }
    }
  } else if ('slides' in state) {
    for (const slide of state.slides) {
      if (remaining <= 0) break;
      append(slide.name);
      append(slide.notesText);
      const pending = [...slide.shapes];
      while (pending.length && remaining > 0) {
        const shape = pending.pop();
        if (!shape) break;
        append(shape.text);
        append(shape.description);
        if (shape.children) pending.push(...shape.children);
      }
    }
  } else {
    append(state.metadata.title);
    append(state.metadata.subject);
    for (const page of state.pages) {
      if (remaining <= 0) break;
      for (const annotation of page.annotations) append(annotation.contents);
    }
    for (const field of state.formFields) {
      if (remaining <= 0) break;
      append(field.name);
      append(Array.isArray(field.value) ? field.value.join(' ') : field.value);
    }
  }
  return parts.join('\n');
}

export async function officePackageSearchText(
  state: NativeOfficeState,
  bytes: Uint8Array
) {
  const metadata = officeStateSearchText(state);
  if (
    state.schemaVersion !== 'localmind-office-pdf-state/v1' ||
    metadata.length >= 250000 ||
    bytes.length > 64 * 1024 * 1024
  )
    return metadata;
  const text = await pdfSearchText(bytes, 250000 - metadata.length - 1);
  return `${metadata}\n${text}`.slice(0, 250000);
}

export const OFFICE_FORMATS = {
  docx: {
    format: 'docx',
    kind: OfficeArtifactKind.document,
    extension: '.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    engine: 'localmind-native-docx',
    modelVersion: DOCX_MODEL_VERSION,
    stateMimeType: 'application/vnd.localmind.office.docx-state+json',
    maxPackageBytes: DEFAULT_DOCX_PACKAGE_LIMITS.maxPackageBytes,
    maxStateBytes: 128 * 1024 * 1024,
  },
  xlsx: {
    format: 'xlsx',
    kind: OfficeArtifactKind.workbook,
    extension: '.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    engine: 'localmind-native-xlsx',
    modelVersion: XLSX_MODEL_VERSION,
    stateMimeType: 'application/vnd.localmind.office.xlsx-state+json',
    maxPackageBytes: DEFAULT_OOXML_PACKAGE_LIMITS.maxPackageBytes,
    maxStateBytes: 256 * 1024 * 1024,
  },
  pptx: {
    format: 'pptx',
    kind: OfficeArtifactKind.presentation,
    extension: '.pptx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    engine: 'localmind-native-pptx',
    modelVersion: PPTX_MODEL_VERSION,
    stateMimeType: 'application/vnd.localmind.office.pptx-state+json',
    maxPackageBytes: DEFAULT_OOXML_PACKAGE_LIMITS.maxPackageBytes,
    maxStateBytes: 256 * 1024 * 1024,
  },
  pdf: {
    format: 'pdf',
    kind: OfficeArtifactKind.pdf,
    extension: '.pdf',
    mimeType: 'application/pdf',
    engine: 'localmind-native-pdf',
    modelVersion: PDF_MODEL_VERSION,
    stateMimeType: 'application/vnd.localmind.office.pdf-state+json',
    maxPackageBytes: DEFAULT_PDF_PACKAGE_LIMITS.maxPackageBytes,
    maxStateBytes: 64 * 1024 * 1024,
  },
} as const;

export type OfficeFormatPolicy = (typeof OFFICE_FORMATS)[NativeOfficeFormat];

export function officeFormatFromFileName(sourceFileName: string) {
  const lower = sourceFileName.toLowerCase();
  const format = (Object.keys(OFFICE_FORMATS) as NativeOfficeFormat[]).find(
    candidate => lower.endsWith(OFFICE_FORMATS[candidate].extension)
  );
  if (!format) {
    throw new Error(
      'Native Office import requires a .docx, .xlsx, .pptx, or .pdf file'
    );
  }
  return OFFICE_FORMATS[format];
}

export function officeFormatFromKind(kind: OfficeArtifactKind) {
  const format = (Object.keys(OFFICE_FORMATS) as NativeOfficeFormat[]).find(
    candidate => OFFICE_FORMATS[candidate].kind === kind
  );
  if (!format) throw new Error(`Unsupported Office artifact kind: ${kind}`);
  return OFFICE_FORMATS[format];
}

export function officeFormatForCommand(command: OfficeCommand) {
  if (command.operation.startsWith('office.document.')) {
    return OFFICE_FORMATS.docx;
  }
  if (command.operation.startsWith('office.workbook.')) {
    return OFFICE_FORMATS.xlsx;
  }
  if (command.operation.startsWith('office.presentation.')) {
    return OFFICE_FORMATS.pptx;
  }
  if (command.operation.startsWith('office.pdf.')) return OFFICE_FORMATS.pdf;
  throw new Error(`Unsupported Office command: ${command.operation}`);
}

export async function readNativeOfficeState(
  policy: OfficeFormatPolicy,
  bytes: Uint8Array
): Promise<NativeOfficeState> {
  switch (policy.format) {
    case 'docx':
      return readDocxSemanticState(openDocxPackage(bytes));
    case 'xlsx':
      return readXlsxSemanticState(openXlsxPackage(bytes));
    case 'pptx':
      return readPptxSemanticState(openPptxPackage(bytes));
    case 'pdf':
      return readPdfSemanticState(await openPdfPackage(bytes));
  }
}

export async function applyNativeOfficeCommand(
  policy: OfficeFormatPolicy,
  bytes: Uint8Array,
  command: OfficeCommand
) {
  switch (policy.format) {
    case 'docx':
      return applyDocxCommand(openDocxPackage(bytes), command);
    case 'xlsx':
      return applyXlsxCommand(openXlsxPackage(bytes), command);
    case 'pptx':
      return applyPptxCommand(openPptxPackage(bytes), command);
    case 'pdf':
      return await applyPdfCommand(await openPdfPackage(bytes), command);
  }
}

export function officeCompatibilitySummary(
  policy: OfficeFormatPolicy,
  state: NativeOfficeState
) {
  const base = {
    engine: policy.engine,
    format: policy.format,
    preservationLevel: 'L0',
    stats: state.stats,
  };
  switch (state.schemaVersion) {
    case 'localmind-office-docx-state/v1':
      return {
        ...base,
        unsupportedBodyElements:
          state.compatibility.unsupportedBodyElements.slice(0, 256),
      };
    case 'localmind-office-xlsx-state/v1':
      return {
        ...base,
        unsupportedFormulaFunctions:
          state.compatibility.unsupportedFormulaFunctions.slice(0, 256),
        calculationErrors: state.compatibility.calculationErrors,
      };
    case 'localmind-office-pptx-state/v1':
      return {
        ...base,
        unsupportedShapeElements:
          state.compatibility.unsupportedShapeElements.slice(0, 256),
        animationPartCount: state.compatibility.animationParts.length,
      };
    case 'localmind-office-pdf-state/v1':
      return {
        ...base,
        signatures: state.compatibility.signatures,
        unsupportedFormFields: state.compatibility.unsupportedFormFields.slice(
          0,
          256
        ),
      };
  }
  throw new Error('Unsupported Office semantic state');
}

export function officeStateStats(state: NativeOfficeState) {
  return state.stats as unknown as Record<string, number>;
}

import type { GraphQLService } from '@affine/core/modules/cloud';
import type {
  OfficeArtifactQuery,
  ProjectOfficeArtifactQuery,
} from '@affine/graphql';
import type { OfficeCommand, OfficeSelection } from '@localmind/office';
import type { DocxBlock, DocxParagraph } from '@localmind/office/docx';
import type { PptxShape } from '@localmind/office/pptx';

import {
  executeOfficeCommand,
  fetchOfficeState,
  type NativeOfficeState,
  type OfficeArtifactKindValue,
  type OfficeCommentAnchor,
  type OfficeResourceOwner,
  previewOfficeCommand,
} from '../../../../modules/office';

export type OfficeArtifact =
  | NonNullable<OfficeArtifactQuery['officeArtifact']>
  | ProjectOfficeArtifactQuery['projectOfficeArtifact'];
export type OfficeRevision = OfficeArtifact['currentRevision'];

export function isHistoricalOfficeRevision(
  current: Pick<OfficeRevision, 'sequence'>,
  selected: Pick<OfficeRevision, 'sequence'>
) {
  return selected.sequence < current.sequence;
}

export function newestOfficeRevision<
  T extends Pick<OfficeRevision, 'sequence'>,
>(current: T | null, candidate: T) {
  return !current || candidate.sequence >= current.sequence
    ? candidate
    : current;
}

function collectDocumentBlocks(blocks: readonly DocxBlock[]) {
  const result: DocxBlock[] = [];
  const visit = (items: readonly DocxBlock[]) => {
    for (const block of items) {
      result.push(block);
      if (block.type === 'table') {
        for (const row of block.rows) {
          for (const cell of row.cells) visit(cell.blocks);
        }
      } else if (block.type === 'contentControl') {
        visit(block.blocks);
      }
    }
  };
  visit(blocks);
  return result;
}

function documentBlocks(state: Extract<NativeOfficeState, { body: unknown }>) {
  return [
    ...collectDocumentBlocks(state.body),
    ...state.stories.flatMap(story => collectDocumentBlocks(story.blocks)),
  ];
}

function findPresentationShape(
  shapes: readonly PptxShape[],
  shapeId: string
): PptxShape | null {
  for (const shape of shapes) {
    if (shape.id === shapeId) return shape;
    const child = findPresentationShape(shape.children ?? [], shapeId);
    if (child) return child;
  }
  return null;
}

export function isOfficeSelectionAvailable(
  state: NativeOfficeState,
  selection: OfficeSelection
) {
  switch (selection.kind) {
    case 'document': {
      if (state.schemaVersion !== 'localmind-office-docx-state/v1') {
        return false;
      }
      const blocks = documentBlocks(state);
      const byId = new Map(blocks.map(block => [block.id, block]));
      const target = selection.target;
      if (target.type === 'section') {
        return Boolean(state.sections[target.sectionIndex]);
      }
      const block = byId.get(
        target.type === 'text_range' ? target.start.blockId : target.blockId
      );
      if (!block) return false;
      if (target.type === 'paragraph') return block.type === 'paragraph';
      if (target.type === 'run') {
        return (
          block.type === 'paragraph' && Boolean(block.runs[target.runIndex])
        );
      }
      const end = byId.get(target.end.blockId);
      if (block.type !== 'paragraph' || end?.type !== 'paragraph') return false;
      return (
        target.start.offset <= (block as DocxParagraph).text.length &&
        target.end.offset <= end.text.length
      );
    }
    case 'workbook': {
      if (state.schemaVersion !== 'localmind-office-xlsx-state/v1') {
        return false;
      }
      const target = selection.target;
      const sheet = state.sheets.find(item => item.id === target.sheetId);
      if (!sheet) return false;
      if (target.type === 'table') {
        return sheet.tables.some(table => table.id === target.tableId);
      }
      if (target.type === 'chart') {
        return sheet.charts.some(chart => chart.id === target.chartId);
      }
      return true;
    }
    case 'presentation': {
      if (state.schemaVersion !== 'localmind-office-pptx-state/v1') {
        return false;
      }
      const target = selection.target;
      const slide = state.slides.find(item => item.id === target.slideId);
      if (!slide) return false;
      if (target.type === 'shape' || target.type === 'placeholder') {
        const shape = findPresentationShape(slide.shapes, target.shapeId);
        if (!shape) return false;
        return (
          target.type !== 'placeholder' ||
          !target.placeholderType ||
          shape.placeholder?.type === target.placeholderType
        );
      }
      return true;
    }
    case 'pdf': {
      if (state.schemaVersion !== 'localmind-office-pdf-state/v1') return false;
      const target = selection.target;
      if (target.type === 'form_field') {
        return state.formFields.some(field => field.name === target.fieldName);
      }
      const page = state.pages[target.pageIndex];
      if (!page) return false;
      return (
        target.type !== 'annotation' ||
        page.annotations.some(item => item.id === target.annotationId)
      );
    }
  }
}

export type NativeOfficeEditorProps<TState extends NativeOfficeState> = {
  state: TState;
  revision: OfficeRevision;
  artifactId: string;
  owner: OfficeResourceOwner;
  graphql: GraphQLService;
  readOnly: boolean;
  onRevision: (revision: OfficeRevision, state: TState) => void;
  onCommentAnchorChange: (anchor: OfficeCommentAnchor | null) => void;
  onAiSelectionChange: (selection: OfficeSelection | null) => void;
};

export async function executeAndReloadOfficeCommand<
  TState extends NativeOfficeState,
>(input: {
  graphql: GraphQLService;
  owner: OfficeResourceOwner;
  kind: OfficeArtifactKindValue;
  command: OfficeCommand;
}) {
  const preview = await previewOfficeCommand(
    input.graphql,
    input.owner,
    input.command
  );
  const execution = await executeOfficeCommand(
    input.graphql,
    input.owner,
    input.command
  );
  const revision = execution.executeOfficeCommand.artifact.currentRevision;
  if (!revision.stateUrl) {
    throw new Error('Saved revision has no editable Office state');
  }
  const state = await fetchOfficeState(revision.stateUrl, input.kind);
  return {
    revision: revision as OfficeRevision,
    state: state as TState,
    preview: preview.previewOfficeCommand,
    summary: execution.executeOfficeCommand.summary as Record<string, unknown>,
  };
}

export function officeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /revision conflict|stale/i.test(message)
    ? 'This Office file changed in another session. Reload the latest revision and retry.'
    : message;
}

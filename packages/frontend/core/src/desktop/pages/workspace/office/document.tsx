import { Button, IconButton, Loading, Modal, Tooltip } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import { NbstoreService } from '@affine/core/modules/storage';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewService,
  ViewSidebarTab,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import {
  type OfficeArtifactQuery,
  officeArtifactQuery,
  type OfficeRevisionCompareQuery,
  officeRevisionCompareQuery,
  type OfficeRevisionsQuery,
  officeRevisionsQuery,
} from '@affine/graphql';
import {
  AiIcon,
  BoldIcon,
  ChartPanelIcon,
  CommentIcon,
  DownloadIcon,
  ExportToPdfIcon,
  HistoryIcon,
  ImageIcon,
  ItalicIcon,
  PageIcon,
  PresentationIcon,
  ShapeIcon,
  TableIcon,
  UnderLineIcon,
} from '@blocksuite/icons/rc';
import type { OfficeSelection } from '@localmind/office';
import { useService } from '@toeverything/infra';
import { nanoid } from 'nanoid';
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import {
  collectDocxParagraphs,
  diffTextReplacement,
  type DocxBlock,
  type DocxParagraph,
  type DocxRunContent,
  docxRunContentText,
  type DocxRunFormat,
  type DocxSemanticState,
  downloadOfficePackage,
  executeOfficeDocxCommand,
  fetchOfficeState,
  isDocxSemanticState,
  isPdfSemanticState,
  isPptxSemanticState,
  isXlsxSemanticState,
  type NativeOfficeState,
  type OfficeCommentAnchor,
  type OfficeDocumentFormat,
  type OfficeDocumentFormatParagraphCommand,
  type OfficeDocumentFormatTextCommand,
  type OfficeDocumentHeaderFooterTextCommand,
  type OfficeDocumentInsertBreakCommand,
  type OfficeDocumentInsertObjectCommand,
  type OfficeDocumentInsertSectionCommand,
  type OfficeDocumentInsertTableCommand,
  type OfficeDocumentPageLayoutCommand,
  type OfficeDocumentReplaceTextCommand,
  type OfficeDocumentReviewResolveCommand,
  type OfficeDocxCommand,
  officePackagePartUrl,
  officePdfExportUrl,
  type OfficeResourceOwner,
  type OfficeTextRange,
  paginateDocxBlocks,
  previewOfficeDocxCommand,
  resolveOfficeTextRange,
} from '../../../../modules/office';
import { OfficeChatPanel, type OfficeTaskRevisionEvidence } from './chat';
import { OfficeCommentsPanel } from './comments';
import * as styles from './document.css';
import { PdfEditor } from './pdf';
import { PresentationEditor } from './presentation';
import {
  executeAndReloadOfficeCommand,
  isHistoricalOfficeRevision,
  isOfficeSelectionAvailable,
  newestOfficeRevision,
  officeErrorMessage,
  type OfficeRevision,
} from './shared';
import { SpreadsheetEditor } from './spreadsheet';
import * as surfaceStyles from './surface.css';

const FONT_FAMILIES = [
  'Aptos',
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Verdana',
];
const FONT_SIZES = [
  8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72,
];

type Artifact = NonNullable<OfficeArtifactQuery['officeArtifact']>;
type Revision = OfficeRevision;
type HistoryRevision = OfficeRevisionsQuery['officeRevisions'][number];
type RevisionCompare = OfficeRevisionCompareQuery['officeRevisionCompare'];
type DocxObject = OfficeDocumentInsertObjectCommand['object'];
type RevisionUpdateOptions = { preserveAiSelection?: boolean };

type RevisionCompareChange = {
  entity: string;
  id: string;
  change: 'added' | 'removed' | 'modified';
  label: string;
  changedFields?: string[];
  before?: string;
  after?: string;
};

export function revisionCompareChanges(
  value: unknown
): RevisionCompareChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RevisionCompareChange => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.entity === 'string' &&
      typeof candidate.id === 'string' &&
      ['added', 'removed', 'modified'].includes(String(candidate.change)) &&
      typeof candidate.label === 'string'
    );
  });
}

function useOfficeArtifact(workspaceId: string, artifactId: string) {
  const query = useQuery(
    {
      query: officeArtifactQuery,
      variables: { workspaceId, artifactId },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  return {
    ...query,
    artifact: query.data?.officeArtifact ?? null,
  };
}

function formatRunStyle(format?: DocxRunFormat): CSSProperties {
  if (!format) return {};
  const underline = format.underline;
  return {
    fontFamily: format.fontFamily,
    fontSize: format.fontSizePt ? `${format.fontSizePt}pt` : undefined,
    color: format.color,
    fontWeight: format.bold ? 700 : undefined,
    fontStyle: format.italic ? 'italic' : undefined,
    textDecorationLine:
      [underline ? 'underline' : '', format.strike ? 'line-through' : '']
        .filter(Boolean)
        .join(' ') || undefined,
    textDecorationStyle: underline
      ? underline.style === 'dash'
        ? 'dashed'
        : underline.style === 'wavy'
          ? 'wavy'
          : underline.style === 'double'
            ? 'double'
            : underline.style === 'dotted'
              ? 'dotted'
              : 'solid'
      : undefined,
    textDecorationColor:
      underline && underline.color ? underline.color : undefined,
    verticalAlign:
      format.verticalAlign === 'superscript'
        ? 'super'
        : format.verticalAlign === 'subscript'
          ? 'sub'
          : undefined,
  };
}

function RunObject({
  content,
  packageUrl,
}: {
  content: Extract<DocxRunContent, { type: 'object' }>;
  packageUrl: string;
}) {
  if (content.objectType === 'image' && content.part) {
    return (
      <span contentEditable={false} className={styles.inlineObject}>
        <img
          src={officePackagePartUrl(packageUrl, content.part)}
          alt={content.description ?? content.name ?? ''}
          title={content.name}
          style={{
            width: content.widthPt ? `${content.widthPt}pt` : undefined,
            height: content.heightPt ? `${content.heightPt}pt` : undefined,
          }}
        />
      </span>
    );
  }
  return (
    <span
      contentEditable={false}
      className={styles.inlineObjectPlaceholder}
      title={content.description ?? content.name}
    >
      {content.objectType}
    </span>
  );
}

function Paragraph({
  paragraph,
  order,
  disabled,
  packageUrl,
  onCommit,
}: {
  paragraph: DocxParagraph;
  order: number;
  disabled: boolean;
  packageUrl: string;
  onCommit: (paragraph: DocxParagraph, text: string) => void;
}) {
  let runOffset = 0;
  const outlineLevel = paragraph.properties?.outlineLevel;
  return (
    <p
      id={`office-block-${encodeURIComponent(paragraph.id)}`}
      className={styles.paragraph}
      data-office-block-id={paragraph.id}
      data-office-order={order}
      data-outline-level={outlineLevel}
      contentEditable={!disabled}
      suppressContentEditableWarning
      aria-label="Editable document paragraph"
      onBlur={event =>
        onCommit(paragraph, event.currentTarget.textContent ?? '')
      }
      style={{
        textAlign: paragraph.properties
          ?.alignment as CSSProperties['textAlign'],
      }}
    >
      {paragraph.runs.length ? (
        paragraph.runs.map((run, index) => {
          const text = docxRunContentText(run.content);
          const offset = runOffset;
          runOffset += text.length;
          return (
            <span
              key={`${paragraph.id}:${index}`}
              data-office-run-offset={offset}
              data-change={run.change}
              style={formatRunStyle(run.format)}
            >
              {run.content.map((content, contentIndex) =>
                content.type === 'object' ? (
                  <RunObject
                    key={`${paragraph.id}:${index}:${contentIndex}`}
                    content={content}
                    packageUrl={packageUrl}
                  />
                ) : (
                  <span key={`${paragraph.id}:${index}:${contentIndex}`}>
                    {docxRunContentText([content])}
                  </span>
                )
              )}
            </span>
          );
        })
      ) : (
        <br />
      )}
    </p>
  );
}

function Blocks({
  blocks,
  paragraphOrder,
  editingDisabled,
  packageUrl,
  onParagraphCommit,
}: {
  blocks: readonly DocxBlock[];
  paragraphOrder: ReadonlyMap<string, number>;
  editingDisabled: boolean;
  packageUrl: string;
  onParagraphCommit: (paragraph: DocxParagraph, text: string) => void;
}) {
  return blocks.map(block => {
    if (block.type === 'paragraph') {
      return (
        <Paragraph
          key={block.id}
          paragraph={block}
          order={paragraphOrder.get(block.id) ?? 0}
          disabled={editingDisabled}
          packageUrl={packageUrl}
          onCommit={onParagraphCommit}
        />
      );
    }
    if (block.type === 'table') {
      return (
        <table className={styles.table} key={block.id}>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${block.id}:row:${rowIndex}`}>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`${block.id}:cell:${rowIndex}:${cellIndex}`}
                    colSpan={cell.gridSpan}
                  >
                    <Blocks
                      blocks={cell.blocks}
                      paragraphOrder={paragraphOrder}
                      editingDisabled={editingDisabled}
                      packageUrl={packageUrl}
                      onParagraphCommit={onParagraphCommit}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (block.type === 'contentControl') {
      return (
        <section
          className={styles.contentControl}
          key={block.id}
          data-content-control={block.tag ?? block.title ?? ''}
        >
          <Blocks
            blocks={block.blocks}
            paragraphOrder={paragraphOrder}
            editingDisabled={editingDisabled}
            packageUrl={packageUrl}
            onParagraphCommit={onParagraphCommit}
          />
        </section>
      );
    }
    return (
      <div className={styles.unsupportedBlock} key={block.id}>
        Unsupported document object: {block.element}
      </div>
    );
  });
}

function Header({
  title,
  kind,
  revision,
  latestSequence,
  historical,
  downloading,
  returningLatest,
  onDownload,
  onHistory,
  onLatest,
  onComments,
  onAI,
  onPrint,
  onExportPdf,
}: {
  title: string;
  kind: Artifact['kind'];
  revision: Revision;
  latestSequence: number;
  historical: boolean;
  downloading: boolean;
  returningLatest: boolean;
  onDownload: () => void;
  onHistory: () => void;
  onLatest: () => void;
  onComments: () => void;
  onAI: () => void;
  onPrint: () => void;
  onExportPdf?: () => void;
}) {
  const icon =
    kind === 'workbook' ? (
      <TableIcon />
    ) : kind === 'presentation' ? (
      <PresentationIcon />
    ) : kind === 'pdf' ? (
      <ExportToPdfIcon />
    ) : (
      <PageIcon />
    );
  return (
    <div className={styles.header}>
      <div className={styles.headerTitle}>
        {icon}
        <span>{title}</span>
        <span className={styles.revisionLabel}>v{revision.sequence}</span>
      </div>
      <div className={styles.headerActions}>
        <Tooltip content="Open LocalMind AI">
          <IconButton size="24" onClick={onAI} aria-label="Open LocalMind AI">
            <AiIcon />
          </IconButton>
        </Tooltip>
        {historical ? (
          <Button
            variant="plain"
            disabled={returningLatest}
            loading={returningLatest}
            aria-label={`Return to latest Office revision v${latestSequence}`}
            onClick={onLatest}
          >
            Latest v{latestSequence}
          </Button>
        ) : null}
        {onExportPdf ? (
          <Tooltip content="Export PDF">
            <IconButton
              size="24"
              onClick={onExportPdf}
              disabled={downloading}
              aria-label="Export PDF"
            >
              <ExportToPdfIcon />
            </IconButton>
          </Tooltip>
        ) : null}
        <Button variant="plain" onClick={onPrint}>
          Print
        </Button>
        <Tooltip content="Comments and collaborators">
          <IconButton
            size="24"
            onClick={onComments}
            aria-label="Comments and collaborators"
          >
            <CommentIcon />
          </IconButton>
        </Tooltip>
        <Tooltip content="Revision history">
          <IconButton
            size="24"
            onClick={onHistory}
            aria-label="Revision history"
          >
            <HistoryIcon />
          </IconButton>
        </Tooltip>
        <IconButton
          size="24"
          onClick={onDownload}
          disabled={downloading}
          tooltip="Download native Office file"
          aria-label="Download native Office file"
        >
          <DownloadIcon />
        </IconButton>
      </div>
    </div>
  );
}

function RevisionHistory({
  open,
  workspaceId,
  artifactId,
  selectedRevision,
  graphql,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  workspaceId: string;
  artifactId: string;
  selectedRevision: Revision;
  graphql: GraphQLService;
  onOpenChange: (open: boolean) => void;
  onSelect: (revision: HistoryRevision) => void;
}) {
  const [compare, setCompare] = useState<RevisionCompare | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const query = useQuery(
    {
      query: officeRevisionsQuery,
      variables: { workspaceId, artifactId, limit: 100 },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  const refreshRevisions = query.mutate;

  useEffect(() => {
    if (!open) return;
    refreshRevisions().catch(console.error);
  }, [open, refreshRevisions]);

  const compareWithSelected = useCallback(
    async (revision: HistoryRevision) => {
      if (revision.id === selectedRevision.id) return;
      setComparing(revision.id);
      setCompareError(null);
      try {
        const result = await graphql.gql({
          query: officeRevisionCompareQuery,
          variables: {
            workspaceId,
            artifactId,
            beforeRevisionId: revision.id,
            afterRevisionId: selectedRevision.id,
          },
        });
        setCompare(result.officeRevisionCompare);
      } catch (error) {
        setCompareError(officeErrorMessage(error));
      } finally {
        setComparing(null);
      }
    },
    [artifactId, graphql, selectedRevision.id, workspaceId]
  );

  const summary = (compare?.summary ?? {}) as Record<string, number>;
  const changes = revisionCompareChanges(compare?.changes);
  return (
    <Modal
      open={open}
      title="Revision history"
      width={680}
      onOpenChange={onOpenChange}
    >
      <div className={surfaceStyles.historyPanel}>
        <div className={surfaceStyles.historyHeader}>
          <span>Immutable Office revisions</span>
          <span>Comparing against v{selectedRevision.sequence}</span>
        </div>
        <div className={surfaceStyles.historyList}>
          {query.isLoading ? (
            <CenterState>
              <Loading />
              <span>Loading revisions…</span>
            </CenterState>
          ) : query.error ? (
            <CenterState>
              <span>{query.error.message}</span>
              <Button onClick={() => void query.mutate()}>Retry</Button>
            </CenterState>
          ) : query.data?.officeRevisions.length ? (
            query.data.officeRevisions.map(revision => (
              <div className={surfaceStyles.historyRow} key={revision.id}>
                <button
                  type="button"
                  className={surfaceStyles.historyItem}
                  data-active={revision.id === selectedRevision.id}
                  onClick={() => onSelect(revision)}
                >
                  <span className={surfaceStyles.historySequence}>
                    v{revision.sequence}
                  </span>
                  <span className={surfaceStyles.historyMeta}>
                    <strong>
                      {String(
                        revision.operationSummary.operation ??
                          revision.operationSummary.type ??
                          revision.origin
                      )}
                    </strong>
                    <span>
                      {new Date(revision.createdAt).toLocaleString()} ·{' '}
                      {revision.origin}
                    </span>
                  </span>
                </button>
                <Button
                  variant="plain"
                  disabled={revision.id === selectedRevision.id}
                  loading={comparing === revision.id}
                  onClick={() => void compareWithSelected(revision)}
                >
                  Compare
                </Button>
              </div>
            ))
          ) : (
            <CenterState>
              <span>No revisions are available.</span>
            </CenterState>
          )}
        </div>
        {compareError ? (
          <div className={surfaceStyles.historyCompareError}>
            {compareError}
          </div>
        ) : null}
        {compare ? (
          <section className={surfaceStyles.historyCompare}>
            <div className={surfaceStyles.historyCompareTitle}>
              v{compare.beforeRevision.sequence} to v
              {compare.afterRevision.sequence}
            </div>
            <div className={surfaceStyles.historyCompareSummary}>
              <span>{summary.added ?? 0} added</span>
              <span>{summary.removed ?? 0} removed</span>
              <span>{summary.modified ?? 0} modified</span>
              <span>{summary.unchanged ?? 0} unchanged</span>
            </div>
            {changes.length ? (
              <div className={surfaceStyles.historyCompareChanges}>
                {changes.map(change => (
                  <div
                    className={surfaceStyles.historyCompareChange}
                    data-change={change.change}
                    key={`${change.entity}:${change.id}`}
                  >
                    <strong>{change.label}</strong>
                    <span>
                      {change.change} {change.entity}
                      {change.changedFields?.length
                        ? ` · ${change.changedFields.join(', ')}`
                        : ''}
                    </span>
                    {change.before ? <del>{change.before}</del> : null}
                    {change.after ? <ins>{change.after}</ins> : null}
                  </div>
                ))}
                {compare.truncated ? (
                  <span className={surfaceStyles.historyCompareTruncated}>
                    More changes exist beyond the bounded comparison result.
                  </span>
                ) : null}
              </div>
            ) : (
              <span className={surfaceStyles.historyCompareEmpty}>
                These revisions have the same native semantic state.
              </span>
            )}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

function finiteNumber(value: string, label: string, minimum = 0.01) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) {
    throw new Error(`${label} must be at least ${minimum}.`);
  }
  return number;
}

async function fileAsBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }
  return btoa(binary);
}

function ObjectInsertDialog({
  open,
  initialType,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initialType: DocxObject['type'];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (object: DocxObject) => Promise<boolean>;
}) {
  const [type, setType] = useState<DocxObject['type']>(initialType);
  const [width, setWidth] = useState('240');
  const [height, setHeight] = useState('160');
  const [image, setImage] = useState<File | null>(null);
  const [imageName, setImageName] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [shape, setShape] =
    useState<Extract<DocxObject, { type: 'shape' }>['shape']>('rectangle');
  const [shapeText, setShapeText] = useState('');
  const [fillColor, setFillColor] = useState('#DCEBFF');
  const [lineColor, setLineColor] = useState('#245BDB');
  const [equation, setEquation] = useState('x^2 + y^2 = z^2');
  const [chartType, setChartType] =
    useState<Extract<DocxObject, { type: 'chart' }>['chartType']>('column');
  const [chartTitle, setChartTitle] = useState('');
  const [categories, setCategories] = useState('Q1, Q2, Q3, Q4');
  const [series, setSeries] = useState('Series 1: 12, 18, 24, 31');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setError(null);
  }, [initialType, open]);

  const submit = useCallback(async () => {
    setError(null);
    try {
      let object: DocxObject;
      if (type === 'image') {
        if (!image) throw new Error('Choose a PNG, JPEG, or GIF image.');
        if (!['image/png', 'image/jpeg', 'image/gif'].includes(image.type)) {
          throw new Error('The selected image format is not supported.');
        }
        object = {
          type,
          mimeType: image.type as 'image/png' | 'image/jpeg' | 'image/gif',
          dataBase64: await fileAsBase64(image),
          widthPt: finiteNumber(width, 'Width'),
          heightPt: finiteNumber(height, 'Height'),
          name: imageName.trim() || image.name,
          description: imageDescription.trim() || undefined,
        };
      } else if (type === 'shape') {
        object = {
          type,
          shape,
          widthPt: finiteNumber(width, 'Width'),
          heightPt: finiteNumber(height, 'Height'),
          text: shapeText || undefined,
          fillColor,
          lineColor,
        };
      } else if (type === 'equation') {
        if (!equation.trim()) throw new Error('Enter an equation.');
        object = { type, linearText: equation.trim() };
      } else {
        const categoryValues = categories
          .split(',')
          .map(value => value.trim())
          .filter(Boolean);
        if (!categoryValues.length) {
          throw new Error('Enter at least one chart category.');
        }
        const seriesValues = series
          .split('\n')
          .map(value => value.trim())
          .filter(Boolean)
          .map((line, index) => {
            const separator = line.indexOf(':');
            const name =
              separator === -1
                ? `Series ${index + 1}`
                : line.slice(0, separator).trim();
            const values = (separator === -1 ? line : line.slice(separator + 1))
              .split(',')
              .map(value => Number(value.trim()));
            if (
              !name ||
              values.length !== categoryValues.length ||
              values.some(value => !Number.isFinite(value))
            ) {
              throw new Error(
                `Chart series ${index + 1} must have one numeric value per category.`
              );
            }
            return { name, values };
          });
        if (!seriesValues.length) throw new Error('Enter at least one series.');
        object = {
          type,
          chartType,
          title: chartTitle.trim() || undefined,
          categories: categoryValues,
          series: seriesValues,
          widthPt: finiteNumber(width, 'Width'),
          heightPt: finiteNumber(height, 'Height'),
        };
      }
      if (await onSubmit(object)) onOpenChange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [
    categories,
    chartTitle,
    chartType,
    equation,
    fillColor,
    height,
    image,
    imageDescription,
    imageName,
    lineColor,
    onOpenChange,
    onSubmit,
    series,
    shape,
    shapeText,
    type,
    width,
  ]);

  return (
    <Modal
      open={open}
      title="Insert document object"
      width={520}
      onOpenChange={onOpenChange}
    >
      <div className={styles.dialogForm}>
        <label className={styles.dialogField}>
          <span>Object type</span>
          <select
            className={surfaceStyles.select}
            value={type}
            disabled={saving}
            onChange={event =>
              setType(event.target.value as DocxObject['type'])
            }
          >
            <option value="image">Image</option>
            <option value="shape">Shape</option>
            <option value="equation">Equation</option>
            <option value="chart">Chart</option>
          </select>
        </label>
        {type === 'image' ? (
          <>
            <label className={surfaceStyles.fileButton}>
              <ImageIcon />
              {image?.name ?? 'Choose image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                disabled={saving}
                onChange={event => setImage(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className={styles.dialogGrid}>
              <label className={styles.dialogField}>
                <span>Name</span>
                <input
                  className={surfaceStyles.field}
                  value={imageName}
                  maxLength={512}
                  disabled={saving}
                  onChange={event => setImageName(event.target.value)}
                />
              </label>
              <label className={styles.dialogField}>
                <span>Alt text</span>
                <input
                  className={surfaceStyles.field}
                  value={imageDescription}
                  maxLength={2048}
                  disabled={saving}
                  onChange={event => setImageDescription(event.target.value)}
                />
              </label>
            </div>
          </>
        ) : type === 'shape' ? (
          <>
            <div className={styles.dialogGrid}>
              <label className={styles.dialogField}>
                <span>Shape</span>
                <select
                  className={surfaceStyles.select}
                  value={shape}
                  disabled={saving}
                  onChange={event =>
                    setShape(event.target.value as typeof shape)
                  }
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="roundedRectangle">Rounded rectangle</option>
                  <option value="ellipse">Ellipse</option>
                  <option value="line">Line</option>
                </select>
              </label>
              <label className={styles.dialogField}>
                <span>Text</span>
                <input
                  className={surfaceStyles.field}
                  value={shapeText}
                  maxLength={64 * 1024}
                  disabled={saving || shape === 'line'}
                  onChange={event => setShapeText(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.dialogGrid}>
              <label className={styles.dialogField}>
                <span>Fill</span>
                <input
                  className={surfaceStyles.colorInput}
                  type="color"
                  value={fillColor}
                  disabled={saving}
                  onChange={event =>
                    setFillColor(event.target.value.toUpperCase())
                  }
                />
              </label>
              <label className={styles.dialogField}>
                <span>Line</span>
                <input
                  className={surfaceStyles.colorInput}
                  type="color"
                  value={lineColor}
                  disabled={saving}
                  onChange={event =>
                    setLineColor(event.target.value.toUpperCase())
                  }
                />
              </label>
            </div>
          </>
        ) : type === 'equation' ? (
          <label className={styles.dialogField}>
            <span>Linear equation</span>
            <textarea
              className={surfaceStyles.textarea}
              value={equation}
              maxLength={64 * 1024}
              disabled={saving}
              onChange={event => setEquation(event.target.value)}
            />
          </label>
        ) : (
          <>
            <div className={styles.dialogGrid}>
              <label className={styles.dialogField}>
                <span>Chart type</span>
                <select
                  className={surfaceStyles.select}
                  value={chartType}
                  disabled={saving}
                  onChange={event =>
                    setChartType(event.target.value as typeof chartType)
                  }
                >
                  <option value="column">Column</option>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
              </label>
              <label className={styles.dialogField}>
                <span>Title</span>
                <input
                  className={surfaceStyles.field}
                  value={chartTitle}
                  maxLength={1024}
                  disabled={saving}
                  onChange={event => setChartTitle(event.target.value)}
                />
              </label>
            </div>
            <label className={styles.dialogField}>
              <span>Categories</span>
              <input
                className={surfaceStyles.field}
                value={categories}
                disabled={saving}
                onChange={event => setCategories(event.target.value)}
              />
            </label>
            <label className={styles.dialogField}>
              <span>Series</span>
              <textarea
                className={surfaceStyles.textarea}
                value={series}
                disabled={saving}
                onChange={event => setSeries(event.target.value)}
              />
            </label>
          </>
        )}
        {type !== 'equation' ? (
          <div className={styles.dialogGrid}>
            <label className={styles.dialogField}>
              <span>Width (pt)</span>
              <input
                className={surfaceStyles.field}
                type="number"
                min="1"
                value={width}
                disabled={saving}
                onChange={event => setWidth(event.target.value)}
              />
            </label>
            <label className={styles.dialogField}>
              <span>Height (pt)</span>
              <input
                className={surfaceStyles.field}
                type="number"
                min="1"
                value={height}
                disabled={saving}
                onChange={event => setHeight(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        {error ? <div className={styles.dialogError}>{error}</div> : null}
        <div className={styles.dialogActions}>
          <Button disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={() => void submit()}
          >
            Insert
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PageLayoutDialog({
  open,
  state,
  selectionAvailable,
  saving,
  onOpenChange,
  onSubmit,
  onInsertSection,
}: {
  open: boolean;
  state: DocxSemanticState;
  selectionAvailable: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    sectionIndex: number,
    layout: OfficeDocumentPageLayoutCommand['layout']
  ) => Promise<boolean>;
  onInsertSection: (
    sectionType: OfficeDocumentInsertSectionCommand['sectionType'],
    sourceSectionIndex: number
  ) => Promise<boolean>;
}) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [width, setWidth] = useState('612');
  const [height, setHeight] = useState('792');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    'portrait'
  );
  const [marginTop, setMarginTop] = useState('72');
  const [marginRight, setMarginRight] = useState('72');
  const [marginBottom, setMarginBottom] = useState('72');
  const [marginLeft, setMarginLeft] = useState('72');
  const [header, setHeader] = useState('36');
  const [footer, setFooter] = useState('36');
  const [gutter, setGutter] = useState('0');
  const [columns, setColumns] = useState('1');
  const [titlePage, setTitlePage] = useState(false);
  const [sectionType, setSectionType] =
    useState<OfficeDocumentInsertSectionCommand['sectionType']>('nextPage');
  const [error, setError] = useState<string | null>(null);

  const loadSection = useCallback(
    (index: number) => {
      const section = state.sections[index];
      setSectionIndex(index);
      setWidth(String(section?.pageSize?.widthPt ?? 612));
      setHeight(String(section?.pageSize?.heightPt ?? 792));
      setOrientation(
        section?.pageSize?.orientation === 'landscape'
          ? 'landscape'
          : 'portrait'
      );
      setMarginTop(String(section?.margins?.topPt ?? 72));
      setMarginRight(String(section?.margins?.rightPt ?? 72));
      setMarginBottom(String(section?.margins?.bottomPt ?? 72));
      setMarginLeft(String(section?.margins?.leftPt ?? 72));
      setHeader(String(section?.margins?.headerPt ?? 36));
      setFooter(String(section?.margins?.footerPt ?? 36));
      setGutter(String(section?.margins?.gutterPt ?? 0));
      setColumns(String(section?.columns ?? 1));
      setTitlePage(section?.titlePage ?? false);
    },
    [state.sections]
  );

  useEffect(() => {
    if (!open) return;
    loadSection(Math.min(sectionIndex, Math.max(0, state.sections.length - 1)));
    setError(null);
  }, [loadSection, open, sectionIndex, state.sections.length]);

  const save = useCallback(async () => {
    setError(null);
    try {
      const success = await onSubmit(sectionIndex, {
        widthPt: finiteNumber(width, 'Page width'),
        heightPt: finiteNumber(height, 'Page height'),
        orientation,
        marginTopPt: finiteNumber(marginTop, 'Top margin', 0),
        marginRightPt: finiteNumber(marginRight, 'Right margin', 0),
        marginBottomPt: finiteNumber(marginBottom, 'Bottom margin', 0),
        marginLeftPt: finiteNumber(marginLeft, 'Left margin', 0),
        headerPt: finiteNumber(header, 'Header position', 0),
        footerPt: finiteNumber(footer, 'Footer position', 0),
        gutterPt: finiteNumber(gutter, 'Gutter', 0),
        columns: Math.trunc(finiteNumber(columns, 'Columns', 1)),
        titlePage,
      });
      if (success) onOpenChange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [
    columns,
    footer,
    gutter,
    header,
    height,
    marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    onOpenChange,
    onSubmit,
    orientation,
    sectionIndex,
    titlePage,
    width,
  ]);

  const insertSection = useCallback(async () => {
    setError(null);
    try {
      if (await onInsertSection(sectionType, sectionIndex)) {
        onOpenChange(false);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [onInsertSection, onOpenChange, sectionIndex, sectionType]);

  return (
    <Modal
      open={open}
      title="Page and section setup"
      width={560}
      onOpenChange={onOpenChange}
    >
      <div className={styles.dialogForm}>
        <label className={styles.dialogField}>
          <span>Section</span>
          <select
            className={surfaceStyles.select}
            value={sectionIndex}
            disabled={saving}
            onChange={event => loadSection(Number(event.target.value))}
          >
            {(state.sections.length ? state.sections : [{ index: 0 }]).map(
              section => (
                <option value={section.index} key={section.index}>
                  Section {section.index + 1}
                </option>
              )
            )}
          </select>
        </label>
        <div className={styles.dialogGrid}>
          <label className={styles.dialogField}>
            <span>Orientation</span>
            <select
              className={surfaceStyles.select}
              value={orientation}
              disabled={saving}
              onChange={event => {
                const next = event.target.value as typeof orientation;
                setOrientation(next);
                const currentWidth = Number(width);
                const currentHeight = Number(height);
                if (
                  Number.isFinite(currentWidth) &&
                  Number.isFinite(currentHeight)
                ) {
                  setWidth(
                    String(
                      next === 'landscape'
                        ? Math.max(currentWidth, currentHeight)
                        : Math.min(currentWidth, currentHeight)
                    )
                  );
                  setHeight(
                    String(
                      next === 'landscape'
                        ? Math.min(currentWidth, currentHeight)
                        : Math.max(currentWidth, currentHeight)
                    )
                  );
                }
              }}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label className={styles.dialogField}>
            <span>Columns</span>
            <input
              className={surfaceStyles.field}
              type="number"
              min="1"
              max="64"
              value={columns}
              disabled={saving}
              onChange={event => setColumns(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.dialogGrid}>
          <label className={styles.dialogField}>
            <span>Page width (pt)</span>
            <input
              className={surfaceStyles.field}
              type="number"
              min="1"
              value={width}
              disabled={saving}
              onChange={event => setWidth(event.target.value)}
            />
          </label>
          <label className={styles.dialogField}>
            <span>Page height (pt)</span>
            <input
              className={surfaceStyles.field}
              type="number"
              min="1"
              value={height}
              disabled={saving}
              onChange={event => setHeight(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.dialogGridFour}>
          {[
            { label: 'Top', value: marginTop, setValue: setMarginTop },
            { label: 'Right', value: marginRight, setValue: setMarginRight },
            { label: 'Bottom', value: marginBottom, setValue: setMarginBottom },
            { label: 'Left', value: marginLeft, setValue: setMarginLeft },
          ].map(({ label, value, setValue }) => (
            <label className={styles.dialogField} key={label}>
              <span>{label} margin</span>
              <input
                className={surfaceStyles.field}
                type="number"
                min="0"
                value={value}
                disabled={saving}
                onChange={event => setValue(event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className={styles.dialogGridThree}>
          {[
            { label: 'Header', value: header, setValue: setHeader },
            { label: 'Footer', value: footer, setValue: setFooter },
            { label: 'Gutter', value: gutter, setValue: setGutter },
          ].map(({ label, value, setValue }) => (
            <label className={styles.dialogField} key={label}>
              <span>{label} (pt)</span>
              <input
                className={surfaceStyles.field}
                type="number"
                min="0"
                value={value}
                disabled={saving}
                onChange={event => setValue(event.target.value)}
              />
            </label>
          ))}
        </div>
        <label className={styles.dialogCheck}>
          <input
            type="checkbox"
            checked={titlePage}
            disabled={saving}
            onChange={event => setTitlePage(event.target.checked)}
          />
          Different first page
        </label>
        <div className={styles.dialogSectionAction}>
          <select
            className={surfaceStyles.select}
            value={sectionType}
            disabled={saving || !selectionAvailable}
            onChange={event =>
              setSectionType(event.target.value as typeof sectionType)
            }
          >
            <option value="nextPage">Next page section</option>
            <option value="continuous">Continuous section</option>
            <option value="evenPage">Even page section</option>
            <option value="oddPage">Odd page section</option>
          </select>
          <Button
            disabled={saving || !selectionAvailable}
            onClick={() => void insertSection()}
          >
            Insert after selection
          </Button>
        </div>
        {error ? <div className={styles.dialogError}>{error}</div> : null}
        <div className={styles.dialogActions}>
          <Button disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={() => void save()}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StoryDialog({
  open,
  initialKind,
  state,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initialKind: 'header' | 'footer';
  state: DocxSemanticState;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    sectionIndex: number,
    kind: 'header' | 'footer',
    storyType: OfficeDocumentHeaderFooterTextCommand['storyType'],
    text: string
  ) => Promise<boolean>;
}) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [kind, setKind] = useState(initialKind);
  const [storyType, setStoryType] =
    useState<OfficeDocumentHeaderFooterTextCommand['storyType']>('default');
  const [text, setText] = useState('');

  const loadStory = useCallback(
    (
      nextSection: number,
      nextKind: 'header' | 'footer',
      nextType: typeof storyType
    ) => {
      const section = state.sections[nextSection];
      const reference = (
        nextKind === 'header'
          ? section?.headerReferences
          : section?.footerReferences
      )?.find(candidate => (candidate.type ?? 'default') === nextType);
      const story = state.stories.find(candidate =>
        reference?.part
          ? candidate.part === reference.part
          : candidate.kind === nextKind &&
            (candidate.type ?? 'default') === nextType
      );
      setText(
        story
          ? collectDocxParagraphs(story.blocks)
              .map(paragraph => paragraph.text)
              .join('\n')
          : ''
      );
    },
    [state.sections, state.stories]
  );

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setSectionIndex(0);
    setStoryType('default');
    loadStory(0, initialKind, 'default');
  }, [initialKind, loadStory, open]);

  return (
    <Modal
      open={open}
      title="Header and footer"
      width={520}
      onOpenChange={onOpenChange}
    >
      <div className={styles.dialogForm}>
        <div className={styles.dialogGridThree}>
          <label className={styles.dialogField}>
            <span>Section</span>
            <select
              className={surfaceStyles.select}
              value={sectionIndex}
              disabled={saving}
              onChange={event => {
                const next = Number(event.target.value);
                setSectionIndex(next);
                loadStory(next, kind, storyType);
              }}
            >
              {(state.sections.length ? state.sections : [{ index: 0 }]).map(
                section => (
                  <option value={section.index} key={section.index}>
                    Section {section.index + 1}
                  </option>
                )
              )}
            </select>
          </label>
          <label className={styles.dialogField}>
            <span>Area</span>
            <select
              className={surfaceStyles.select}
              value={kind}
              disabled={saving}
              onChange={event => {
                const next = event.target.value as typeof kind;
                setKind(next);
                loadStory(sectionIndex, next, storyType);
              }}
            >
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </label>
          <label className={styles.dialogField}>
            <span>Page type</span>
            <select
              className={surfaceStyles.select}
              value={storyType}
              disabled={saving}
              onChange={event => {
                const next = event.target.value as typeof storyType;
                setStoryType(next);
                loadStory(sectionIndex, kind, next);
              }}
            >
              <option value="default">Default</option>
              <option value="first">First page</option>
              <option value="even">Even pages</option>
            </select>
          </label>
        </div>
        <label className={styles.dialogField}>
          <span>Text</span>
          <textarea
            className={surfaceStyles.textarea}
            value={text}
            maxLength={4 * 1024 * 1024}
            disabled={saving}
            onChange={event => setText(event.target.value)}
          />
        </label>
        <div className={styles.dialogActions}>
          <Button disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={() =>
              void onSubmit(sectionIndex, kind, storyType, text).then(
                success => {
                  if (success) onOpenChange(false);
                }
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Toolbar({
  format,
  selection,
  pending,
  saving,
  onFormatChange,
  onParagraphAlignment,
  onInsertPageBreak,
  onInsertTable,
  onInsertObject,
  onOpenPageLayout,
  onEditStory,
  onPreview,
}: {
  format: OfficeDocumentFormat;
  selection: OfficeTextRange | null;
  pending: boolean;
  saving: boolean;
  onFormatChange: (format: OfficeDocumentFormat) => void;
  onParagraphAlignment: (
    alignment: OfficeDocumentFormatParagraphCommand['format']['alignment']
  ) => void;
  onInsertPageBreak: () => void;
  onInsertTable: () => void;
  onInsertObject: (type: DocxObject['type']) => void;
  onOpenPageLayout: () => void;
  onEditStory: (kind: 'header' | 'footer') => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Document formatting"
    >
      <select
        className={styles.select}
        value={format.paragraphStyleId ?? ''}
        aria-label="Paragraph style"
        onChange={event =>
          onFormatChange({
            ...format,
            paragraphStyleId: event.target.value || undefined,
          })
        }
      >
        <option value="">Normal</option>
        <option value="Title">Title</option>
        <option value="Subtitle">Subtitle</option>
        <option value="Heading1">Heading 1</option>
        <option value="Heading2">Heading 2</option>
        <option value="Heading3">Heading 3</option>
      </select>
      <select
        className={styles.fontSelect}
        value={format.fontFamily ?? ''}
        aria-label="Font family"
        onChange={event =>
          onFormatChange({
            ...format,
            fontFamily: event.target.value || undefined,
          })
        }
      >
        <option value="">Document font</option>
        {FONT_FAMILIES.map(font => (
          <option key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </option>
        ))}
      </select>
      <select
        className={styles.sizeSelect}
        value={format.fontSizePt ?? ''}
        aria-label="Font size"
        onChange={event =>
          onFormatChange({
            ...format,
            fontSizePt: event.target.value
              ? Number(event.target.value)
              : undefined,
          })
        }
      >
        <option value="">Size</option>
        {FONT_SIZES.map(size => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <div className={styles.toolbarDivider} />
      <IconButton
        size="24"
        tooltip="Bold"
        aria-label="Bold"
        aria-pressed={format.bold === true}
        data-active={format.bold === true}
        onClick={() => onFormatChange({ ...format, bold: !format.bold })}
      >
        <BoldIcon />
      </IconButton>
      <IconButton
        size="24"
        tooltip="Italic"
        aria-label="Italic"
        aria-pressed={format.italic === true}
        data-active={format.italic === true}
        onClick={() => onFormatChange({ ...format, italic: !format.italic })}
      >
        <ItalicIcon />
      </IconButton>
      <IconButton
        size="24"
        tooltip="Underline"
        aria-label="Underline"
        aria-pressed={Boolean(format.underline)}
        data-active={Boolean(format.underline)}
        onClick={() =>
          onFormatChange({
            ...format,
            underline: format.underline ? false : { style: 'single' },
          })
        }
      >
        <UnderLineIcon />
      </IconButton>
      <label className={styles.colorControl} title="Text color">
        <span>A</span>
        <input
          type="color"
          value={format.textColor ?? '#1f2329'}
          aria-label="Text color"
          onChange={event =>
            onFormatChange({
              ...format,
              textColor: event.target.value.toUpperCase(),
            })
          }
        />
      </label>
      <select
        className={styles.select}
        defaultValue=""
        disabled={!selection || saving}
        aria-label="Paragraph alignment"
        onChange={event => {
          const alignment = event.target.value as
            | OfficeDocumentFormatParagraphCommand['format']['alignment']
            | '';
          if (alignment) onParagraphAlignment(alignment);
          event.currentTarget.value = '';
        }}
      >
        <option value="">Align</option>
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
        <option value="both">Justify</option>
      </select>
      <Button
        variant="plain"
        disabled={!selection || saving}
        onClick={onInsertPageBreak}
      >
        Page break
      </Button>
      <Button
        variant="plain"
        disabled={!selection || saving}
        onClick={onInsertTable}
      >
        Insert table
      </Button>
      <Button
        variant="plain"
        disabled={!selection || saving}
        onClick={() => onInsertObject('image')}
      >
        <ImageIcon />
        Image
      </Button>
      <Button
        variant="plain"
        disabled={!selection || saving}
        onClick={() => onInsertObject('shape')}
      >
        <ShapeIcon />
        Shape
      </Button>
      <Button
        variant="plain"
        disabled={!selection || saving}
        onClick={() => onInsertObject('chart')}
      >
        <ChartPanelIcon />
        Chart
      </Button>
      <Button
        variant="plain"
        disabled={!selection || saving}
        onClick={() => onInsertObject('equation')}
      >
        Equation
      </Button>
      <Button variant="plain" disabled={saving} onClick={onOpenPageLayout}>
        Page setup
      </Button>
      <Button
        variant="plain"
        disabled={saving}
        onClick={() => onEditStory('header')}
      >
        Header
      </Button>
      <Button
        variant="plain"
        disabled={saving}
        onClick={() => onEditStory('footer')}
      >
        Footer
      </Button>
      <div className={styles.toolbarSpacer} />
      <span className={styles.selectionStatus}>
        {selection ? 'Selection ready' : 'Select text to format'}
      </span>
      <Button
        variant="primary"
        disabled={!selection || saving}
        loading={pending}
        onClick={onPreview}
      >
        Preview
      </Button>
    </div>
  );
}

function CenterState({ children }: { children: ReactNode }) {
  return <div className={styles.centerState}>{children}</div>;
}

export function DocumentEditor({
  state,
  revision,
  artifactId,
  owner,
  graphql,
  readOnly,
  onRevision,
  onCommentAnchorChange,
  onAiSelectionChange,
}: {
  state: DocxSemanticState;
  revision: Revision;
  artifactId: string;
  owner: OfficeResourceOwner;
  graphql: GraphQLService;
  readOnly: boolean;
  onRevision: (revision: Revision, state: DocxSemanticState) => void;
  onCommentAnchorChange: (anchor: OfficeCommentAnchor | null) => void;
  onAiSelectionChange: (selection: OfficeSelection | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<OfficeTextRange | null>(null);
  const [format, setFormat] = useState<OfficeDocumentFormat>({});
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [objectDialogType, setObjectDialogType] = useState<
    DocxObject['type'] | null
  >(null);
  const [pageLayoutOpen, setPageLayoutOpen] = useState(false);
  const [storyDialogKind, setStoryDialogKind] = useState<
    'header' | 'footer' | null
  >(null);
  const [preview, setPreview] = useState<{
    command: OfficeDocumentFormatTextCommand;
    stats: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paragraphs = useMemo(() => collectDocxParagraphs(state.body), [state]);
  const paragraphOrder = useMemo(
    () => new Map(paragraphs.map((paragraph, index) => [paragraph.id, index])),
    [paragraphs]
  );
  const pages = useMemo(
    () => paginateDocxBlocks(state.body, state.sections),
    [state.body, state.sections]
  );
  const headings = useMemo(
    () =>
      paragraphs.filter(
        paragraph =>
          paragraph.text.trim() &&
          (paragraph.properties?.outlineLevel !== undefined ||
            paragraph.properties?.styleId?.toLowerCase().startsWith('heading'))
      ),
    [paragraphs]
  );
  const defaultHeader = useMemo(
    () =>
      state.stories.find(
        story =>
          story.kind === 'header' && (story.type ?? 'default') === 'default'
      ),
    [state.stories]
  );
  const defaultFooter = useMemo(
    () =>
      state.stories.find(
        story =>
          story.kind === 'footer' && (story.type ?? 'default') === 'default'
      ),
    [state.stories]
  );
  const storyText = useCallback(
    (story: typeof defaultHeader) =>
      story
        ? collectDocxParagraphs(story.blocks)
            .map(paragraph => paragraph.text)
            .join('\n')
        : '',
    []
  );

  const executeImmediate = useCallback(
    async (command: OfficeDocxCommand) => {
      if (readOnly || saving) return false;
      setSaving(true);
      setError(null);
      try {
        const result = await executeAndReloadOfficeCommand<DocxSemanticState>({
          graphql,
          owner,
          kind: 'document',
          command,
        });
        onRevision(result.revision, result.state);
        setPreview(null);
        setSelection(null);
        return true;
      } catch (err) {
        setError(officeErrorMessage(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [graphql, onRevision, owner, readOnly, saving]
  );

  const executeImmediateInBackground = useCallback(
    (command: OfficeDocxCommand) => {
      executeImmediate(command).catch(err => {
        setError(officeErrorMessage(err));
      });
    },
    [executeImmediate]
  );

  const commandBase = useCallback(() => {
    const id = nanoid();
    return {
      version: 'localmind-office-command/v1' as const,
      commandId: id,
      idempotencyKey: `office-user:${id}`,
      artifactId,
      expectedRevisionId: revision.id,
      source: 'user' as const,
    };
  }, [artifactId, revision.id]);

  const handleParagraphAlignment = useCallback(
    (
      alignment: OfficeDocumentFormatParagraphCommand['format']['alignment']
    ) => {
      if (!selection || !alignment) return;
      executeImmediateInBackground({
        ...commandBase(),
        operation: 'office.document.paragraph.format',
        target: { type: 'paragraph', blockId: selection.start.blockId },
        format: { alignment },
      } satisfies OfficeDocumentFormatParagraphCommand);
    },
    [commandBase, executeImmediateInBackground, selection]
  );

  const handleInsertPageBreak = useCallback(() => {
    if (!selection) return;
    executeImmediateInBackground({
      ...commandBase(),
      operation: 'office.document.break.insert',
      target: selection.start,
      breakType: 'page',
    } satisfies OfficeDocumentInsertBreakCommand);
  }, [commandBase, executeImmediateInBackground, selection]);

  const handleInsertTable = useCallback(() => {
    if (!selection) return;
    executeImmediateInBackground({
      ...commandBase(),
      operation: 'office.document.table.insert',
      afterBlockId: selection.end.blockId,
      rows: 3,
      columns: 3,
    } satisfies OfficeDocumentInsertTableCommand);
  }, [commandBase, executeImmediateInBackground, selection]);

  const handlePageLayout = useCallback(
    async (
      sectionIndex: number,
      layout: OfficeDocumentPageLayoutCommand['layout']
    ) =>
      await executeImmediate({
        ...commandBase(),
        operation: 'office.document.page.layout.set',
        sectionIndex,
        layout,
      } satisfies OfficeDocumentPageLayoutCommand),
    [commandBase, executeImmediate]
  );

  const handleInsertSection = useCallback(
    async (
      sectionType: OfficeDocumentInsertSectionCommand['sectionType'],
      sourceSectionIndex: number
    ) => {
      if (!selection) return false;
      return await executeImmediate({
        ...commandBase(),
        operation: 'office.document.section.insert',
        target: {
          type: 'paragraph',
          blockId: selection.end.blockId,
        },
        sectionType,
        sourceSectionIndex,
      } satisfies OfficeDocumentInsertSectionCommand);
    },
    [commandBase, executeImmediate, selection]
  );

  const handleInsertObject = useCallback(
    async (object: DocxObject) => {
      if (!selection) return false;
      return await executeImmediate({
        ...commandBase(),
        operation: 'office.document.object.insert',
        target: selection.start,
        object,
      } satisfies OfficeDocumentInsertObjectCommand);
    },
    [commandBase, executeImmediate, selection]
  );

  const handleEditStory = useCallback(
    async (
      sectionIndex: number,
      kind: 'header' | 'footer',
      storyType: OfficeDocumentHeaderFooterTextCommand['storyType'],
      text: string
    ) =>
      await executeImmediate({
        ...commandBase(),
        operation: 'office.document.header_footer.text.set',
        sectionIndex,
        storyKind: kind,
        storyType,
        text,
      } satisfies OfficeDocumentHeaderFooterTextCommand),
    [commandBase, executeImmediate]
  );

  const handleReview = useCallback(
    (action: OfficeDocumentReviewResolveCommand['action']) => {
      if (!state.review.changes.length) return;
      executeImmediateInBackground({
        ...commandBase(),
        operation: 'office.document.review.resolve',
        action,
      } satisfies OfficeDocumentReviewResolveCommand);
    },
    [commandBase, executeImmediateInBackground, state.review.changes.length]
  );

  const updateSelection = useCallback(() => {
    if (!rootRef.current) return;
    const next = resolveOfficeTextRange(rootRef.current, window.getSelection());
    setSelection(next);
    onAiSelectionChange(next ? { kind: 'document', target: next } : null);
    onCommentAnchorChange(
      next
        ? {
            kind: 'document',
            revisionId: revision.id,
            start: next.start,
            end: next.end,
          }
        : null
    );
    setPreview(null);
  }, [onAiSelectionChange, onCommentAnchorChange, revision.id]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateSelection);
    return () =>
      document.removeEventListener('selectionchange', updateSelection);
  }, [updateSelection]);

  const makeCommand = useCallback(() => {
    if (!selection || Object.keys(format).length === 0) return null;
    const id = nanoid();
    return {
      version: 'localmind-office-command/v1',
      commandId: id,
      idempotencyKey: `office-user:${id}`,
      artifactId,
      expectedRevisionId: revision.id,
      source: 'user',
      operation: 'office.document.text.format',
      target: selection,
      format,
    } satisfies OfficeDocumentFormatTextCommand;
  }, [artifactId, format, revision.id, selection]);

  const handlePreview = useCallback(async () => {
    if (readOnly) return;
    const command = makeCommand();
    if (!command) return;
    setPreviewing(true);
    setError(null);
    try {
      const result = await previewOfficeDocxCommand(graphql, owner, command);
      setPreview({
        command,
        stats: result.previewOfficeDocxCommand.stats as Record<string, number>,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }, [graphql, makeCommand, owner, readOnly]);

  const handleApply = useCallback(async () => {
    if (!preview || readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const result = await executeOfficeDocxCommand(
        graphql,
        owner,
        preview.command
      );
      const next = result.executeOfficeDocxCommand.artifact.currentRevision;
      if (!next.stateUrl)
        throw new Error('Saved revision has no document state');
      const nextState = await fetchOfficeState(next.stateUrl, 'document');
      if (!isDocxSemanticState(nextState)) {
        throw new Error('Saved revision has an invalid document state');
      }
      onRevision(next as Revision, nextState);
      setPreview(null);
      setSelection(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.toLowerCase().includes('stale')
          ? 'This document changed in another session. Reload the latest revision and try again.'
          : message
      );
    } finally {
      setSaving(false);
    }
  }, [graphql, onRevision, owner, preview, readOnly]);

  const handleParagraphCommit = useCallback(
    async (paragraph: DocxParagraph, text: string) => {
      if (readOnly) return;
      const replacement = diffTextReplacement(paragraph.text, text);
      if (!replacement) return;
      if (saving) {
        setError(
          'Wait for the current save to finish before editing another paragraph.'
        );
        return;
      }
      const id = nanoid();
      const command = {
        version: 'localmind-office-command/v1',
        commandId: id,
        idempotencyKey: `office-user:${id}`,
        artifactId,
        expectedRevisionId: revision.id,
        source: 'user',
        operation: 'office.document.text.replace',
        target: {
          type: 'text_range',
          start: { blockId: paragraph.id, offset: replacement.start },
          end: { blockId: paragraph.id, offset: replacement.end },
        },
        text: replacement.text,
      } satisfies OfficeDocumentReplaceTextCommand;
      setSaving(true);
      setError(null);
      try {
        await previewOfficeDocxCommand(graphql, owner, command);
        const result = await executeOfficeDocxCommand(graphql, owner, command);
        const next = result.executeOfficeDocxCommand.artifact.currentRevision;
        if (!next.stateUrl)
          throw new Error('Saved revision has no document state');
        const nextState = await fetchOfficeState(next.stateUrl, 'document');
        if (!isDocxSemanticState(nextState)) {
          throw new Error('Saved revision has an invalid document state');
        }
        onRevision(next as Revision, nextState);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [artifactId, graphql, onRevision, readOnly, revision.id, saving, owner]
  );

  const handleEditorKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      setFormat(current => ({ ...current, bold: !current.bold }));
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      setFormat(current => ({ ...current, italic: !current.italic }));
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'u') {
      event.preventDefault();
      setFormat(current => ({
        ...current,
        underline: current.underline ? false : { style: 'single' },
      }));
    }
  }, []);

  return (
    <>
      <div className={styles.editorRoot}>
        <Toolbar
          format={format}
          selection={selection}
          pending={previewing}
          saving={saving || readOnly}
          onFormatChange={setFormat}
          onParagraphAlignment={handleParagraphAlignment}
          onInsertPageBreak={handleInsertPageBreak}
          onInsertTable={handleInsertTable}
          onInsertObject={type => setObjectDialogType(type)}
          onOpenPageLayout={() => setPageLayoutOpen(true)}
          onEditStory={kind => setStoryDialogKind(kind)}
          onPreview={() => void handlePreview()}
        />
        {preview ? (
          <div className={styles.previewBar} role="status">
            <span>
              Preview ready: {preview.stats.changedParagraphs ?? 0}{' '}
              paragraph(s), {preview.stats.changedRuns ?? 0} run(s)
            </span>
            <div className={styles.previewActions}>
              <Button variant="plain" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={saving}
                onClick={() => void handleApply()}
              >
                Apply and save
              </Button>
            </div>
          </div>
        ) : null}
        {error ? <div className={styles.errorBar}>{error}</div> : null}
        <div className={styles.workspace}>
          <aside className={styles.navigation} aria-label="Document navigation">
            <div className={styles.navigationTitle}>Navigation</div>
            {headings.length ? (
              <nav className={styles.headingList}>
                {headings.map(heading => (
                  <a
                    key={heading.id}
                    href={`#office-block-${encodeURIComponent(heading.id)}`}
                    data-level={heading.properties?.outlineLevel ?? 0}
                  >
                    {heading.text}
                  </a>
                ))}
              </nav>
            ) : (
              <div className={styles.navigationEmpty}>No headings</div>
            )}
            {state.references.bookmarks.length ? (
              <>
                <div className={styles.navigationSectionTitle}>Bookmarks</div>
                <nav className={styles.headingList}>
                  {state.references.bookmarks.map(bookmark => (
                    <a
                      key={`${bookmark.paragraphId}:${bookmark.id ?? bookmark.name}`}
                      href={`#office-block-${encodeURIComponent(bookmark.paragraphId)}`}
                    >
                      {bookmark.name}
                    </a>
                  ))}
                </nav>
              </>
            ) : null}
            {state.review.changes.length || state.review.comments.length ? (
              <section className={styles.reviewSummary}>
                <div className={styles.navigationSectionTitle}>Review</div>
                <span>{state.review.changes.length} tracked change(s)</span>
                <span>{state.review.comments.length} package comment(s)</span>
                {state.review.changes.length && !readOnly ? (
                  <div className={styles.reviewActions}>
                    <Button
                      variant="plain"
                      onClick={() => handleReview('reject')}
                    >
                      Reject all
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleReview('accept')}
                    >
                      Accept all
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}
            {state.notes.footnotes.length || state.notes.endnotes.length ? (
              <section className={styles.notesSummary}>
                <div className={styles.navigationSectionTitle}>Notes</div>
                {state.notes.footnotes.slice(0, 6).map(note => (
                  <span key={`footnote:${note.id}`}>
                    {note.id}.{' '}
                    {collectDocxParagraphs(note.blocks)
                      .map(paragraph => paragraph.text)
                      .join(' ')}
                  </span>
                ))}
                {state.notes.endnotes.slice(0, 6).map(note => (
                  <span key={`endnote:${note.id}`}>
                    Endnote {note.id}.{' '}
                    {collectDocxParagraphs(note.blocks)
                      .map(paragraph => paragraph.text)
                      .join(' ')}
                  </span>
                ))}
              </section>
            ) : null}
            <div className={styles.pageCount}>{pages.length} page(s)</div>
          </aside>
          <main
            ref={rootRef}
            className={styles.canvas}
            onKeyDown={handleEditorKeyDown}
            tabIndex={0}
            aria-label="Document pages"
          >
            {pages.map(page => (
              <article
                className={styles.page}
                key={page.index}
                data-page-number={page.index + 1}
                style={
                  {
                    '--office-page-width': `${page.widthPt}pt`,
                    '--office-page-height': `${page.heightPt}pt`,
                    '--office-margin-top': `${page.margins.topPt}pt`,
                    '--office-margin-right': `${page.margins.rightPt}pt`,
                    '--office-margin-bottom': `${page.margins.bottomPt}pt`,
                    '--office-margin-left': `${page.margins.leftPt}pt`,
                  } as CSSProperties
                }
              >
                {defaultHeader ? (
                  <div className={styles.pageHeader}>
                    {storyText(defaultHeader)}
                  </div>
                ) : null}
                <div className={styles.pageContent}>
                  <Blocks
                    blocks={page.blocks}
                    paragraphOrder={paragraphOrder}
                    editingDisabled={saving || readOnly}
                    packageUrl={revision.packageUrl}
                    onParagraphCommit={(paragraph, text) =>
                      void handleParagraphCommit(paragraph, text)
                    }
                  />
                </div>
                {defaultFooter ? (
                  <div className={styles.pageFooter}>
                    {storyText(defaultFooter)}
                  </div>
                ) : null}
                <span className={styles.pageNumber}>{page.index + 1}</span>
              </article>
            ))}
          </main>
        </div>
      </div>
      <ObjectInsertDialog
        open={objectDialogType !== null}
        initialType={objectDialogType ?? 'image'}
        saving={saving}
        onOpenChange={open => {
          if (!open) setObjectDialogType(null);
        }}
        onSubmit={handleInsertObject}
      />
      <PageLayoutDialog
        open={pageLayoutOpen}
        state={state}
        selectionAvailable={selection !== null}
        saving={saving}
        onOpenChange={setPageLayoutOpen}
        onSubmit={handlePageLayout}
        onInsertSection={handleInsertSection}
      />
      <StoryDialog
        open={storyDialogKind !== null}
        initialKind={storyDialogKind ?? 'header'}
        state={state}
        saving={saving}
        onOpenChange={open => {
          if (!open) setStoryDialogKind(null);
        }}
        onSubmit={handleEditStory}
      />
    </>
  );
}

export const Component = () => {
  const { artifactId = '' } = useParams<{ artifactId: string }>();
  const workspaceId = useService(WorkspaceService).workspace.id;
  const graphql = useService(GraphQLService);
  const realtime = useService(NbstoreService).realtime;
  const workbench = useService(WorkbenchService).workbench;
  const view = useService(ViewService).view;
  const { artifact, error, isLoading, mutate } = useOfficeArtifact(
    workspaceId,
    artifactId
  );
  const [revision, setRevision] = useState<Revision | null>(null);
  const [latestRevision, setLatestRevision] = useState<Revision | null>(null);
  const latestRevisionRef = useRef<{
    artifactId: string;
    revision: Revision;
  } | null>(null);
  const [state, setState] = useState<NativeOfficeState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [returningLatest, setReturningLatest] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentAnchor, setCommentAnchor] =
    useState<OfficeCommentAnchor | null>(null);
  const [aiSelection, setAiSelection] = useState<OfficeSelection | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);

  useEffect(() => {
    setAiSelection(null);
    setSelectionNotice(null);
  }, [artifactId]);

  useEffect(() => {
    if (!artifact?.currentRevision) return;
    const previousEntry =
      latestRevisionRef.current?.artifactId === artifact.id
        ? latestRevisionRef.current
        : null;
    const next = newestOfficeRevision(
      previousEntry?.revision ?? null,
      artifact.currentRevision
    );
    latestRevisionRef.current = { artifactId: artifact.id, revision: next };
    setLatestRevision(next);
    setRevision(selected =>
      !selected || !previousEntry || selected.id === previousEntry.revision.id
        ? next
        : selected
    );
  }, [artifact]);

  useEffect(() => {
    const url = revision?.stateUrl;
    if (!url) {
      if (revision)
        setStateError('This document revision has no editable state.');
      return;
    }
    const controller = new AbortController();
    setState(null);
    setStateError(null);
    fetchOfficeState(url, artifact?.kind, controller.signal)
      .then(setState)
      .catch(err => {
        if (!controller.signal.aborted) {
          setStateError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => controller.abort();
  }, [artifact?.kind, revision]);

  const handleRevision = useCallback(
    (
      nextRevision: Revision,
      nextState: NativeOfficeState,
      options: RevisionUpdateOptions = {}
    ) => {
      const preservedSelection =
        options.preserveAiSelection &&
        aiSelection &&
        isOfficeSelectionAvailable(nextState, aiSelection)
          ? aiSelection
          : null;
      latestRevisionRef.current = { artifactId, revision: nextRevision };
      setLatestRevision(nextRevision);
      setRevision(nextRevision);
      setState(nextState);
      setCommentAnchor(null);
      setAiSelection(preservedSelection);
      setSelectionNotice(
        options.preserveAiSelection && aiSelection
          ? preservedSelection
            ? `Selection preserved on revision ${nextRevision.sequence}.`
            : 'Selection cleared because its stable target is not present in the new revision.'
          : null
      );
      mutate().catch(console.error);
    },
    [aiSelection, artifactId, mutate]
  );

  const handleAiSelectionChange = useCallback(
    (selection: OfficeSelection | null) => {
      setAiSelection(selection);
      setSelectionNotice(null);
    },
    []
  );

  const handleTaskRevision = useCallback(
    async (evidence: OfficeTaskRevisionEvidence) => {
      if (evidence.artifactId !== artifactId) {
        throw new Error('Office task result targets a different artifact.');
      }
      const result = await graphql.gql({
        query: officeArtifactQuery,
        variables: { workspaceId, artifactId },
      });
      const nextArtifact = result.officeArtifact;
      const latest = nextArtifact?.currentRevision;
      if (!nextArtifact || !latest || nextArtifact.id !== evidence.artifactId) {
        throw new Error('The completed Office task artifact is unavailable.');
      }
      let evidenceRevision: OfficeRevision | HistoryRevision | undefined =
        latest.id === evidence.revisionId ? latest : undefined;
      if (!evidenceRevision) {
        const history = await graphql.gql({
          query: officeRevisionsQuery,
          variables: { workspaceId, artifactId, limit: 100 },
        });
        evidenceRevision = history.officeRevisions.find(
          candidate => candidate.id === evidence.revisionId
        );
      }
      if (
        !evidenceRevision ||
        evidenceRevision.artifactId !== artifactId ||
        evidenceRevision.origin !== 'ai'
      ) {
        throw new Error('Office task revision evidence could not be verified.');
      }
      if (
        evidence.sequence !== null &&
        evidenceRevision.sequence !== evidence.sequence
      ) {
        throw new Error(
          'Office task revision sequence evidence does not match.'
        );
      }
      if (latest.sequence < evidenceRevision.sequence) {
        throw new Error('The latest Office revision is behind task evidence.');
      }
      if (!latest.stateUrl) {
        throw new Error('The latest Office revision has no editable state.');
      }
      const nextState = await fetchOfficeState(
        latest.stateUrl,
        nextArtifact.kind
      );
      handleRevision(latest, nextState, { preserveAiSelection: true });
    },
    [artifactId, graphql, handleRevision, workspaceId]
  );

  const openAiChat = useCallback(() => {
    workbench.openSidebar();
    view.activeSidebarTab('chat');
  }, [view, workbench]);

  const handleHistorySelect = useCallback((nextRevision: HistoryRevision) => {
    setRevision(nextRevision as OfficeRevision);
    setAiSelection(null);
    setSelectionNotice(null);
    setHistoryOpen(false);
  }, []);

  const handleLatest = useCallback(async () => {
    const cachedLatest =
      latestRevisionRef.current?.artifactId === artifactId
        ? latestRevisionRef.current.revision
        : latestRevision;
    if (cachedLatest) setRevision(cachedLatest);
    setReturningLatest(true);
    setStateError(null);
    try {
      const result = await graphql.gql({
        query: officeArtifactQuery,
        variables: { workspaceId, artifactId },
      });
      const latest = result.officeArtifact?.currentRevision;
      if (!latest)
        throw new Error('The latest Office revision is unavailable.');
      latestRevisionRef.current = { artifactId, revision: latest };
      setLatestRevision(latest);
      setRevision(latest);
      setCommentAnchor(null);
      setAiSelection(null);
      setSelectionNotice(null);
      mutate().catch(console.error);
    } catch (err) {
      setStateError(err instanceof Error ? err.message : String(err));
    } finally {
      setReturningLatest(false);
    }
  }, [artifactId, graphql, latestRevision, mutate, workspaceId]);

  const handleDownload = useCallback(async () => {
    if (!artifact || !revision) return;
    setDownloading(true);
    setStateError(null);
    try {
      await downloadOfficePackage(revision.packageUrl, artifact.sourceFileName);
    } catch (err) {
      setStateError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, [artifact, revision]);

  const handleExportPdf = useCallback(async () => {
    if (!artifact || !revision || artifact.kind !== 'document') return;
    setDownloading(true);
    setStateError(null);
    try {
      await downloadOfficePackage(
        officePdfExportUrl(revision.packageUrl),
        `${artifact.title || 'document'}.pdf`
      );
    } catch (err) {
      setStateError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, [artifact, revision]);

  const title = artifact?.title ?? 'LocalMind Office';
  const isHistorical = Boolean(
    latestRevision &&
    revision &&
    isHistoricalOfficeRevision(latestRevision, revision)
  );
  const body =
    isLoading || (artifact && revision && !state && !stateError) ? (
      <CenterState>
        <Loading />
        <span>Opening native document…</span>
      </CenterState>
    ) : error ? (
      <CenterState>
        <strong>Unable to open this document</strong>
        <span>{error.message}</span>
        <Button onClick={() => void mutate()}>Retry</Button>
      </CenterState>
    ) : !artifact || !revision ? (
      <CenterState>
        <strong>Document not found</strong>
        <span>
          The Office artifact may have been removed or you may not have access.
        </span>
      </CenterState>
    ) : stateError ? (
      <CenterState>
        <strong>Unable to load document contents</strong>
        <span>{stateError}</span>
        <Button onClick={() => setRevision({ ...revision })}>Retry</Button>
      </CenterState>
    ) : state && artifact.kind === 'document' && isDocxSemanticState(state) ? (
      <DocumentEditor
        state={state}
        revision={revision}
        artifactId={artifact.id}
        owner={{ kind: 'workspace', workspaceId }}
        graphql={graphql}
        readOnly={isHistorical}
        onRevision={handleRevision}
        onCommentAnchorChange={setCommentAnchor}
        onAiSelectionChange={handleAiSelectionChange}
      />
    ) : state && artifact.kind === 'workbook' && isXlsxSemanticState(state) ? (
      <SpreadsheetEditor
        state={state}
        revision={revision}
        artifactId={artifact.id}
        owner={{ kind: 'workspace', workspaceId }}
        graphql={graphql}
        readOnly={isHistorical}
        onRevision={handleRevision}
        onCommentAnchorChange={setCommentAnchor}
        onAiSelectionChange={handleAiSelectionChange}
      />
    ) : state &&
      artifact.kind === 'presentation' &&
      isPptxSemanticState(state) ? (
      <PresentationEditor
        state={state}
        revision={revision}
        artifactId={artifact.id}
        owner={{ kind: 'workspace', workspaceId }}
        graphql={graphql}
        readOnly={isHistorical}
        onRevision={handleRevision}
        onCommentAnchorChange={setCommentAnchor}
        onAiSelectionChange={handleAiSelectionChange}
      />
    ) : state && artifact.kind === 'pdf' && isPdfSemanticState(state) ? (
      <PdfEditor
        state={state}
        revision={revision}
        artifactId={artifact.id}
        owner={{ kind: 'workspace', workspaceId }}
        graphql={graphql}
        readOnly={isHistorical}
        onRevision={handleRevision}
        onCommentAnchorChange={setCommentAnchor}
        onAiSelectionChange={handleAiSelectionChange}
      />
    ) : state ? (
      <CenterState>
        <strong>Unsupported Office state</strong>
        <span>The saved state does not match this artifact type.</span>
      </CenterState>
    ) : null;

  const header =
    artifact && revision ? (
      <Header
        title={title}
        kind={artifact.kind}
        revision={revision}
        latestSequence={latestRevision?.sequence ?? artifact.revisionCounter}
        historical={isHistorical}
        downloading={downloading}
        returningLatest={returningLatest}
        onDownload={() => void handleDownload()}
        onHistory={() => setHistoryOpen(true)}
        onLatest={() => void handleLatest()}
        onComments={() => setCommentsOpen(true)}
        onAI={openAiChat}
        onPrint={() => window.print()}
        onExportPdf={
          artifact.kind === 'document'
            ? () => void handleExportPdf()
            : undefined
        }
      />
    ) : null;

  return (
    <>
      <ViewTitle title={title} />
      <ViewIcon icon="doc" />
      {BUILD_CONFIG.isMobileWeb ? null : <ViewHeader>{header}</ViewHeader>}
      {BUILD_CONFIG.isMobileWeb ? (
        <div className={styles.mobileRoot}>
          {header}
          {body}
        </div>
      ) : (
        <ViewBody>{body}</ViewBody>
      )}
      {artifact && revision ? (
        <ViewSidebarTab
          tabId="chat"
          icon={<AiIcon />}
          unmountOnInactive={false}
        >
          <OfficeChatPanel
            workspaceId={workspaceId}
            artifact={artifact}
            revision={revision}
            selection={aiSelection}
            selectionNotice={selectionNotice}
            autoRefreshEnabled={!isHistorical}
            onClearSelection={() => {
              setAiSelection(null);
              setSelectionNotice('Selection removed from AI context.');
            }}
            onTaskRevision={handleTaskRevision}
          />
        </ViewSidebarTab>
      ) : null}
      {artifact && revision ? (
        <>
          <RevisionHistory
            open={historyOpen}
            workspaceId={workspaceId}
            artifactId={artifact.id}
            selectedRevision={revision}
            graphql={graphql}
            onOpenChange={setHistoryOpen}
            onSelect={handleHistorySelect}
          />
          <OfficeCommentsPanel
            open={commentsOpen}
            workspaceId={workspaceId}
            artifactId={artifact.id}
            anchor={commentAnchor}
            graphql={graphql}
            realtime={realtime}
            onOpenChange={setCommentsOpen}
          />
        </>
      ) : null}
    </>
  );
};

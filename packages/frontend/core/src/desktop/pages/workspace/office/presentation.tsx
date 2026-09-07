import { Button, IconButton } from '@affine/component';
import {
  ArrowDownSmallIcon,
  ArrowUpSmallIcon,
  DeleteIcon,
  DuplicateIcon,
  ImageIcon,
  PlusIcon,
  ShapeIcon,
} from '@blocksuite/icons/rc';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  OfficeCommand,
  OfficePresentationSetThemeColorCommand,
  PptxGeometry,
  PptxSemanticState,
  PptxShape,
  PptxSlide,
} from '../../../../modules/office';
import { officePackagePartUrl } from '../../../../modules/office';
import {
  executeAndReloadOfficeCommand,
  type NativeOfficeEditorProps,
  officeErrorMessage,
} from './shared';
import * as styles from './surface.css';

function flattenShapes(shapes: readonly PptxShape[]): PptxShape[] {
  return shapes.flatMap(shape => [
    shape,
    ...flattenShapes(shape.children ?? []),
  ]);
}

function ShapeLayer({
  slide,
  state,
  selectedShapeId,
  thumbnail = false,
  packageUrl,
  onSelect,
}: {
  slide: PptxSlide;
  state: PptxSemanticState;
  selectedShapeId?: string;
  thumbnail?: boolean;
  packageUrl: string;
  onSelect?: (shape: PptxShape) => void;
}) {
  return flattenShapes(slide.shapes).map(shape => {
    const geometry = shape.geometry;
    if (!geometry) return null;
    const left = ((geometry.xPt ?? 0) / state.slideSize.widthPt) * 100;
    const top = ((geometry.yPt ?? 0) / state.slideSize.heightPt) * 100;
    const width = ((geometry.widthPt ?? 1) / state.slideSize.widthPt) * 100;
    const height = ((geometry.heightPt ?? 1) / state.slideSize.heightPt) * 100;
    const firstRun = shape.paragraphs?.[0]?.runs[0];
    const content = shape.image ? (
      <img
        src={officePackagePartUrl(packageUrl, shape.image.part)}
        alt={shape.description || shape.name || 'Slide image'}
      />
    ) : (
      shape.text || (shape.type === 'picture' ? 'Image' : shape.name)
    );
    const style = {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      transform: geometry.rotationDeg
        ? `rotate(${geometry.rotationDeg}deg)`
        : undefined,
      fontFamily: firstRun?.fontFamily,
      fontSize: firstRun?.fontSizePt
        ? `${thumbnail ? firstRun.fontSizePt * 0.13 : firstRun.fontSizePt}pt`
        : thumbnail
          ? 3
          : undefined,
      fontWeight: firstRun?.bold ? 700 : undefined,
      fontStyle: firstRun?.italic ? 'italic' : undefined,
      color: firstRun?.color,
    } as const;

    if (thumbnail) {
      return (
        <span
          className={styles.slideShape}
          data-type={shape.type}
          aria-hidden="true"
          key={shape.id}
          style={style}
        >
          {content}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={styles.slideShape}
        data-selected={selectedShapeId === shape.id}
        data-type={shape.type}
        aria-label={`${shape.type}: ${shape.name ?? shape.id}`}
        key={shape.id}
        onClick={event => {
          event.stopPropagation();
          onSelect?.(shape);
        }}
        style={style}
      >
        {content}
      </button>
    );
  });
}

async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + 32_768));
  }
  return btoa(binary);
}

function geometryDraft(shape: PptxShape | undefined): Required<PptxGeometry> {
  return {
    xPt: shape?.geometry?.xPt ?? 0,
    yPt: shape?.geometry?.yPt ?? 0,
    widthPt: shape?.geometry?.widthPt ?? 1,
    heightPt: shape?.geometry?.heightPt ?? 1,
    rotationDeg: shape?.geometry?.rotationDeg ?? 0,
    flipHorizontal: shape?.geometry?.flipHorizontal ?? false,
    flipVertical: shape?.geometry?.flipVertical ?? false,
    preset: shape?.geometry?.preset ?? 'rect',
  };
}

export function PresentationEditor({
  state,
  revision,
  artifactId,
  owner,
  graphql,
  readOnly,
  onRevision,
  onCommentAnchorChange,
  onAiSelectionChange,
}: NativeOfficeEditorProps<PptxSemanticState>) {
  const [slideId, setSlideId] = useState(state.slides[0]?.id ?? '');
  const slide =
    state.slides.find(candidate => candidate.id === slideId) ?? state.slides[0];
  const shapes = useMemo(() => flattenShapes(slide?.shapes ?? []), [slide]);
  const [shapeId, setShapeId] = useState(shapes[0]?.id ?? '');
  const selectedShape = shapes.find(shape => shape.id === shapeId);
  const [text, setText] = useState(selectedShape?.text ?? '');
  const [geometry, setGeometry] = useState(() => geometryDraft(selectedShape));
  const [newShape, setNewShape] = useState<
    'rectangle' | 'roundedRectangle' | 'ellipse' | 'line'
  >('rectangle');
  const [newShapeText, setNewShapeText] = useState('');
  const [notes, setNotes] = useState(slide?.notesText ?? '');
  const [themeSlot, setThemeSlot] =
    useState<OfficePresentationSetThemeColorCommand['slot']>('accent1');
  const [themeColor, setThemeColor] = useState(
    state.masters[0]?.themeColors.accent1 ?? '#0057B8'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    if (!slide && state.slides[0]) setSlideId(state.slides[0].id);
  }, [slide, state.slides]);

  useEffect(() => {
    const next = shapes.find(shape => shape.id === shapeId) ?? shapes[0];
    if (next && next.id !== shapeId) setShapeId(next.id);
    setText(next?.text ?? '');
    setGeometry(geometryDraft(next));
  }, [shapeId, shapes]);

  useEffect(() => {
    setNotes(slide?.notesText ?? '');
  }, [slide]);

  useEffect(() => {
    setThemeColor(state.masters[0]?.themeColors[themeSlot] ?? '#000000');
  }, [state.masters, themeSlot]);

  useEffect(() => {
    if (!slide) {
      onCommentAnchorChange(null);
      onAiSelectionChange(null);
      return;
    }
    onCommentAnchorChange({
      kind: 'presentation',
      revisionId: revision.id,
      slideId: slide.id,
      ...(selectedShape ? { shapeId: selectedShape.id } : {}),
    });
    onAiSelectionChange({
      kind: 'presentation',
      target: selectedShape
        ? { type: 'shape', slideId: slide.id, shapeId: selectedShape.id }
        : { type: 'slide', slideId: slide.id },
    });
  }, [
    onAiSelectionChange,
    onCommentAnchorChange,
    revision.id,
    selectedShape,
    slide,
  ]);

  const runCommand = useCallback(
    async (command: OfficeCommand, message: string) => {
      if (readOnly || saving) return false;
      setSaving(true);
      setError(null);
      setStatus(`Previewing ${message}`);
      try {
        const result = await executeAndReloadOfficeCommand<PptxSemanticState>({
          graphql,
          owner,
          kind: 'presentation',
          command,
        });
        onRevision(result.revision, result.state);
        setStatus(`${message} saved in revision ${result.revision.sequence}`);
        return true;
      } catch (err) {
        setError(officeErrorMessage(err));
        setStatus('Save failed');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [graphql, onRevision, owner, readOnly, saving]
  );

  const saveText = useCallback(async () => {
    if (!slide || !selectedShape || readOnly || saving) return;
    const id = nanoid();
    await runCommand(
      {
        version: 'localmind-office-command/v1',
        commandId: id,
        idempotencyKey: `office-user:${id}`,
        artifactId,
        expectedRevisionId: revision.id,
        source: 'user',
        operation: 'office.presentation.shape.text.set',
        target: { type: 'shape', slideId: slide.id, shapeId: selectedShape.id },
        text,
      },
      'Shape text'
    );
  }, [
    artifactId,
    readOnly,
    revision.id,
    runCommand,
    saving,
    selectedShape,
    slide,
    text,
  ]);

  const saveGeometry = useCallback(async () => {
    if (!slide || !selectedShape || readOnly || saving) return;
    const id = nanoid();
    await runCommand(
      {
        version: 'localmind-office-command/v1',
        commandId: id,
        idempotencyKey: `office-user:${id}`,
        artifactId,
        expectedRevisionId: revision.id,
        source: 'user',
        operation: 'office.presentation.shape.geometry.set',
        target: { type: 'shape', slideId: slide.id, shapeId: selectedShape.id },
        geometry: {
          xPt: geometry.xPt,
          yPt: geometry.yPt,
          widthPt: geometry.widthPt,
          heightPt: geometry.heightPt,
          rotationDeg: geometry.rotationDeg,
        },
      },
      'Shape geometry'
    );
  }, [
    artifactId,
    geometry,
    readOnly,
    revision.id,
    runCommand,
    saving,
    selectedShape,
    slide,
  ]);

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

  const moveSlide = useCallback(
    async (direction: -1 | 1) => {
      if (!slide) return;
      const order = state.slides.map(candidate => candidate.id);
      const index = order.indexOf(slide.id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      await runCommand(
        {
          ...commandBase(),
          operation: 'office.presentation.slides.reorder',
          slideIds: order,
        },
        'Slide order'
      );
    },
    [commandBase, runCommand, slide, state.slides]
  );

  const insertShape = useCallback(async () => {
    if (!slide) return;
    await runCommand(
      {
        ...commandBase(),
        operation: 'office.presentation.shape.add',
        slideId: slide.id,
        shape: newShape,
        geometry: {
          xPt: state.slideSize.widthPt * 0.3,
          yPt: state.slideSize.heightPt * 0.3,
          widthPt: state.slideSize.widthPt * 0.4,
          heightPt: newShape === 'line' ? 2 : state.slideSize.heightPt * 0.16,
        },
        text: newShapeText || undefined,
        fillColor: newShape === 'line' ? undefined : '#E8F0FE',
        lineColor: '#2F6FEB',
      },
      'Shape insertion'
    );
    setNewShapeText('');
  }, [commandBase, newShape, newShapeText, runCommand, slide, state.slideSize]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!slide) return;
      if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
        setError('Slides accepts PNG, JPEG, or GIF images.');
        return;
      }
      const dataBase64 = await fileBase64(file);
      await runCommand(
        {
          ...commandBase(),
          operation: 'office.presentation.image.add',
          slideId: slide.id,
          mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/gif',
          dataBase64,
          geometry: {
            xPt: state.slideSize.widthPt * 0.25,
            yPt: state.slideSize.heightPt * 0.2,
            widthPt: state.slideSize.widthPt * 0.5,
            heightPt: state.slideSize.heightPt * 0.5,
          },
          name: file.name,
        },
        'Image insertion'
      );
    },
    [commandBase, runCommand, slide, state.slideSize]
  );

  const saveNotes = useCallback(async () => {
    if (!slide) return;
    await runCommand(
      {
        ...commandBase(),
        operation: 'office.presentation.notes.text.set',
        slideId: slide.id,
        text: notes,
      },
      'Speaker notes'
    );
  }, [commandBase, notes, runCommand, slide]);

  const saveThemeColor = useCallback(async () => {
    const master = state.masters[0];
    if (!master) return;
    await runCommand(
      {
        ...commandBase(),
        operation: 'office.presentation.theme.color.set',
        masterId: master.id,
        slot: themeSlot,
        color: themeColor,
      },
      'Theme color'
    );
  }, [commandBase, runCommand, state.masters, themeColor, themeSlot]);

  if (!slide) {
    return (
      <div className={styles.editor}>
        <div className={styles.emptyState} role="status">
          This presentation has no slides.
        </div>
      </div>
    );
  }

  const updateGeometry = (
    key: 'xPt' | 'yPt' | 'widthPt' | 'heightPt' | 'rotationDeg',
    value: string
  ) => {
    const next = Number(value);
    if (Number.isFinite(next))
      setGeometry(current => ({ ...current, [key]: next }));
  };

  return (
    <div className={styles.editor}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Presentation editing"
      >
        <span>
          Slide{' '}
          {state.slides.findIndex(candidate => candidate.id === slide.id) + 1}
        </span>
        <span>{slide.name}</span>
        <IconButton
          size="24"
          tooltip="Add slide"
          aria-label="Add slide"
          disabled={readOnly || saving}
          onClick={() =>
            void runCommand(
              {
                ...commandBase(),
                operation: 'office.presentation.slide.add',
                afterSlideId: slide.id,
              },
              'Slide insertion'
            )
          }
        >
          <PlusIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip="Duplicate slide"
          aria-label="Duplicate slide"
          disabled={readOnly || saving}
          onClick={() =>
            void runCommand(
              {
                ...commandBase(),
                operation: 'office.presentation.slide.duplicate',
                slideId: slide.id,
              },
              'Slide duplication'
            )
          }
        >
          <DuplicateIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip="Move slide up"
          aria-label="Move slide up"
          disabled={
            readOnly ||
            saving ||
            state.slides.findIndex(candidate => candidate.id === slide.id) === 0
          }
          onClick={() => void moveSlide(-1)}
        >
          <ArrowUpSmallIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip="Move slide down"
          aria-label="Move slide down"
          disabled={
            readOnly ||
            saving ||
            state.slides.findIndex(candidate => candidate.id === slide.id) ===
              state.slides.length - 1
          }
          onClick={() => void moveSlide(1)}
        >
          <ArrowDownSmallIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip="Delete slide"
          aria-label="Delete slide"
          disabled={readOnly || saving || state.slides.length === 1}
          onClick={() =>
            void runCommand(
              {
                ...commandBase(),
                operation: 'office.presentation.slide.delete',
                slideId: slide.id,
              },
              'Slide deletion'
            )
          }
        >
          <DeleteIcon />
        </IconButton>
        <div className={styles.toolbarSpacer} />
        <span>
          {state.slideSize.widthPt} x {state.slideSize.heightPt} pt
        </span>
      </div>
      <div className={styles.slidesBody}>
        <aside className={styles.slideRail} aria-label="Slide thumbnails">
          {state.slides.map((candidate, index) => (
            <button
              type="button"
              className={styles.slideThumbButton}
              data-active={candidate.id === slide.id}
              key={candidate.id}
              onClick={() => {
                setSlideId(candidate.id);
                setShapeId(candidate.shapes[0]?.id ?? '');
              }}
            >
              <span>{index + 1}</span>
              <span className={styles.thumbnail}>
                <ShapeLayer
                  slide={candidate}
                  state={state}
                  packageUrl={revision.packageUrl}
                  thumbnail
                />
              </span>
            </button>
          ))}
        </aside>
        <main className={styles.slideStageScroller} aria-label="Slide canvas">
          <div
            className={styles.slideStage}
            style={{
              aspectRatio: `${state.slideSize.widthPt} / ${state.slideSize.heightPt}`,
            }}
            onClick={() => setShapeId('')}
          >
            <ShapeLayer
              slide={slide}
              state={state}
              selectedShapeId={selectedShape?.id}
              packageUrl={revision.packageUrl}
              onSelect={shape => setShapeId(shape.id)}
            />
          </div>
        </main>
        <aside className={styles.shapeInspector} aria-label="Shape properties">
          <div className={styles.panelTitle}>Shape properties</div>
          {selectedShape ? (
            <>
              <div className={styles.inspectorGroup}>
                <span>{selectedShape.name ?? `Shape ${selectedShape.id}`}</span>
                {selectedShape.paragraphs ? (
                  <>
                    <textarea
                      className={styles.textarea}
                      value={text}
                      disabled={readOnly || saving}
                      aria-label="Shape text"
                      onChange={event => setText(event.target.value)}
                    />
                    <Button
                      variant="primary"
                      disabled={readOnly}
                      loading={saving}
                      onClick={() => void saveText()}
                    >
                      Save text
                    </Button>
                  </>
                ) : null}
              </div>
              <div className={styles.inspectorGroup}>
                <div className={styles.inspectorGrid}>
                  {(
                    [
                      'xPt',
                      'yPt',
                      'widthPt',
                      'heightPt',
                      'rotationDeg',
                    ] as const
                  ).map(key => (
                    <label className={styles.fieldLabel} key={key}>
                      {key === 'rotationDeg'
                        ? 'Rotation'
                        : key.replace('Pt', '').toUpperCase()}
                      <input
                        className={styles.field}
                        type="number"
                        min={
                          key === 'widthPt' || key === 'heightPt'
                            ? 0.01
                            : undefined
                        }
                        step={key === 'rotationDeg' ? 1 : 0.5}
                        value={geometry[key]}
                        disabled={readOnly || saving}
                        onChange={event =>
                          updateGeometry(key, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                <Button
                  disabled={readOnly}
                  loading={saving}
                  onClick={() => void saveGeometry()}
                >
                  Apply geometry
                </Button>
                <Button
                  disabled={readOnly}
                  loading={saving}
                  onClick={() =>
                    void runCommand(
                      {
                        ...commandBase(),
                        operation: 'office.presentation.shape.delete',
                        target: {
                          type: 'shape',
                          slideId: slide.id,
                          shapeId: selectedShape.id,
                        },
                      },
                      'Shape deletion'
                    )
                  }
                >
                  <DeleteIcon />
                  Delete shape
                </Button>
              </div>
            </>
          ) : (
            <span>Select a shape on the slide.</span>
          )}
          <div className={styles.panelTitle}>Insert</div>
          <div className={styles.inspectorGroup}>
            <select
              className={styles.select}
              value={newShape}
              disabled={readOnly || saving}
              aria-label="New shape type"
              onChange={event =>
                setNewShape(event.target.value as typeof newShape)
              }
            >
              <option value="rectangle">Rectangle</option>
              <option value="roundedRectangle">Rounded rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="line">Line</option>
            </select>
            <input
              className={styles.field}
              value={newShapeText}
              maxLength={4096}
              disabled={readOnly || saving || newShape === 'line'}
              aria-label="New shape text"
              placeholder="Optional shape text"
              onChange={event => setNewShapeText(event.target.value)}
            />
            <Button
              disabled={readOnly}
              loading={saving}
              onClick={() => void insertShape()}
            >
              <ShapeIcon />
              Add shape
            </Button>
            <label className={styles.fileButton}>
              <ImageIcon />
              Add image
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                disabled={readOnly || saving}
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) insertImage(file).catch(console.error);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          <div className={styles.panelTitle}>Speaker notes</div>
          <div className={styles.inspectorGroup}>
            <textarea
              className={styles.textarea}
              value={notes}
              maxLength={4 * 1024 * 1024}
              disabled={readOnly || saving}
              aria-label="Speaker notes"
              onChange={event => setNotes(event.target.value)}
            />
            <Button
              disabled={readOnly}
              loading={saving}
              onClick={() => void saveNotes()}
            >
              Save notes
            </Button>
          </div>
          {state.masters[0] ? (
            <>
              <div className={styles.panelTitle}>Theme color</div>
              <div className={styles.inspectorGroup}>
                <select
                  className={styles.select}
                  value={themeSlot}
                  disabled={readOnly || saving}
                  aria-label="Theme color slot"
                  onChange={event =>
                    setThemeSlot(
                      event.target
                        .value as OfficePresentationSetThemeColorCommand['slot']
                    )
                  }
                >
                  {(
                    [
                      'dk1',
                      'lt1',
                      'dk2',
                      'lt2',
                      'accent1',
                      'accent2',
                      'accent3',
                      'accent4',
                      'accent5',
                      'accent6',
                      'hlink',
                      'folHlink',
                    ] as const
                  ).map(slot => (
                    <option value={slot} key={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <input
                  className={styles.colorInput}
                  type="color"
                  value={themeColor}
                  disabled={readOnly || saving}
                  aria-label="Theme color value"
                  onChange={event => setThemeColor(event.target.value)}
                />
                <Button
                  disabled={readOnly}
                  loading={saving}
                  onClick={() => void saveThemeColor()}
                >
                  Apply theme color
                </Button>
              </div>
            </>
          ) : null}
        </aside>
      </div>
      <div className={styles.statusBar} role="status" aria-live="polite">
        <span>{state.stats.slides} slides</span>
        <span>{state.stats.shapes} shapes</span>
        {state.compatibility.animatedSlideIds.length ? (
          <span>{state.compatibility.animatedSlideIds.length} animated</span>
        ) : null}
        {readOnly ? <span>Historical revision, read only</span> : null}
        {error ? (
          <span className={styles.statusError}>{error}</span>
        ) : (
          <span>{status}</span>
        )}
      </div>
    </div>
  );
}

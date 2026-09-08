import { Button, IconButton } from '@affine/component';
import { I18n, useI18n } from '@affine/i18n';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  OfficeCommand,
  OfficePresentationSetThemeColorCommand,
  PptxGeometry,
  PptxSemanticState,
  PptxShape,
  PptxSlide,
} from '../../../../modules/office';
import { officePackagePartUrl } from '../../../../modules/office';
import { useOfficeEditorDraft, useOfficeSelectionChange } from './edit-draft';
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
  const i18n = useI18n();
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
        alt={
          shape.description ||
          shape.name ||
          i18n['com.affine.office.slide-image']()
        }
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
      fontSize: `${((firstRun?.fontSizePt ?? 18) / state.slideSize.widthPt) * 100}cqw`,
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
  registerDraft,
  beforeSelectionChange,
}: NativeOfficeEditorProps<PptxSemanticState>) {
  const i18n = useI18n();
  const changeSelection = useOfficeSelectionChange(beforeSelectionChange);
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
  const savedDraft = useRef({
    text: selectedShape?.text ?? '',
    geometry: geometryDraft(selectedShape),
    notes: slide?.notesText ?? '',
  });
  const currentDraft = useRef({ text, geometry, notes });
  currentDraft.current = { text, geometry, notes };
  const draftTarget = useRef({ shapeId, slideId });
  const latestRevision = useRef(revision);
  if (revision.sequence >= latestRevision.current.sequence)
    latestRevision.current = revision;

  useEffect(() => {
    if (!slide && state.slides[0]) setSlideId(state.slides[0].id);
  }, [slide, state.slides]);

  useEffect(() => {
    const next = shapes.find(shape => shape.id === shapeId) ?? shapes[0];
    if (next && next.id !== shapeId) setShapeId(next.id);
    const changedTarget = draftTarget.current.shapeId !== shapeId;
    const previous = savedDraft.current;
    setText(current =>
      !registerDraft || changedTarget || current === previous.text
        ? (next?.text ?? '')
        : current
    );
    setGeometry(current =>
      !registerDraft ||
      changedTarget ||
      JSON.stringify(current) === JSON.stringify(previous.geometry)
        ? geometryDraft(next)
        : current
    );
    savedDraft.current = {
      ...savedDraft.current,
      text: next?.text ?? '',
      geometry: geometryDraft(next),
    };
    draftTarget.current.shapeId = shapeId;
  }, [shapeId, shapes, registerDraft]);

  useEffect(() => {
    const previous = savedDraft.current.notes;
    const changedTarget = draftTarget.current.slideId !== slideId;
    setNotes(current =>
      !registerDraft || changedTarget || current === previous
        ? (slide?.notesText ?? '')
        : current
    );
    savedDraft.current.notes = slide?.notesText ?? '';
    draftTarget.current.slideId = slideId;
  }, [slide, slideId, registerDraft]);

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
      setStatus(
        I18n['com.affine.office.previewing-operation']({ operation: message })
      );
      try {
        const result = await executeAndReloadOfficeCommand<PptxSemanticState>({
          graphql,
          owner,
          kind: 'presentation',
          command,
        });
        onRevision(result.revision, result.state);
        setStatus(
          I18n['com.affine.office.operation-saved']({
            operation: message,
            version: String(result.revision.sequence),
          })
        );
        return true;
      } catch (err) {
        setError(officeErrorMessage(err, owner));
        setStatus(i18n['com.affine.office.save-failed']());
        return false;
      } finally {
        setSaving(false);
      }
    },
    [graphql, onRevision, owner, readOnly, saving, i18n]
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
      i18n['com.affine.office.shape-text']()
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

    i18n,
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
      i18n['com.affine.office.shape-geometry']()
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

    i18n,
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
        i18n['com.affine.office.slide-order']()
      );
    },
    [commandBase, runCommand, slide, state.slides, i18n]
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
      i18n['com.affine.office.shape-insertion']()
    );
    setNewShapeText('');
  }, [
    commandBase,
    newShape,
    newShapeText,
    runCommand,
    slide,
    state.slideSize,
    i18n,
  ]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!slide) return;
      if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
        setError(
          i18n['com.affine.office.slides-accepts-png-jpeg-or-gif-images']()
        );
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
        i18n['com.affine.office.image-insertion']()
      );
    },
    [commandBase, runCommand, slide, state.slideSize, i18n]
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
      i18n['com.affine.office.speaker-notes']()
    );
  }, [commandBase, notes, runCommand, slide, i18n]);

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
      i18n['com.affine.office.theme-color']()
    );
  }, [commandBase, runCommand, state.masters, themeColor, themeSlot, i18n]);

  useOfficeEditorDraft(registerDraft, {
    get hasUnsavedChanges() {
      return (
        JSON.stringify(currentDraft.current) !==
        JSON.stringify(savedDraft.current)
      );
    },
    save: async () => {
      if (readOnly || saving || !slide)
        throw new Error(
          i18n['com.affine.office.office-editor-is-not-writable']()
        );
      const draft = currentDraft.current;
      const commands: {
        field: 'text' | 'geometry' | 'notes';
        command: OfficeCommand;
      }[] = [];
      if (draft.text !== savedDraft.current.text && selectedShape)
        commands.push({
          field: 'text',
          command: {
            ...commandBase(),
            operation: 'office.presentation.shape.text.set',
            target: {
              type: 'shape',
              slideId: slide.id,
              shapeId: selectedShape.id,
            },
            text: draft.text,
          },
        });
      if (
        JSON.stringify(draft.geometry) !==
          JSON.stringify(savedDraft.current.geometry) &&
        selectedShape
      )
        commands.push({
          field: 'geometry',
          command: {
            ...commandBase(),
            operation: 'office.presentation.shape.geometry.set',
            target: {
              type: 'shape',
              slideId: slide.id,
              shapeId: selectedShape.id,
            },
            geometry: draft.geometry,
          },
        });
      if (draft.notes !== savedDraft.current.notes)
        commands.push({
          field: 'notes',
          command: {
            ...commandBase(),
            operation: 'office.presentation.notes.text.set',
            slideId: slide.id,
            text: draft.notes,
          },
        });
      for (const { field, command } of commands) {
        const result = await executeAndReloadOfficeCommand<PptxSemanticState>({
          graphql,
          owner,
          kind: 'presentation',
          command: {
            ...command,
            expectedRevisionId: latestRevision.current.id,
          },
        });
        latestRevision.current = result.revision;
        savedDraft.current = { ...savedDraft.current, [field]: draft[field] };
        onRevision(result.revision, result.state);
      }
    },
    discard: async () => {
      currentDraft.current = { ...savedDraft.current };
      setText(savedDraft.current.text);
      setGeometry(savedDraft.current.geometry);
      setNotes(savedDraft.current.notes);
    },
  });

  if (!slide) {
    return (
      <div className={styles.editor}>
        <div className={styles.emptyState} role="status">
          {i18n['com.affine.office.this-presentation-has-no-slides']()}{' '}
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
    <div className={styles.presentationEditor}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label={i18n['com.affine.office.presentation-editing']()}
      >
        <span>
          {i18n['com.affine.office.slide']()}{' '}
          {state.slides.findIndex(candidate => candidate.id === slide.id) + 1}
        </span>
        <span>{slide.name}</span>
        <IconButton
          size="24"
          tooltip={i18n['com.affine.office.add-slide']()}
          aria-label={i18n['com.affine.office.add-slide']()}
          disabled={readOnly || saving}
          onClick={() =>
            void runCommand(
              {
                ...commandBase(),
                operation: 'office.presentation.slide.add',
                afterSlideId: slide.id,
              },
              i18n['com.affine.office.slide-insertion']()
            )
          }
        >
          <PlusIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip={i18n['com.affine.office.duplicate-slide']()}
          aria-label={i18n['com.affine.office.duplicate-slide']()}
          disabled={readOnly || saving}
          onClick={() =>
            void runCommand(
              {
                ...commandBase(),
                operation: 'office.presentation.slide.duplicate',
                slideId: slide.id,
              },
              i18n['com.affine.office.slide-duplication']()
            )
          }
        >
          <DuplicateIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip={i18n['com.affine.office.move-slide-up']()}
          aria-label={i18n['com.affine.office.move-slide-up']()}
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
          tooltip={i18n['com.affine.office.move-slide-down']()}
          aria-label={i18n['com.affine.office.move-slide-down']()}
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
          tooltip={i18n['com.affine.office.delete-slide']()}
          aria-label={i18n['com.affine.office.delete-slide']()}
          disabled={readOnly || saving || state.slides.length === 1}
          onClick={() =>
            void runCommand(
              {
                ...commandBase(),
                operation: 'office.presentation.slide.delete',
                slideId: slide.id,
              },
              i18n['com.affine.office.slide-deletion']()
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
        <aside
          className={styles.slideRail}
          aria-label={i18n['com.affine.office.slide-thumbnails']()}
        >
          {state.slides.map((candidate, index) => (
            <button
              type="button"
              className={styles.slideThumbButton}
              data-active={candidate.id === slide.id}
              key={candidate.id}
              onClick={() => {
                if (candidate.id !== slideId)
                  changeSelection(() => {
                    setSlideId(candidate.id);
                    setShapeId(candidate.shapes[0]?.id ?? '');
                  });
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
        <main
          className={styles.slideStageScroller}
          aria-label={i18n['com.affine.office.slide-canvas']()}
        >
          <div
            className={styles.slideStage}
            style={{
              aspectRatio: `${state.slideSize.widthPt} / ${state.slideSize.heightPt}`,
            }}
            onClick={() => {
              if (shapeId) changeSelection(() => setShapeId(''));
            }}
          >
            <ShapeLayer
              slide={slide}
              state={state}
              selectedShapeId={selectedShape?.id}
              packageUrl={revision.packageUrl}
              onSelect={shape => {
                if (shape.id !== shapeId)
                  changeSelection(() => setShapeId(shape.id));
              }}
            />
          </div>
        </main>
        <aside
          className={styles.shapeInspector}
          aria-label={i18n['com.affine.office.shape-properties']()}
        >
          <div className={styles.panelTitle}>
            {i18n['com.affine.office.shape-properties']()}
          </div>
          {selectedShape ? (
            <>
              <div className={styles.inspectorGroup}>
                <span>
                  {selectedShape.name ??
                    I18n['com.affine.office.named-shape']({
                      name: selectedShape.id,
                    })}
                </span>
                {selectedShape.paragraphs ? (
                  <>
                    <textarea
                      className={styles.textarea}
                      value={text}
                      disabled={readOnly || saving}
                      aria-label={i18n['com.affine.office.shape-text']()}
                      onChange={event => setText(event.target.value)}
                    />
                    <Button
                      variant="primary"
                      disabled={readOnly}
                      loading={saving}
                      onClick={() => void saveText()}
                    >
                      {i18n['com.affine.office.save-text']()}{' '}
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
                        ? i18n['com.affine.office.rotation']()
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
                  {i18n['com.affine.office.apply-geometry']()}{' '}
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
                      i18n['com.affine.office.shape-deletion']()
                    )
                  }
                >
                  <DeleteIcon />
                  {i18n['com.affine.office.delete-shape']()}{' '}
                </Button>
              </div>
            </>
          ) : (
            <span>
              {i18n['com.affine.office.select-a-shape-on-the-slide']()}
            </span>
          )}
          <div className={styles.panelTitle}>
            {i18n['com.affine.ui.insert']()}
          </div>
          <div className={styles.inspectorGroup}>
            <select
              className={styles.select}
              value={newShape}
              disabled={readOnly || saving}
              aria-label={i18n['com.affine.office.new-shape-type']()}
              onChange={event =>
                setNewShape(event.target.value as typeof newShape)
              }
            >
              <option value="rectangle">
                {i18n['com.affine.office.rectangle']()}
              </option>
              <option value="roundedRectangle">
                {i18n['com.affine.office.rounded-rectangle']()}
              </option>
              <option value="ellipse">
                {i18n[
                  'com.affine.settings.editorSettings.edgeless.shape.ellipse'
                ]()}
              </option>
              <option value="line">{i18n['com.affine.office.line']()}</option>
            </select>
            <input
              className={styles.field}
              value={newShapeText}
              maxLength={4096}
              disabled={readOnly || saving || newShape === 'line'}
              aria-label={i18n['com.affine.office.new-shape-text']()}
              placeholder={i18n['com.affine.office.optional-shape-text']()}
              onChange={event => setNewShapeText(event.target.value)}
            />
            <Button
              disabled={readOnly}
              loading={saving}
              onClick={() => void insertShape()}
            >
              <ShapeIcon />
              {i18n['com.affine.office.add-shape']()}{' '}
            </Button>
            <label className={styles.fileButton}>
              <ImageIcon />
              {i18n['com.affine.office.add-image']()}{' '}
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
          <div className={styles.panelTitle}>
            {i18n['com.affine.office.speaker-notes']()}
          </div>
          <div className={styles.inspectorGroup}>
            <textarea
              className={styles.textarea}
              value={notes}
              maxLength={4 * 1024 * 1024}
              disabled={readOnly || saving}
              aria-label={i18n['com.affine.office.speaker-notes']()}
              onChange={event => setNotes(event.target.value)}
            />
            <Button
              disabled={readOnly}
              loading={saving}
              onClick={() => void saveNotes()}
            >
              {i18n['com.affine.office.save-notes']()}{' '}
            </Button>
          </div>
          {state.masters[0] ? (
            <>
              <div className={styles.panelTitle}>
                {i18n['com.affine.office.theme-color']()}
              </div>
              <div className={styles.inspectorGroup}>
                <select
                  className={styles.select}
                  value={themeSlot}
                  disabled={readOnly || saving}
                  aria-label={i18n['com.affine.office.theme-color-slot']()}
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
                  aria-label={i18n['com.affine.office.theme-color-value']()}
                  onChange={event => setThemeColor(event.target.value)}
                />
                <Button
                  disabled={readOnly}
                  loading={saving}
                  onClick={() => void saveThemeColor()}
                >
                  {i18n['com.affine.office.apply-theme-color']()}{' '}
                </Button>
              </div>
            </>
          ) : null}
        </aside>
      </div>
      <div className={styles.statusBar} role="status" aria-live="polite">
        <span>
          {state.stats.slides} {i18n['com.affine.office.slides']()}
        </span>
        <span>
          {state.stats.shapes} {i18n['com.affine.office.shapes']()}
        </span>
        {state.compatibility.animatedSlideIds.length ? (
          <span>
            {state.compatibility.animatedSlideIds.length}{' '}
            {i18n['com.affine.office.animated']()}
          </span>
        ) : null}
        {readOnly ? (
          <span>
            {i18n['com.affine.office.historical-revision-read-only']()}
          </span>
        ) : null}
        {error ? (
          <span className={styles.statusError}>{error}</span>
        ) : (
          <span>{status}</span>
        )}
      </div>
    </div>
  );
}

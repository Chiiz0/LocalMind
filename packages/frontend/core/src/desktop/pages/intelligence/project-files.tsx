import {
  Button,
  IconButton,
  Input,
  Loading,
  Menu,
  MenuItem,
  Modal,
  notify,
  useConfirmModal,
} from '@affine/component';
import { GraphQLService, ServerService } from '@affine/core/modules/cloud';
import { projectEditLeaseStore } from '@affine/core/modules/project-resources/edit-lease-store';
import { projectErrorMessage } from '@affine/core/modules/project-resources/error';
import {
  type ProjectUploadProgress,
  uploadProjectBlobWithProgress,
} from '@affine/core/modules/project-resources/upload';
import { ProjectUploadQueue } from '@affine/core/modules/project-resources/upload-queue';
import {
  changeProjectResourceMutation,
  createProjectResourceMutation,
  permanentlyDeleteProjectResourceMutation,
  type ProjectEditLeaseProofInput,
  ProjectResourceKind,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  ArrowDownSmallIcon,
  ArrowLeftSmallIcon,
  ArrowRightSmallIcon,
  ArrowUpSmallIcon,
  DeleteTemporarilyIcon,
  EditIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PageIcon,
  PlusIcon,
  ResetIcon,
  UploadIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';

import {
  ProjectFileDropTarget,
  ProjectFolderDropTarget,
} from './project-file-drop-target';
import * as styles from './project-files.css';
import {
  type ProjectFile,
  uploadProjectFile,
  useProjectFolder,
} from './project-files-data';
import {
  ProjectWorkspaceImportPicker,
  ProjectWorkspaceImportStatus,
} from './project-workspace-import';

type FileAction =
  | {
      kind: 'create';
      parentId: string | null;
      resourceKind: ProjectResourceKind;
      name: string;
      requestKey: string;
    }
  | {
      kind: 'rename' | 'move';
      file: ProjectFile;
      name: string;
      requestKey: string;
    };

type FileTreeProps = {
  projectId: string;
  parentId?: string | null;
  selectedResourceId: string | null;
  onOpen: (resourceId: string) => void;
};

type BranchProps = FileTreeProps & {
  parentId: string | null;
  trash: boolean;
  pending: ReadonlySet<string>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAction: (action: FileAction) => void;
  onChange: (
    file: ProjectFile,
    change: {
      trash?: boolean;
      parentId?: string | null;
      beforeId?: string | null;
    }
  ) => void;
  onFiles: (files: File[], parentId: string | null) => void;
  onDelete?: (file: ProjectFile) => void;
  selection?: {
    ids: ReadonlySet<string>;
    disabled: boolean;
    limit?: number;
    toggle: (id: string) => void;
  };
};

function FileBranch(props: BranchProps) {
  const t = useI18n();
  const query = useProjectFolder(props);
  if (query.isLoading && !query.error)
    return (
      <div className={styles.state}>
        <Loading size={16} />
      </div>
    );
  if (query.error)
    return (
      <div className={styles.state} role="alert">
        <span>{projectErrorMessage(query.error)}</span>
        <Button
          loading={query.isValidating}
          disabled={query.isValidating}
          onClick={() => void query.retry()}
        >
          {t['com.affine.localmind.project-files.retry']()}
        </Button>
      </div>
    );
  return (
    <>
      <ul className={styles.list}>
        {query.items.map((file, index) => {
          const folder = file.kind === ProjectResourceKind.folder;
          const expanded = props.expanded.has(file.id);
          const selectionDisabled =
            props.selection &&
            (props.selection.disabled ||
              (!folder &&
                !props.selection.ids.has(file.id) &&
                props.selection.ids.size >=
                  (props.selection.limit ?? Infinity)));
          return (
            <li key={file.id}>
              <ProjectFileDropTarget
                file={file}
                nextId={query.items[index + 1]?.id ?? null}
                pending={props.pending.has(file.id)}
                trash={props.trash}
                onMove={props.onChange}
                onFiles={props.onFiles}
                readOnly={!!props.selection}
              >
                {props.selection && !folder ? (
                  <input
                    type="checkbox"
                    className={styles.selectionCheckbox}
                    aria-label={file.title}
                    checked={props.selection.ids.has(file.id)}
                    disabled={selectionDisabled}
                    onChange={() => props.selection?.toggle(file.id)}
                  />
                ) : null}
                {folder && !props.trash ? (
                  <IconButton
                    size="16"
                    icon={
                      <ArrowRightSmallIcon
                        style={{
                          transform: expanded ? 'rotate(90deg)' : undefined,
                        }}
                      />
                    }
                    aria-expanded={expanded}
                    aria-label={file.title}
                    onClick={() => props.onToggle(file.id)}
                  />
                ) : null}
                <button
                  className={styles.open}
                  type="button"
                  disabled={props.trash || selectionDisabled}
                  aria-current={props.selectedResourceId === file.id}
                  onClick={() =>
                    props.selection
                      ? folder
                        ? props.onToggle(file.id)
                        : props.selection.toggle(file.id)
                      : props.onOpen(file.id)
                  }
                  aria-disabled={selectionDisabled}
                >
                  {folder ? <FolderIcon /> : <PageIcon />}
                  <span className={styles.title} title={file.title}>
                    {file.title}
                  </span>
                </button>
                {!props.selection ? (
                  <Menu
                    contentOptions={{ align: 'end' }}
                    items={
                      props.trash ? (
                        <>
                          <MenuItem
                            prefixIcon={<ResetIcon />}
                            disabled={props.pending.has(file.id)}
                            onClick={() =>
                              props.onChange(file, { trash: false })
                            }
                          >
                            {t['com.affine.localmind.project-files.restore']()}
                          </MenuItem>
                          <MenuItem
                            prefixIcon={<DeleteTemporarilyIcon />}
                            disabled={props.pending.has(file.id)}
                            onClick={() => props.onDelete?.(file)}
                          >
                            {t[
                              'com.affine.localmind.project-files.permanentlyDelete'
                            ]()}
                          </MenuItem>
                        </>
                      ) : (
                        <>
                          {folder ? (
                            <>
                              <MenuItem
                                prefixIcon={<PageIcon />}
                                disabled={props.pending.has(file.id)}
                                onClick={() =>
                                  props.onAction({
                                    kind: 'create',
                                    parentId: file.id,
                                    resourceKind: ProjectResourceKind.page,
                                    name: '',
                                    requestKey: crypto.randomUUID(),
                                  })
                                }
                              >
                                {t[
                                  'com.affine.localmind.project-files.newDocument'
                                ]()}
                              </MenuItem>
                              <MenuItem
                                prefixIcon={<FolderIcon />}
                                disabled={props.pending.has(file.id)}
                                onClick={() =>
                                  props.onAction({
                                    kind: 'create',
                                    parentId: file.id,
                                    resourceKind: ProjectResourceKind.folder,
                                    name: '',
                                    requestKey: crypto.randomUUID(),
                                  })
                                }
                              >
                                {t[
                                  'com.affine.localmind.project-files.newFolder'
                                ]()}
                              </MenuItem>
                            </>
                          ) : null}
                          <MenuItem
                            prefixIcon={<EditIcon />}
                            disabled={props.pending.has(file.id)}
                            onClick={() =>
                              props.onAction({
                                kind: 'rename',
                                file,
                                name: file.title,
                                requestKey: crypto.randomUUID(),
                              })
                            }
                          >
                            {t['com.affine.localmind.project-files.rename']()}
                          </MenuItem>
                          <MenuItem
                            prefixIcon={<FolderIcon />}
                            disabled={props.pending.has(file.id)}
                            onClick={() =>
                              props.onAction({
                                kind: 'move',
                                file,
                                name: file.title,
                                requestKey: crypto.randomUUID(),
                              })
                            }
                          >
                            {t['com.affine.localmind.project-files.move']()}
                          </MenuItem>
                          <MenuItem
                            prefixIcon={<ArrowUpSmallIcon />}
                            disabled={props.pending.has(file.id) || index === 0}
                            onClick={() =>
                              props.onChange(file, {
                                beforeId: query.items[index - 1].id,
                              })
                            }
                          >
                            {t['com.affine.localmind.project-files.moveUp']()}
                          </MenuItem>
                          <MenuItem
                            prefixIcon={<ArrowDownSmallIcon />}
                            disabled={
                              props.pending.has(file.id) ||
                              index === query.items.length - 1
                            }
                            onClick={() =>
                              props.onChange(file, {
                                beforeId: query.items[index + 2]?.id ?? null,
                              })
                            }
                          >
                            {t['com.affine.localmind.project-files.moveDown']()}
                          </MenuItem>
                          <MenuItem
                            prefixIcon={<DeleteTemporarilyIcon />}
                            disabled={props.pending.has(file.id)}
                            onClick={() =>
                              props.onChange(file, { trash: true })
                            }
                          >
                            {t['com.affine.localmind.project-files.delete']()}
                          </MenuItem>
                        </>
                      )
                    }
                  >
                    <IconButton
                      size="16"
                      tooltip={t[
                        'com.affine.localmind.project-files.actions'
                      ]()}
                      aria-label={t[
                        'com.affine.localmind.project-files.actions'
                      ]()}
                      icon={<MoreHorizontalIcon />}
                    />
                  </Menu>
                ) : null}
                {props.pending.has(file.id) ? <Loading size={16} /> : null}
              </ProjectFileDropTarget>
              {folder && expanded && !props.trash ? (
                <div className={styles.nested}>
                  <FileBranch {...props} parentId={file.id} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!query.items.length ? (
        <div className={styles.state}>
          {t['com.affine.localmind.project-files.empty']()}
        </div>
      ) : null}
      {query.hasMore ? (
        <Button
          disabled={query.loadingMore}
          loading={query.loadingMore}
          onClick={() => void query.loadMore()}
        >
          {t['com.affine.localmind.project-files.more']()}
        </Button>
      ) : null}
    </>
  );
}

const ignoreTreeAction = () => {};
const NO_PENDING = new Set<string>();
export function ProjectFileSelectionTree({
  projectId,
  selected,
  disabled,
  limit,
  onToggle,
}: {
  projectId: string;
  selected: ReadonlySet<string>;
  disabled: boolean;
  limit?: number;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(new Set<string>());
  return (
    <FileBranch
      projectId={projectId}
      parentId={null}
      selectedResourceId={null}
      onOpen={ignoreTreeAction}
      trash={false}
      pending={NO_PENDING}
      expanded={expanded}
      onToggle={id =>
        setExpanded(current => {
          const next = new Set(current);
          if (!next.delete(id)) next.add(id);
          return next;
        })
      }
      onAction={ignoreTreeAction}
      onChange={ignoreTreeAction}
      onFiles={ignoreTreeAction}
      selection={{ ids: selected, disabled, limit, toggle: onToggle }}
    />
  );
}

function MoveFolderList({
  projectId,
  path,
  excludedId,
  onEnter,
}: {
  projectId: string;
  path: ProjectFile[];
  excludedId: string;
  onEnter: (file: ProjectFile) => void;
}) {
  const t = useI18n();
  const [search, setSearch] = useState('');
  const query = useProjectFolder({
    projectId,
    parentId: path.at(-1)?.id ?? null,
    search,
  });
  return (
    <>
      <Input
        value={search}
        onChange={setSearch}
        maxLength={128}
        placeholder={t['com.affine.localmind.project-files.search']()}
      />
      <div className={styles.picker}>
        {query.isLoading && !query.error ? (
          <div className={styles.state}>
            <Loading size={20} />
          </div>
        ) : query.error ? (
          <div className={styles.state} role="alert">
            <span>{projectErrorMessage(query.error)}</span>
            <Button
              loading={query.isValidating}
              disabled={query.isValidating}
              onClick={() => void query.retry()}
            >
              {t['com.affine.localmind.project-files.retry']()}
            </Button>
          </div>
        ) : (
          <>
            {query.items
              .filter(file => file.kind === ProjectResourceKind.folder)
              .map(file => (
                <button
                  className={styles.open}
                  type="button"
                  key={file.id}
                  disabled={file.id === excludedId}
                  onClick={() => onEnter(file)}
                >
                  <FolderIcon />
                  <span className={styles.title}>{file.title}</span>
                  <ArrowRightSmallIcon />
                </button>
              ))}
            {!query.items.length ? (
              <div className={styles.state}>
                {t['com.affine.localmind.project-files.empty']()}
              </div>
            ) : null}
            {query.hasMore ? (
              <Button
                disabled={query.loadingMore}
                loading={query.loadingMore}
                onClick={() => void query.loadMore()}
              >
                {t['com.affine.localmind.project-files.more']()}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

export function ProjectFiles(props: FileTreeProps) {
  const t = useI18n();
  const { openConfirmModal } = useConfirmModal();
  const graphql = useService(GraphQLService);
  const server = useService(ServerService).server;
  const parentId = props.parentId ?? null;
  const [expanded, setExpanded] = useState(new Set<string>());
  const [trash, setTrash] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRevision, setImportRevision] = useState(0);
  const [action, setAction] = useState<FileAction | null>(null);
  const [path, setPath] = useState<ProjectFile[]>([]);
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(
    new Set()
  );
  const pendingRef = useRef(new Set<string>());
  const actionKey =
    action?.kind === 'create'
      ? `create:${action.parentId ?? 'root'}`
      : action?.file.id;
  const pending = !!actionKey && pendingKeys.has(actionKey);
  const [error, setError] = useState<string | null>(null);
  type Upload = {
    file: File;
    requestKey: string;
    parentId: string | null;
    status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
    progress?: ProjectUploadProgress;
    error?: string;
  };
  const [uploads, setUploads] = useState<Upload[]>([]);
  const uploadQueue = useRef<ProjectUploadQueue<Upload> | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const report = (caught: unknown) => {
    const message = projectErrorMessage(caught);
    notify.error({ title: message });
    return message;
  };
  const run = async (key: string, operation: () => Promise<void>) => {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    setPendingKeys(new Set(pendingRef.current));
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(report(caught));
    } finally {
      pendingRef.current.delete(key);
      setPendingKeys(new Set(pendingRef.current));
    }
  };

  const submit = () =>
    run(actionKey ?? 'create', async () => {
      if (!action) return;
      if (action.kind === 'create') {
        const result = await graphql.gql({
          query: createProjectResourceMutation,
          variables: {
            input: {
              projectId: props.projectId,
              parentId: action.parentId,
              kind: action.resourceKind,
              title: action.name.trim(),
              markdown: '',
              requestKey: action.requestKey,
            },
          },
        });
        if (action.parentId)
          setExpanded(current =>
            new Set(current).add(action.parentId as string)
          );
        if (result.createProjectResource.kind !== ProjectResourceKind.folder)
          props.onOpen(result.createProjectResource.id);
      } else {
        const change = (editLease?: ProjectEditLeaseProofInput) =>
          graphql.gql({
            query: changeProjectResourceMutation,
            variables: {
              input: {
                projectId: props.projectId,
                resourceId: action.file.id,
                expectedVersion: action.file.version,
                requestKey: action.requestKey,
                editLease,
                ...(action.kind === 'move'
                  ? { parentId: path.at(-1)?.id ?? null }
                  : { title: action.name.trim() }),
              },
            },
          });
        if (action.kind === 'rename')
          await projectEditLeaseStore(
            graphql,
            props.projectId,
            action.file.id
          ).withProof(change);
        else await change();
      }
      setAction(null);
    });

  const permanentlyDelete = (file: ProjectFile) => {
    const requestKey = crypto.randomUUID();
    openConfirmModal({
      title: t['com.affine.localmind.project-files.permanentlyDelete'](),
      description: t[
        'com.affine.localmind.project-files.permanentlyDeleteConfirm'
      ]({ title: file.title }),
      confirmText: t['com.affine.localmind.project-files.permanentlyDelete'](),
      cancelText: t['Cancel'](),
      confirmButtonOptions: { variant: 'error' },
      onConfirm: () =>
        run(file.id, async () => {
          await graphql.gql({
            query: permanentlyDeleteProjectResourceMutation,
            variables: {
              input: {
                projectId: props.projectId,
                resourceId: file.id,
                expectedVersion: file.version,
                requestKey,
              },
            },
          });
        }),
    });
  };

  const selectAction = (next: FileAction) => {
    setError(null);
    if (
      next.kind === 'create' &&
      next.resourceKind !== ProjectResourceKind.folder
    ) {
      void run(`create:${next.parentId ?? 'root'}`, async () => {
        const result = await graphql.gql({
          query: createProjectResourceMutation,
          variables: {
            input: {
              projectId: props.projectId,
              parentId: next.parentId,
              kind: next.resourceKind,
              title: t['Untitled'](),
              markdown: '',
              requestKey: next.requestKey,
            },
          },
        });
        props.onOpen(result.createProjectResource.id);
      }).catch(report);
    } else {
      setPath([]);
      setAction(next);
    }
  };

  const changeFile: BranchProps['onChange'] = (file, change) => {
    void run(file.id, async () => {
      await graphql.gql({
        query: changeProjectResourceMutation,
        variables: {
          input: {
            projectId: props.projectId,
            resourceId: file.id,
            expectedVersion: file.version,
            requestKey: crypto.randomUUID(),
            ...change,
          },
        },
      });
    }).catch(report);
  };

  const upload = async (input: Upload, signal: AbortSignal) => {
    const update = (patch: Partial<Upload>) => {
      if (!signal.aborted)
        setUploads(current =>
          current.map(item =>
            item.requestKey === input.requestKey ? { ...item, ...patch } : item
          )
        );
    };
    update({ status: 'uploading', error: undefined, progress: undefined });
    try {
      await uploadProjectFile(graphql, {
        ...input,
        projectId: props.projectId,
        signal,
        uploadBlob: file =>
          uploadProjectBlobWithProgress({
            baseUrl: server.serverMetadata.baseUrl,
            projectId: props.projectId,
            file,
            signal,
            onProgress: progress => update({ progress }),
          }),
        onUploaded: () => update({ status: 'processing' }),
      });
      update({ status: 'completed' });
    } catch (caught) {
      if (!signal.aborted) update({ status: 'failed', error: report(caught) });
    }
  };
  const enqueueFiles = (files: File[], directoryId: string | null) => {
    const queue: Upload[] = files.map(file => ({
      file,
      parentId: directoryId,
      requestKey: crypto.randomUUID(),
      status: 'queued',
    }));
    setUploads(current => [...current, ...queue]);
    uploadQueue.current?.enqueue(queue);
  };
  const executeUpload = useRef(upload);
  executeUpload.current = upload;
  const reportUpload = useRef(report);
  reportUpload.current = report;
  useEffect(() => {
    const queue = new ProjectUploadQueue<Upload>(
      (job, signal) => executeUpload.current(job, signal),
      (_job, caught) => {
        reportUpload.current(caught);
      }
    );
    uploadQueue.current = queue;
    return () => {
      queue.dispose();
      uploadQueue.current = null;
    };
  }, []);

  const title =
    action?.kind === 'move'
      ? t['com.affine.localmind.project-files.move']()
      : action?.kind === 'rename'
        ? t['com.affine.localmind.project-files.rename']()
        : action?.kind === 'create' &&
            action.resourceKind === ProjectResourceKind.folder
          ? t['com.affine.localmind.project-files.newFolder']()
          : action?.kind === 'create' &&
              action.resourceKind === ProjectResourceKind.edgeless
            ? t['com.affine.localmind.project-files.newCanvas']()
            : t['com.affine.localmind.project-files.newDocument']();

  return (
    <section
      className={styles.root}
      aria-label={t['com.affine.localmind.project-files.title']()}
      onDragOver={event => {
        if (!trash && event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={event => {
        if (!trash && event.dataTransfer.files.length) {
          event.preventDefault();
          enqueueFiles(Array.from(event.dataTransfer.files), parentId);
        }
      }}
    >
      <div className={styles.toolbar}>
        <h3 className={styles.heading}>
          {trash
            ? t['com.affine.localmind.project-files.trash']()
            : t['com.affine.localmind.project-files.title']()}
        </h3>
        <IconButton
          size="16"
          icon={<DeleteTemporarilyIcon />}
          tooltip={t['com.affine.localmind.project-files.trash']()}
          aria-label={t['com.affine.localmind.project-files.trash']()}
          aria-pressed={trash}
          onClick={() => setTrash(value => !value)}
        />
        <IconButton
          size="16"
          icon={<UploadIcon />}
          tooltip={t['com.affine.localmind.project-files.upload']()}
          aria-label={t['com.affine.localmind.project-files.upload']()}
          disabled={trash}
          onClick={() => uploadRef.current?.click()}
        />
        <Menu
          items={
            <>
              {[
                [
                  ProjectResourceKind.page,
                  t['com.affine.localmind.project-files.newDocument'](),
                ],
                [
                  ProjectResourceKind.edgeless,
                  t['com.affine.localmind.project-files.newCanvas'](),
                ],
                [
                  ProjectResourceKind.folder,
                  t['com.affine.localmind.project-files.newFolder'](),
                ],
              ].map(([kind, label]) => (
                <MenuItem
                  key={kind}
                  prefixIcon={
                    kind === ProjectResourceKind.folder ? (
                      <FolderIcon />
                    ) : (
                      <PageIcon />
                    )
                  }
                  onClick={() => {
                    selectAction({
                      kind: 'create',
                      parentId,
                      resourceKind: kind as ProjectResourceKind,
                      name: '',
                      requestKey: crypto.randomUUID(),
                    });
                  }}
                >
                  {label}
                </MenuItem>
              ))}
            </>
          }
        >
          <IconButton
            size="16"
            icon={<PlusIcon />}
            tooltip={t['com.affine.localmind.project-files.create']()}
            aria-label={t['com.affine.localmind.project-files.create']()}
            disabled={pendingKeys.has(`create:${parentId ?? 'root'}`) || trash}
          />
        </Menu>
        <Button disabled={trash} onClick={() => setImportOpen(true)}>
          {t['com.affine.localmind.workspace-import.title']()}
        </Button>
        <input
          className={styles.hidden}
          ref={uploadRef}
          type="file"
          multiple
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            enqueueFiles(files, parentId);
          }}
        />
      </div>
      {!trash ? (
        <ProjectWorkspaceImportStatus
          key={`${props.projectId}:${parentId}`}
          projectId={props.projectId}
          parentId={parentId}
          revision={importRevision}
          onOpen={props.onOpen}
        />
      ) : null}
      {importOpen ? (
        <ProjectWorkspaceImportPicker
          projectId={props.projectId}
          parentId={parentId}
          onClose={() => setImportOpen(false)}
          onSubmitted={() => setImportRevision(value => value + 1)}
        />
      ) : null}
      {error && !action ? (
        <div className={styles.state} role="alert">
          <span>{error}</span>
        </div>
      ) : null}
      {uploads.length ? (
        <ul className={styles.uploads} aria-live="polite">
          {uploads.map(item => (
            <li key={item.requestKey} className={styles.uploadRow}>
              <span className={styles.title}>{item.file.name}</span>
              <span>
                {t[
                  `com.affine.localmind.project-files.upload.${item.status}`
                ]()}
              </span>
              {item.status === 'uploading' ? (
                <progress
                  aria-label={item.file.name}
                  max={item.progress?.total ?? 1}
                  value={item.progress?.loaded}
                />
              ) : null}
              {item.status === 'failed' ? (
                <Button onClick={() => uploadQueue.current?.enqueue([item])}>
                  {t['com.affine.localmind.project-files.retry']()}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ProjectFolderDropTarget
        projectId={props.projectId}
        parentId={parentId}
        trash={trash}
        onMove={changeFile}
      >
        <FileBranch
          {...props}
          key={`${props.projectId}:${trash}`}
          parentId={trash ? null : parentId}
          trash={trash}
          pending={pendingKeys}
          onFiles={enqueueFiles}
          onDelete={permanentlyDelete}
          expanded={expanded}
          onToggle={id =>
            setExpanded(current => {
              const next = new Set(current);
              if (!next.delete(id)) next.add(id);
              return next;
            })
          }
          onAction={selectAction}
          onChange={changeFile}
        />
      </ProjectFolderDropTarget>
      <Modal
        open={!!action}
        title={title}
        onOpenChange={open => {
          if (!open && !pending) setAction(null);
        }}
      >
        {action ? (
          <form
            className={styles.form}
            onSubmit={event => {
              event.preventDefault();
              void submit().catch(report);
            }}
          >
            {action.kind === 'move' ? (
              <>
                <nav
                  className={styles.breadcrumbs}
                  aria-label={t['com.affine.localmind.project-files.move']()}
                >
                  <IconButton
                    size="16"
                    icon={<ArrowLeftSmallIcon />}
                    disabled={!path.length || pending}
                    tooltip={t['com.affine.localmind.project-files.back']()}
                    aria-label={t['com.affine.localmind.project-files.back']()}
                    onClick={() => setPath(current => current.slice(0, -1))}
                  />
                  <Button disabled={pending} onClick={() => setPath([])}>
                    {t['com.affine.localmind.project-files.root']()}
                  </Button>
                  {path.map((file, index) => (
                    <Button
                      key={file.id}
                      disabled={pending}
                      onClick={() =>
                        setPath(current => current.slice(0, index + 1))
                      }
                    >
                      {file.title}
                    </Button>
                  ))}
                </nav>
                <MoveFolderList
                  key={path.at(-1)?.id ?? 'root'}
                  projectId={props.projectId}
                  path={path}
                  excludedId={action.file.id}
                  onEnter={file => {
                    if (!pending) setPath(current => [...current, file]);
                  }}
                />
              </>
            ) : (
              <Input
                autoFocus
                autoSelect
                aria-label={t['com.affine.localmind.project-files.name']()}
                value={action.name}
                maxLength={512}
                disabled={pending}
                onChange={name =>
                  setAction(current =>
                    current
                      ? { ...current, name, requestKey: crypto.randomUUID() }
                      : null
                  )
                }
              />
            )}
            {error ? <div role="alert">{error}</div> : null}
            <div className={styles.actions}>
              <Button disabled={pending} onClick={() => setAction(null)}>
                {t['com.affine.localmind.project-files.cancel']()}
              </Button>
              <Button
                variant="primary"
                loading={pending}
                disabled={
                  pending || (!action.name.trim() && action.kind !== 'move')
                }
                onClick={() => void submit().catch(report)}
              >
                {action.kind === 'move'
                  ? t['com.affine.localmind.project-files.moveHere']()
                  : action.kind === 'rename'
                    ? t['com.affine.localmind.project-files.save']()
                    : t['com.affine.localmind.project-files.create']()}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}

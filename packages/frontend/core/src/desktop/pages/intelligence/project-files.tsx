import {
  Button,
  IconButton,
  Input,
  Loading,
  Menu,
  MenuItem,
  Modal,
} from '@affine/component';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  changeProjectResourceMutation,
  createProjectResourceMutation,
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
import { useRef, useState } from 'react';

import * as styles from './project-files.css';
import {
  type ProjectFile,
  projectFilesChanged,
  uploadProjectFile,
  useProjectFolder,
} from './project-files-data';
import { ProjectLegacy } from './project-legacy';
import { ProjectMigrations } from './project-migrations';

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
  selectedResourceId: string | null;
  onOpen: (resourceId: string) => void;
};

type BranchProps = FileTreeProps & {
  parentId: string | null;
  trash: boolean;
  pending: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAction: (action: FileAction) => void;
  onChange: (
    file: ProjectFile,
    change: { trash?: boolean; beforeId?: string | null }
  ) => void;
};

function FileBranch(props: BranchProps) {
  const t = useI18n();
  const query = useProjectFolder(props);
  if (query.isLoading)
    return (
      <div className={styles.state}>
        <Loading size={16} />
      </div>
    );
  if (query.error)
    return (
      <div className={styles.state} role="alert">
        <span>{String(query.error.message)}</span>
        <Button onClick={() => void query.mutate()}>
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
          return (
            <li key={file.id}>
              <div className={styles.row}>
                <button
                  className={styles.open}
                  type="button"
                  disabled={props.trash}
                  aria-expanded={folder ? expanded : undefined}
                  aria-current={props.selectedResourceId === file.id}
                  onClick={() =>
                    folder ? props.onToggle(file.id) : props.onOpen(file.id)
                  }
                >
                  {folder ? (
                    <>
                      <ArrowRightSmallIcon
                        style={{
                          transform: expanded ? 'rotate(90deg)' : undefined,
                        }}
                      />
                      <FolderIcon />
                    </>
                  ) : (
                    <PageIcon />
                  )}
                  <span className={styles.title} title={file.title}>
                    {file.title}
                  </span>
                </button>
                <Menu
                  contentOptions={{ align: 'end' }}
                  items={
                    props.trash ? (
                      <MenuItem
                        prefixIcon={<ResetIcon />}
                        disabled={props.pending}
                        onClick={() => props.onChange(file, { trash: false })}
                      >
                        {t['com.affine.localmind.project-files.restore']()}
                      </MenuItem>
                    ) : (
                      <>
                        {folder ? (
                          <>
                            <MenuItem
                              prefixIcon={<PageIcon />}
                              disabled={props.pending}
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
                              disabled={props.pending}
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
                          disabled={props.pending}
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
                          disabled={props.pending}
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
                          disabled={props.pending || index === 0}
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
                            props.pending || index === query.items.length - 1
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
                          disabled={props.pending}
                          onClick={() => props.onChange(file, { trash: true })}
                        >
                          {t['com.affine.localmind.project-files.delete']()}
                        </MenuItem>
                      </>
                    )
                  }
                >
                  <IconButton
                    size="16"
                    tooltip={t['com.affine.localmind.project-files.actions']()}
                    aria-label={t[
                      'com.affine.localmind.project-files.actions'
                    ]()}
                    icon={<MoreHorizontalIcon />}
                  />
                </Menu>
              </div>
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
        {query.isLoading ? (
          <div className={styles.state}>
            <Loading size={20} />
          </div>
        ) : query.error ? (
          <div className={styles.state} role="alert">
            <span>{String(query.error.message)}</span>
            <Button onClick={() => void query.mutate()}>
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
  const graphql = useService(GraphQLService);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [trash, setTrash] = useState(false);
  const [action, setAction] = useState<FileAction | null>(null);
  const [path, setPath] = useState<ProjectFile[]>([]);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadRetry, setUploadRetry] = useState<{
    file: File;
    requestKey: string;
  } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const run = async (operation: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      projectFilesChanged(props.projectId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const submit = () =>
    run(async () => {
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
        await graphql.gql({
          query: changeProjectResourceMutation,
          variables: {
            input: {
              projectId: props.projectId,
              resourceId: action.file.id,
              expectedVersion: action.file.version,
              requestKey: action.requestKey,
              ...(action.kind === 'move'
                ? { parentId: path.at(-1)?.id ?? null }
                : { title: action.name.trim() }),
            },
          },
        });
      }
      setAction(null);
    });

  const upload = (input: { file: File; requestKey: string }) =>
    run(async () => {
      setUploadRetry(input);
      const id = await uploadProjectFile(graphql, {
        ...input,
        projectId: props.projectId,
        parentId: null,
      });
      setUploadRetry(null);
      props.onOpen(id);
    });

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
          disabled={pending || trash}
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
                    setError(null);
                    setAction({
                      kind: 'create',
                      parentId: null,
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
            disabled={pending || trash}
          />
        </Menu>
        <input
          className={styles.hidden}
          ref={uploadRef}
          type="file"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file)
              upload({ file, requestKey: crypto.randomUUID() }).catch(
                console.error
              );
          }}
        />
      </div>
      {error && !action ? (
        <div className={styles.state} role="alert">
          <span>{error}</span>
          {uploadRetry ? (
            <Button disabled={pending} onClick={() => void upload(uploadRetry)}>
              {t['com.affine.localmind.project-files.retry']()}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!trash ? (
        <>
          <ProjectMigrations
            projectId={props.projectId}
            onOpen={props.onOpen}
          />
          <ProjectLegacy
            key={props.projectId}
            projectId={props.projectId}
            onOpen={props.onOpen}
          />
        </>
      ) : null}
      <FileBranch
        {...props}
        key={`${props.projectId}:${trash}`}
        parentId={null}
        trash={trash}
        pending={pending}
        expanded={expanded}
        onToggle={id =>
          setExpanded(current => {
            const next = new Set(current);
            if (!next.delete(id)) next.add(id);
            return next;
          })
        }
        onAction={next => {
          setError(null);
          setPath([]);
          setAction(next);
        }}
        onChange={(file, change) =>
          void run(async () => {
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
          })
        }
      />
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
              submit().catch(console.error);
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
                onClick={() => void submit()}
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

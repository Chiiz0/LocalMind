import {
  Button,
  IconButton,
  Input,
  Loading,
  Menu,
  MenuItem,
  Modal,
} from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import { projectErrorMessage } from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import {
  changeProjectPublicationMutation,
  confirmProjectPublicationMutation,
  createProjectDestinationFolderMutation,
  prepareProjectPublicationMutation,
  previewProjectPublicationMutation,
  projectAgentTaskQuery,
  projectDestinationFoldersQuery,
  projectDestinationWorkspacesQuery,
  projectPublicationCandidatesQuery,
  type ProjectPublicationFieldsFragment,
  projectPublicationQuery,
  projectPublicationsQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  ArrowLeftSmallIcon,
  ArrowRightSmallIcon,
  FolderIcon,
  PageIcon,
  PlusIcon,
  UploadIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import * as files from './project-files.css';
import * as styles from './project-publications.css';

type Publication = ProjectPublicationFieldsFragment;
const pathSchema = z.array(z.object({ id: z.string(), name: z.string() }));
const targetSchema = z.object({
  workspaceId: z.string(),
  resourceId: z.string(),
  folderId: z.string().nullable(),
  expectedVersion: z.string().nullable(),
});
const differenceSchema = z.object({
  before: z.string().optional(),
  after: z.string().optional(),
  truncated: z.boolean().optional(),
  changes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        before: z.string().optional(),
        after: z.string().optional(),
      })
    )
    .optional(),
});
const previewSchema = z.object({
  difference: differenceSchema,
  targetPath: pathSchema,
  resourceKind: z.string(),
  targetTitle: z.string().optional(),
  workspaceName: z.string().optional(),
  targetSequence: z.number().nullable().optional(),
  targetModifiedAt: z.string().nullable().optional(),
  audience: z.object({ memberCount: z.number() }),
});

const requestTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

function useStatusLabel() {
  const t = useI18n();
  return (status: string) => {
    switch (status) {
      case 'waiting_for_location':
        return t['com.affine.localmind.publications.waiting_for_location']();
      case 'waiting_for_confirmation':
        return t[
          'com.affine.localmind.publications.waiting_for_confirmation'
        ]();
      case 'complete':
        return t['com.affine.localmind.publications.complete']();
      case 'conflict':
        return t['com.affine.localmind.publications.conflict']();
      case 'expired':
        return t['com.affine.localmind.publications.expired']();
      case 'cancelled':
        return t['com.affine.localmind.project-tasks.cancelled']();
      case 'queued':
        return t['com.affine.localmind.project-tasks.queued']();
      case 'running':
        return t['com.affine.localmind.project-tasks.running']();
      default:
        return t['com.affine.localmind.project-tasks.failed']();
    }
  };
}

export function ProjectPublicationActions({
  projectId,
  resourceId,
}: {
  projectId: string;
  resourceId: string;
}) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        size="20"
        icon={<UploadIcon />}
        tooltip={t['com.affine.localmind.publications.title']()}
        aria-label={t['com.affine.localmind.publications.title']()}
        onClick={() => setOpen(true)}
      />
      <Modal
        open={open}
        title={t['com.affine.localmind.publications.title']()}
        onOpenChange={setOpen}
        contentOptions={{ className: styles.dialog }}
      >
        {open ? (
          <ProjectPublications
            key={`${projectId}:${resourceId}`}
            projectId={projectId}
            resourceId={resourceId}
          />
        ) : null}
      </Modal>
    </>
  );
}

export function ProjectPublications({
  projectId,
  resourceId,
}: {
  projectId: string;
  resourceId?: string;
}) {
  return (
    <ProjectPublicationList
      key={`${projectId}:${resourceId ?? ''}`}
      projectId={projectId}
      resourceId={resourceId}
    />
  );
}

function ProjectPublicationList({
  projectId,
  resourceId,
}: {
  projectId: string;
  resourceId?: string;
}) {
  const t = useI18n();
  const status = useStatusLabel();
  const graphql = useService(GraphQLService);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const creating = useRef(false);
  const retry = useRef<{ kind: string; key: string } | null>(null);
  const query = useQuery(
    {
      query: projectPublicationsQuery,
      variables: { projectId, resourceId, cursor, limit: 20 },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  useProjectRefresh(projectId, 'task', query.mutate);
  const create = async (kind: 'publish' | 'update') => {
    if (!resourceId || creating.current) return;
    creating.current = true;
    setPending(true);
    setError(null);
    if (retry.current?.kind !== kind)
      retry.current = { kind, key: crypto.randomUUID() };
    try {
      const result = await graphql.gql({
        query: prepareProjectPublicationMutation,
        variables: {
          projectId,
          resourceId,
          kind,
          requestKey: retry.current.key,
        },
      });
      retry.current = null;
      setSelected(result.prepareProjectPublication.id);
      await query.mutate();
    } catch (error) {
      setError(projectErrorMessage(error));
    } finally {
      creating.current = false;
      setPending(false);
    }
  };
  const items = query.error
    ? []
    : (query.data?.projectPublications.items ?? []).filter(
        item =>
          item.projectId === projectId &&
          (!resourceId || item.resourceId === resourceId)
      );
  if (selected)
    return (
      <PublicationDetail
        key={selected}
        projectId={projectId}
        publicationId={selected}
        onBack={() => {
          setSelected(null);
          void query
            .mutate()
            .catch(error => setError(projectErrorMessage(error)));
        }}
      />
    );
  return (
    <section
      className={styles.panel}
      aria-label={t['com.affine.localmind.publications.title']()}
    >
      <div className={styles.header}>
        <span className={styles.title}>
          {t['com.affine.localmind.publications.title']()}
        </span>
        {resourceId ? (
          <Menu
            items={
              <>
                <MenuItem
                  prefixIcon={<UploadIcon />}
                  disabled={pending}
                  onClick={() => void create('publish')}
                >
                  {t['com.affine.localmind.publications.publish']()}
                </MenuItem>
                <MenuItem
                  prefixIcon={<PageIcon />}
                  disabled={pending}
                  onClick={() => void create('update')}
                >
                  {t['com.affine.localmind.publications.update']()}
                </MenuItem>
              </>
            }
          >
            <IconButton
              size="20"
              icon={<PlusIcon />}
              disabled={pending}
              tooltip={t['com.affine.localmind.publications.publish']()}
              aria-label={t['com.affine.localmind.publications.publish']()}
            />
          </Menu>
        ) : null}
      </div>
      {query.isLoading ? (
        <div className={files.state}>
          <Loading size={18} />
        </div>
      ) : query.error ? (
        <p className={styles.error} role="alert">
          {projectErrorMessage(query.error)}
        </p>
      ) : items.length === 0 ? (
        <div className={files.state}>
          {t['com.affine.localmind.publications.empty']()}
        </div>
      ) : (
        <ul className={styles.rows}>
          {items.map(item => (
            <li key={item.id} className={styles.row}>
              <button
                type="button"
                className={styles.choice}
                onClick={() => setSelected(item.id)}
                data-publication-id={item.id}
              >
                <span className={styles.title}>
                  {item.title}
                  <span className={styles.meta}>
                    {' '}
                    ·{' '}
                    {t['com.affine.localmind.project-files.version']({
                      version: String(item.sourceSequence),
                    })}{' '}
                    · {requestTime(item.createdAt)}
                  </span>
                  <div className={styles.meta}>{status(item.status)}</div>
                </span>
                <ArrowRightSmallIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.footer}>
        {cursor ? (
          <IconButton
            size="20"
            icon={<ArrowLeftSmallIcon />}
            aria-label={t['com.affine.localmind.project-tasks.latest']()}
            tooltip={t['com.affine.localmind.project-tasks.latest']()}
            onClick={() => setCursor(undefined)}
          />
        ) : null}
        {query.data?.projectPublications.nextCursor ? (
          <Button
            onClick={() =>
              setCursor(query.data?.projectPublications.nextCursor ?? undefined)
            }
          >
            {t['com.affine.localmind.project-files.more']()}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function PublicationDetail({
  projectId,
  publicationId,
  onBack,
}: {
  projectId: string;
  publicationId: string;
  onBack: () => void;
}) {
  const t = useI18n();
  const status = useStatusLabel();
  const graphql = useService(GraphQLService);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const query = useQuery(
    { query: projectPublicationQuery, variables: { projectId, publicationId } },
    { suspense: false, shouldRetryOnError: false }
  );
  useProjectRefresh(projectId, 'task', query.mutate);
  const candidate = query.data?.projectPublication;
  const record =
    !query.error &&
    candidate?.projectId === projectId &&
    candidate.id === publicationId
      ? candidate
      : null;
  const run = async (operation: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      await query.mutate();
    } catch (error) {
      setError(projectErrorMessage(error));
      await query.mutate().catch(error => setError(projectErrorMessage(error)));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  const change = (action: 'cancel' | 'reopen') =>
    record &&
    run(() =>
      graphql.gql({
        query: changeProjectPublicationMutation,
        variables: {
          projectId,
          publicationId,
          expectedRevision: record.revision,
          action,
        },
      })
    );
  const target = targetSchema.safeParse(record?.target);
  const preview = previewSchema.safeParse(record?.preview);
  return (
    <div className={styles.form} data-publication-detail={publicationId}>
      <div className={styles.header}>
        <IconButton
          size="20"
          icon={<ArrowLeftSmallIcon />}
          disabled={pending}
          tooltip={t['com.affine.localmind.project-files.back']()}
          aria-label={t['com.affine.localmind.project-files.back']()}
          onClick={onBack}
        />
        <span className={styles.title}>
          {record?.title ?? t['com.affine.localmind.publications.title']()}
        </span>
      </div>
      {query.isLoading ? (
        <Loading size={18} />
      ) : query.error ? (
        <div role="alert">
          <p className={styles.error}>{projectErrorMessage(query.error)}</p>
          <Button onClick={() => void query.mutate()}>
            {t['com.affine.localmind.project-files.retry']()}
          </Button>
        </div>
      ) : record ? (
        <>
          <div>
            <div>
              {t['com.affine.localmind.publications.saved']()} ·{' '}
              {t['com.affine.localmind.project-files.version']({
                version: String(record.sourceSequence),
              })}
            </div>
            <div className={styles.meta}>
              {status(record.status)} · {requestTime(record.createdAt)}
            </div>
          </div>
          {record.status === 'waiting_for_location' ? (
            <DestinationPicker
              record={record}
              pending={pending}
              onSelect={selection =>
                run(() =>
                  graphql.gql({
                    query: previewProjectPublicationMutation,
                    variables: {
                      projectId,
                      publicationId,
                      expectedRevision: record.revision,
                      ...selection,
                    },
                  })
                )
              }
            />
          ) : null}
          {target.success ? (
            <div
              className={styles.meta}
              data-target-resource-id={target.data.resourceId}
            >
              {(preview.success && preview.data.workspaceName) ||
                target.data.workspaceId}{' '}
              /{' '}
              {preview.success
                ? preview.data.targetPath.map(part => part.name).join(' / ') ||
                  t['com.affine.localmind.publications.root']()
                : (target.data.folderId ??
                  t['com.affine.localmind.publications.root']())}
              <br />
              {(preview.success && preview.data.targetTitle) || record.title}
              {preview.success && preview.data.targetSequence ? (
                <div>
                  {t['com.affine.localmind.project-files.version']({
                    version: String(preview.data.targetSequence),
                  })}
                </div>
              ) : null}
              {preview.success && preview.data.targetModifiedAt ? (
                <div>{requestTime(preview.data.targetModifiedAt)}</div>
              ) : null}
            </div>
          ) : null}
          {record.status === 'waiting_for_confirmation' ? (
            preview.success ? (
              <>
                <div className={styles.meta}>
                  {t['com.affine.localmind.publications.audience']({
                    count: String(preview.data.audience.memberCount),
                  })}
                </div>
                <PublicationDifference difference={preview.data.difference} />
              </>
            ) : (
              <p className={styles.error} role="alert">
                {t['com.affine.localmind.publications.previewUnavailable']()}
              </p>
            )
          ) : null}
          {record.failureCode ? (
            <p className={styles.error} role="alert">
              {status(record.status)}
            </p>
          ) : null}
          <div className={styles.footer}>
            {[
              'waiting_for_location',
              'waiting_for_confirmation',
              'queued',
              'running',
            ].includes(record.status) ? (
              <Button disabled={pending} onClick={() => void change('cancel')}>
                {t['com.affine.localmind.project-files.cancel']()}
              </Button>
            ) : null}
            {[
              'waiting_for_confirmation',
              'failed',
              'conflict',
              'expired',
              'cancelled',
            ].includes(record.status) ? (
              <Button disabled={pending} onClick={() => void change('reopen')}>
                {t['com.affine.localmind.publications.reopen']()}
              </Button>
            ) : null}
            {record.status === 'waiting_for_confirmation' ? (
              <Button
                variant="primary"
                loading={pending}
                disabled={
                  pending || !record.targetFingerprint || !preview.success
                }
                onClick={() =>
                  void run(() =>
                    graphql.gql({
                      query: confirmProjectPublicationMutation,
                      variables: {
                        projectId,
                        publicationId,
                        expectedRevision: record.revision,
                        targetFingerprint: record.targetFingerprint ?? '',
                      },
                    })
                  )
                }
              >
                {t['com.affine.localmind.publications.confirm']()}
              </Button>
            ) : null}
            {record.status === 'complete' && target.success ? (
              <a
                href={`/workspace/${encodeURIComponent(target.data.workspaceId)}/${['document', 'workbook', 'presentation', 'pdf'].includes(preview.success ? preview.data.resourceKind : '') ? 'office/' : ''}${encodeURIComponent(target.data.resourceId)}`}
                target="_blank"
                rel="noreferrer"
              >
                {t['com.affine.localmind.publications.external']()}
              </a>
            ) : null}
          </div>
        </>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PublicationDifference({
  difference,
}: {
  difference: z.infer<typeof differenceSchema>;
}) {
  const t = useI18n();
  const rows = difference.changes ?? [
    {
      id: 'document',
      label: '',
      before: difference.before,
      after: difference.after,
    },
  ];
  return (
    <div>
      {difference.truncated ? (
        <p className={styles.meta}>
          {t['com.affine.localmind.publications.truncated']()}
        </p>
      ) : null}
      {rows.map(row => (
        <div key={row.id}>
          {row.label ? <p className={styles.meta}>{row.label}</p> : null}
          <div className={styles.comparison}>
            <div>
              <span className={styles.meta}>
                {t['com.affine.localmind.publications.before']()}
              </span>
              <pre className={styles.excerpt}>{row.before ?? ''}</pre>
            </div>
            <div>
              <span className={styles.meta}>
                {t['com.affine.localmind.publications.after']()}
              </span>
              <pre className={styles.excerpt}>{row.after ?? ''}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type Selection = {
  workspaceId: string;
  folderId: string | null;
  targetResourceId?: string;
};
function DestinationPicker({
  record,
  pending,
  onSelect,
}: {
  record: Publication;
  pending: boolean;
  onSelect: (selection: Selection) => Promise<void>;
}) {
  const t = useI18n();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const query = useQuery(
    {
      query: projectDestinationWorkspacesQuery,
      variables: { projectId: record.projectId },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  const workspaces = query.error
    ? []
    : (query.data?.projectDestinationWorkspaces ?? []);
  return (
    <div className={styles.form}>
      <Menu
        items={workspaces.map(workspace => (
          <MenuItem
            key={workspace.id}
            onClick={() => {
              setWorkspaceId(workspace.id);
              setParentId(null);
            }}
          >
            {workspace.name}
          </MenuItem>
        ))}
      >
        <Button disabled={pending || query.isLoading || !workspaces.length}>
          {workspaces.find(item => item.id === workspaceId)?.name ??
            t['com.affine.localmind.publications.workspace']()}
        </Button>
      </Menu>
      {query.isLoading ? (
        <Loading size={18} />
      ) : query.error ? (
        <div role="alert">
          <p className={styles.error}>{projectErrorMessage(query.error)}</p>
          <Button onClick={() => void query.mutate()}>
            {t['com.affine.localmind.project-files.retry']()}
          </Button>
        </div>
      ) : !workspaces.length ? (
        <p className={styles.meta}>
          {t['com.affine.localmind.publications.noWorkspaces']()}
        </p>
      ) : null}
      {workspaceId && workspaces.some(item => item.id === workspaceId) ? (
        <DestinationDirectory
          key={`${workspaceId}:${parentId ?? ''}`}
          record={record}
          workspaceId={workspaceId}
          parentId={parentId}
          pending={pending}
          onEnter={setParentId}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

function DestinationDirectory({
  record,
  workspaceId,
  parentId,
  pending,
  onEnter,
  onSelect,
}: {
  record: Publication;
  workspaceId: string;
  parentId: string | null;
  pending: boolean;
  onEnter: (id: string | null) => void;
  onSelect: (selection: Selection) => Promise<void>;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('');
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const [name, setName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useRef(false);
  const folderRequest = useRef<{ title: string; key: string } | null>(null);
  const mounted = useRef(false);
  const [folderRunId, setFolderRunId] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const folderTask = useQuery(
    folderRunId
      ? {
          query: projectAgentTaskQuery,
          variables: { projectId: record.projectId, runId: folderRunId },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  useProjectRefresh(record.projectId, 'task', folderTask.mutate);
  const task = folderTask.error ? null : folderTask.data?.projectAgentTask;
  const taskMatches =
    task?.id === folderRunId && task?.projectId === record.projectId;
  const folderPending =
    !!folderRunId &&
    (!taskMatches ||
      !['completed', 'failed', 'cancelled'].includes(task?.status ?? ''));
  useEffect(() => {
    if (
      taskMatches &&
      task?.status === 'completed' &&
      typeof task.receipt?.folderId === 'string'
    ) {
      onEnter(task.receipt.folderId);
    }
  }, [onEnter, task, taskMatches]);
  const query = useQuery(
    {
      query: projectDestinationFoldersQuery,
      variables: {
        projectId: record.projectId,
        workspaceId,
        parentId,
        query: queryText || undefined,
        cursor: pages.at(-1),
        limit: 20,
      },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  const directory = query.error ? null : query.data?.projectDestinationFolders;
  const createFolder = async () => {
    if (!directory || !name?.trim() || submit.current) return;
    submit.current = true;
    setCreating(true);
    setError(null);
    if (folderRequest.current?.title !== name.trim())
      folderRequest.current = { title: name.trim(), key: crypto.randomUUID() };
    try {
      const result = await graphql.gql({
        query: createProjectDestinationFolderMutation,
        variables: {
          projectId: record.projectId,
          publicationId: record.id,
          workspaceId,
          parentId,
          title: name.trim(),
          expectedDirectoryRevision: directory.revision,
          requestKey: folderRequest.current.key,
        },
      });
      if (!mounted.current) return;
      const outcome = result.createProjectDestinationFolder;
      if (outcome.status === 'completed' && outcome.folderId) {
        folderRequest.current = null;
        setName(null);
        onEnter(outcome.folderId);
      } else if (outcome.status === 'failed')
        throw new Error(t['com.affine.localmind.publications.noPermission']());
      else {
        setName(null);
        setFolderRunId(outcome.runId);
        await query.mutate();
      }
    } catch (error) {
      setError(projectErrorMessage(error));
    } finally {
      submit.current = false;
      setCreating(false);
    }
  };
  const disabled = pending || creating || folderPending;
  return (
    <div className={styles.form}>
      <nav
        className={files.breadcrumbs}
        aria-label={t['com.affine.localmind.publications.current']()}
      >
        <IconButton
          size="20"
          icon={<ArrowLeftSmallIcon />}
          disabled={disabled || !parentId}
          tooltip={t['com.affine.localmind.project-files.back']()}
          aria-label={t['com.affine.localmind.project-files.back']()}
          onClick={() => onEnter(directory?.current.path.at(-2)?.id ?? null)}
        />
        <button
          type="button"
          className={files.open}
          disabled={disabled}
          onClick={() => onEnter(null)}
        >
          {t['com.affine.localmind.publications.root']()}
        </button>
        {directory?.current.path.map(part => (
          <button
            type="button"
            key={part.id}
            className={files.open}
            disabled={disabled}
            onClick={() => onEnter(part.id)}
          >
            {part.name}
          </button>
        ))}
      </nav>
      <form
        className={styles.header}
        onSubmit={event => {
          event.preventDefault();
          setQueryText(search.trim());
          setPages([undefined]);
        }}
      >
        <Input
          value={search}
          onChange={setSearch}
          placeholder={t['com.affine.localmind.publications.search']()}
          aria-label={t['com.affine.localmind.publications.search']()}
          maxLength={128}
        />
        <Button disabled={disabled}>
          {t['com.affine.localmind.publications.search']()}
        </Button>
      </form>
      <div className={styles.browser} aria-busy={query.isLoading}>
        {query.isLoading ? (
          <div className={files.state}>
            <Loading size={18} />
          </div>
        ) : query.error ? (
          <div className={files.state} role="alert">
            <span>{projectErrorMessage(query.error)}</span>
            <Button onClick={() => void query.mutate()}>
              {t['com.affine.localmind.project-files.retry']()}
            </Button>
          </div>
        ) : directory?.items.length ? (
          directory.items.map(folder => (
            <button
              key={folder.folderId}
              type="button"
              className={styles.choice}
              disabled={disabled}
              onClick={() => onEnter(folder.folderId)}
            >
              <FolderIcon />
              <span className={styles.title}>
                {folder.path.at(-1)?.name}
                <span className={styles.meta}>
                  {queryText
                    ? ` / ${folder.path.map(item => item.name).join(' / ')}`
                    : ''}
                </span>
              </span>
              <ArrowRightSmallIcon />
            </button>
          ))
        ) : (
          <div className={files.state}>
            {t['com.affine.localmind.project-files.empty']()}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <IconButton
          size="20"
          icon={<ArrowLeftSmallIcon />}
          disabled={disabled || pages.length === 1}
          tooltip={t['com.affine.localmind.project-files.back']()}
          aria-label={t['com.affine.localmind.project-files.back']()}
          onClick={() => setPages(current => current.slice(0, -1))}
        />
        <IconButton
          size="20"
          icon={<ArrowRightSmallIcon />}
          disabled={disabled || !directory?.nextCursor}
          tooltip={t['com.affine.localmind.project-files.more']()}
          aria-label={t['com.affine.localmind.project-files.more']()}
          onClick={() =>
            setPages(current => [
              ...current,
              directory?.nextCursor ?? undefined,
            ])
          }
        />
        <Button
          prefix={<PlusIcon />}
          disabled={
            disabled || query.isLoading || !directory?.current.canCreateFolder
          }
          onClick={() => setName('')}
        >
          {t['com.affine.localmind.project-files.newFolder']()}
        </Button>
        {record.kind === 'publish' ? (
          <Button
            variant="primary"
            disabled={
              disabled || query.isLoading || !directory?.current.canSave
            }
            onClick={() => void onSelect({ workspaceId, folderId: parentId })}
          >
            {t['com.affine.localmind.publications.current']()}
          </Button>
        ) : null}
      </div>
      {name !== null ? (
        <form
          className={styles.header}
          onSubmit={event => {
            event.preventDefault();
            void createFolder().catch(error =>
              setError(projectErrorMessage(error))
            );
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={setName}
            maxLength={512}
            aria-label={t['com.affine.localmind.project-files.newFolder']()}
          />
          <Button loading={creating} disabled={disabled || !name.trim()}>
            {t['com.affine.localmind.project-files.create']()}
          </Button>
          <Button
            disabled={creating}
            onClick={event => {
              event.preventDefault();
              setName(null);
            }}
          >
            {t['com.affine.localmind.project-files.cancel']()}
          </Button>
        </form>
      ) : null}
      {record.kind === 'update' ? (
        <TargetDocuments
          key={`${workspaceId}:${parentId}:${queryText}`}
          record={record}
          workspaceId={workspaceId}
          parentId={parentId}
          queryText={queryText}
          pending={disabled}
          onSelect={onSelect}
        />
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {folderRunId ? (
        <div className={styles.meta} role="status">
          {folderPending ? <Loading size={18} /> : null}
          {taskMatches
            ? task?.title
            : t['com.affine.localmind.project-tasks.queued']()}
          {taskMatches && task?.failureMessage ? (
            <p className={styles.error}>
              {projectErrorMessage(task.failureMessage)}
            </p>
          ) : null}
          {folderTask.error ? (
            <div role="alert">
              <p className={styles.error}>
                {projectErrorMessage(folderTask.error)}
              </p>
              <Button onClick={() => void folderTask.mutate()}>
                {t['com.affine.localmind.project-files.retry']()}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TargetDocuments({
  record,
  workspaceId,
  parentId,
  queryText,
  pending,
  onSelect,
}: {
  record: Publication;
  workspaceId: string;
  parentId: string | null;
  queryText: string;
  pending: boolean;
  onSelect: (selection: Selection) => Promise<void>;
}) {
  const t = useI18n();
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const query = useQuery(
    {
      query: projectPublicationCandidatesQuery,
      variables: {
        projectId: record.projectId,
        resourceId: record.resourceId,
        workspaceId,
        parentId,
        query: queryText,
        cursor: pages.at(-1),
      },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  const data = query.error ? null : query.data?.projectPublicationCandidates;
  return (
    <div>
      <div className={styles.meta}>
        {t['com.affine.localmind.publications.target']()}
      </div>
      <div className={styles.browser}>
        {query.isLoading ? (
          <Loading size={18} />
        ) : query.error ? (
          <p className={styles.error} role="alert">
            {projectErrorMessage(query.error)}
          </p>
        ) : data?.items.length ? (
          data.items.map(item => (
            <button
              type="button"
              className={styles.choice}
              key={item.resourceId}
              data-target-resource-id={item.resourceId}
              disabled={pending || !item.canUpdate}
              onClick={() =>
                void onSelect({
                  workspaceId,
                  folderId: item.folderId,
                  targetResourceId: item.resourceId,
                })
              }
            >
              <PageIcon />
              <span className={styles.title}>
                {item.title}
                <div className={styles.meta}>
                  {item.path.map(part => part.name).join(' / ') ||
                    t['com.affine.localmind.publications.root']()}
                  {' / '}
                  {item.resourceId}
                </div>
              </span>
              <ArrowRightSmallIcon />
            </button>
          ))
        ) : (
          <div className={files.state}>
            {t['com.affine.localmind.publications.noTargets']()}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <IconButton
          size="20"
          icon={<ArrowLeftSmallIcon />}
          disabled={pending || pages.length === 1}
          tooltip={t['com.affine.localmind.project-files.back']()}
          aria-label={t['com.affine.localmind.project-files.back']()}
          onClick={() => setPages(current => current.slice(0, -1))}
        />
        <IconButton
          size="20"
          icon={<ArrowRightSmallIcon />}
          disabled={pending || !data?.nextCursor}
          tooltip={t['com.affine.localmind.project-files.more']()}
          aria-label={t['com.affine.localmind.project-files.more']()}
          onClick={() =>
            setPages(current => [...current, data?.nextCursor ?? undefined])
          }
        />
      </div>
    </div>
  );
}

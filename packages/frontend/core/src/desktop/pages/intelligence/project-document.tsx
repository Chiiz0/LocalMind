import {
  Button,
  IconButton,
  Loading,
  Modal,
  useConfirmModal,
} from '@affine/component';
import { getViewManager } from '@affine/core/blocksuite/manager/view';
import { getPreviewThemeExtension } from '@affine/core/blocksuite/view-extensions/theme/preview-theme';
import {
  AuthService,
  FetchService,
  GraphQLService,
  ServerService,
} from '@affine/core/modules/cloud';
import { ProjectBlobEngine } from '@affine/core/modules/project-resources/blob';
import {
  ProjectDocumentSession,
  type ProjectDocumentState,
  type ProjectRecoverableDraft,
} from '@affine/core/modules/project-resources/document-session';
import { projectDraftTabId } from '@affine/core/modules/project-resources/draft-tab';
import {
  useProjectEditGuard,
  useProjectUnsavedConfirmation,
} from '@affine/core/modules/project-resources/edit-guard';
import { useProjectEditLease } from '@affine/core/modules/project-resources/edit-lease';
import {
  projectErrorMessage,
  reportProjectError as reportError,
} from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import { WorkspaceImpl } from '@affine/core/modules/workspace/impls/workspace';
import { UserFriendlyError } from '@affine/error';
import { saveProjectDocumentMutation } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { ViewportElementExtension } from '@blocksuite/affine/shared/services';
import { BlockStdScope } from '@blocksuite/affine/std';
import { SaveIcon } from '@blocksuite/icons/rc';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';
import { Doc } from 'yjs';

import * as styles from './project-files.css';

export function ProjectDocument({
  projectId,
  resourceId,
  title,
  mode,
}: {
  projectId: string;
  resourceId: string;
  title: string;
  mode: 'page' | 'edgeless';
}) {
  const t = useI18n();
  const framework = useFramework();
  const graphql = useService(GraphQLService);
  const fetcher = useService(FetchService);
  const server = useService(ServerService).server;
  const account = useLiveData(useService(AuthService).session.account$);
  const accountId = account?.id;
  const container = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ProjectDocumentSession | null>(null);
  const editLease = useProjectEditLease();
  const proofRef = useRef(editLease?.proof);
  proofRef.current = editLease?.proof;
  const editorRef = useRef<BlockStdScope | null>(null);
  useEffect(() => {
    if (editorRef.current) editorRef.current.store.readonly = !editLease?.proof;
    if (!editLease?.proof) sessionRef.current?.suspend();
    else sessionRef.current?.resume();
  }, [editLease?.proof]);
  useProjectEditGuard({
    get hasUnsavedChanges() {
      return sessionRef.current?.hasUnsavedChanges ?? false;
    },
    save: async () => sessionRef.current?.saveChanges(),
    discard: async () => sessionRef.current?.discardChanges(),
    suspend: () => sessionRef.current?.suspend(),
    resume: () => sessionRef.current?.resume(),
  });
  const [state, setState] = useState<ProjectDocumentState>({
    phase: 'loading',
    version: 0,
    error: null,
  });
  const initialTitle = useRef(title);
  const [reload, setReload] = useState(0);
  useProjectRefresh(projectId, 'resource', () => sessionRef.current?.refresh());
  const [tabId] = useState(projectDraftTabId);
  const [recoverable, setRecoverable] = useState<ProjectRecoverableDraft[]>([]);
  const recoveryKey = useRef<string[] | undefined>(undefined);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const confirmUnsaved = useProjectUnsavedConfirmation();
  const { openConfirmModal } = useConfirmModal();

  useEffect(() => {
    if (!accountId || !container.current) return;
    let disposed = false;
    const element = container.current;
    const blobs = new ProjectBlobEngine(projectId, graphql, fetcher);
    // BlockSuite's collection interface is an editor container, not a persisted Workspace.
    const root = new Doc();
    const collection = new WorkspaceImpl({
      id: `project:${projectId}`,
      rootDoc: root,
      blobEngine: blobs,
      onCreateDoc: () => {
        throw new Error('Create documents through the Project file tree');
      },
    });
    collection.meta.initialize();
    collection.meta.addDocMeta({
      id: resourceId,
      title: initialTitle.current,
      createDate: Date.now(),
      tags: [],
    });
    const doc = collection.getDoc(resourceId);
    if (!doc)
      throw new Error('Project document editor could not be initialized');
    const recoverFrom = recoveryKey.current;
    recoveryKey.current = undefined;
    const session = new ProjectDocumentSession({
      doc: doc.spaceDoc,
      recoverFrom,
      onRecoverableDrafts: drafts => {
        if (!disposed) setRecoverable(drafts);
      },
      cacheKey: [
        server.serverMetadata.baseUrl,
        accountId,
        projectId,
        resourceId,
        tabId,
      ],
      read: async () => {
        const result = await fetcher.fetch(
          `/api/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/revisions/current`,
          { credentials: 'include' }
        );
        const version = Number(result.headers.get('x-project-content-version'));
        if (!Number.isSafeInteger(version) || version < 1)
          throw new Error('Project document version is unavailable');
        return { bytes: new Uint8Array(await result.arrayBuffer()), version };
      },
      save: async input => {
        const proof = proofRef.current;
        if (!proof) throw new Error('Project edit lease is unavailable');
        const result = await graphql.gql({
          query: saveProjectDocumentMutation,
          variables: {
            input: { projectId, resourceId, ...input, editLease: proof },
          },
        });
        return result.saveProjectDocument;
      },
      onState: next => {
        if (!disposed) setState(next);
      },
      onSaved: () => {
        blobs.clearPending();
      },
      isWritable: () => !!proofRef.current,
    });
    sessionRef.current = session;
    const mount = async () => {
      await session.load();
      if (disposed) return;
      doc.load();
      const std = new BlockStdScope({
        store: doc.getStore(),
        extensions: [
          ...getViewManager().config.init().value.get(mode),
          ViewportElementExtension('.project-document-viewport'),
          getPreviewThemeExtension(framework),
        ],
      });
      std.store.readonly = !proofRef.current;
      editorRef.current = std;
      element.replaceChildren(std.render());
    };
    void mount().catch(caught => {
      if (!disposed)
        setState({
          phase: 'error',
          version: 0,
          error: UserFriendlyError.fromAny(caught),
        });
    });
    const reconnect = () => {
      session.retry().catch(reportError);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (session.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      disposed = true;
      window.removeEventListener('online', reconnect);
      window.removeEventListener('beforeunload', beforeUnload);
      element.replaceChildren();
      sessionRef.current = null;
      editorRef.current = null;
      void session
        .dispose()
        .catch(reportError)
        .finally(() => {
          collection.dispose();
          root.destroy();
        });
    };
  }, [
    accountId,
    fetcher,
    framework,
    graphql,
    mode,
    projectId,
    resourceId,
    server.serverMetadata.baseUrl,
    reload,
    tabId,
  ]);

  return (
    <div className={styles.preview}>
      <div className={styles.toolbar}>
        <span className={styles.heading} role="status">
          {state.phase === 'saved'
            ? t['com.affine.localmind.project-files.saved']()
            : state.phase === 'saving'
              ? t['com.affine.localmind.project-files.saving']()
              : state.phase === 'unsaved' || state.phase === 'error'
                ? t['com.affine.localmind.project-files.unsaved']()
                : null}
        </span>
        {recoverable.length ? (
          <Button onClick={() => setRecoveryOpen(true)}>
            {t['com.affine.localmind.project-draft.local']({
              count: String(recoverable.length),
            })}
          </Button>
        ) : null}
        <IconButton
          size="20"
          icon={<SaveIcon />}
          disabled={state.phase !== 'unsaved' || !editLease?.proof}
          tooltip={t['com.affine.localmind.project-files.save']()}
          aria-label={t['com.affine.localmind.project-files.save']()}
          onClick={() => void sessionRef.current?.flush()}
        />
      </div>
      <Modal
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        title={t['com.affine.localmind.project-draft.recover']()}
        width={480}
      >
        {recoverable.map((draft, index) => (
          <div className={styles.toolbar} key={JSON.stringify(draft.cacheKey)}>
            <span>
              {t['com.affine.localmind.project-files.version']({
                version: String(draft.version),
              })}{' '}
              ·{' '}
              {draft.savedAt
                ? new Date(draft.savedAt).toLocaleString()
                : t['com.affine.localmind.project-draft.earlier']({
                    number: String(index + 1),
                  })}
            </span>
            <Button
              disabled={!editLease?.proof}
              onClick={() =>
                openConfirmModal({
                  title: t['com.affine.localmind.project-draft.recover'](),
                  description:
                    t['com.affine.localmind.project-draft.confirm'](),
                  confirmText:
                    t['com.affine.localmind.project-draft.recover'](),
                  cancelText: t['Cancel'](),
                  autoFocusConfirm: false,
                  onConfirm: async () => {
                    if (!(await confirmUnsaved())) return;
                    recoveryKey.current = draft.cacheKey;
                    setReload(value => value + 1);
                    setRecoveryOpen(false);
                  },
                })
              }
            >
              {t['com.affine.localmind.project-draft.recover']()}
            </Button>
          </div>
        ))}
      </Modal>
      {state.error ? (
        <div className={styles.state} role="alert">
          <span>{projectErrorMessage(state.error)}</span>
          <Button
            onClick={() => {
              if (state.version) sessionRef.current?.retry().catch(reportError);
              else setReload(value => value + 1);
            }}
          >
            {t['com.affine.localmind.project-files.retry']()}
          </Button>
        </div>
      ) : null}
      {state.phase === 'loading' ? (
        <div className={styles.state}>
          <Loading size={24} />
        </div>
      ) : null}
      <div className={`${styles.content} project-document-viewport`}>
        <div ref={container} className={styles.editor} data-mode={mode} />
      </div>
    </div>
  );
}

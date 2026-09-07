import { Button, IconButton, Loading } from '@affine/component';
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
} from '@affine/core/modules/project-resources/document-session';
import { WorkspaceImpl } from '@affine/core/modules/workspace/impls/workspace';
import { saveProjectDocumentMutation } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { ViewportElementExtension } from '@blocksuite/affine/shared/services';
import { BlockStdScope } from '@blocksuite/affine/std';
import { SaveIcon } from '@blocksuite/icons/rc';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';
import { Doc } from 'yjs';

import * as styles from './project-files.css';
import { projectFilesChanged } from './project-files-data';

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
  const [state, setState] = useState<ProjectDocumentState>({
    phase: 'loading',
    version: 0,
    error: null,
  });
  const initialTitle = useRef(title);
  const [reload, setReload] = useState(0);
  const [tabId] = useState(() => {
    const key = 'localmind-project-editor-tab';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  });

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
    const session = new ProjectDocumentSession({
      doc: doc.spaceDoc,
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
        const result = await graphql.gql({
          query: saveProjectDocumentMutation,
          variables: { input: { projectId, resourceId, ...input } },
        });
        return result.saveProjectDocument;
      },
      onState: next => {
        if (!disposed) setState(next);
      },
      onSaved: () => {
        blobs.clearPending();
        projectFilesChanged(projectId);
      },
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
      element.replaceChildren(std.render());
    };
    void mount().catch(caught => {
      if (!disposed)
        setState({
          phase: 'error',
          version: 0,
          error: caught instanceof Error ? caught.message : String(caught),
        });
    });
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible')
        session.refresh().catch(console.error);
    }, 10000);
    const reconnect = () => {
      session.retry().catch(console.error);
    };
    const flush = () => {
      session.flush().catch(console.error);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (session.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', beforeUnload);
      element.replaceChildren();
      sessionRef.current = null;
      void session
        .dispose()
        .catch(console.error)
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
        <IconButton
          size="20"
          icon={<SaveIcon />}
          disabled={state.phase !== 'unsaved'}
          tooltip={t['com.affine.localmind.project-files.save']()}
          aria-label={t['com.affine.localmind.project-files.save']()}
          onClick={() => void sessionRef.current?.flush()}
        />
      </div>
      {state.error ? (
        <div className={styles.state} role="alert">
          <span>{state.error}</span>
          <Button
            onClick={() => {
              if (state.version)
                sessionRef.current?.retry().catch(console.error);
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

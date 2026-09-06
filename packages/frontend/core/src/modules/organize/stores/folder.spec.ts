import {
  createORMClient,
  Framework,
  LiveData,
  YjsDBAdapter,
} from '@toeverything/infra';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Doc as YDoc } from 'yjs';

import type { WorkspaceDBService } from '../../db';
import { AFFiNE_WORKSPACE_DB_SCHEMA } from '../../db/schema';
import type { DocsService } from '../../doc';
import type {
  DirectoryAccessState,
  DirectoryAccessStore,
} from './directory-access';
import { FolderStore } from './folder';

const WorkspaceDBClient = createORMClient(AFFiNE_WORKSPACE_DB_SCHEMA);

describe('FolderStore links', () => {
  let mutate: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let db: InstanceType<typeof WorkspaceDBClient>;
  let store: FolderStore;
  let folderLoading$: LiveData<boolean>;
  let directoryState$: LiveData<DirectoryAccessState>;
  let docs: {
    trashDocs$: LiveData<{ id: string }[]>;
    docsMap$: LiveData<Map<string, { id: string }>>;
    isReady$: LiveData<boolean>;
  };

  beforeEach(() => {
    db = new WorkspaceDBClient(
      new YjsDBAdapter(AFFiNE_WORKSPACE_DB_SCHEMA, {
        getDoc: guid => new YDoc({ guid }),
      })
    );
    const framework = new Framework();
    mutate = vi.fn().mockResolvedValue(undefined);
    refresh = vi.fn().mockResolvedValue(undefined);
    directoryState$ = new LiveData<DirectoryAccessState>({
      mode: 'local',
      items: [],
      error: null,
    });
    folderLoading$ = new LiveData(false);
    const dbService = {
      db: {
        folders: Object.assign(db.folders, { isLoading$: folderLoading$ }),
      },
    } as unknown as WorkspaceDBService;
    docs = {
      trashDocs$: new LiveData<{ id: string }[]>([]),
      docsMap$: new LiveData(new Map([['doc-1', { id: 'doc-1' }]])),
      isReady$: new LiveData(true),
    };
    framework.store(
      FolderStore,
      () =>
        new FolderStore(
          dbService,
          { list: docs } as unknown as DocsService,
          {
            state$: directoryState$,
            saving$: new LiveData(false),
            mutate,
            refresh,
          } as unknown as DirectoryAccessStore
        )
    );
    store = framework.provider().get(FolderStore);
  });

  function createFolder(id: string) {
    db.folders.create({
      id,
      parentId: null,
      type: 'folder',
      data: id,
      index: 'a0',
    });
  }

  test('restricted and failed loads never fall back to cached directory rows', async () => {
    createFolder('cached-private');
    directoryState$.next({
      mode: 'filtered',
      error: null,
      items: [
        {
          id: 'visible',
          type: 'folder',
          data: 'Visible',
          parentId: null,
          index: 'a0',
          rights: {
            canRead: true,
            canWrite: false,
            canOrganize: false,
            canCreateFolder: false,
          },
        },
      ],
    });
    expect(
      (await firstValueFrom(store.watchNodeChildren(null))).map(row => row.id)
    ).toEqual(['visible']);
    expect(
      await firstValueFrom(store.watchNodeInfo('cached-private'))
    ).toBeNull();
    expect(() => store.createFolder(null, 'Blocked', 'a0')).toThrow(
      /authorized server operation/
    );
    directoryState$.next({ mode: 'error', items: [], error: 'Access revoked' });
    expect(await firstValueFrom(store.watchNodeChildren(null))).toEqual([]);
    expect(db.folders.get('cached-private')).not.toBeNull();
  });

  test('waits for directory authorization before choosing the write path', async () => {
    directoryState$.next({ mode: 'loading', items: [], error: null });
    queueMicrotask(() => {
      directoryState$.next({ mode: 'full', items: [], error: null });
    });

    const id = await store.createFolderAuthorized(null, 'Ready', 'a0');

    expect(refresh).not.toHaveBeenCalled();
    expect(db.folders.get(id)).toEqual(
      expect.objectContaining({ data: 'Ready', parentId: null })
    );
    expect(mutate).not.toHaveBeenCalled();

    directoryState$.next({
      mode: 'error',
      items: [],
      error: 'Directory access revoked',
    });
    refresh.mockResolvedValueOnce(undefined);
    await expect(
      store.createFolderAuthorized(null, 'Blocked', 'a1')
    ).rejects.toThrow('Directory access revoked');
    expect(refresh).toHaveBeenCalledWith(true);
    expect(db.folders.find({ parentId: null })).toHaveLength(1);
  });

  test('restricted writes use server operations without altering cached rows', async () => {
    createFolder('visible');
    directoryState$.next({
      mode: 'filtered',
      error: null,
      items: [
        {
          id: 'visible',
          type: 'folder',
          data: 'Visible',
          parentId: null,
          index: 'a0',
          rights: {
            canRead: true,
            canWrite: true,
            canOrganize: true,
            canCreateFolder: true,
          },
        },
      ],
    });
    await store.renameNodeAuthorized('visible', 'Renamed');
    expect(mutate).toHaveBeenLastCalledWith([
      {
        op: 'upsert',
        key: 'visible',
        values: {
          type: 'folder',
          data: 'Renamed',
          parentId: null,
          index: 'a0',
        },
      },
    ]);
    expect(db.folders.get('visible')?.data).toBe('visible');
    expect(await firstValueFrom(store.watchFolderCanDelete('visible'))).toBe(
      true
    );
    mutate.mockRejectedValueOnce(new Error('Permission revoked'));
    await expect(store.removeNodeAuthorized('visible')).rejects.toThrow(
      'Permission revoked'
    );
    expect(db.folders.get('visible')).not.toBeNull();
    await expect(
      store.renameNodeAuthorized('hidden', 'Overwrite')
    ).rejects.toThrow('Folder not found');
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  test('deletes an empty folder without deleting its sibling', () => {
    createFolder('folder-1');
    createFolder('folder-2');
    expect(store.removeFolder('folder-1')).toBe(true);
    expect(db.folders.get('folder-1')).toBeNull();
    expect(db.folders.get('folder-2')).not.toBeNull();
  });

  test('does not delete a folder before its contents finish loading', () => {
    createFolder('folder-1');
    folderLoading$.next(true);
    expect(store.removeFolder('folder-1')).toBe(false);
    expect(db.folders.get('folder-1')).not.toBeNull();
    folderLoading$.next(false);
    expect(store.removeFolder('folder-1')).toBe(true);
  });

  test.each(['doc', 'tag', 'collection'] as const)(
    'refuses to delete a folder containing a %s link',
    type => {
      createFolder('folder-1');
      const link = store.createLink('folder-1', type, 'doc-1', 'a0');
      expect(store.removeFolder('folder-1')).toBe(false);
      expect(db.folders.get('folder-1')).not.toBeNull();
      expect(db.folders.get(link)).not.toBeNull();
    }
  );

  test('refuses to delete even an empty subfolder recursively', () => {
    createFolder('folder-1');
    const child = store.createFolder('folder-1', 'child', 'a0');
    expect(store.removeFolder('folder-1')).toBe(false);
    expect(db.folders.get(child)).not.toBeNull();
    expect(store.removeFolder(child)).toBe(true);
    expect(store.removeFolder('folder-1')).toBe(true);
  });

  test('checks current contents after the menu observed an empty folder', () => {
    createFolder('folder-1');
    const canDelete$ = LiveData.from(
      store.watchFolderCanDelete('folder-1'),
      false
    );
    expect(canDelete$.value).toBe(true);
    const link = store.createLink('folder-1', 'doc', 'doc-1', 'a0');
    expect(store.removeFolder('folder-1')).toBe(false);
    expect(canDelete$.value).toBe(false);
    store.removeLink(link);
    expect(canDelete$.value).toBe(true);
  });

  test('cleans only trash links in the deleted folder and preserves other locations', () => {
    createFolder('folder-1');
    createFolder('folder-2');
    const removed = store.createLink('folder-1', 'doc', 'doc-1', 'a0');
    const retained = store.createLink('folder-2', 'doc', 'doc-1', 'a0');
    docs.trashDocs$.next([{ id: 'doc-1' }]);
    expect(store.removeFolder('folder-1')).toBe(true);
    expect(db.folders.get(removed)).toBeNull();
    expect(db.folders.get(retained)).not.toBeNull();
    expect(docs.trashDocs$.value).toEqual([{ id: 'doc-1' }]);
    docs.trashDocs$.next([]);
    expect(store.removeFolder('folder-2')).toBe(false);
  });

  test('does not partially remove trash links when another child blocks deletion', () => {
    createFolder('folder-1');
    const link = store.createLink('folder-1', 'doc', 'doc-1', 'a0');
    store.createFolder('folder-1', 'child', 'a1');
    docs.trashDocs$.next([{ id: 'doc-1' }]);
    expect(store.removeFolder('folder-1')).toBe(false);
    expect(db.folders.get(link)).not.toBeNull();
  });

  test('rechecks restored documents before deleting and updates the menu state', () => {
    createFolder('folder-1');
    store.createLink('folder-1', 'doc', 'doc-1', 'a0');
    const canDelete$ = LiveData.from(
      store.watchFolderCanDelete('folder-1'),
      false
    );
    expect(canDelete$.value).toBe(false);
    docs.trashDocs$.next([{ id: 'doc-1' }]);
    expect(canDelete$.value).toBe(true);
    docs.trashDocs$.next([]);
    expect(canDelete$.value).toBe(false);
    expect(store.removeFolder('folder-1')).toBe(false);
  });

  test('only removes missing document links once the document list is ready', () => {
    createFolder('folder-1');
    store.createLink('folder-1', 'doc', 'deleted-doc', 'a0');
    docs.isReady$.next(false);
    expect(store.removeFolder('folder-1')).toBe(false);
    docs.isReady$.next(true);
    expect(store.removeFolder('folder-1')).toBe(true);
  });

  test('reuses a link to the same target in the same folder', () => {
    createFolder('folder-1');

    const firstId = store.createLink('folder-1', 'doc', 'doc-1', 'a0');
    const secondId = store.createLink('folder-1', 'doc', 'doc-1', 'a1');

    expect(secondId).toBe(firstId);
    expect(
      db.folders.find({
        parentId: 'folder-1',
        type: 'doc',
        data: 'doc-1',
      })
    ).toEqual([expect.objectContaining({ id: firstId, index: 'a0' })]);
  });

  test('allows links to the same target in different folders', () => {
    createFolder('folder-1');
    createFolder('folder-2');

    const firstId = store.createLink('folder-1', 'doc', 'doc-1', 'a0');
    const secondId = store.createLink('folder-2', 'doc', 'doc-1', 'a0');

    expect(secondId).not.toBe(firstId);
    expect(db.folders.find({ type: 'doc', data: 'doc-1' })).toHaveLength(2);
  });

  test('removes the moved link when the target folder already has it', () => {
    createFolder('folder-1');
    createFolder('folder-2');
    const movedId = store.createLink('folder-1', 'doc', 'doc-1', 'a0');
    const existingId = store.createLink('folder-2', 'doc', 'doc-1', 'a0');

    expect(store.moveNode(movedId, 'folder-2', 'a1')).toBe(existingId);
    expect(db.folders.get(movedId)).toBeNull();
    expect(db.folders.get(existingId)).toEqual(
      expect.objectContaining({ parentId: 'folder-2', index: 'a0' })
    );
  });

  test('moves a link when the target folder does not contain it', () => {
    createFolder('folder-1');
    createFolder('folder-2');
    const linkId = store.createLink('folder-1', 'doc', 'doc-1', 'a0');

    expect(store.moveNode(linkId, 'folder-2', 'a1')).toBe(linkId);
    expect(db.folders.get(linkId)).toEqual(
      expect.objectContaining({ parentId: 'folder-2', index: 'a1' })
    );
  });
});

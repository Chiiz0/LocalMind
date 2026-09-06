import test from 'ava';
import * as Y from 'yjs';

import { directoryPolicySnapshot } from '../../../models/workspace-directory-grant';
import {
  resolveWorkspaceDataDocId,
  WorkspaceOrganizationService,
} from '../workspace-organization';

function rootFixture() {
  const doc = new Y.Doc({ guid: 'workspace-1' });
  const meta = doc.getMap<unknown>('meta');
  meta.set('name', 'LocalMind');

  const pages = new Y.Array<Y.Map<unknown>>();
  const page = new Y.Map<unknown>();
  page.set('id', 'doc-1');
  page.set('title', 'Document');
  page.set('tags', new Y.Array<string>());
  pages.push([page]);
  meta.set('pages', pages);

  const properties = new Y.Map<unknown>();
  const tags = new Y.Map<unknown>();
  tags.set('options', new Y.Array<unknown>());
  properties.set('tags', tags);
  meta.set('properties', properties);

  const setting = doc.getMap<unknown>('setting');
  setting.set('collections', new Y.Array<unknown>());
  return doc;
}

function createServiceFixture() {
  const docs = new Map<string, Y.Doc>([['workspace-1', rootFixture()]]);
  let timestamp = 1;
  const reader = {
    getDoc: async (_workspaceId: string, docId: string) => {
      const doc = docs.get(docId);
      return doc
        ? {
            spaceId: 'workspace-1',
            docId,
            bin: Y.encodeStateAsUpdate(doc),
            timestamp,
          }
        : null;
    },
  };
  const writer = {
    pushDocUpdate: async (
      _workspaceId: string,
      docId: string,
      update: Uint8Array
    ) => {
      let doc = docs.get(docId);
      if (!doc) {
        doc = new Y.Doc({ guid: docId });
        docs.set(docId, doc);
      }
      Y.applyUpdate(doc, update);
      timestamp++;
      return { success: true, timestamp };
    },
    deleteDocPermanently: async () => {},
  };
  return {
    docs,
    reader,
    service: new WorkspaceOrganizationService(
      reader as never,
      writer as never,
      {
        workspaceDirectoryGrant: {
          snapshot: async () => directoryPolicySnapshot('actor', []),
          withMutationLock: async (
            _workspaceId: string,
            operation: () => Promise<unknown>
          ) => await operation(),
          rights: async () => ({
            canRead: true,
            canWrite: true,
            canOrganize: true,
            canCreateFolder: true,
          }),
        },
      } as never
    ),
  };
}

function createService() {
  return createServiceFixture().service;
}

test('directory snapshots reject cycles, missing parents and paths beyond 64 nodes', async t => {
  const { docs, service } = createServiceFixture();
  const doc = new Y.Doc();
  const add = (id: string, parentId: string | null, type = 'folder') => {
    const record = doc.getMap(id);
    for (const [key, value] of Object.entries({
      id,
      parentId,
      type,
      data: id,
      index: 'a0',
    }))
      record.set(key, value);
  };
  for (let depth = 0; depth < 65; depth++)
    add(`depth-${depth}`, depth === 0 ? null : `depth-${depth - 1}`);
  add('cycle-a', 'cycle-b');
  add('cycle-b', 'cycle-a');
  add('orphan', 'absent');
  add('document-parent', null, 'doc');
  add('invalid-parent', 'document-parent');
  docs.set('db$workspace-1$folders', doc);
  const snapshot = await service.readDirectory('workspace-1', 'actor');
  const ids = new Set(snapshot.entries.map(entry => entry.row.id));
  t.true(ids.has('depth-63'));
  for (const id of [
    'depth-64',
    'cycle-a',
    'cycle-b',
    'orphan',
    'invalid-parent',
  ])
    t.false(ids.has(id));
  t.is(
    snapshot.revision,
    await service.directoryRevision('workspace-1', 'actor')
  );
  doc.destroy();
});

test('directory parse cache revalidates bytes and does not reuse data after storage failure', async t => {
  const { docs, reader, service } = createServiceFixture();
  const doc = new Y.Doc();
  const record = doc.getMap('folder');
  for (const [key, value] of Object.entries({
    id: 'folder',
    type: 'folder',
    parentId: null,
    data: 'Original',
    index: 'a0',
  }))
    record.set(key, value);
  docs.set('db$workspace-1$folders', doc);
  const first = await service.readDirectory('workspace-1', 'actor');
  first.entries[0].row.data = 'Caller mutation';
  const second = await service.readDirectory('workspace-1', 'actor');
  t.is(second.entries[0].row.data, 'Original');
  const state = Y.encodeStateVector(doc);
  record.delete('data');
  t.deepEqual(Y.encodeStateVector(doc), state);
  const deleted = await service.readDirectory('workspace-1', 'actor');
  t.not(deleted.revision, first.revision);
  t.is(deleted.entries[0].row.data, undefined);
  await t.throwsAsync(
    service.applyConditionalFolderOperations({
      workspaceId: 'workspace-1',
      actorId: 'actor',
      expectedRevision: first.revision,
      operations: [{ op: 'delete', key: 'folder' }],
      authorizeDocument: async () => {},
    }),
    { message: /Directory changed/ }
  );
  reader.getDoc = async () => {
    throw new Error('Storage unavailable');
  };
  await t.throwsAsync(service.readDirectory('workspace-1', 'actor'), {
    message: 'Storage unavailable',
  });
  doc.destroy();
});

function removeTrashClaims(doc: Y.Doc, documentId: string) {
  const pages = doc.getMap<unknown>('meta').get('pages');
  if (!(pages instanceof Y.Array)) throw new Error('Root pages are missing.');
  const page = pages
    .toArray()
    .find(
      candidate =>
        candidate instanceof Y.Map && candidate.get('id') === documentId
    );
  if (!(page instanceof Y.Map)) throw new Error('Document page is missing.');
  page.delete('$localmindTrashClaims');
}

test('workspace organization resolves browser-compatible storage doc IDs', t => {
  const workspaceId = 'workspace-1';
  const userId = 'user-1';

  t.deepEqual(
    {
      folders: resolveWorkspaceDataDocId('folders', workspaceId, userId),
      documentProperties: resolveWorkspaceDataDocId(
        'document_properties',
        workspaceId,
        userId
      ),
      workspaceProperties: resolveWorkspaceDataDocId(
        'workspace_properties',
        workspaceId,
        userId
      ),
      pinnedCollections: resolveWorkspaceDataDocId(
        'pinned_collections',
        workspaceId,
        userId
      ),
      explorerIcons: resolveWorkspaceDataDocId(
        'explorer_icons',
        workspaceId,
        userId
      ),
      favorites: resolveWorkspaceDataDocId('favorites', workspaceId, userId),
      userSettings: resolveWorkspaceDataDocId(
        'user_settings',
        workspaceId,
        userId
      ),
    },
    {
      folders: 'db$workspace-1$folders',
      documentProperties: 'db$workspace-1$docProperties',
      workspaceProperties: 'db$workspace-1$docCustomPropertyInfo',
      pinnedCollections: 'db$workspace-1$pinnedCollections',
      explorerIcons: 'db$workspace-1$explorerIcon',
      favorites: 'userdata$user-1$workspace-1$favorite',
      userSettings: 'userdata$user-1$workspace-1$settings',
    }
  );
});

test('workspace organization service round-trips root metadata operations', async t => {
  const service = createService();

  const result = await service.applyRootOperations('workspace-1', 'user-1', [
    {
      op: 'create_tag',
      id: 'tag-1',
      value: 'Important',
      color: 'red',
    },
    {
      op: 'set_document_tags',
      docId: 'doc-1',
      tagIds: ['tag-1'],
    },
    {
      op: 'create_collection',
      id: 'collection-1',
      name: 'Focus',
      rules: { filters: [] },
      allowList: ['doc-1'],
    },
    { op: 'set_document_trashed', docId: 'doc-1', trashed: true },
  ]);
  t.deepEqual(result.createdTagIds, ['tag-1']);
  t.deepEqual(result.createdCollectionIds, ['collection-1']);

  const read = await service.readOrganization('workspace-1', 'user-1');
  t.deepEqual(read.tags, [
    {
      id: 'tag-1',
      value: 'Important',
      color: 'red',
      createDate: (read.tags as { createDate: number }[])[0].createDate,
      updateDate: (read.tags as { updateDate: number }[])[0].updateDate,
    },
  ]);
  t.deepEqual(read.collections, [
    {
      id: 'collection-1',
      name: 'Focus',
      rules: { filters: [] },
      allowList: ['doc-1'],
    },
  ]);
  t.deepEqual(read.documents, [
    {
      id: 'doc-1',
      title: 'Document',
      tags: ['tag-1'],
      trash: true,
      trashDate: (read.documents as { trashDate: number }[])[0].trashDate,
    },
  ]);
});

test('workspace organization service round-trips ORM table operations', async t => {
  const service = createService();

  await service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'favorites',
    [{ op: 'upsert', key: 'doc:doc-1', values: { index: 'a0' } }]
  );
  await service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder-1',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Projects',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'link-1',
        values: {
          parentId: 'folder-1',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
    ]
  );
  await service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'document_properties',
    [
      {
        op: 'upsert',
        key: 'doc-1',
        values: { primaryMode: 'edgeless', isTemplate: true },
      },
    ]
  );

  const read = await service.readOrganization('workspace-1', 'user-1');
  t.deepEqual(read.favorites, [{ key: 'doc:doc-1', index: 'a0' }]);
  t.deepEqual(read.folders, [
    {
      id: 'folder-1',
      parentId: null,
      type: 'folder',
      data: 'Projects',
      index: 'a0',
    },
    {
      id: 'link-1',
      parentId: 'folder-1',
      type: 'doc',
      data: 'doc-1',
      index: 'a0',
    },
  ]);
  t.deepEqual(read.documentProperties, [
    { id: 'doc-1', primaryMode: 'edgeless', isTemplate: true },
  ]);
});

test('folder Trash claims keep a multiply placed document trashed until every folder is restored', async t => {
  const service = createService();
  await service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder-a',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Folder A',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'placement-a',
        values: {
          parentId: 'folder-a',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'folder-b',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Folder B',
          index: 'a1',
        },
      },
      {
        op: 'upsert',
        key: 'placement-b',
        values: {
          parentId: 'folder-b',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
    ]
  );
  const authorizeDocument = async () => {};
  await service.trashFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-a',
    expectedName: 'Folder A',
    recursive: true,
    authorizeDocument,
  });
  await service.trashFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-b',
    expectedName: 'Folder B',
    recursive: true,
    authorizeDocument,
  });
  await service.restoreFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-a',
    expectedName: 'Folder A',
    authorizeDocument,
  });
  const afterFirstRestore = await service.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.is((afterFirstRestore.documents[0] as Record<string, unknown>).trash, true);

  await service.restoreFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-b',
    expectedName: 'Folder B',
    authorizeDocument,
  });
  const afterSecondRestore = await service.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.false('trash' in afterSecondRestore.documents[0]);
});

test('root trash operations preserve active folder claims', async t => {
  const service = createService();
  await service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder-1',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Folder',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'placement-1',
        values: {
          parentId: 'folder-1',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
    ]
  );
  const authorizeDocument = async () => {};
  await service.trashFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-1',
    expectedName: 'Folder',
    recursive: true,
    authorizeDocument,
  });
  await service.applyRootOperations('workspace-1', 'user-1', [
    { op: 'set_document_trashed', docId: 'doc-1', trashed: true },
  ]);
  await service.restoreFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-1',
    expectedName: 'Folder',
    authorizeDocument,
  });
  let organization = await service.readOrganization('workspace-1', 'user-1');
  t.is((organization.documents[0] as Record<string, unknown>).trash, true);
  t.false(
    '$localmindTrashClaims' in
      (organization.documents[0] as Record<string, unknown>)
  );

  await service.applyRootOperations('workspace-1', 'user-1', [
    { op: 'set_document_trashed', docId: 'doc-1', trashed: false },
  ]);
  organization = await service.readOrganization('workspace-1', 'user-1');
  t.false('trash' in organization.documents[0]);
});

test('legacy folder Trash manifests restore documents according to their original state', async t => {
  const authorizeDocument = async () => {};

  const newlyTrashed = createServiceFixture();
  await newlyTrashed.service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder-new',
        values: {
          parentId: null,
          type: 'folder',
          data: 'New',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'placement-new',
        values: {
          parentId: 'folder-new',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
    ]
  );
  await newlyTrashed.service.trashFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-new',
    expectedName: 'New',
    recursive: true,
    authorizeDocument,
  });
  removeTrashClaims(newlyTrashed.docs.get('workspace-1')!, 'doc-1');
  await newlyTrashed.service.restoreFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-new',
    expectedName: 'New',
    authorizeDocument,
  });
  const restoredNew = await newlyTrashed.service.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.false('trash' in restoredNew.documents[0]);

  const previouslyTrashed = createServiceFixture();
  await previouslyTrashed.service.applyRootOperations('workspace-1', 'user-1', [
    { op: 'set_document_trashed', docId: 'doc-1', trashed: true },
  ]);
  await previouslyTrashed.service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder-existing',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Existing',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'placement-existing',
        values: {
          parentId: 'folder-existing',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
    ]
  );
  await previouslyTrashed.service.trashFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-existing',
    expectedName: 'Existing',
    recursive: true,
    authorizeDocument,
  });
  removeTrashClaims(previouslyTrashed.docs.get('workspace-1')!, 'doc-1');
  await previouslyTrashed.service.restoreFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-existing',
    expectedName: 'Existing',
    authorizeDocument,
  });
  const restoredExisting = await previouslyTrashed.service.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.is((restoredExisting.documents[0] as Record<string, unknown>).trash, true);
});

test('permanently deleting a document repairs its trashed folder manifest', async t => {
  const service = createService();
  await service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder-1',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Folder',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'placement-1',
        values: {
          parentId: 'folder-1',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
    ]
  );
  const authorizeDocument = async () => {};
  await service.trashFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-1',
    expectedName: 'Folder',
    recursive: true,
    authorizeDocument,
  });
  const deleted = await service.deleteDocumentPermanently({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    documentId: 'doc-1',
    expectedTitle: 'Document',
  });
  t.is(deleted.removedPlacementCount, 1);

  await service.restoreFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-1',
    expectedName: 'Folder',
    authorizeDocument,
  });
  const organization = await service.readOrganization('workspace-1', 'user-1');
  t.deepEqual(organization.documents, []);
  t.deepEqual(organization.folders, [
    {
      id: 'folder-1',
      parentId: null,
      type: 'folder',
      data: 'Folder',
      index: 'a0',
    },
  ]);
});

test('permanently deleting one shared folder repairs other trashed folder manifests', async t => {
  const service = createService();
  await service.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder-a',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Folder A',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'placement-a',
        values: {
          parentId: 'folder-a',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'folder-b',
        values: {
          parentId: null,
          type: 'folder',
          data: 'Folder B',
          index: 'a1',
        },
      },
      {
        op: 'upsert',
        key: 'placement-b',
        values: {
          parentId: 'folder-b',
          type: 'doc',
          data: 'doc-1',
          index: 'a0',
        },
      },
    ]
  );
  const authorizeDocument = async () => {};
  for (const [folderId, expectedName] of [
    ['folder-a', 'Folder A'],
    ['folder-b', 'Folder B'],
  ] as const) {
    await service.trashFolderTree({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      editorId: 'user-1',
      folderId,
      expectedName,
      recursive: true,
      authorizeDocument,
    });
  }
  await service.deleteFolderTreePermanently({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-a',
    expectedName: 'Folder A',
    authorizeDocument,
  });

  await service.restoreFolderTree({
    workspaceId: 'workspace-1',
    userId: 'user-1',
    editorId: 'user-1',
    folderId: 'folder-b',
    expectedName: 'Folder B',
    authorizeDocument,
  });
  const organization = await service.readOrganization('workspace-1', 'user-1');
  t.deepEqual(organization.documents, []);
  t.deepEqual(organization.folders, [
    {
      id: 'folder-b',
      parentId: null,
      type: 'folder',
      data: 'Folder B',
      index: 'a1',
    },
  ]);
});

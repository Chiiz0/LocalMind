import test from 'ava';
import * as Y from 'yjs';

import { WorkspaceOrganizationService } from '../../core/doc';
import { directoryPolicySnapshot } from '../../models/workspace-directory-grant';
import { createWorkspaceOrganizationTools } from '../../plugins/copilot/tools/workspace-organization';

function rootFixture() {
  const doc = new Y.Doc({ guid: 'workspace-1' });
  const meta = doc.getMap<unknown>('meta');
  const pages = new Y.Array<Y.Map<unknown>>();
  for (const [id, title] of [
    ['doc-1', 'Readable'],
    ['doc-2', 'Private'],
  ]) {
    const page = new Y.Map<unknown>();
    page.set('id', id);
    page.set('title', title);
    pages.push([page]);
  }
  meta.set('pages', pages);
  return doc;
}

function createOrganization(input?: {
  deletedDocumentIds?: string[];
  failPermanentDeleteOnceFor?: Set<string>;
  orphanDocumentIds?: string[];
}) {
  const docs = new Map<string, Y.Doc>([['workspace-1', rootFixture()]]);
  for (const docId of input?.orphanDocumentIds ?? []) {
    docs.set(docId, new Y.Doc({ guid: docId }));
  }
  const reader = {
    getDoc: async (_workspaceId: string, docId: string) => {
      const doc = docs.get(docId);
      return doc
        ? {
            spaceId: 'workspace-1',
            docId,
            bin: Y.encodeStateAsUpdate(doc),
            timestamp: 1,
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
      return { success: true, timestamp: 2 };
    },
    deleteDocPermanently: async (_workspaceId: string, docId: string) => {
      if (input?.failPermanentDeleteOnceFor?.delete(docId)) {
        throw new Error(`Injected permanent-delete failure for ${docId}`);
      }
      input?.deletedDocumentIds?.push(docId);
      docs.delete(docId);
    },
  };
  return new WorkspaceOrganizationService(
    reader as never,
    writer as never,
    {
      copilotContext: {
        withDocumentSourcesShared: async (
          _input: unknown,
          operation: () => Promise<unknown>
        ) => await operation(),
      },
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
  );
}

function createPermissions(input?: {
  read?: boolean;
  write?: boolean;
  readableDocumentIds?: string[];
}) {
  const read = input?.read ?? true;
  const write = input?.write ?? true;
  const readable = new Set(input?.readableDocumentIds ?? ['doc-1']);
  const ac = {
    user: () => ({
      workspace: () => ({
        assert: async (permission: string) => {
          if (
            (permission === 'Workspace.Organize.Read' && !read) ||
            (permission === 'Workspace.Sync' && !write)
          ) {
            throw new Error(`Permission denied: ${permission}`);
          }
        },
        doc: (docId: string) => ({
          assert: async () => {
            if (!readable.has(docId)) {
              throw new Error(`Permission denied for document ${docId}`);
            }
          },
        }),
      }),
      doc: ({ docId }: { docId: string }) => ({
        allowLocal: () => ({ can: async () => readable.has(docId) }),
      }),
    }),
  };
  const permission = {
    listReadableDocIds: async () => [...readable],
  };
  return { ac, permission };
}

function tools(
  organization: WorkspaceOrganizationService,
  permissions = createPermissions(),
  options: Record<string, unknown> = { legacyWorkspaceFolderDelete: true }
) {
  return createWorkspaceOrganizationTools(
    permissions.ac as never,
    permissions.permission as never,
    organization,
    { user: 'user-1', workspace: 'workspace-1', ...options }
  );
}

async function run(
  toolSet: ReturnType<typeof tools>,
  name: keyof ReturnType<typeof tools>,
  args: Record<string, unknown>,
  executeOptions: Record<string, unknown> = {}
) {
  return (await toolSet[name].execute?.(
    args,
    executeOptions as never
  )) as Record<string, any>;
}

test('workspace folder tools manage folder trees and document placements safely', async t => {
  const organization = createOrganization();
  const toolSet = tools(organization);

  const projects = await run(toolSet, 'workspace_folder_create', {
    name: 'Projects',
    parent_folder_id: null,
  });
  t.true(projects.success);
  t.false(projects.idempotentReplay);
  const replay = await run(toolSet, 'workspace_folder_create', {
    name: 'Projects',
    parent_folder_id: null,
  });
  t.is(replay.folderId, projects.folderId);
  t.true(replay.idempotentReplay);
  await organization.applyDataOperations(
    'workspace-1',
    'user-1',
    'user-1',
    'folders',
    [
      {
        op: 'upsert',
        key: 'private-placement',
        values: {
          parentId: projects.folderId,
          type: 'doc',
          data: 'doc-2',
          index: 'a0',
        },
      },
    ]
  );

  const archive = await run(toolSet, 'workspace_folder_create', {
    name: 'Archive',
    parent_folder_id: null,
  });
  const child = await run(toolSet, 'workspace_folder_create', {
    name: 'Child',
    parent_folder_id: projects.folderId,
  });
  const renamed = await run(toolSet, 'workspace_folder_rename', {
    folder_id: child.folderId,
    name: 'Work',
  });
  t.like(renamed, { success: true, name: 'Work' });

  const moved = await run(toolSet, 'workspace_folder_move', {
    folder_id: child.folderId,
    parent_folder_id: archive.folderId,
  });
  t.is(moved.parentFolderId, archive.folderId);
  const cycle = await run(toolSet, 'workspace_folder_move', {
    folder_id: archive.folderId,
    parent_folder_id: child.folderId,
  });
  t.is(cycle.type, 'error');
  t.regex(cycle.message, /descendant/);

  const added = await run(toolSet, 'workspace_folder_add_document', {
    folder_id: child.folderId,
    document_id: 'doc-1',
  });
  t.false(added.idempotentReplay);
  const addedReplay = await run(toolSet, 'workspace_folder_add_document', {
    folder_id: child.folderId,
    document_id: 'doc-1',
  });
  t.is(addedReplay.placementId, added.placementId);
  t.true(addedReplay.idempotentReplay);
  const unreadable = await run(toolSet, 'workspace_folder_add_document', {
    folder_id: child.folderId,
    document_id: 'doc-2',
  });
  t.is(unreadable.type, 'error');

  const movedDocument = await run(toolSet, 'workspace_folder_move_document', {
    document_id: 'doc-1',
    folder_id: archive.folderId,
  });
  t.is(movedDocument.folderId, archive.folderId);
  const listing = await run(toolSet, 'workspace_folder_list', {});
  t.deepEqual(
    listing.documents.map((document: any) => document.documentId),
    ['doc-1']
  );
  t.is(listing.documents[0].folderId, archive.folderId);
  const movedDocumentReplay = await run(
    toolSet,
    'workspace_folder_move_document',
    { document_id: 'doc-1', folder_id: archive.folderId }
  );
  t.true(movedDocumentReplay.idempotentReplay);
  const removedDocument = await run(toolSet, 'workspace_folder_move_document', {
    document_id: 'doc-1',
    folder_id: null,
  });
  t.like(removedDocument, {
    folderId: null,
    removedPlacementCount: 1,
    idempotentReplay: false,
  });
  const removedDocumentReplay = await run(
    toolSet,
    'workspace_folder_move_document',
    { document_id: 'doc-1', folder_id: null }
  );
  t.true(removedDocumentReplay.idempotentReplay);
  await run(toolSet, 'workspace_folder_add_document', {
    folder_id: child.folderId,
    document_id: 'doc-1',
  });

  const wrongName = await run(toolSet, 'workspace_folder_delete', {
    folder_id: archive.folderId,
    expected_name: 'Wrong',
    recursive: true,
  });
  t.is(wrongName.type, 'error');
  const nonRecursive = await run(toolSet, 'workspace_folder_delete', {
    folder_id: archive.folderId,
    expected_name: 'Archive',
    recursive: false,
  });
  t.is(nonRecursive.type, 'error');

  const deleted = await run(toolSet, 'workspace_folder_delete', {
    folder_id: archive.folderId,
    expected_name: 'Archive',
    recursive: true,
  });
  t.like(deleted, {
    success: true,
    deletedFolderCount: 2,
    removedPlacementCount: 1,
    documentsDeleted: 0,
  });
  const deletedReplay = await run(toolSet, 'workspace_folder_delete', {
    folder_id: archive.folderId,
    expected_name: 'Archive',
    recursive: true,
  });
  t.true(deletedReplay.alreadyAbsent);
  t.true(deletedReplay.idempotentReplay);

  const afterDelete = await run(toolSet, 'workspace_folder_list', {});
  t.deepEqual(
    afterDelete.folders.map((item: any) => item.name),
    ['Projects']
  );
  t.deepEqual(afterDelete.documents, []);
});

test('workspace folder tools enforce organization ACLs', async t => {
  const organization = createOrganization();
  const noRead = tools(
    organization,
    createPermissions({ read: false, readableDocumentIds: ['doc-1'] })
  );
  const list = await run(noRead, 'workspace_folder_list', {});
  t.is(list.type, 'error');
  t.regex(list.message, /Workspace\.Organize\.Read/);

  const noWrite = tools(
    organization,
    createPermissions({ write: false, readableDocumentIds: ['doc-1'] })
  );
  const create = await run(noWrite, 'workspace_folder_create', {
    name: 'Denied',
    parent_folder_id: null,
  });
  t.is(create.type, 'error');
  t.regex(create.message, /Workspace\.Sync/);
});

test('current document and folder deletion tools use Trash before permanent deletion', async t => {
  const organization = createOrganization();
  const toolSet = tools(organization, createPermissions(), {});

  t.false('workspace_folder_delete' in toolSet);
  const folder = await run(toolSet, 'workspace_folder_create', {
    name: 'Reports',
    parent_folder_id: null,
  });
  await run(toolSet, 'workspace_folder_add_document', {
    folder_id: folder.folderId,
    document_id: 'doc-1',
  });

  const trashed = await run(toolSet, 'workspace_folder_trash', {
    folder_id: folder.folderId,
    expected_name: 'Reports',
    recursive: true,
  });
  t.like(trashed, {
    success: true,
    trashedFolderCount: 1,
    trashedDocumentCount: 1,
    newlyTrashedDocumentCount: 1,
    idempotentReplay: false,
  });
  const afterTrash = await organization.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.deepEqual(afterTrash.folders, []);
  t.true((afterTrash.documents as Array<{ trash?: boolean }>)[0].trash);

  const restored = await run(toolSet, 'workspace_folder_restore', {
    folder_id: folder.folderId,
    expected_name: 'Reports',
  });
  t.like(restored, {
    success: true,
    restoredFolderCount: 1,
    restoredDocumentCount: 1,
    leftInTrashDocumentCount: 0,
  });
  const afterRestore = await organization.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.is((afterRestore.folders as unknown[]).length, 2);
  t.false(
    (afterRestore.documents as Array<{ trash?: boolean }>)[0].trash === true
  );

  const docTrashed = await run(toolSet, 'doc_trash', {
    doc_id: 'doc-1',
    expected_title: 'Readable',
  });
  t.true(docTrashed.changed);
  const docTrashReplay = await run(toolSet, 'doc_trash', {
    doc_id: 'doc-1',
    expected_title: 'Readable',
  });
  t.true(docTrashReplay.idempotentReplay);
  const docRestored = await run(toolSet, 'doc_restore', {
    doc_id: 'doc-1',
    expected_title: 'Readable',
  });
  t.true(docRestored.changed);
  const docRestoreReplay = await run(toolSet, 'doc_restore', {
    doc_id: 'doc-1',
    expected_title: 'Readable',
  });
  t.true(docRestoreReplay.idempotentReplay);

  const permanentToolSet = tools(organization, createPermissions(), {
    taskId: 'task-1',
    destructiveIntent: {
      permanentDocumentDelete: true,
      permanentFolderDelete: false,
    },
  });
  const deniedBeforeTrash = await run(
    permanentToolSet,
    'doc_delete_permanently',
    {
      doc_id: 'doc-1',
      expected_title: 'Readable',
      confirm_permanent_deletion: true,
    }
  );
  t.is(deniedBeforeTrash.type, 'error');
  t.regex(deniedBeforeTrash.message, /already be in Trash/);

  await run(toolSet, 'doc_trash', {
    doc_id: 'doc-1',
    expected_title: 'Readable',
  });
  const deniedPermanent = await run(toolSet, 'doc_delete_permanently', {
    doc_id: 'doc-1',
    expected_title: 'Readable',
    confirm_permanent_deletion: true,
  });
  t.is(deniedPermanent.type, 'error');
  t.regex(deniedPermanent.message, /explicit permanent-delete request/);
  const permanentlyDeleted = await run(
    permanentToolSet,
    'doc_delete_permanently',
    {
      doc_id: 'doc-1',
      expected_title: 'Readable',
      confirm_permanent_deletion: true,
    }
  );
  t.like(permanentlyDeleted, {
    success: true,
    changed: true,
    idempotentReplay: false,
  });
});

test('folder restore leaves documents that were already in Trash untouched', async t => {
  const organization = createOrganization();
  const toolSet = tools(organization, createPermissions(), {});
  const folder = await run(toolSet, 'workspace_folder_create', {
    name: 'Existing Trash',
    parent_folder_id: null,
  });
  await run(toolSet, 'workspace_folder_add_document', {
    folder_id: folder.folderId,
    document_id: 'doc-1',
  });
  await run(toolSet, 'doc_trash', {
    doc_id: 'doc-1',
    expected_title: 'Readable',
  });

  const trashed = await run(toolSet, 'workspace_folder_trash', {
    folder_id: folder.folderId,
    expected_name: 'Existing Trash',
    recursive: true,
  });
  t.like(trashed, {
    newlyTrashedDocumentCount: 0,
    previouslyTrashedDocumentCount: 1,
  });

  const restored = await run(toolSet, 'workspace_folder_restore', {
    folder_id: folder.folderId,
    expected_name: 'Existing Trash',
  });
  t.like(restored, {
    restoredDocumentCount: 0,
    leftInTrashDocumentCount: 1,
  });
  const afterRestore = await organization.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.true((afterRestore.documents as Array<{ trash?: boolean }>)[0].trash);
});

test('folder permanent deletion requires explicit intent and recursively removes documents', async t => {
  const deletedDocumentIds: string[] = [];
  const organization = createOrganization({ deletedDocumentIds });
  const toolSet = tools(organization, createPermissions(), {});
  const folder = await run(toolSet, 'workspace_folder_create', {
    name: 'Delete Me',
    parent_folder_id: null,
  });
  const child = await run(toolSet, 'workspace_folder_create', {
    name: 'Child',
    parent_folder_id: folder.folderId,
  });
  const retainedFolder = await run(toolSet, 'workspace_folder_create', {
    name: 'Retained',
    parent_folder_id: null,
  });
  await run(toolSet, 'workspace_folder_add_document', {
    folder_id: child.folderId,
    document_id: 'doc-1',
  });
  await run(toolSet, 'workspace_folder_add_document', {
    folder_id: retainedFolder.folderId,
    document_id: 'doc-1',
  });

  const deniedIntent = await run(
    toolSet,
    'workspace_folder_delete_permanently',
    {
      folder_id: folder.folderId,
      expected_name: 'Delete Me',
      confirm_permanent_deletion: true,
    }
  );
  t.is(deniedIntent.type, 'error');
  t.regex(deniedIntent.message, /explicit permanent-delete request/);

  const permanentRequest = {
    messages: [
      {
        role: 'user',
        content: '从 Trash 中删除名为 Delete Me 的文件夹。',
      },
    ],
  };
  const deniedBeforeTrash = await run(
    toolSet,
    'workspace_folder_delete_permanently',
    {
      folder_id: folder.folderId,
      expected_name: 'Delete Me',
      confirm_permanent_deletion: true,
    },
    permanentRequest
  );
  t.is(deniedBeforeTrash.type, 'error');
  t.regex(deniedBeforeTrash.message, /already be in Trash/);

  await run(toolSet, 'workspace_folder_trash', {
    folder_id: folder.folderId,
    expected_name: 'Delete Me',
    recursive: true,
  });
  const permanentlyDeleted = await run(
    toolSet,
    'workspace_folder_delete_permanently',
    {
      folder_id: folder.folderId,
      expected_name: 'Delete Me',
      confirm_permanent_deletion: true,
    },
    permanentRequest
  );
  t.like(permanentlyDeleted, {
    success: true,
    permanentlyDeletedFolderCount: 2,
    permanentlyDeletedDocumentCount: 1,
    removedPlacementCount: 2,
    changed: true,
    idempotentReplay: false,
  });
  t.deepEqual(deletedDocumentIds, ['doc-1']);

  const afterDelete = await organization.readOrganization(
    'workspace-1',
    'user-1'
  );
  t.deepEqual(
    (afterDelete.folders as Array<{ data?: string }>).map(
      record => record.data
    ),
    ['Retained']
  );
  t.deepEqual(
    (afterDelete.documents as Array<{ id?: string }>).map(record => record.id),
    ['doc-2']
  );

  const replay = await run(
    toolSet,
    'workspace_folder_delete_permanently',
    {
      folder_id: folder.folderId,
      expected_name: 'Delete Me',
      confirm_permanent_deletion: true,
    },
    permanentRequest
  );
  t.like(replay, {
    alreadyAbsent: true,
    changed: false,
    idempotentReplay: true,
  });
});

test('folder permanent deletion retains its Trash manifest until document deletion succeeds', async t => {
  const deletedDocumentIds: string[] = [];
  const organization = createOrganization({
    deletedDocumentIds,
    failPermanentDeleteOnceFor: new Set(['doc-1']),
  });
  const toolSet = tools(organization, createPermissions(), {});
  const folder = await run(toolSet, 'workspace_folder_create', {
    name: 'Retry Delete',
    parent_folder_id: null,
  });
  await run(toolSet, 'workspace_folder_add_document', {
    folder_id: folder.folderId,
    document_id: 'doc-1',
  });
  await run(toolSet, 'workspace_folder_trash', {
    folder_id: folder.folderId,
    expected_name: 'Retry Delete',
    recursive: true,
  });
  const permanentRequest = {
    messages: [
      {
        role: 'user',
        content: 'Permanently delete the folder named Retry Delete.',
      },
    ],
  };

  const failed = await run(
    toolSet,
    'workspace_folder_delete_permanently',
    {
      folder_id: folder.folderId,
      expected_name: 'Retry Delete',
      confirm_permanent_deletion: true,
    },
    permanentRequest
  );
  t.is(failed.type, 'error');
  t.regex(failed.message, /Injected permanent-delete failure/);

  const retry = await run(
    toolSet,
    'workspace_folder_delete_permanently',
    {
      folder_id: folder.folderId,
      expected_name: 'Retry Delete',
      confirm_permanent_deletion: true,
    },
    permanentRequest
  );
  t.like(retry, {
    success: true,
    permanentlyDeletedFolderCount: 1,
    permanentlyDeletedDocumentCount: 1,
    changed: true,
  });
  t.deepEqual(deletedDocumentIds, ['doc-1']);
});

test('permanent document deletion refuses an orphan without Trash metadata', async t => {
  const deletedDocumentIds: string[] = [];
  const organization = createOrganization({
    deletedDocumentIds,
    orphanDocumentIds: ['orphan-doc'],
  });
  const toolSet = tools(
    organization,
    createPermissions({ readableDocumentIds: ['orphan-doc'] }),
    {
      taskId: 'task-1',
      destructiveIntent: {
        permanentDocumentDelete: true,
        permanentFolderDelete: false,
      },
    }
  );

  const result = await run(toolSet, 'doc_delete_permanently', {
    doc_id: 'orphan-doc',
    expected_title: 'Orphan',
    confirm_permanent_deletion: true,
  });

  t.is(result.type, 'error');
  t.regex(result.message, /already be in Trash/);
  t.deepEqual(deletedDocumentIds, []);
});

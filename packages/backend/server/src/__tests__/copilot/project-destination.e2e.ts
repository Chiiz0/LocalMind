import { PrismaClient } from '@prisma/client';
import test from 'ava';
import { Doc, encodeStateAsUpdate } from 'yjs';

import { DocumentDestinationService } from '../../core/doc';
import { createTestingApp, type TestingApp } from '../utils';

let app: TestingApp;
test.before(async () => {
  app = await createTestingApp();
});
test.beforeEach(async () => {
  await app.initTestingDB();
});
test.after.always(async () => {
  await app.close();
});

test.serial(
  'Project destination API browses only direct children among 10000 folders and validates scoped pages, 64-level paths and live rights',
  async t => {
    const db = app.get(PrismaClient);
    const user = await app.createUser();
    await app
      .POST('/api/auth/sign-in')
      .set('x-affine-version', '0.27.0')
      .send({ email: user.email, password: user.password })
      .expect(200);
    const workspace = await app.models.workspace.create(user.id);
    const owner = await app.models.user.create({
      email: 'destination-owner@example.com',
    });
    const project = await db.aiContextProject.create({
      data: {
        name: 'Destination test',
        members: {
          create: [
            { userId: owner.id, role: 'owner' },
            { userId: user.id, role: 'member' },
          ],
        },
      },
    });
    await db.effectiveWorkspaceQuotaState.create({
      data: {
        workspaceId: workspace.id,
        ownerUserId: user.id,
        plan: 'free',
        seatLimit: 100,
        blobLimit: 0,
        storageQuota: 0,
        historyPeriodSeconds: 0,
        known: true,
        stale: false,
      },
    });
    const ydoc = new Doc();
    for (let i = 0; i < 10000; i++) {
      const id = `folder-${String(i).padStart(5, '0')}`;
      const row = ydoc.getMap(id);
      const parentId =
        i > 0 && i < 64 ? `folder-${String(i - 1).padStart(5, '0')}` : null;
      for (const [key, value] of Object.entries({
        id,
        type: 'folder',
        data: `Directory ${i}`,
        parentId,
        index: 'a0',
      }))
        row.set(key, value);
    }
    const binary = encodeStateAsUpdate(ydoc);
    await db.snapshot.create({
      data: {
        workspaceId: workspace.id,
        id: `db$${workspace.id}$folders`,
        blob: binary,
        size: binary.length,
        createdBy: user.id,
        updatedAt: new Date(),
      },
    });
    ydoc.destroy();
    const service = app.get(DocumentDestinationService);
    const input = {
      actorId: user.id,
      workspaceId: workspace.id,
      parentId: null,
    };
    const root = await service.locations({ ...input, limit: 20 });
    t.is(root.items.length, 20);
    t.deepEqual(root.current.path, []);
    t.is(root.current.folderId, null);
    t.true(root.current.canSave);
    t.true(root.items.every(item => item.path.length === 1));
    t.truthy(root.nextCursor);
    const next = await service.locations({
      ...input,
      cursor: root.nextCursor!,
      limit: 20,
    });
    t.true(
      next.items.every(
        item =>
          !root.items.some(previous => previous.folderId === item.folderId)
      )
    );
    const children = await service.locations({
      ...input,
      parentId: 'folder-00000',
    });
    t.deepEqual(
      children.items.map(item => item.folderId),
      ['folder-00001']
    );
    t.deepEqual(
      children.current.path.map(item => item.id),
      ['folder-00000']
    );
    const deep = await service.locations({
      ...input,
      parentId: 'folder-00063',
    });
    t.is(deep.current.path.length, 64);
    t.is(deep.items.length, 0);
    const search = await service.locations({
      ...input,
      query: 'Directory 63',
      limit: 10,
    });
    t.is(search.items.length, 10);
    t.true(search.items.some(item => item.path.length === 64));
    await t.throwsAsync(
      service.locations({
        ...input,
        parentId: 'folder-00000',
        cursor: root.nextCursor!,
      })
    );
    await t.throwsAsync(
      service.locations({
        ...input,
        query: 'Directory',
        cursor: root.nextCursor!,
      })
    );
    await t.throwsAsync(service.locations({ ...input, limit: 101 }));
    const query = `query($projectId: String!, $workspaceId: String!, $parentId: String) { projectDestinationFolders(projectId: $projectId, workspaceId: $workspaceId, parentId: $parentId, limit: 20) { current { folderId canSave canCreateFolder path { id name } } items { folderId } nextCursor } }`;
    const response = await app.gql<{
      projectDestinationFolders: { items: { folderId: string }[] };
    }>(query, {
      projectId: project.id,
      workspaceId: workspace.id,
      parentId: 'folder-00000',
    });
    t.deepEqual(response.projectDestinationFolders.items, [
      { folderId: 'folder-00001' },
    ]);
    await db.workspaceDirectoryGrant.create({
      data: {
        workspaceId: workspace.id,
        directoryId: 'folder-00000',
        principalId: '*',
        canRead: true,
        canWrite: false,
        canOrganize: true,
        canCreateFolder: true,
      },
    });
    const readonly = await service.locations({
      ...input,
      parentId: 'folder-00000',
    });
    t.false(readonly.current.canSave);
    t.false(readonly.current.canCreateFolder);
    await db.workspaceDirectoryGrant.update({
      where: {
        workspaceId_directoryId_principalId: {
          workspaceId: workspace.id,
          directoryId: 'folder-00000',
          principalId: '*',
        },
      },
      data: { canRead: false },
    });
    await t.throwsAsync(
      service.locations({ ...input, parentId: 'folder-00063' })
    );
    const hidden = await service.locations({
      ...input,
      query: 'Directory 63',
      limit: 100,
    });
    t.false(hidden.items.some(item => item.folderId === 'folder-00063'));
    t.false(JSON.stringify(hidden).includes('Directory 0'));
    await db.aiContextProjectMember.delete({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    await t.throwsAsync(
      app.gql(query, { projectId: project.id, workspaceId: workspace.id })
    );
  }
);

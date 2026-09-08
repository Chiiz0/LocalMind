import { PrismaClient } from '@prisma/client';
import test from 'ava';
import { io } from 'socket.io-client';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { retitleDocumentCopySnapshot } from '../../core/doc/copy-snapshot';
import { ProjectBlobStorage, ProjectModule } from '../../core/project';
import { ProjectRealtimeProvider } from '../../core/project/realtime';
import { ProjectResourceService } from '../../core/project/resources';
import { createTestingApp, type TestingApp } from '../utils';

let app: TestingApp;

test.before(async () => {
  app = await createTestingApp({ imports: [ProjectModule] });
});
test.beforeEach(async () => {
  await app.initTestingDB();
});
test.after.always(async () => {
  await app.close();
});

async function login() {
  const user = await app.createUser();
  const response = await app
    .POST('/api/auth/sign-in')
    .set('x-affine-version', '0.26.7')
    .send({ email: user.email, password: user.password })
    .expect(200);
  const cookie = (response.get('Set-Cookie') ?? [])
    .map(value => value.split(';')[0])
    .join('; ');
  return { user, cookie };
}

test.serial(
  'rename requires the exact tab lease and preserves the editor lease',
  async t => {
    const { user } = await login();
    const db = app.get(PrismaClient);
    const project = await db.aiContextProject.create({
      data: {
        name: 'Rename project',
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
    const { createProjectResource: resource } = await app.gql<{
      createProjectResource: { id: string; version: number };
    }>(
      `mutation Create($input: CreateProjectResourceInput!) { createProjectResource(input: $input) { id version } }`,
      {
        input: {
          projectId: project.id,
          title: 'Before',
          kind: 'page',
          markdown: 'Original',
          requestKey: 'rename-create',
        },
      }
    );
    const scope = {
      projectId: project.id,
      resourceId: resource.id,
      actorId: user.id,
      kind: 'user' as const,
      tabId: 'editor',
    };
    const lease = (await app.models.projectResourceEditLease.acquire(scope))
      .lease!;
    const change = (editLease?: { tabId: string; leaseId: string }) =>
      app.gql<{
        changeProjectResource: { title: string; contentVersion: number };
      }>(
        `mutation Change($input: ChangeProjectResourceInput!) { changeProjectResource(input: $input) { title contentVersion } }`,
        {
          input: {
            projectId: project.id,
            resourceId: resource.id,
            expectedVersion: resource.version,
            title: 'After',
            requestKey: 'rename',
            editLease,
          },
        }
      );
    await t.throwsAsync(change());
    await t.throwsAsync(change({ tabId: 'other-tab', leaseId: lease.leaseId }));
    t.is(await db.projectResourceRevision.count(), 1);
    const changed = await change({
      tabId: scope.tabId,
      leaseId: lease.leaseId,
    });
    t.is(changed.changeProjectResource.title, 'After');
    t.is(changed.changeProjectResource.contentVersion, 2);
    t.is(
      (await app.models.projectResourceEditLease.get(scope))?.leaseId,
      lease.leaseId
    );
  }
);

test.serial(
  'permanent deletion is authorized, recursive, irreversible and blocks content access',
  async t => {
    const { user } = await login();
    const db = app.get(PrismaClient);
    const project = await db.aiContextProject.create({
      data: {
        name: 'Deletion project',
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
    const actor = { projectId: project.id, actorId: user.id };
    const folder = await app.models.projectResource.create({
      ...actor,
      kind: 'folder',
      title: 'Folder',
      requestKey: 'delete-folder',
    });
    const resources = app.get(ProjectResourceService);
    const child = await resources.createDocument({
      ...actor,
      parentId: folder.id,
      title: 'Child',
      markdown: 'Retained evidence',
      requestKey: 'delete-child',
    });
    const revision = await app.models.projectResource.revision({
      ...actor,
      resourceId: child.id,
    });
    const remove = (expectedVersion: number) =>
      app.gql<{ permanentlyDeleteProjectResource: boolean }>(
        `mutation Delete($input: PermanentlyDeleteProjectResourceInput!) { permanentlyDeleteProjectResource(input: $input) }`,
        {
          input: {
            projectId: project.id,
            resourceId: folder.id,
            expectedVersion,
            requestKey: 'permanent-delete',
          },
        }
      );
    await t.throwsAsync(remove(folder.version));
    const leaseInput = {
      ...actor,
      resourceId: child.id,
      kind: 'user' as const,
      tabId: 'open-child',
    };
    const lease = (
      await app.models.projectResourceEditLease.acquire(leaseInput)
    ).lease!;
    const trashed = await app.models.projectResource.change({
      ...actor,
      resourceId: folder.id,
      expectedVersion: folder.version,
      trash: true,
    });
    await t.throwsAsync(remove(trashed.version));
    await app.models.projectResourceEditLease.release({
      ...leaseInput,
      leaseId: lease.leaseId,
    });
    await t.throwsAsync(remove(folder.version));
    const outsider = await app.models.user.create({
      email: 'deletion-outsider@example.com',
    });
    await t.throwsAsync(
      app.models.projectResource.permanentlyDelete({
        ...actor,
        actorId: outsider.id,
        resourceId: folder.id,
        expectedVersion: trashed.version,
        requestKey: 'denied',
      })
    );
    t.true((await remove(trashed.version)).permanentlyDeleteProjectResource);
    t.true((await remove(trashed.version)).permanentlyDeleteProjectResource);
    t.is(await db.projectResourceDeletion.count(), 2);
    t.is(
      await db.projectResourceAuditEvent.count({
        where: { action: 'permanently_deleted' },
      }),
      1
    );
    t.is(
      (await app.models.projectResource.list({ ...actor, trash: true })).items
        .length,
      0
    );
    await t.throwsAsync(
      app.models.projectResource.get({
        ...actor,
        resourceId: child.id,
        includeTrash: true,
      })
    );
    await t.throwsAsync(
      app.models.projectResource.change({
        ...actor,
        resourceId: folder.id,
        expectedVersion: trashed.version,
        trash: false,
      })
    );
    await t.throwsAsync(
      app.models.projectResource.assertBlobDownload({
        ...actor,
        key: revision.blobKey,
      })
    );
    await t.throwsAsync(
      app.models.projectResourceEditLease.acquire(leaseInput)
    );
    await t.throwsAsync(
      db.projectResourceDeletion.delete({ where: { resourceId: child.id } })
    );
    t.is(await db.projectResourceRevision.count(), 1);
  }
);

test.serial(
  'Project GraphQL, HTTP and realtime enforce membership without a Workspace host',
  async t => {
    const { user, cookie } = await login();
    const db = app.get(PrismaClient);
    const owner = await app.models.user.create({
      email: 'api-project-owner@example.com',
    });
    const project = await db.aiContextProject.create({
      data: {
        name: 'Project API',
        members: {
          create: [
            { userId: owner.id, role: 'owner' },
            { userId: user.id, role: 'member' },
          ],
        },
      },
    });
    const created = await app.gql<{
      createProjectResource: {
        id: string;
        projectId: string;
        contentVersion: number;
      };
    }>(
      `
    mutation Create($input: CreateProjectResourceInput!) {
      createProjectResource(input: $input) { id projectId contentVersion }
    }
  `,
      {
        input: {
          projectId: project.id,
          title: 'API document',
          kind: 'page',
          markdown: 'API body',
          requestKey: 'api-create',
        },
      }
    );
    const resource = created.createProjectResource;
    t.is(resource.projectId, project.id);
    t.is(resource.contentVersion, 1);
    t.is(await db.workspace.count(), 0);
    const acquired = await app.gql<{
      acquireProjectResourceEditLease: { lease: { leaseId: string } };
    }>(
      `mutation Acquire($input: ProjectEditLeaseInput!) { acquireProjectResourceEditLease(input: $input) { lease { leaseId } } }`,
      {
        input: {
          projectId: project.id,
          resourceId: resource.id,
          tabId: 'api-tab',
        },
      }
    );
    const editLease = {
      tabId: 'api-tab',
      leaseId: acquired.acquireProjectResourceEditLease.lease.leaseId,
    };

    const socket = io(app.url(), {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: { cookie },
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      const joined = await socket
        .timeout(5000)
        .emitWithAck('project:join', { projectId: project.id });
      t.deepEqual(joined, { data: { success: true } });
      const loaded = await socket
        .timeout(5000)
        .emitWithAck('project:load-document', {
          projectId: project.id,
          resourceId: resource.id,
        });
      t.is(loaded.data.contentVersion, 1);
      const ydoc = new Doc();
      let snapshotBase64: string;
      try {
        applyUpdate(
          ydoc,
          retitleDocumentCopySnapshot(
            Buffer.from(loaded.data.missing, 'base64'),
            'Edited resource title',
            resource.id
          )
        );
        ydoc.getMap('api-test').set('saved', true);
        snapshotBase64 = Buffer.from(encodeStateAsUpdate(ydoc)).toString(
          'base64'
        );
      } finally {
        ydoc.destroy();
      }
      const changed = new Promise<{ projectId: string; resourceId: string }>(
        resolve => socket.once('project:resource-changed', resolve)
      );
      const saved = await app.gql<{
        saveProjectDocument: { sequence: number };
      }>(
        `
      mutation Save($input: SaveProjectDocumentInput!) { saveProjectDocument(input: $input) { sequence } }
    `,
        {
          input: {
            projectId: project.id,
            resourceId: resource.id,
            expectedContentVersion: 1,
            requestKey: 'api-save',
            editLease,
            snapshotBase64,
          },
        }
      );
      t.is(saved.saveProjectDocument.sequence, 2);
      t.is(
        (
          await db.projectResource.findUniqueOrThrow({
            where: { id: resource.id },
          })
        ).title,
        'Edited resource title'
      );
      await app.get(ProjectRealtimeProvider).deliver();
      t.deepEqual(await changed, {
        projectId: project.id,
        resourceId: resource.id,
      });
      const downloaded = await app
        .GET(
          `/api/projects/${project.id}/resources/${resource.id}/revisions/current`
        )
        .expect(200);
      t.is(downloaded.headers['x-project-content-version'], '2');
      t.is(downloaded.headers['cache-control'], 'private, no-store');
      const revision = await app.models.projectResource.revision({
        projectId: project.id,
        resourceId: resource.id,
        actorId: user.id,
      });
      await app
        .GET(`/api/projects/${project.id}/blobs/${revision.blobKey}`)
        .expect(200);

      await db.aiContextProjectMember.delete({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
      });
      const rejected = await socket
        .timeout(5000)
        .emitWithAck('project:load-document', {
          projectId: project.id,
          resourceId: resource.id,
        });
      t.truthy(rejected.error);
      await app
        .GET(
          `/api/projects/${project.id}/resources/${resource.id}/revisions/current`
        )
        .expect(403);
      await app
        .GET(`/api/projects/${project.id}/blobs/${revision.blobKey}`)
        .expect(403);
      await t.throwsAsync(
        app.gql(
          `query Read($projectId: String!) { projectResources(projectId: $projectId) { items { id } } }`,
          { projectId: project.id }
        )
      );
      await t.throwsAsync(
        app.gql(
          `mutation Save($input: SaveProjectDocumentInput!) { saveProjectDocument(input: $input) { sequence } }`,
          {
            input: {
              projectId: project.id,
              resourceId: resource.id,
              expectedContentVersion: 2,
              requestKey: 'forbidden-save',
              editLease,
              snapshotBase64,
            },
          }
        )
      );
      t.is(
        await db.projectResourceRevision.count({
          where: { resourceId: resource.id },
        }),
        2
      );
    } finally {
      socket.disconnect();
    }
  }
);

test.serial(
  'Project list and task live queries deliver committed changes and converge after reconnect',
  async t => {
    const { user, cookie } = await login();
    const db = app.get(PrismaClient);
    const recipient = await app.models.user.create({
      email: 'socket-recipient@example.com',
    });
    const socket = io(app.url(), {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: { cookie },
    });
    const connected = () =>
      new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
    const request = (op: string) =>
      socket.timeout(5000).emitWithAck('realtime:request', {
        clientVersion: '0.26.7',
        op,
        input: {},
      });
    try {
      await connected();
      for (const topic of ['project.list.changed', 'project.task.changed']) {
        const result = await socket
          .timeout(5000)
          .emitWithAck('realtime:subscribe', {
            clientVersion: '0.26.7',
            topic,
            input: {},
          });
        t.truthy(result.data.subscriptionId);
      }
      const received = new Set<string>();
      const changes = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Project events did not arrive')),
          5000
        );
        socket.on('realtime:event', event => {
          received.add(event.topic);
          if (
            received.has('project.list.changed') &&
            received.has('project.task.changed')
          ) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      const project = await db.aiContextProject.create({
        data: {
          name: 'Live project',
          members: {
            create: [
              { userId: user.id, role: 'owner' },
              { userId: recipient.id, role: 'member' },
            ],
          },
        },
      });
      const fileRequest = await db.projectFileRequest.create({
        data: {
          projectId: project.id,
          requesterId: user.id,
          recipientId: recipient.id,
          title: 'Live file request',
          requestKey: 'socket-task',
          fingerprint: 'b'.repeat(64),
        },
      });
      await app.get(ProjectRealtimeProvider).deliver();
      await changes;
      t.is(
        (await request('project.list.get')).data.projects[0].name,
        'Live project'
      );
      t.true(
        (await request('project.task.get')).data.tasks.some(
          (task: { id: string }) => task.id.includes(fileRequest.id)
        )
      );
      socket.disconnect();
      await db.aiContextProject.update({
        where: { id: project.id },
        data: { name: 'Changed offline' },
      });
      await app.get(ProjectRealtimeProvider).deliver();
      const reconnected = connected();
      socket.connect();
      await reconnected;
      t.is(
        (await request('project.list.get')).data.projects[0].name,
        'Changed offline'
      );
    } finally {
      socket.disconnect();
    }
  }
);

test.serial(
  'Blob uploads cannot rewrite existing immutable objects through MIME drift',
  async t => {
    const { user } = await login();
    const db = app.get(PrismaClient);
    const owner = await app.models.user.create({
      email: 'blob-project-owner@example.com',
    });
    const project = await db.aiContextProject.create({
      data: {
        name: 'Blob isolation',
        members: {
          create: [
            { userId: owner.id, role: 'owner' },
            { userId: user.id, role: 'member' },
          ],
        },
      },
    });
    const storage = app.get(ProjectBlobStorage);
    const scope = { projectId: project.id, actorId: user.id };
    const bytes = Buffer.from('immutable attachment');
    const initial = await storage.put({
      ...scope,
      bytes,
      mimeType: 'text/plain',
    });
    await t.throwsAsync(
      storage.put({ ...scope, bytes, mimeType: 'text/html' })
    );
    const reopened = await storage.read({ ...scope, key: initial.key });
    t.deepEqual(reopened.bytes, bytes);
    t.is(reopened.blob.mimeType, 'text/plain');
  }
);

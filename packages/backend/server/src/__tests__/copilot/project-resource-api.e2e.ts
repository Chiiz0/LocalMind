import { PrismaClient } from '@prisma/client';
import test from 'ava';
import { io } from 'socket.io-client';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { ProjectBlobStorage, ProjectModule } from '../../core/project';
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
        applyUpdate(ydoc, Buffer.from(loaded.data.missing, 'base64'));
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
            snapshotBase64,
          },
        }
      );
      t.is(saved.saveProjectDocument.sequence, 2);
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

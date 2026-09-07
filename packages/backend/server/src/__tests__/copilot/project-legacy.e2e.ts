import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import test from 'ava';
import { applyUpdate, Doc, encodeStateAsUpdate, Map as YMap } from 'yjs';

import { DocReader, DocWriter } from '../../core/doc';
import { ProjectBlobStorage, ProjectResourceService } from '../../core/project';
import { createDocWithMarkdown } from '../../native';
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

const list = `query($projectId: String!) { projectLegacyOperations(projectId: $projectId) { items { id title status revision resourceId } } }`;
const change = `mutation($projectId: String!, $operationId: String!, $expectedRevision: Int!, $action: String!) {
  changeProjectLegacyOperation(projectId: $projectId, operationId: $operationId, expectedRevision: $expectedRevision, action: $action) { id status revision resourceId }
}`;

async function fixture(unknown = false) {
  const user = await app.createUser();
  await app
    .POST('/api/auth/sign-in')
    .set('x-affine-version', '0.27.0')
    .send({ email: user.email, password: user.password })
    .expect(200);
  const db = app.get(PrismaClient);
  const workspace = await app.models.workspace.create(user.id);
  const owner = await app.models.user.create({
    email: 'legacy-project-owner@example.test',
  });
  const project = await db.aiContextProject.create({
    data: {
      name: 'Legacy project',
      members: {
        create: [
          { userId: user.id, role: 'member' },
          { userId: owner.id, role: 'owner' },
        ],
      },
    },
  });
  await db.aiPrompt.upsert({
    where: { name: 'Legacy fixture' },
    create: { name: 'Legacy fixture', model: 'test' },
    update: {},
  });
  const session = await db.aiSession.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      selectedContextProjectId: project.id,
      promptName: 'Legacy fixture',
      title: 'Historical conversation',
    },
  });
  await app.models.copilotContext.recordInputSources({
    projectId: project.id,
    actorId: user.id,
    sessionId: session.id,
    sources: [
      {
        workspaceId: workspace.id,
        kind: unknown ? 'unknown' : 'workspace',
        sourceId: unknown ? 'legacy-unknown' : 'project-input:original',
      },
    ],
  });
  await db.aiSessionMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: 'Original historical request',
    },
  });
  const operation = await db.copilotDocumentOperation.create({
    data: {
      actorId: user.id,
      projectId: project.id,
      sessionId: session.id,
      requestKey: randomUUID(),
      title: 'Same historical title',
      markdown: 'Original retained draft',
      contentFingerprint: 'original-fingerprint',
    },
  });
  return { db, user, project, session, operation, workspace };
}

test.serial(
  'legacy API recovers a known draft once, preserves historical identity and never writes a Workspace',
  async t => {
    const { db, user, project, session, operation } = await fixture();
    const second = await db.copilotDocumentOperation.create({
      data: {
        actorId: user.id,
        projectId: project.id,
        sessionId: session.id,
        requestKey: randomUUID(),
        title: operation.title,
        markdown: 'Another retained draft',
        contentFingerprint: 'second-fingerprint',
      },
    });
    const rows = await app.gql<{
      projectLegacyOperations: {
        items: { id: string; status: string; revision: number }[];
      };
    }>(list, { projectId: project.id });
    t.is(rows.projectLegacyOperations.items.length, 2);
    const variables = {
      projectId: project.id,
      operationId: operation.id,
      expectedRevision: 1,
      action: 'recover',
    };
    const result = await app.gql<{
      changeProjectLegacyOperation: { resourceId: string; status: string };
    }>(change, variables);
    t.is(result.changeProjectLegacyOperation.status, 'complete');
    t.deepEqual(await app.gql(change, variables), result);
    t.is(await db.projectResource.count(), 1);
    t.is(await db.snapshot.count(), 0);
    t.is(await db.update.count(), 0);
    const saved = await app.get(ProjectResourceService).readDocument({
      projectId: project.id,
      actorId: user.id,
      resourceId: result.changeProjectLegacyOperation.resourceId,
    });
    t.true(saved.bytes.length > 0);
    const original = await db.copilotDocumentOperation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    t.is(original.markdown, operation.markdown);
    t.is(original.contentFingerprint, operation.contentFingerprint);
    t.is(original.createdDocumentAt, null);
    t.is(original.status, 'waiting_location');
    const cancelled = await app.gql<{
      changeProjectLegacyOperation: { status: string };
    }>(change, { ...variables, operationId: second.id, action: 'cancel' });
    t.is(cancelled.changeProjectLegacyOperation.status, 'cancelled');
    await t.throwsAsync(
      app.models.copilotDocumentOperation.acquire({
        operationId: operation.id,
        actorId: user.id,
        expectedRevision: 0,
      }),
      { message: /explicit internal recovery/ }
    );
    await t.throwsAsync(
      db.copilotDocumentOperation.update({
        where: { id: operation.id },
        data: { createdDocumentAt: new Date() },
      })
    );
  }
);

test.serial(
  'unknown legacy sources remain blocked with retained draft and immutable denial evidence',
  async t => {
    const { db, project, operation } = await fixture(true);
    await app.gql(list, { projectId: project.id });
    await t.throwsAsync(
      app.gql(change, {
        projectId: project.id,
        operationId: operation.id,
        expectedRevision: 1,
        action: 'recover',
      })
    );
    const row = await db.copilotDocumentOperation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    t.is(row.projectMigrationStatus, 'blocked');
    t.is(row.projectMigrationRevision, 2);
    t.is(row.markdown, operation.markdown);
    t.is(await db.projectResource.count(), 0);
    t.true(
      (await db.aiSharedWriteSourceCheck.count({ where: { allowed: false } })) >
        0
    );
    t.is(
      await db.copilotDocumentOperationEvent.count({
        where: { operationId: operation.id, eventType: 'project_migration' },
      }),
      2
    );
  }
);

test.serial(
  'legacy copy recovery preserves frozen content and attachment bytes after the source advances',
  async t => {
    const { db, user, project, session, workspace } = await fixture();
    const sourceId = randomUUID();
    const document = new Doc();
    applyUpdate(
      document,
      createDocWithMarkdown('Frozen source', 'Original copy body', sourceId)
    );
    const image = new YMap();
    image.set('sys:flavour', 'affine:image');
    image.set('prop:sourceId', 'original-image');
    document.getMap('blocks').set('original-image-block', image);
    const snapshot = encodeStateAsUpdate(document);
    await app
      .get(DocWriter)
      .pushDocUpdate(workspace.id, sourceId, snapshot, user.id);
    const copy = await app.models.copilotDocumentOperation.prepare({
      sessionId: session.id,
      actorId: user.id,
      requestKey: 'frozen-copy',
      title: 'Frozen project copy',
      markdown: '',
      addToProject: true,
      copySource: {
        workspaceId: workspace.id,
        documentId: sourceId,
        snapshot,
        assets: [
          {
            key: 'original-image',
            data: Buffer.from('Frozen image bytes'),
            contentType: 'image/png',
          },
        ],
      },
    });
    document.getMap('blocks').delete('original-image-block');
    document.getMap('new-source-state').set('changed', true);
    await app
      .get(DocWriter)
      .pushDocUpdate(
        workspace.id,
        sourceId,
        encodeStateAsUpdate(document),
        user.id
      );
    document.destroy();
    const before = await app.get(DocReader).getDoc(workspace.id, sourceId);
    await app.gql(list, { projectId: project.id });
    const variables = {
      projectId: project.id,
      operationId: copy.id,
      expectedRevision: 1,
      action: 'recover',
    };
    const result = await app.gql<{
      changeProjectLegacyOperation: { resourceId: string; status: string };
    }>(change, variables);
    t.is(result.changeProjectLegacyOperation.status, 'complete');
    t.deepEqual(await app.gql(change, variables), result);
    const resourceId = result.changeProjectLegacyOperation.resourceId;
    const attached = await db.projectResourceAttachment.findFirstOrThrow({
      where: { resourceId },
    });
    const bytes = await app
      .get(ProjectBlobStorage)
      .read({ projectId: project.id, actorId: user.id, key: attached.key });
    t.is(bytes.bytes.toString(), 'Frozen image bytes');
    const saved = await app
      .get(ProjectResourceService)
      .readDocument({ projectId: project.id, actorId: user.id, resourceId });
    const reopened = new Doc();
    applyUpdate(reopened, saved.bytes);
    t.is(reopened.getMap('new-source-state').size, 0);
    reopened.destroy();
    t.deepEqual(
      Buffer.from(
        (await app.get(DocReader).getDoc(workspace.id, sourceId))!.bin
      ),
      Buffer.from(before!.bin)
    );
  }
);

test.serial(
  'historical conversation views stay actor scoped and cannot resume as native chat',
  async t => {
    const { db, user, project, session } = await fixture(true);
    const histories = await app.gql<{
      projectLegacyConversations: { items: { id: string }[] };
    }>(
      `query($projectId: String!) { projectLegacyConversations(projectId: $projectId) { items { id title } } }`,
      { projectId: project.id }
    );
    t.is(histories.projectLegacyConversations.items[0].id, session.id);
    const query = `query($projectId: String!, $sessionId: String!) { projectLegacyMessages(projectId: $projectId, sessionId: $sessionId) { items { content } } }`;
    const messages = await app.gql<{
      projectLegacyMessages: { items: { content: string }[] };
    }>(query, { projectId: project.id, sessionId: session.id });
    t.is(
      messages.projectLegacyMessages.items[0].content,
      'Original historical request'
    );
    await t.throwsAsync(
      app.gql(
        `query($projectId: String!, $sessionId: String!) { currentUser { copilot { projectChat(projectId: $projectId, sessionId: $sessionId) { sessionId } } } }`,
        { projectId: project.id, sessionId: session.id }
      )
    );
    await db.aiContextProjectMember.delete({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    await t.throwsAsync(
      app.gql(query, { projectId: project.id, sessionId: session.id })
    );
  }
);

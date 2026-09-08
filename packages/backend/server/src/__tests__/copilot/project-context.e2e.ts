import { createMinimalXlsxFixture } from '@localmind/office/testing';
import { PrismaClient } from '@prisma/client';
import test from 'ava';

import { OFFICE_FORMATS, OfficeImportService } from '../../core/office';
import { ProjectBlobStorage, ProjectResourceService } from '../../core/project';
import { CompatSubmissionStore } from '../../plugins/copilot/compat/submission-store';
import { ContextMemoryService } from '../../plugins/copilot/context-memory-service';
import { ContextScopeResolver } from '../../plugins/copilot/context-scope-resolver';
import { ConversationInboxService } from '../../plugins/copilot/conversation/inbox';
import { TurnSchema } from '../../plugins/copilot/core';
import { ProjectContextService } from '../../plugins/copilot/project-context-service';
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

async function fixture() {
  const user = await app.createUser();
  await app
    .POST('/api/auth/sign-in')
    .set('x-affine-version', '0.27.0')
    .send({ email: user.email, password: user.password })
    .expect(200);
  const db = app.get(PrismaClient);
  const owner = await app.models.user.create({
    email: 'context-owner@example.com',
  });
  const project = await db.aiContextProject.create({
    data: {
      name: 'Context Project',
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: user.id, role: 'member' },
        ],
      },
    },
  });
  const session = await app.gql<{
    createCopilotSessionWithHistory: { sessionId: string };
  }>(
    `mutation($options: CreateChatSessionInput!) { createCopilotSessionWithHistory(options: $options) { sessionId } }`,
    {
      options: {
        projectId: project.id,
        promptName: 'Chat With LocalMind AI',
        reuseLatestChat: false,
      },
    }
  );
  return {
    db,
    projectId: project.id,
    actorId: user.id,
    sessionId: session.createCopilotSessionWithHistory.sessionId,
  };
}

test.serial(
  'scope uses native resources selected for this session and fails closed after membership removal',
  async t => {
    const { db, ...scope } = await fixture();
    const resource = await app.get(ProjectResourceService).createDocument({
      ...scope,
      title: 'Selected resource',
      markdown: 'Native Project content',
      requestKey: 'scope-resource',
    });
    await app.models.copilotProjectContext.set({
      ...scope,
      expectedVersion: 0,
      items: [{ kind: 'resource', resourceId: resource.id, sequence: 1 }],
    });
    const resolver = app.get(ContextScopeResolver);
    const input = {
      userId: scope.actorId,
      workspaceId: null,
      sessionId: scope.sessionId,
      selectedProjectId: scope.projectId,
    };
    const resolved = await resolver.resolve(input);
    t.deepEqual(resolved.readableProjectResourceIds, [resource.id]);
    t.deepEqual(resolved.readableDocumentRefs, []);
    t.deepEqual(resolved.projectIds, [scope.projectId]);
    const otherSession = await app.gql<{
      createCopilotSessionWithHistory: { sessionId: string };
    }>(
      'mutation($options: CreateChatSessionInput!) { createCopilotSessionWithHistory(options: $options) { sessionId } }',
      {
        options: {
          projectId: scope.projectId,
          promptName: 'Chat With LocalMind AI',
          reuseLatestChat: false,
        },
      }
    );
    t.deepEqual(
      (
        await resolver.resolve({
          ...input,
          sessionId: otherSession.createCopilotSessionWithHistory.sessionId,
        })
      ).readableProjectResourceIds,
      []
    );
    t.deepEqual((await resolver.resolve(input)).readableProjectResourceIds, [
      resource.id,
    ]);
    await db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
    });
    const denied = await resolver.resolve(input);
    t.deepEqual(denied.projectIds, []);
    t.deepEqual(denied.readableProjectResourceIds, []);
    t.is(denied.selectedProjectId, null);
  }
);

test.serial(
  'native Project context persists exact source versions and uploads across reopen without Workspace records',
  async t => {
    const { db, ...scope } = await fixture();
    const context = app.models.copilotProjectContext;
    const service = app.get(ProjectContextService);
    const resources = app.get(ProjectResourceService);
    const doc = await resources.createDocument({
      ...scope,
      title: 'Reference',
      markdown: 'ORIGINAL_REFERENCE',
      requestKey: 'reference',
    });
    const selected = await context.set({
      ...scope,
      expectedVersion: 0,
      items: [{ kind: 'resource', resourceId: doc.id, sequence: 1 }],
    });
    t.is(selected.version, 1);
    const uploaded = await service.upload({
      ...scope,
      expectedVersion: 1,
      name: 'notes.txt',
      mimeType: 'text/plain',
      bytes: Buffer.from('PERSISTENT_ATTACHMENT'),
    });
    t.is(uploaded.items.length, 2);
    const snapshot = await context.snapshot(scope);
    const source = await service.materialize({ ...scope, snapshot });
    t.true(source?.content.includes('ORIGINAL_REFERENCE'));
    t.true(source?.content.includes('PERSISTENT_ATTACHMENT'));
    const bounded = await service.materialize({
      ...scope,
      snapshot,
      maxCharacters: 480,
    });
    t.true((bounded?.content.length ?? Infinity) <= 480);
    t.notThrows(() =>
      JSON.parse(bounded!.content.split('\n').slice(1).join('\n'))
    );
    t.is(
      await service.materialize({ ...scope, snapshot, maxCharacters: 0 }),
      null
    );
    await resources.updateMarkdown({
      ...scope,
      resourceId: doc.id,
      markdown: 'UPDATED_REFERENCE',
      origin: 'user',
      expectedContentVersion: 1,
      requestKey: 'new-content',
      editLease: {
        kind: 'user',
        tabId: 'context-edit',
        leaseId: (
          await app.models.projectResourceEditLease.acquire({
            ...scope,
            resourceId: doc.id,
            kind: 'user',
            tabId: 'context-edit',
          })
        ).lease!.leaseId,
      },
    });
    const reopened = await service.view(scope);
    t.is(
      reopened.items.find(item => item.kind === 'resource')?.currentSequence,
      2
    );
    t.is((await context.get(scope)).items[0].kind, 'resource');
    const old = await service.materialize({ ...scope, snapshot });
    t.true(old?.content.includes('ORIGINAL_REFERENCE'));
    t.false(old?.content.includes('UPDATED_REFERENCE'));
    await context.set({ ...scope, expectedVersion: 2, items: [] });
    t.is((await service.view(scope)).items.length, 0);
    t.true(
      (await service.materialize({ ...scope, snapshot }))?.content.includes(
        'PERSISTENT_ATTACHMENT'
      )
    );
    t.is(await db.workspace.count(), 0);
    t.is(await db.blob.count(), 0);
    t.is(
      await db.aiSessionContextSource.count({
        where: { sessionId: scope.sessionId, kind: 'project_resource' },
      }),
      1
    );
    t.is(
      await db.aiSessionContextSource.count({
        where: { sessionId: scope.sessionId, kind: 'project_blob' },
      }),
      1
    );
  }
);

test.serial(
  'native Project memory captures persisted turns with immutable source proof, isolates recall and refuses revoked or private sources',
  async t => {
    const { db, ...scope } = await fixture();
    const service = app.get(ContextMemoryService);
    const message = await db.aiSessionMessage.create({
      data: {
        sessionId: scope.sessionId,
        role: 'user',
        content: 'Remember that the project codename is Juniper.',
      },
    });
    const resolution = await app.get(ContextScopeResolver).resolve({
      userId: scope.actorId,
      workspaceId: null,
      sessionId: scope.sessionId,
      selectedProjectId: scope.projectId,
    });
    const input = {
      userId: scope.actorId,
      workspaceId: null,
      sessionId: scope.sessionId,
      scope: resolution,
      turn: TurnSchema.parse({
        id: message.id,
        conversationId: scope.sessionId,
        role: 'user',
        content: message.content,
        createdAt: message.createdAt,
      }),
    };
    const events = await service.captureDurableTurn(input);
    t.is(events.length, 1);
    t.is(events[0]?.operation, 'ADD');
    const memory = await db.aiContextMemory.findUniqueOrThrow({
      where: { id: events[0]!.memoryId! },
      include: { projectSourceCheck: true },
    });
    t.is(memory.workspaceId, null);
    t.is(memory.projectId, scope.projectId);
    t.true(memory.projectSourceCheck?.allowed);
    t.true(
      JSON.stringify(memory.projectSourceCheck?.sources).includes(message.id)
    );
    await app.models.copilotContext.recordRecalledMemorySources({
      ...scope,
      workspaceId: null,
      memories: [{ id: memory.id, content: memory.content }],
    });
    t.is(
      await db.aiSessionContextSource.count({
        where: { sessionId: scope.sessionId, kind: 'private' },
      }),
      0
    );
    const replay = await service.captureDurableTurn(input);
    t.is(replay[0]?.id, events[0]?.id);
    t.is(await db.aiContextMemory.count(), 1);
    const member = await app.models.user.create({
      email: 'context-member@example.com',
    });
    await db.aiContextProjectMember.create({
      data: { projectId: scope.projectId, userId: member.id, role: 'member' },
    });
    t.true(
      (
        await app.models.copilotContextMemory.listVisible({
          userId: member.id,
          projectIds: [scope.projectId],
        })
      ).some(item => item.id === memory.id)
    );
    t.false(
      (
        await app.models.copilotContextMemory.listVisible({
          userId: member.id,
          projectIds: ['other'],
        })
      ).some(item => item.id === memory.id)
    );
    await t.throwsAsync(
      db.aiContextMemory.update({
        where: { id: memory.id },
        data: { projectSourceCheckId: null },
      })
    );
    await db.aiSessionContextSource.create({
      data: {
        sessionId: scope.sessionId,
        projectId: scope.projectId,
        kind: 'unknown',
        sourceId: 'unverified-memory-material',
      },
    });
    t.deepEqual(await service.captureDurableTurn(input), []);
    t.is(await db.aiContextMemory.count(), 1);
    t.true(
      (await db.aiSharedWriteSourceCheck.count({
        where: {
          sessionId: scope.sessionId,
          sinkType: 'project_memory',
          allowed: false,
        },
      })) > 0
    );
    await db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
    });
    t.deepEqual(await service.captureDurableTurn(input), []);
    t.deepEqual(
      await app.models.copilotContextMemory.listVisible({
        userId: scope.actorId,
        projectIds: [scope.projectId],
      }),
      []
    );
    t.is(await db.workspace.count(), 0);
  }
);

test.serial(
  'manual Project Summary persists owner evidence, deduplicates and retains access boundaries',
  async t => {
    const { db, ...scope } = await fixture();
    const create = `mutation($input: CreateCopilotContextMemoryInput!) {
    createCopilotContextMemory(input: $input) { id content projectId workspaceId }
  }`;
    const input = {
      scope: 'project',
      kind: 'project_summary',
      projectId: scope.projectId,
      content: 'Shared project objective',
    };
    await t.throwsAsync(app.gql(create, { input }));
    await t.throwsAsync(
      app
        .get(ContextMemoryService)
        .create(
          scope.actorId,
          input as Parameters<ContextMemoryService['create']>[1]
        )
    );
    await db.aiContextProjectMember.update({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
      data: { role: 'owner' },
    });
    const responses = await Promise.all([
      app.gql<{ createCopilotContextMemory: { id: string } }>(create, {
        input,
      }),
      app.gql<{ createCopilotContextMemory: { id: string } }>(create, {
        input,
      }),
    ]);
    const id = responses[0].createCopilotContextMemory.id;
    t.is(responses[1].createCopilotContextMemory.id, id);
    t.is(await db.projectSummaryRevision.count({ where: { memoryId: id } }), 1);
    await app.models.copilotContext.recordRecalledMemorySources({
      ...scope,
      workspaceId: null,
      memories: [{ id, content: input.content }],
    });
    t.is(
      await db.aiSessionContextSource.count({
        where: { sessionId: scope.sessionId, kind: 'private' },
      }),
      0
    );
    const update = `mutation($input: UpdateCopilotContextMemoryInput!) {
    updateCopilotContextMemory(input: $input) { id content status }
  }`;
    await app.gql(update, {
      input: { id, content: 'Revised shared objective' },
    });
    t.is(await db.projectSummaryRevision.count({ where: { memoryId: id } }), 2);
    await app.gql(update, { input: { id, status: 'disabled' } });
    await app.gql(update, { input: { id, status: 'active' } });
    await t.throwsAsync(
      db.aiContextMemory.update({
        where: { id },
        data: { content: 'Unproven replacement' },
      })
    );
    const revision = await db.projectSummaryRevision.findFirstOrThrow({
      where: { memoryId: id },
    });
    await t.throwsAsync(
      db.projectSummaryRevision.update({
        where: { id: revision.id },
        data: { actorIdSnapshot: 'forged' },
      })
    );
    await t.throwsAsync(
      db.projectSummaryRevision.delete({ where: { id: revision.id } })
    );
    await t.throwsAsync(
      db.aiContextMemory.create({
        data: {
          ownerUserId: scope.actorId,
          projectId: scope.projectId,
          scope: 'project',
          kind: 'auto_memory',
          content: 'Unproven automatic memory',
          fingerprint: 'unproven',
        },
      })
    );
    await t.throwsAsync(
      app.models.copilotContextMemory.update(
        id,
        { content: ' ' },
        scope.actorId
      )
    );
    await db.aiContextProjectMember.update({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
      data: { role: 'member' },
    });
    await t.throwsAsync(
      app.gql(update, { input: { id, content: 'Member rewrite' } })
    );
    await t.throwsAsync(
      app.models.copilotContextMemory.update(
        id,
        { status: 'disabled' },
        scope.actorId
      )
    );
    t.true(
      (
        await app.models.copilotContextMemory.listVisible({
          userId: scope.actorId,
          projectIds: [scope.projectId],
        })
      ).some(memory => memory.id === id)
    );
    await db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
    });
    t.deepEqual(
      await app.models.copilotContextMemory.listVisible({
        userId: scope.actorId,
        projectIds: [scope.projectId],
      }),
      []
    );
    await t.throwsAsync(app.gql(create, { input }));
    t.is(await db.workspace.count(), 0);
  }
);

test.serial(
  'Project context API checks actor, resource owner, optimistic versions and revoked or trashed sources',
  async t => {
    const { db, ...scope } = await fixture();
    const doc = await app.get(ProjectResourceService).createDocument({
      ...scope,
      title: 'Private context',
      markdown: 'PRIVATE_MARKER',
      requestKey: 'private',
    });
    const query = `query($projectId: String!, $sessionId: String!) { projectChatContext(projectId: $projectId, sessionId: $sessionId) { version items { kind resourceId sequence title available } } }`;
    const mutation = `mutation($projectId: String!, $sessionId: String!, $expectedVersion: Int!, $items: [ProjectChatContextItemInput!]!) { updateProjectChatContext(projectId: $projectId, sessionId: $sessionId, expectedVersion: $expectedVersion, items: $items) { version items { resourceId } } }`;
    const item = { kind: 'resource', resourceId: doc.id, sequence: 1 };
    await app.gql(mutation, {
      projectId: scope.projectId,
      sessionId: scope.sessionId,
      expectedVersion: 0,
      items: [item],
    });
    await t.throwsAsync(
      app.gql(mutation, {
        projectId: scope.projectId,
        sessionId: scope.sessionId,
        expectedVersion: 0,
        items: [],
      })
    );
    await t.throwsAsync(
      app.models.copilotProjectContext.set({
        ...scope,
        expectedVersion: 1,
        items: [item, item],
      })
    );
    const other = await db.aiContextProject.create({
      data: {
        name: 'Other',
        members: { create: { userId: scope.actorId, role: 'owner' } },
      },
    });
    await t.throwsAsync(
      app.gql(query, { projectId: other.id, sessionId: scope.sessionId })
    );
    await t.throwsAsync(
      db.projectChatContext.update({
        where: { sessionId: scope.sessionId },
        data: { projectId: other.id, version: 2 },
      })
    );
    const snapshot = await app.models.copilotProjectContext.snapshot(scope);
    await app.models.projectResource.change({
      ...scope,
      resourceId: doc.id,
      expectedVersion: doc.version,
      trash: true,
    });
    const hidden = await app.gql<{
      projectChatContext: { items: { available: boolean; title: string }[] };
    }>(query, { projectId: scope.projectId, sessionId: scope.sessionId });
    t.false(hidden.projectChatContext.items[0].available);
    t.false(JSON.stringify(hidden).includes('PRIVATE_MARKER'));
    await t.throwsAsync(
      app.get(ProjectContextService).materialize({ ...scope, snapshot })
    );
    await db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
    });
    await t.throwsAsync(
      app.gql(query, { projectId: scope.projectId, sessionId: scope.sessionId })
    );
  }
);

test.serial(
  'Project Office selections retain native identity and inbox freezes server-owned context over caller metadata',
  async t => {
    const { db, ...scope } = await fixture();
    const blob = await app.get(ProjectBlobStorage).put({
      ...scope,
      bytes: Buffer.from(createMinimalXlsxFixture()),
      mimeType: OFFICE_FORMATS.xlsx.mimeType,
    });
    const imported = await app.get(OfficeImportService).import({
      ...scope,
      title: 'Workbook',
      sourceFileName: 'workbook.xlsx',
      sourceBlobKey: blob.key,
      importIdempotencyKey: 'context-workbook',
    });
    await app.models.copilotProjectContext.set({
      ...scope,
      expectedVersion: 0,
      items: [
        { kind: 'resource', resourceId: imported.artifact.id, sequence: 1 },
      ],
    });
    const id = await app
      .get(ConversationInboxService)
      .createMessage(scope.actorId, {
        sessionId: scope.sessionId,
        content: 'Read the selected workbook',
        params: { projectContext: { projectId: 'forged', items: [] } },
      });
    const submission = await app.get(CompatSubmissionStore).get(id);
    const snapshot = submission?.params?.projectContext;
    t.true(JSON.stringify(snapshot).includes(imported.artifact.id));
    t.false(JSON.stringify(snapshot).includes('forged'));
    const source = await app
      .get(ProjectContextService)
      .materialize({ ...scope, snapshot });
    t.true(source?.content.includes('workbook'));
    t.is(
      await db.officeArtifact.count({ where: { workspaceId: { not: null } } }),
      0
    );
  }
);

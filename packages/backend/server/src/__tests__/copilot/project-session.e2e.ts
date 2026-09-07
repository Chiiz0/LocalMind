import { PrismaClient } from '@prisma/client';
import test from 'ava';

import { ProjectBlobStorage, ProjectResourceService } from '../../core/project';
import { PROJECT_AGENT_WORKFLOW } from '../../models/copilot-project-agent-runtime';
import { ByokService } from '../../plugins/copilot/byok';
import { ConversationInboxService } from '../../plugins/copilot/conversation/inbox';
import { CopilotProjectAgentRuntimeWorker } from '../../plugins/copilot/project-agent-runtime-worker';
import { buildToolCapabilitySnapshot } from '../../plugins/copilot/runtime/tool-capability-snapshot';
import { ToolRuntime } from '../../plugins/copilot/runtime/tool-runtime';
import { ChatSessionService } from '../../plugins/copilot/session';
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
  const owner = await app.models.user.create({
    email: 'native-session-owner@example.com',
  });
  const db = app.get(PrismaClient);
  const createProject = (name: string) =>
    db.aiContextProject.create({
      data: {
        name,
        members: {
          create: [
            { userId: owner.id, role: 'owner' },
            { userId: user.id, role: 'member' },
          ],
        },
      },
    });
  const project = await createProject('Native conversation');
  const other = await createProject('Other native conversation');
  const createSession = async (projectId: string) => {
    const result = await app.gql<{
      createCopilotSessionWithHistory: {
        sessionId: string;
        workspaceId: null;
        selectedContextProjectId: string;
      };
    }>(
      `mutation($options: CreateChatSessionInput!) {
        createCopilotSessionWithHistory(options: $options) { sessionId workspaceId selectedContextProjectId }
      }`,
      {
        options: {
          projectId,
          promptName: 'Chat With LocalMind AI',
          reuseLatestChat: false,
        },
      }
    );
    return result.createCopilotSessionWithHistory;
  };
  return { db, user, project, other, createSession };
}

test.serial(
  'Project task API returns bounded views, confirms exact requests and rejects cross-project access',
  async t => {
    const { user, project, other, createSession } = await fixture();
    const session = await createSession(project.id);
    const run = await app.models.copilotProjectAgentRuntime.prepare({
      projectId: project.id,
      actorId: user.id,
      sessionId: session.sessionId,
      requestKey: 'api-approval',
      workflow: PROJECT_AGENT_WORKFLOW,
      sourceType: 'project_resource',
      title: 'Confirm this request',
      status: 'waiting_approval',
      command: {
        content: 'PRIVATE_COMMAND_MARKER',
        preview: { artifactTitle: 'Document' },
      },
    });
    const query = `query($projectId: String!, $runId: String!) {
    projectAgentTask(projectId: $projectId, runId: $runId) { id status targetFingerprint preview receipt }
  }`;
    const result = await app.gql<{
      projectAgentTask: {
        id: string;
        status: string;
        targetFingerprint: string;
      };
    }>(query, { projectId: project.id, runId: run.id });
    t.is(result.projectAgentTask.status, 'waiting_approval');
    t.false(JSON.stringify(result).includes('PRIVATE_COMMAND_MARKER'));
    await t.throwsAsync(app.gql(query, { projectId: other.id, runId: run.id }));
    const approve = `mutation($projectId: String!, $runId: String!, $targetFingerprint: String!) {
    approveProjectAgentTask(projectId: $projectId, runId: $runId, targetFingerprint: $targetFingerprint) { id status }
  }`;
    await t.throwsAsync(
      app.gql(approve, {
        projectId: project.id,
        runId: run.id,
        targetFingerprint: 'wrong',
      })
    );
    const approved = await app.gql<{
      approveProjectAgentTask: { status: string };
    }>(approve, {
      projectId: project.id,
      runId: run.id,
      targetFingerprint: run.targetFingerprint,
    });
    t.is(approved.approveProjectAgentTask.status, 'queued');
    const cancelled = await app.gql<{
      cancelProjectAgentTask: { status: string };
    }>(
      `mutation($projectId: String!, $runId: String!) {
    cancelProjectAgentTask(projectId: $projectId, runId: $runId) { status }
  }`,
      { projectId: project.id, runId: run.id }
    );
    t.is(cancelled.cancelProjectAgentTask.status, 'cancelled');
  }
);

test.serial(
  'Project worker resumes persisted tool input and replays the original immutable receipt',
  async t => {
    const { db, user, project, createSession } = await fixture();
    const session = await createSession(project.id);
    const deployment = env.DEPLOYMENT_TYPE;
    env.DEPLOYMENT_TYPE = 'selfhosted';
    t.teardown(() => {
      env.DEPLOYMENT_TYPE = deployment;
    });
    const scope = { projectId: project.id, actorId: user.id };
    const run = await app.models.copilotProjectAgentRuntime.prepare({
      ...scope,
      requestKey: 'durable-background-create',
      sessionId: session.sessionId,
      sourceType: 'project_resource',
      workflow: PROJECT_AGENT_WORKFLOW,
      title: 'Create a document after restart',
      command: {
        version: 1,
        toolName: 'doc_create',
        toolCallId: 'background-call',
        arguments: {
          title: 'Recovered document',
          content: 'Created by the recovered Project worker',
          kind: 'page',
        },
        options: {
          user: user.id,
          session: session.sessionId,
          tools: ['docCreate'],
        },
      },
    });
    const worker = app.get(CopilotProjectAgentRuntimeWorker);
    await worker.run({ projectId: project.id, runId: run.id });
    await worker.run({ projectId: project.id, runId: run.id });
    const completed = await app.models.copilotProjectAgentRuntime.get({
      ...scope,
      runId: run.id,
    });
    t.is(completed.status, 'completed');
    t.is(completed.projectExecutionResults.length, 1);
    t.is(await db.projectResource.count(), 1);
    t.is(await db.workspace.count(), 0);
    const resource = await db.projectResource.findFirstOrThrow();
    const reopened = await app
      .get(ProjectResourceService)
      .readDocument({ ...scope, resourceId: resource.id });
    t.true(reopened.bytes.length > 0);
  }
);

test.serial(
  'Project worker rechecks membership and the platform write switch after queueing',
  async t => {
    const { db, user, project, createSession } = await fixture();
    const session = await createSession(project.id);
    const deployment = env.DEPLOYMENT_TYPE;
    env.DEPLOYMENT_TYPE = 'affine';
    t.teardown(() => {
      env.DEPLOYMENT_TYPE = deployment;
    });
    const prepare = (requestKey: string) =>
      app.models.copilotProjectAgentRuntime.prepare({
        projectId: project.id,
        actorId: user.id,
        requestKey,
        sessionId: session.sessionId,
        sourceType: 'project_resource',
        workflow: PROJECT_AGENT_WORKFLOW,
        title: 'Queued create',
        command: {
          version: 1,
          toolName: 'doc_create',
          toolCallId: requestKey,
          arguments: { title: requestKey, content: 'Must not be written' },
          options: {
            user: user.id,
            session: session.sessionId,
            tools: ['docCreate'],
          },
        },
      });
    const disabled = await prepare('disabled');
    const revoked = await prepare('revoked');
    const worker = app.get(CopilotProjectAgentRuntimeWorker);
    await worker.run({ projectId: project.id, runId: disabled.id });
    env.DEPLOYMENT_TYPE = 'selfhosted';
    await db.aiContextProjectMember.delete({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    await worker.run({ projectId: project.id, runId: revoked.id });
    t.is(await db.projectResource.count(), 0);
    const results = await db.aiAgentRuntimeExecutionResult.findMany();
    t.is(results.length, 2);
    t.true(
      results.every(
        result => result.resultStatus === 'failed' && !result.sideEffectsApplied
      )
    );
  }
);

test.serial(
  'native Project sessions need no Workspace, stay isolated, and preserve internal AI source evidence',
  async t => {
    const { db, user, project, other, createSession } = await fixture();
    const session = await createSession(project.id);
    const second = await createSession(other.id);
    t.is(session.workspaceId, null);
    t.is(session.selectedContextProjectId, project.id);
    t.is(await db.workspace.count(), 0);
    const result = await app.gql<{
      currentUser: {
        copilot: {
          projectChats: {
            totalCount: number;
            edges: { node: { sessionId: string } }[];
          };
        };
      };
    }>(
      `query($projectId: String!) { currentUser { copilot { projectChats(projectId: $projectId, pagination: { first: 10 }) { totalCount edges { node { sessionId } } } } } }`,
      { projectId: project.id }
    );
    t.is(result.currentUser.copilot.projectChats.totalCount, 1);
    t.deepEqual(
      result.currentUser.copilot.projectChats.edges.map(
        edge => edge.node.sessionId
      ),
      [session.sessionId]
    );
    await t.throwsAsync(
      app.gql(
        `query($projectId: String!, $sessionId: String!) {
    currentUser { copilot { projectChat(projectId: $projectId, sessionId: $sessionId) { sessionId } } }
  }`,
        { projectId: project.id, sessionId: second.sessionId }
      )
    );
    await t.throwsAsync(
      app.gql(
        `mutation($options: UpdateChatSessionInput!) { updateCopilotSession(options: $options) }`,
        {
          options: {
            sessionId: session.sessionId,
            selectedContextProjectId: other.id,
          },
        }
      )
    );
    const chat = await app.get(ChatSessionService).get(session.sessionId);
    t.is(chat?.contextScope?.workspaceId, null);
    t.is(chat?.contextScope?.selectedProjectId, project.id);
    await app.models.copilotSession.appendMessage({
      sessionId: session.sessionId,
      userId: user.id,
      prompt: { model: 'test' },
      message: {
        role: 'user',
        content: 'Create a document in this project',
        createdAt: new Date(),
      },
    });
    const resource = await app.get(ProjectResourceService).createDocument({
      projectId: project.id,
      actorId: user.id,
      title: 'Native AI document',
      markdown: 'Project body',
      requestKey: 'native-ai-create',
      origin: 'ai',
      sourceSessionId: session.sessionId,
    });
    t.is(resource.projectId, project.id);
    t.is(await db.workspace.count(), 0);
    const sources = await db.aiSessionContextSource.findMany({
      where: { sessionId: session.sessionId },
    });
    t.true(sources.length >= 2);
    t.true(
      sources.every(
        source =>
          source.workspaceId === null &&
          source.projectId === project.id &&
          source.kind === 'project'
      )
    );
    t.deepEqual(
      await app
        .get(ByokService)
        .getProfiles({ sessionId: session.sessionId, userId: user.id }),
      []
    );
  }
);

test.serial(
  'native membership revocation blocks history, uploads and durable message commits',
  async t => {
    const { db, user, project, createSession } = await fixture();
    const session = await createSession(project.id);
    await db.aiContextProjectMember.delete({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    await t.throwsAsync(
      app.gql(
        `query($projectId: String!, $sessionId: String!) {
    currentUser { copilot { projectChat(projectId: $projectId, sessionId: $sessionId) { sessionId } } }
  }`,
        { projectId: project.id, sessionId: session.sessionId }
      )
    );
    await t.throwsAsync(
      app.get(ConversationInboxService).createMessage(user.id, {
        sessionId: session.sessionId,
        content: 'Rejected',
      })
    );
    await t.throwsAsync(
      app.models.copilotSession.appendMessage({
        sessionId: session.sessionId,
        userId: user.id,
        prompt: { model: 'test' },
        message: { role: 'user', content: 'Rejected', createdAt: new Date() },
      })
    );
    t.is(
      await db.aiSessionMessage.count({
        where: { sessionId: session.sessionId },
      }),
      0
    );
  }
);

test.serial(
  'native attachment evidence is bounded to stored Project bytes and remains immutable',
  async t => {
    const { db, user, project, other, createSession } = await fixture();
    const session = await createSession(project.id);
    const bytes = Buffer.from('Project attachment contents');
    const blob = await app.get(ProjectBlobStorage).put({
      projectId: project.id,
      actorId: user.id,
      bytes,
      mimeType: 'text/plain',
    });
    await app.models.copilotSession.appendMessage({
      sessionId: session.sessionId,
      userId: user.id,
      prompt: { model: 'test' },
      message: {
        role: 'user',
        content: 'Use this attachment',
        createdAt: new Date(),
        attachments: [
          {
            kind: 'data',
            data: bytes.toString('base64'),
            encoding: 'base64',
            mimeType: 'text/plain',
          },
        ],
      },
    });
    const source = await db.aiSessionContextSource.findFirstOrThrow({
      where: { sessionId: session.sessionId, kind: 'project_blob' },
    });
    t.is(source.projectId, project.id);
    t.is(source.sourceId, blob.key);
    await t.throwsAsync(
      db.aiSessionContextSource.update({
        where: { id: source.id },
        data: { projectId: other.id },
      })
    );
    await t.throwsAsync(
      db.aiSessionContextSource.create({
        data: {
          sessionId: session.sessionId,
          projectId: other.id,
          kind: 'project',
          sourceId: 'project-input:forged',
        },
      })
    );
    await t.throwsAsync(
      db.aiSession.create({
        data: {
          userId: user.id,
          promptName: 'Chat With LocalMind AI',
          workspaceId: null,
        },
      })
    );
  }
);

test.serial(
  'native AI tools persist nested resources, replay writes once, detect conflicts and reject legacy delegation',
  async t => {
    const { db, user, project, createSession } = await fixture();
    const session = await createSession(project.id);
    const runtime = app.get(ToolRuntime);
    const deployment = env.DEPLOYMENT_TYPE;
    env.DEPLOYMENT_TYPE = 'selfhosted';
    t.teardown(() => {
      env.DEPLOYMENT_TYPE = deployment;
    });
    const options = {
      user: user.id,
      session: session.sessionId,
      billingUnitId: 'native-test-turn',
      tools: [
        'docRead',
        'docCreate',
        'docUpdate',
        'docUpdateMeta',
        'workspaceOrganization',
      ] as const,
    };
    const tools = await runtime.getTools(
      { ...options, tools: [...options.tools] },
      'test'
    );
    env.DEPLOYMENT_TYPE = 'affine';
    const restrictedTools = await runtime.getTools(
      { ...options, tools: [...options.tools] },
      'test'
    );
    t.truthy(restrictedTools.doc_read);
    t.falsy(restrictedTools.doc_create);
    t.falsy(restrictedTools.project_folder_create);
    env.DEPLOYMENT_TYPE = 'selfhosted';
    const call = async (
      name: string,
      args: Record<string, unknown>,
      toolCallId: string
    ) => {
      const execute = tools[name]?.execute;
      if (!execute) throw new Error(`Missing tool ${name}`);
      return (await execute(args, { toolCallId })) as {
        resourceId: string;
        contentVersion: number;
        version: number;
        markdown: string;
        status: string;
        path: { title: string }[];
      };
    };
    t.is(
      buildToolCapabilitySnapshot(tools).find(
        tool => tool.name === 'doc_create'
      )?.sideEffectType,
      'project_write'
    );
    const folder = await call(
      'project_folder_create',
      { title: 'test1' },
      'folder-call'
    );
    const created = await call(
      'doc_create',
      {
        title: 'Document A',
        content: 'Native tool body',
        parent_id: folder.resourceId,
        kind: 'page',
      },
      'create-call'
    );
    t.is(created.status, 'saved');
    t.deepEqual(
      created.path.map(node => node.title),
      ['test1', 'Document A']
    );
    const replay = await call(
      'doc_create',
      {
        title: 'Document A',
        content: 'Native tool body',
        parent_id: folder.resourceId,
        kind: 'page',
      },
      'create-call'
    );
    t.is(replay.resourceId, created.resourceId);
    t.is(await db.projectResource.count(), 2);
    t.is(await db.workspace.count(), 0);
    await t.throwsAsync(
      call(
        'doc_create',
        {
          title: 'Changed intent',
          content: 'Native tool body',
          parent_id: folder.resourceId,
          kind: 'page',
        },
        'create-call'
      )
    );
    await t.throwsAsync(
      call(
        'doc_update',
        {
          doc_id: created.resourceId,
          expected_content_version: 1,
          content: 'No read proof',
        },
        'no-read'
      )
    );
    const read = await call(
      'doc_read',
      { doc_id: created.resourceId },
      'read-call'
    );
    t.true(read.markdown.includes('Native tool body'));
    await call(
      'doc_update',
      {
        doc_id: created.resourceId,
        expected_content_version: 1,
        content: 'Changed in Project',
      },
      'update-call'
    );
    const recoveredTools = await runtime.getTools(
      { ...options, tools: [...options.tools] },
      'test'
    );
    await recoveredTools.doc_update.execute!(
      {
        doc_id: created.resourceId,
        expected_content_version: 1,
        content: 'Changed in Project',
      },
      { toolCallId: 'update-call' }
    );
    await t.throwsAsync(
      Promise.resolve(
        recoveredTools.doc_update.execute!(
          {
            doc_id: created.resourceId,
            expected_content_version: 1,
            content: 'Changed retry intent',
          },
          { toolCallId: 'update-call' }
        )
      )
    );
    await t.throwsAsync(
      Promise.resolve(
        recoveredTools.doc_update.execute!(
          {
            doc_id: created.resourceId,
            expected_content_version: 2,
            content: 'No recovered read proof',
          },
          { toolCallId: 'new-update-call' }
        )
      )
    );
    await call(
      'doc_update',
      {
        doc_id: created.resourceId,
        expected_content_version: 1,
        content: 'Changed in Project',
      },
      'update-call'
    );
    t.is(
      await db.projectResourceRevision.count({
        where: { resourceId: created.resourceId },
      }),
      2
    );
    await call('doc_read', { doc_id: created.resourceId }, 'second-read');
    await app.get(ProjectResourceService).updateMarkdown({
      projectId: project.id,
      actorId: user.id,
      resourceId: created.resourceId,
      expectedContentVersion: 2,
      markdown: 'Concurrent edit',
      origin: 'user',
      requestKey: 'user-save',
    });
    await t.throwsAsync(
      call(
        'doc_update',
        {
          doc_id: created.resourceId,
          expected_content_version: 2,
          content: 'Stale edit',
        },
        'stale-update'
      )
    );
    await t.throwsAsync(
      runtime.getTools(
        {
          ...options,
          tools: [...options.tools],
          taskId: 'legacy-workspace-task',
        },
        'test'
      )
    );
    await db.aiContextProjectMember.delete({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    await t.throwsAsync(
      call('doc_read', { doc_id: created.resourceId }, 'revoked-read')
    );
    t.is(
      await db.projectResourceRevision.count({
        where: { resourceId: created.resourceId },
      }),
      3
    );
  }
);

import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { PrismaClient } from '@prisma/client';
import test from 'ava';
import { z } from 'zod';

import type { FileUpload } from '../../base';
import { ProjectFileRequestService } from '../../core/project/file-requests';
import { ProjectBlobStorage } from '../../core/project/resources';
import { llmBuildCanonicalRequest } from '../../native';
import { ToolRuntime } from '../../plugins/copilot/runtime/tool-runtime';
import { appendChatSystemPolicy } from '../../plugins/copilot/runtime/turn-orchestrator';
import {
  createProjectFileRequestTools,
  PROJECT_COLLABORATION_POLICY,
} from '../../plugins/copilot/tools/project-file-request';
import { createTestingApp, type TestingApp, type TestUser } from '../utils';

let app: TestingApp;
let db: PrismaClient;
let sender: TestUser;
let recipient: TestUser;
let stranger: TestUser;
let projectId: string;
let workspaceId: string;

test.before(async () => {
  app = await createTestingApp();
  db = app.get(PrismaClient);
});
test.beforeEach(async () => {
  await app.initTestingDB();
  sender = await app.createUser('file-sender@example.invalid', {
    name: 'sender',
  });
  recipient = await app.createUser('file-recipient@example.invalid', {
    name: 'member-01',
  });
  stranger = await app.createUser('file-stranger@example.invalid', {
    name: 'member-private',
  });
  const project = await db.aiContextProject.create({
    data: {
      name: 'File delivery',
      members: { create: { userId: sender.id, role: 'owner' } },
    },
  });
  projectId = project.id;
  const workspace = await app.models.workspace.create(sender.id);
  workspaceId = workspace.id;
  await db.workspaceMember.create({
    data: {
      id: randomUUID(),
      workspaceId,
      userId: recipient.id,
      role: 'member',
      state: 'active',
    },
  });
});
test.after.always(async () => {
  await app?.close();
});

const create = (key = 'request') =>
  app.models.projectFileRequest.create({
    projectId,
    actorId: sender.id,
    recipientId: recipient.id,
    title: 'file a.txt',
    requestKey: key,
  });
const file = (text = 'requested content', filename = 'file a.txt') =>
  ({
    filename,
    mimetype: 'text/plain',
    encoding: '7bit',
    createReadStream: () => Readable.from(Buffer.from(text)),
  }) as FileUpload;

test.serial(
  'Project collaboration policy survives actual native request construction',
  t => {
    const messages = appendChatSystemPolicy(
      [
        { role: 'system', content: 'Base prompt', params: { locale: 'zh' } },
        { role: 'user', content: 'Ask for file a' },
      ],
      { role: 'system', content: PROJECT_COLLABORATION_POLICY }
    );
    t.deepEqual(messages[0].params, { locale: 'zh' });
    const request = llmBuildCanonicalRequest({
      model: 'gpt-5.6-sol',
      messages: messages.map(({ role, content }) => ({ role, content })),
    });
    const sent = JSON.stringify(request.messages);
    t.true(sent.includes('project_file_request_create'));
    t.true(sent.includes('blocker_suggest'));
    t.is(messages.length, 2);
  }
);
const submit = (requestId: string, expectedVersion = 1, text?: string) =>
  app.get(ProjectFileRequestService).submit({
    requestId,
    actorId: recipient.id,
    expectedVersion,
    shareWithProject: true,
    file: file(text),
  });

test.serial(
  'inbox cleanup is scoped to the actor, covers unloaded notifications and preserves requests',
  async t => {
    const request = await create('cleanup');
    const notificationId = `file-request:${request.id}:${recipient.id}`;
    await db.notification.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        userId: recipient.id,
        type: i % 2 ? 'ProjectFileRequest' : 'AccessRequest',
        level: 'Default',
        read: i < 10,
        body: { requestId: request.id, createdByUserId: sender.id },
      })),
    });
    await app.login(stranger);
    await app.logout();
    await t.throwsAsync(app.gql('mutation{dismissAllNotifications}'));
    await app.login(stranger);
    await t.throwsAsync(
      app.gql('mutation($id:String!){dismissNotification(id:$id)}', {
        id: notificationId,
      })
    );
    await t.throwsAsync(
      app.gql('mutation($id:String!){readNotification(id:$id)}', {
        id: notificationId,
      })
    );
    await app.gql('mutation{dismissAllNotifications}');
    t.is(await app.models.notification.countByUserId(recipient.id), 111);

    await app.login(recipient);
    await app.gql('mutation{dismissReadNotifications}');
    t.is(
      await app.models.notification.countByUserId(recipient.id, {
        includeRead: true,
      }),
      111
    );
    await app.gql('mutation{readAllNotifications}');
    t.is(await app.models.notification.countByUserId(recipient.id), 0);
    t.is(
      await app.models.notification.countByUserId(recipient.id, {
        includeRead: true,
      }),
      111
    );
    await app.gql('mutation{dismissAllNotifications}');
    await app.gql('mutation{dismissAllNotifications}');
    t.deepEqual(
      await app.models.notification.findManyByUserId(recipient.id, {
        includeRead: true,
        first: 8,
        offset: 0,
      }),
      []
    );
    t.is(
      await app.models.notification.countByUserId(sender.id, {
        includeRead: true,
      }),
      1
    );
    t.is(
      await db.notification.count({
        where: { userId: recipient.id, dismissedAt: { not: null } },
      }),
      121
    );
    t.deepEqual(
      await db.projectFileRequest.findUniqueOrThrow({
        where: { id: request.id },
      }),
      request
    );
    t.is(
      await db.projectFileRequestEvent.count({
        where: { requestId: request.id },
      }),
      1
    );
    t.is(
      (
        await app.models.intelligenceWorkbenchTaskProjection.listPanel({
          userId: recipient.id,
        })
      ).todo.items[0].entityId,
      request.id
    );

    const next = await create('after-cleanup');
    t.deepEqual(
      (await app.models.notification.findManyByUserId(recipient.id)).map(
        n => n.id
      ),
      [`file-request:${next.id}:${recipient.id}`]
    );
  }
);

test.serial(
  'new file request progress reopens a dismissed incoming notification without reviving the actor inbox',
  async t => {
    const request = await create('cleanup-progress');
    await app.models.notification.dismissAll(sender.id);
    await app.models.notification.dismissAll(recipient.id);
    await app.models.projectFileRequest.change({
      requestId: request.id,
      actorId: recipient.id,
      expectedVersion: 1,
      action: 'start',
    });
    t.is(await app.models.notification.countByUserId(sender.id), 1);
    t.is(
      await app.models.notification.countByUserId(recipient.id, {
        includeRead: true,
      }),
      0
    );
    await app.models.notification.dismissAll(sender.id);
    await submit(request.id, 2);
    t.is(await app.models.notification.countByUserId(sender.id), 1);
    t.is(
      (
        await app.models.intelligenceWorkbenchTaskProjection.listPanel({
          userId: sender.id,
        })
      ).done.items[0].entityId,
      request.id
    );
  }
);

test.serial(
  'recipient discovery is bounded to Project or shared active Workspace and rejects stranger IDs',
  async t => {
    t.deepEqual(
      (
        await app.models.projectFileRequest.recipients({
          projectId,
          actorId: sender.id,
          query: 'member',
        })
      ).map(user => user.id),
      [recipient.id]
    );
    await t.throwsAsync(
      app.models.projectFileRequest.recipients({
        projectId,
        actorId: stranger.id,
        query: 'member',
      })
    );
    await t.throwsAsync(
      app.models.projectFileRequest.create({
        projectId,
        actorId: sender.id,
        recipientId: stranger.id,
        title: 'private',
        requestKey: 'no',
      })
    );
    await t.throwsAsync(
      app.models.projectFileRequest.create({
        projectId,
        actorId: sender.id,
        recipientId: sender.id,
        title: 'self',
        requestKey: 'self',
      })
    );
    t.is(await db.projectFileRequest.count(), 0);
  }
);

test.serial(
  'request receipt creates waiting and actionable tasks; start and file delivery update both parties',
  async t => {
    const request = await create();
    const panel = (userId: string) =>
      app.models.intelligenceWorkbenchTaskProjection.listPanel({ userId });
    t.is((await panel(sender.id)).todo.items[0].attention, 'waiting_on_others');
    t.is(
      (await panel(recipient.id)).todo.items[0].attention,
      'needs_my_action'
    );
    t.is((await panel(stranger.id)).todo.items.length, 0);
    t.is(
      await db.notification.count({
        where: {
          type: 'ProjectFileRequest',
          read: false,
          userId: recipient.id,
        },
      }),
      1
    );
    t.is(await db.notificationRefresh.count(), 2);
    const started = await app.models.projectFileRequest.change({
      requestId: request.id,
      actorId: recipient.id,
      expectedVersion: 1,
      action: 'start',
    });
    t.is(started.version, 2);
    t.is((await panel(sender.id)).inProgress.items[0].entityId, request.id);
    const result = await submit(request.id, 2);
    t.is(result.status, 'completed');
    t.is((await panel(sender.id)).done.items[0].status, 'completed');
    t.is((await panel(recipient.id)).inProgress.items.length, 0);
    const delivery = await app
      .get(ProjectFileRequestService)
      .download(request.id, recipient.id);
    t.is(delivery.bytes.toString(), 'requested content');
    t.is(delivery.resource.projectId, projectId);
    const scope = { projectId, actorId: sender.id };
    const replacement = await app.get(ProjectBlobStorage).put({
      ...scope,
      bytes: Buffer.from('later private Project edit'),
      mimeType: 'text/plain',
    });
    await app.models.projectResource.appendRevision({
      ...scope,
      resourceId: delivery.resource.id,
      expectedContentVersion: delivery.resource.contentVersion,
      blobKey: replacement.key,
      requestKey: 'later-edit',
      origin: 'user',
    });
    t.is(
      (
        await app
          .get(ProjectFileRequestService)
          .download(request.id, recipient.id)
      ).bytes.toString(),
      'requested content'
    );
    t.is(await db.aiContextProjectMember.count({ where: { projectId } }), 1);
    await t.throwsAsync(
      app.models.projectResource.list({ projectId, actorId: recipient.id })
    );
    t.is(
      await db.projectFileRequestEvent.count({
        where: { requestId: request.id },
      }),
      3
    );
    t.is(
      (
        await db.projectResourceAuditEvent.findFirstOrThrow({
          where: { action: 'file_request_delivered' },
        })
      ).actorId,
      recipient.id
    );
    t.is(
      (
        await app.models.intelligenceWorkbenchTaskProjection.listAll({
          userId: sender.id,
          taskId: `file-request:${request.id}`,
        })
      ).items[0].entityId,
      request.id
    );
  }
);

test.serial(
  'create and upload retries are idempotent and reject changed payloads',
  async t => {
    const [first, retry] = await Promise.all([create(), create()]);
    t.is(first.id, retry.id);
    await t.throwsAsync(
      app.models.projectFileRequest.create({
        projectId,
        actorId: sender.id,
        recipientId: recipient.id,
        title: 'different',
        requestKey: 'request',
      })
    );
    const [a, b] = await Promise.all([submit(first.id), submit(first.id)]);
    t.is(a.resourceId, b.resourceId);
    t.is(await db.projectResource.count({ where: { projectId } }), 1);
    await t.throwsAsync(submit(first.id, 1, 'changed'));
    t.is(await db.projectFileRequestEvent.count(), 2);
    await t.throwsAsync(
      db.projectFileRequestEvent.updateMany({ data: { actorId: stranger.id } })
    );
    await t.throwsAsync(
      db.projectFileRequest.update({
        where: { id: first.id },
        data: { status: 'pending', version: 3 },
      })
    );
  }
);

test.serial(
  'live relationship revocation, project removal and archive prevent delivery and hide projections',
  async t => {
    const request = await create();
    await db.workspaceMember.updateMany({
      where: { workspaceId, userId: recipient.id },
      data: { state: 'suspended' },
    });
    await t.throwsAsync(submit(request.id));
    t.is(
      (
        await app.models.intelligenceWorkbenchTaskProjection.listPanel({
          userId: recipient.id,
        })
      ).todo.items.length,
      0
    );
    await db.workspaceMember.updateMany({
      where: { workspaceId, userId: recipient.id },
      data: { state: 'active' },
    });
    await db.aiContextProjectMember.create({
      data: { projectId, userId: stranger.id, role: 'owner' },
    });
    await db.aiContextProjectMember.deleteMany({
      where: { projectId, userId: sender.id },
    });
    await t.throwsAsync(submit(request.id));
    await db.aiContextProjectMember.create({
      data: { projectId, userId: sender.id, role: 'owner' },
    });
    await db.aiContextProject.update({
      where: { id: projectId },
      data: { status: 'archived' },
    });
    await t.throwsAsync(submit(request.id));
    t.is(await db.projectResource.count(), 0);
  }
);

test.serial(
  'recipient in Project without any Workspace can complete a request and declines are terminal',
  async t => {
    await db.workspaceMember.deleteMany({
      where: { workspaceId, userId: recipient.id },
    });
    await db.aiContextProjectMember.create({
      data: { projectId, userId: recipient.id, role: 'member' },
    });
    const request = await create();
    t.is(request.recipientWorkspaceId, null);
    t.is((await submit(request.id)).status, 'completed');
    const declined = await create('decline');
    await t.throwsAsync(
      app.models.projectFileRequest.change({
        requestId: declined.id,
        actorId: sender.id,
        expectedVersion: 1,
        action: 'decline',
      })
    );
    await app.models.projectFileRequest.change({
      requestId: declined.id,
      actorId: recipient.id,
      expectedVersion: 1,
      action: 'decline',
    });
    await t.throwsAsync(submit(declined.id));
  }
);

test.serial(
  'cancel and upload race reaches exactly one terminal result and save failure rolls back request changes',
  async t => {
    const request = await create();
    const results = await Promise.allSettled([
      submit(request.id),
      app.models.projectFileRequest.change({
        requestId: request.id,
        actorId: sender.id,
        expectedVersion: 1,
        action: 'cancel',
      }),
    ]);
    t.is(results.filter(result => result.status === 'fulfilled').length, 1);
    const current = await app.models.projectFileRequest.get(
      request.id,
      sender.id
    );
    t.is(
      await db.projectResource.count(),
      current.status === 'completed' ? 1 : 0
    );
    const failing = await create('failure');
    await t.throwsAsync(
      app.models.projectFileRequest.deliver(
        {
          requestId: failing.id,
          actorId: recipient.id,
          expectedVersion: 1,
          fileName: 'a',
          fingerprint: 'failure',
        },
        async () => {
          throw new Error('storage unavailable');
        }
      )
    );
    t.is(
      (await app.models.projectFileRequest.get(failing.id, sender.id)).status,
      'pending'
    );
    t.is(
      await db.projectFileRequestEvent.count({
        where: { requestId: failing.id },
      }),
      1
    );
  }
);

test.serial(
  'GraphQL upload requires sharing confirmation and HTTP download checks the current participant',
  async t => {
    await app.login(sender);
    const { createProjectFileRequest: request } = await app.gql<{
      createProjectFileRequest: { id: string };
    }>(
      'mutation($input: CreateFileRequestInput!) { createProjectFileRequest(input:$input) { id } }',
      {
        input: {
          projectId,
          recipientId: recipient.id,
          title: 'file a',
          requestKey: 'api',
        },
      }
    );
    await app.login(recipient);
    await t.throwsAsync(
      app.get(ProjectFileRequestService).submit({
        requestId: request.id,
        actorId: recipient.id,
        expectedVersion: 1,
        shareWithProject: false,
        file: file(),
      })
    );
    const response = await app
      .POST('/graphql')
      .field(
        'operations',
        JSON.stringify({
          query:
            'mutation($requestId:String!,$file:Upload!) { submitProjectFileRequest(requestId:$requestId,expectedVersion:1,shareWithProject:true,file:$file) { id status } }',
          variables: { requestId: request.id, file: null },
        })
      )
      .field('map', JSON.stringify({ '0': ['variables.file'] }))
      .attach('0', Buffer.from('API delivery'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      });
    t.falsy(response.body.errors);
    t.is(response.body.data?.submitProjectFileRequest.status, 'completed');
    const downloaded = await app
      .GET(`/api/project-file-requests/${request.id}/file`)
      .expect(200);
    t.is(downloaded.text, 'API delivery');
    t.is(downloaded.headers['cache-control'], 'private, no-store');
    await app.login(stranger);
    await app.GET(`/api/project-file-requests/${request.id}/file`).expect(404);
    await t.throwsAsync(
      app.gql('query($id:String!){projectFileRequest(requestId:$id){title}}', {
        id: request.id,
      })
    );
    await db.workspaceMember.updateMany({
      where: { workspaceId, userId: recipient.id },
      data: { state: 'suspended' },
    });
    await app.login(recipient);
    await app.GET(`/api/project-file-requests/${request.id}/file`).expect(404);
  }
);

test.serial(
  'file request tool resolves real identities and persists one receipt on replay',
  async t => {
    await app.login(sender);
    const created = await app.gql<{
      createCopilotSessionWithHistory: { sessionId: string };
    }>(
      'mutation($options: CreateChatSessionInput!) { createCopilotSessionWithHistory(options:$options) { sessionId } }',
      {
        options: {
          projectId,
          promptName: 'Chat With LocalMind AI',
          reuseLatestChat: false,
        },
      }
    );
    const session = { id: created.createCopilotSessionWithHistory.sessionId };
    const tools = createProjectFileRequestTools(app.models, {
      projectId,
      actorId: sender.id,
      sessionId: session.id,
      turnId: 'turn',
    });
    const options = { toolCallId: 'call', messages: [] };
    const found = z
      .array(z.object({ id: z.string() }))
      .parse(
        await tools.project_file_request_recipients.execute?.(
          { query: 'member-01' },
          options
        )
      );
    t.is(found[0].id, recipient.id);
    const args = {
      recipient_id: recipient.id,
      file_name: 'a',
      user_requested: true as const,
    };
    const receipt = z.object({
      notificationSent: z.boolean(),
      requestId: z.string(),
    });
    const result = receipt.parse(
      await tools.project_file_request_create.execute?.(args, options)
    );
    t.true(result.notificationSent);
    t.is(
      receipt.parse(
        await tools.project_file_request_create.execute?.(args, options)
      ).requestId,
      result.requestId
    );
    t.is(await db.projectFileRequest.count(), 1);
    t.is(await db.aiContextProjectBlocker.count(), 0);
    const runtimeTools = await app.get(ToolRuntime).getTools(
      {
        tools: ['blocker'],
        user: sender.id,
        session: session.id,
        featureKind: 'chat',
        chatSurface: 'intelligence_workbench',
        billingUnitId: 'runtime-turn',
      },
      'test'
    );
    t.truthy(runtimeTools.project_file_request_recipients);
    t.truthy(runtimeTools.project_file_request_create);
    t.truthy(runtimeTools.blocker_suggest);
    const suggestion = await runtimeTools.blocker_suggest.execute?.(
      {
        title: 'Wait for reply',
        type: 'wait_reply',
        waiting_on: 'member-01',
        due_at: null,
      },
      {}
    );
    t.like(suggestion, { confirmationRequired: true, projectId });
    t.is(await db.aiContextProjectBlocker.count(), 0);
  }
);

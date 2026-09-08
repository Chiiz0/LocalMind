import { randomUUID } from 'node:crypto';

import { GraphQLSchemaHost } from '@nestjs/graphql';
import { PrismaClient, type User, type Workspace } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';

import { EventBus } from '../../base';
import {
  IntelligenceWorkbenchAuthorizationModel,
  IntelligenceWorkbenchTaskProjectionModel,
  Models,
} from '../../models';
import { createTestingModule, type TestingModule } from '../utils';

interface Context {
  authorization: IntelligenceWorkbenchAuthorizationModel;
  db: PrismaClient;
  models: Models;
  module: TestingModule;
  projection: IntelligenceWorkbenchTaskProjectionModel;
}

const test = ava.serial as TestFn<Context>;

test.before(async t => {
  const module = await createTestingModule({
    tapModule: builder => {
      builder
        .overrideProvider(EventBus)
        .useValue(Sinon.createStubInstance(EventBus));
    },
  });
  t.context = {
    authorization: module.get(IntelligenceWorkbenchAuthorizationModel),
    db: module.get(PrismaClient),
    models: module.get(Models),
    module,
    projection: module.get(IntelligenceWorkbenchTaskProjectionModel),
  };
});

test.beforeEach(async t => {
  await t.context.module.initTestingDB();
});

test.after(async t => {
  await t.context.module.close();
});

async function createUser(context: Context, label: string) {
  return await context.models.user.create({
    email: `${label}-${randomUUID()}@example.invalid`,
  });
}

async function createWorkspace(context: Context, owner: User) {
  const workspace = await context.models.workspace.create(owner.id);
  await context.db.effectiveWorkspaceQuotaState.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      plan: 'free',
      ownerUserId: owner.id,
      seatLimit: 100,
      blobLimit: 0,
      storageQuota: 0,
      historyPeriodSeconds: 0,
      known: true,
      stale: false,
    },
    update: {
      known: true,
      stale: false,
      staleAfter: null,
    },
  });
  return workspace;
}

async function addWorkspaceMember(
  context: Context,
  workspace: Workspace,
  user: User,
  role: 'admin' | 'member' = 'member'
) {
  await context.db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role,
      state: 'active',
      source: 'legacy',
    },
  });
}

async function createProject(
  context: Context,
  owner: User,
  members: Array<{ user: User; role?: 'owner' | 'member' }> = []
) {
  return await context.db.aiContextProject.create({
    data: {
      createdByUserId: owner.id,
      name: `Project ${randomUUID()}`,
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          ...members.map(member => ({
            userId: member.user.id,
            role: member.role ?? 'member',
          })),
        ],
      },
    },
  });
}

async function setDocRole(
  context: Context,
  workspaceId: string,
  docId: string,
  userId: string,
  role: 'owner' | 'manager' | 'editor' | 'commenter' | 'reader'
) {
  await context.db.docGrant.upsert({
    where: {
      workspaceId_docId_principalType_principalId: {
        workspaceId,
        docId,
        principalType: 'user',
        principalId: userId,
      },
    },
    create: {
      workspaceId,
      docId,
      principalType: 'user',
      principalId: userId,
      role,
    },
    update: { role },
  });
}

test('copy approval serializes decisions and preserves the approved outcome', async t => {
  const { authorization, db } = t.context;
  const sourceOwner = await createUser(t.context, 'copy-source-owner');
  const projectOwner = await createUser(t.context, 'copy-project-owner');
  const reader = await createUser(t.context, 'copy-reader');
  const stranger = await createUser(t.context, 'copy-stranger');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, projectOwner, [
    { user: reader },
  ]);
  const docId = randomUUID();
  await setDocRole(t.context, workspace.id, docId, reader.id, 'reader');
  const input = {
    projectId: project.id,
    workspaceId: workspace.id,
    docId,
    actorId: reader.id,
    requestKey: 'copy-request',
    requestedTitle: 'Source title',
  };
  await t.throwsAsync(authorization.projectCopyPermission(input), {
    message: /Source permission to copy/,
  });
  await t.throwsAsync(
    authorization.requestProjectCopy({ ...input, actorId: stranger.id })
  );
  const requests = await Promise.all([
    authorization.requestProjectCopy(input),
    authorization.requestProjectCopy(input),
  ]);
  t.is(requests[0].request.id, requests[1].request.id);
  t.is(requests.filter(result => result.created).length, 1);
  const request = requests[0].request;
  t.is(request.purpose, 'project_copy');
  t.is(request.beneficiaryType, 'project');
  t.is(request.requestedTitle, 'Source title');
  await t.throwsAsync(
    authorization.approveAccessRequest({
      requestId: request.id,
      actorUserId: projectOwner.id,
    }),
    { message: 'Access request not found' }
  );
  const approved = await Promise.all([
    authorization.approveAccessRequest({
      requestId: request.id,
      actorUserId: sourceOwner.id,
    }),
    authorization.approveAccessRequest({
      requestId: request.id,
      actorUserId: sourceOwner.id,
    }),
  ]);
  t.true(approved.every(result => result.status === 'approved'));
  t.is(await db.aiContextProjectCopyAuthorization.count(), 1);
  t.is(await db.aiContextProjectGrant.count(), 1);
  t.is(
    await db.accessRequestAuditEvent.count({
      where: { eventType: 'approved' },
    }),
    1
  );
  t.deepEqual(await authorization.projectCopyPermission(input), {
    method: 'approved_project_copy',
    authorizationId: request.id,
  });
  const notification = await authorization.getAccessRequestNotification(
    request.id,
    sourceOwner.id
  );
  t.true('projectName' in notification);
  if ('projectName' in notification) {
    t.is(notification.projectName, project.name);
    t.is(notification.docTitle, 'Source title');
  }
  t.deepEqual(
    await authorization.getAccessRequestNotification(request.id, stranger.id),
    {
      requestId: request.id,
      status: 'unavailable',
      canDecide: false,
    }
  );
  await t.throwsAsync(
    authorization.withdrawAccessRequest({
      requestId: request.id,
      actorUserId: sourceOwner.id,
    }),
    { message: 'Access request not found' }
  );
  const unchanged = await authorization.withdrawAccessRequest({
    requestId: request.id,
    actorUserId: reader.id,
  });
  t.is(unchanged.status, 'approved');
  const rejectedReplay = await authorization.rejectAccessRequest({
    requestId: request.id,
    actorUserId: sourceOwner.id,
  });
  t.is(rejectedReplay.status, 'approved');
  t.deepEqual(await authorization.projectCopyPermission(input), {
    method: 'approved_project_copy',
    authorizationId: request.id,
  });
  t.is(await db.aiContextProjectCopyAuthorization.count(), 1);
  t.is(
    await db.aiContextProjectGrantAuditEvent.count({
      where: { eventType: 'revoked' },
    }),
    0
  );
});

test('reviewers receive approval notifications while Project participants retain waiting tasks', async t => {
  const { authorization, db, module, projection } = t.context;
  const sourceOwner = await createUser(t.context, 'notification-source-owner');
  const docOwner = await createUser(t.context, 'notification-doc-owner');
  const requester = await createUser(t.context, 'notification-requester');
  const peer = await createUser(t.context, 'notification-project-peer');
  const workspace = await createWorkspace(t.context, sourceOwner);
  await addWorkspaceMember(t.context, workspace, docOwner);
  const project = await createProject(t.context, requester, [{ user: peer }]);
  const docId = randomUUID();
  await setDocRole(t.context, workspace.id, docId, docOwner.id, 'owner');
  await setDocRole(t.context, workspace.id, docId, requester.id, 'reader');
  const { request } = await authorization.requestProjectCopy({
    projectId: project.id,
    workspaceId: workspace.id,
    docId,
    actorId: requester.id,
    requestKey: 'notification-only-review',
    requestedTitle: 'Private source title',
  });
  for (const reviewer of [sourceOwner, docOwner]) {
    t.is(
      await db.notification.count({
        where: {
          userId: reviewer.id,
          type: 'AccessRequest',
          body: { path: ['requestId'], equals: request.id },
        },
      }),
      1
    );
    const notification = await authorization.getAccessRequestNotification(
      request.id,
      reviewer.id
    );
    t.true(notification.canDecide);
    const panel = await projection.listPanel({ userId: reviewer.id });
    t.false(panel.todo.items.some(item => item.entityId === request.id));
    const history = await projection.listAll({ userId: reviewer.id });
    t.false(history.items.some(item => item.entityId === request.id));
  }
  for (const participant of [requester, peer]) {
    const panel = await projection.listPanel({
      userId: participant.id,
      projectId: project.id,
    });
    const task = panel.todo.items.find(item => item.entityId === request.id);
    t.is(task?.attention, 'waiting_on_others');
    t.deepEqual(
      task?.availableActions,
      participant.id === requester.id ? ['withdraw_access_request'] : []
    );
    t.is(
      task?.title,
      participant.id === requester.id ? 'Private source title' : null
    );
  }
  // Being both a source reviewer and a Project member does not add task actions.
  await db.aiContextProjectMember.create({
    data: { projectId: project.id, userId: sourceOwner.id, role: 'member' },
  });
  const memberPanel = await projection.listPanel({ userId: sourceOwner.id });
  const memberTask = memberPanel.todo.items.find(
    item => item.entityId === request.id
  );
  t.is(memberTask?.attention, 'waiting_on_others');
  t.deepEqual(memberTask?.availableActions, []);
  const approvals = await projection.listAll({
    userId: sourceOwner.id,
    filter: 'approval',
  });
  t.false(approvals.items.some(item => item.entityId === request.id));
  const approved = await authorization.approveAccessRequest({
    requestId: request.id,
    actorUserId: sourceOwner.id,
  });
  t.is(approved.status, 'approved');
  const resolved = await authorization.getAccessRequestNotification(
    request.id,
    docOwner.id
  );
  t.is(resolved.status, 'approved');
  t.false(resolved.canDecide);
  const schema = module.get(GraphQLSchemaHost).schema;
  t.falsy(schema.getMutationType()?.getFields().revokeCopilotProjectGrant);
  t.falsy(schema.getType('RevokeCopilotProjectGrantInput'));
});

test('copy requests expire and terminal decisions cannot be replayed into approval', async t => {
  const { authorization, db } = t.context;
  const owner = await createUser(t.context, 'expiry-owner');
  const reader = await createUser(t.context, 'expiry-reader');
  const workspace = await createWorkspace(t.context, owner);
  const project = await createProject(t.context, reader);
  const input = {
    projectId: project.id,
    workspaceId: workspace.id,
    docId: randomUUID(),
    actorId: reader.id,
    requestKey: 'expiring',
  };
  const expiresAt = new Date(Date.now() + 60_000);
  const { request } = await authorization.requestProjectCopy({
    ...input,
    expiresAt,
  });
  const expired = await authorization.approveAccessRequest({
    requestId: request.id,
    actorUserId: owner.id,
    now: expiresAt,
  });
  t.is(expired.status, 'expired');
  t.is(await db.aiContextProjectCopyAuthorization.count(), 0);
  const next = await authorization.requestProjectCopy({
    ...input,
    requestKey: 'new-request',
  });
  const decisions = await Promise.all([
    authorization.rejectAccessRequest({
      requestId: next.request.id,
      actorUserId: owner.id,
    }),
    authorization.approveAccessRequest({
      requestId: next.request.id,
      actorUserId: owner.id,
    }),
  ]);
  t.is(decisions[0].status, decisions[1].status);
  t.is(
    await db.accessRequestAuditEvent.count({
      where: { accessRequestId: next.request.id },
    }),
    2
  );
  t.is(
    await db.aiContextProjectCopyAuthorization.count(),
    decisions[0].status === 'approved' ? 1 : 0
  );
});

test('applicants can withdraw pending copy requests without granting source access', async t => {
  const { authorization, db, projection } = t.context;
  const owner = await createUser(t.context, 'withdraw-source-owner');
  const requester = await createUser(t.context, 'withdraw-requester');
  const workspace = await createWorkspace(t.context, owner);
  const project = await createProject(t.context, requester);
  const { request } = await authorization.requestProjectCopy({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: randomUUID(),
    actorId: requester.id,
    requestKey: 'withdraw-pending-copy',
  });
  const withdrawn = await authorization.withdrawAccessRequest({
    requestId: request.id,
    actorUserId: requester.id,
  });
  t.is(withdrawn.status, 'withdrawn');
  const notification = await authorization.getAccessRequestNotification(
    request.id,
    owner.id
  );
  t.is(notification.status, 'withdrawn');
  t.false(notification.canDecide);
  const panel = await projection.listPanel({ userId: requester.id });
  t.false(panel.todo.items.some(item => item.entityId === request.id));
  t.true(panel.done.items.some(item => item.entityId === request.id));
  t.is(await db.aiContextProjectCopyAuthorization.count(), 0);
  t.is(await db.aiContextProjectGrant.count(), 0);
});

test('source sharing authority permits member copies and fails closed when sharing is disabled', async t => {
  const { authorization, db } = t.context;
  const owner = await createUser(t.context, 'sharing-owner');
  const member = await createUser(t.context, 'sharing-member');
  const workspace = await createWorkspace(t.context, owner);
  await addWorkspaceMember(t.context, workspace, member, 'admin');
  const project = await createProject(t.context, owner, [{ user: member }]);
  const input = {
    projectId: project.id,
    workspaceId: workspace.id,
    docId: randomUUID(),
    actorId: member.id,
  };
  t.is(
    (await authorization.projectCopyPermission(input)).method,
    'source_sharing_authority'
  );
  await db.workspaceAccessPolicy.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, sharingEnabled: false },
    update: { sharingEnabled: false },
  });
  await t.throwsAsync(authorization.projectCopyPermission(input), {
    message: /does not allow sharing copies/,
  });
});

test('invites, membership removal, and archived projects fail closed', async t => {
  const owner = await createUser(t.context, 'project-owner');
  const secondOwner = await createUser(t.context, 'second-owner');
  const invitee = await createUser(t.context, 'invitee');
  const stranger = await createUser(t.context, 'invite-stranger');
  const project = await createProject(t.context, owner, [
    { user: secondOwner, role: 'owner' },
  ]);

  const sent = await t.context.authorization.sendProjectInvitation({
    projectId: project.id,
    inviterUserId: owner.id,
    inviteeUserId: invitee.id,
  });
  await t.throwsAsync(
    t.context.authorization.acceptProjectInvitation({
      invitationId: sent.invitation.id,
      actorUserId: stranger.id,
    }),
    { message: 'Project invitation not found' }
  );
  const accepted = await t.context.authorization.acceptProjectInvitation({
    invitationId: sent.invitation.id,
    actorUserId: invitee.id,
  });
  t.is(accepted.status, 'accepted');
  t.is(
    (
      await t.context.authorization.acceptProjectInvitation({
        invitationId: accepted.id,
        actorUserId: invitee.id,
      })
    ).status,
    'accepted'
  );
  await t.throwsAsync(
    t.context.authorization.acceptProjectInvitation({
      invitationId: accepted.id,
      actorUserId: stranger.id,
    }),
    { message: 'Project invitation not found' }
  );

  t.true(
    await t.context.authorization.removeProjectMember({
      projectId: project.id,
      actorUserId: owner.id,
      memberUserId: secondOwner.id,
    })
  );
  await t.throwsAsync(
    t.context.authorization.leaveProject({
      projectId: project.id,
      userId: owner.id,
    }),
    { message: 'A project must retain at least one owner' }
  );
  await t.context.db.aiContextProject.update({
    where: { id: project.id },
    data: { status: 'archived' },
  });
  await t.throwsAsync(
    t.context.authorization.leaveProject({
      projectId: project.id,
      userId: invitee.id,
    }),
    { message: 'Project not found' }
  );
  await t.throwsAsync(
    t.context.authorization.setProjectAiPolicy({
      projectId: project.id,
      actorUserId: owner.id,
      policy: 'read_write',
    }),
    { message: 'Project not found' }
  );
});

test('ownership transfer is authorized, atomic, and serialized', async t => {
  const owner = await createUser(t.context, 'transfer-owner');
  const firstMember = await createUser(t.context, 'transfer-first');
  const secondMember = await createUser(t.context, 'transfer-second');
  const outsider = await createUser(t.context, 'transfer-outsider');
  const project = await createProject(t.context, owner, [
    { user: firstMember },
    { user: secondMember },
  ]);

  await t.throwsAsync(
    t.context.authorization.transferProjectOwnership({
      projectId: project.id,
      actorUserId: firstMember.id,
      memberUserId: secondMember.id,
    }),
    { message: 'Project not found' }
  );
  await t.throwsAsync(
    t.context.authorization.transferProjectOwnership({
      projectId: project.id,
      actorUserId: owner.id,
      memberUserId: outsider.id,
    }),
    { message: 'Project member not found' }
  );

  const transfers = await Promise.allSettled([
    t.context.authorization.transferProjectOwnership({
      projectId: project.id,
      actorUserId: owner.id,
      memberUserId: firstMember.id,
    }),
    t.context.authorization.transferProjectOwnership({
      projectId: project.id,
      actorUserId: owner.id,
      memberUserId: secondMember.id,
    }),
  ]);
  t.is(transfers.filter(result => result.status === 'fulfilled').length, 1);
  t.is(transfers.filter(result => result.status === 'rejected').length, 1);
  const members = await t.context.db.aiContextProjectMember.findMany({
    where: { projectId: project.id },
  });
  t.is(members.filter(member => member.role === 'owner').length, 1);
  t.is(members.find(member => member.userId === owner.id)?.role, 'member');
  t.is(
    await t.context.db.aiContextProjectMembershipAuditEvent.count({
      where: { projectId: project.id },
    }),
    1
  );

  const archived = await createProject(t.context, owner, [{ user: outsider }]);
  await t.context.db.aiContextProject.update({
    where: { id: archived.id },
    data: { status: 'archived' },
  });
  await t.throwsAsync(
    t.context.authorization.transferProjectOwnership({
      projectId: archived.id,
      actorUserId: owner.id,
      memberUserId: outsider.id,
    }),
    { message: 'Project not found' }
  );
});

test('only project owners can update the AI policy', async t => {
  const owner = await createUser(t.context, 'policy-owner');
  const member = await createUser(t.context, 'policy-member');
  const project = await createProject(t.context, owner, [{ user: member }]);
  await t.throwsAsync(
    t.context.authorization.setProjectAiPolicy({
      projectId: project.id,
      actorUserId: member.id,
      policy: 'read_write',
    }),
    { message: 'Project not found' }
  );
  const updated = await t.context.authorization.setProjectAiPolicy({
    projectId: project.id,
    actorUserId: owner.id,
    policy: 'read_write',
  });
  t.is(updated?.aiPolicy, 'read_write');
  t.is(
    await t.context.db.aiContextProjectPolicyAuditEvent.count({
      where: { projectId: project.id },
    }),
    1
  );
});

test('task projection caps after merging independently bounded sources', async t => {
  const actor = await createUser(t.context, 'projection-cap-actor');
  const requester = await createUser(t.context, 'projection-cap-requester');
  const workspace = await createWorkspace(t.context, actor);
  const project = await createProject(t.context, actor);
  const invitees = Array.from({ length: 26 }, (_, index) => ({
    id: randomUUID(),
    name: `Projection invitee ${index}`,
    email: `projection-invitee-${index}-${randomUUID()}@example.invalid`,
  }));
  await t.context.db.user.createMany({ data: invitees });
  const now = new Date();
  await t.context.db.accessRequest.createMany({
    data: Array.from({ length: 26 }, (_, index) => ({
      workspaceId: workspace.id,
      docId: `projection-request-${index}`,
      beneficiaryType: 'project',
      beneficiaryProjectId: project.id,
      purpose: 'project_copy',
      requesterUserId: requester.id,
      requesterUserIdSnapshot: requester.id,
      requestedLevel: 'read',
      requestFingerprint: `projection-cap-request-${randomUUID()}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })),
  });
  await t.context.db.aiContextProjectInvitation.createMany({
    data: invitees.map(invitee => ({
      projectId: project.id,
      inviteeUserId: invitee.id,
      inviterUserId: actor.id,
      inviterUserIdSnapshot: actor.id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })),
  });

  const panel = await t.context.projection.listPanel({
    userId: actor.id,
    now: new Date(now.getTime() + 1),
  });
  t.is(panel.todo.items.length, 50);
  t.true(panel.todo.capped);
  t.true(panel.todo.items.every(item => item.segment === 'todo'));
  t.true(
    panel.todo.items.some(item => item.kind === 'access_request') &&
      panel.todo.items.some(item => item.kind === 'project_invitation')
  );
});

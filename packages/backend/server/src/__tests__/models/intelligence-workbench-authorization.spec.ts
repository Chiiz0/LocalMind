import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { PrismaClient, type User, type Workspace } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';

import { EventBus } from '../../base';
import {
  capProjectGrantLevel,
  IntelligenceWorkbenchAuthorizationModel,
  IntelligenceWorkbenchTaskProjectionModel,
  Models,
} from '../../models';
import { ContextMemoryService } from '../../plugins/copilot/context-memory-service';
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

test('explicit reader suppresses default manager and idempotency normalizes whitespace', async t => {
  const sourceOwner = await createUser(t.context, 'source-owner');
  const reader = await createUser(t.context, 'reader');
  const workspace = await createWorkspace(t.context, sourceOwner);
  await addWorkspaceMember(t.context, workspace, reader);
  await t.context.db.workspaceAccessPolicy.update({
    where: { workspaceId: workspace.id },
    data: { memberDefaultDocRole: 'manager' },
  });
  await setDocRole(t.context, workspace.id, 'reader-doc', reader.id, 'reader');
  const project = await createProject(t.context, reader);

  const requested = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'reader-doc',
    requesterUserId: reader.id,
    requestedLevel: 'write',
    requestedTitle: 'Known to initiator',
    idempotencyKey: ' stable-key ',
  });
  t.is(requested.kind, 'requested');
  if (requested.kind !== 'requested') throw new Error('Expected request');
  t.is(await t.context.db.aiContextProjectGrant.count(), 0);
  t.like(
    await t.context.db.aiContextProjectDoc.findUnique({
      where: {
        projectId_workspaceId_docId: {
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'reader-doc',
        },
      },
    }),
    { status: 'pending', placeholderInitiatorUserId: reader.id }
  );

  const rejected = await t.context.authorization.rejectAccessRequest({
    requestId: requested.request.id,
    actorUserId: sourceOwner.id,
  });
  const replay = await t.context.authorization.addProjectDocument({
    projectId: ` ${project.id} `,
    workspaceId: ` ${workspace.id} `,
    docId: ' reader-doc ',
    requesterUserId: ` ${reader.id} `,
    requestedLevel: 'write',
    requestedTitle: 'Known to initiator',
    idempotencyKey: 'stable-key',
  });
  if (replay.kind !== 'requested') throw new Error('Expected request replay');
  t.is(rejected.status, 'rejected');
  t.is(replay.request.id, requested.request.id);
  t.is(replay.request.status, 'rejected');
  t.is(await t.context.db.accessRequest.count(), 1);
  t.is(capProjectGrantLevel('read', 'write'), 'read');
  t.is(capProjectGrantLevel('write', 'read'), 'read');
});

test('only a project owner can directly grant a document', async t => {
  const sourceOwner = await createUser(t.context, 'direct-source-owner');
  const projectOwner = await createUser(t.context, 'direct-project-owner');
  const member = await createUser(t.context, 'direct-member');
  const workspace = await createWorkspace(t.context, sourceOwner);
  await addWorkspaceMember(t.context, workspace, projectOwner);
  await addWorkspaceMember(t.context, workspace, member);
  await setDocRole(
    t.context,
    workspace.id,
    'member-managed-doc',
    member.id,
    'manager'
  );
  await setDocRole(
    t.context,
    workspace.id,
    'member-read-doc',
    member.id,
    'reader'
  );
  await setDocRole(
    t.context,
    workspace.id,
    'owner-managed-doc',
    projectOwner.id,
    'manager'
  );
  const project = await createProject(t.context, projectOwner, [
    { user: member },
  ]);

  const memberResult = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'member-managed-doc',
    requesterUserId: member.id,
    requestedLevel: 'write',
  });
  t.is(memberResult.kind, 'requested');
  t.is(
    await t.context.db.aiContextProjectGrant.count({
      where: { docId: 'member-managed-doc' },
    }),
    0
  );
  await t.throwsAsync(
    t.context.authorization.grantProjectDocument({
      projectId: project.id,
      workspaceId: workspace.id,
      docId: 'member-direct-bypass',
      actorUserId: member.id,
      requestedLevel: 'write',
    }),
    { message: 'Project not found' }
  );
  const memberReadResult = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'member-read-doc',
    requesterUserId: member.id,
    requestedLevel: 'read',
  });
  t.is(memberReadResult.kind, 'requested');
  t.is(
    await t.context.db.aiContextProjectGrant.count({
      where: { docId: 'member-read-doc' },
    }),
    0
  );

  const ownerResult = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'owner-managed-doc',
    requesterUserId: projectOwner.id,
    requestedLevel: 'read',
  });
  if (ownerResult.kind !== 'granted') throw new Error('Expected direct grant');
  t.like(ownerResult.grant, {
    grantedByUserId: projectOwner.id,
    grantorUserIdSnapshot: projectOwner.id,
    level: 'read',
    source: 'direct',
  });
});

test('access notifications follow human decisions, deduplicate replay, and redact former approvers', async t => {
  const { models, db, authorization } = t.context;
  const sourceOwner = await createUser(t.context, 'notification-owner');
  const requester = await createUser(t.context, 'notification-requester');
  const outsider = await createUser(t.context, 'notification-outsider');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, requester);
  const result = await authorization.requestProjectDocumentAccess({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'notification-doc',
    requesterUserId: requester.id,
    requestedLevel: 'read',
    requestedTitle: 'Supplied document',
    idempotencyKey: 'notification-request',
  });
  const requestId = result.request.id;
  const refreshBeforeDecision = await db.notificationRefresh.findUniqueOrThrow({
    where: { userId: sourceOwner.id },
  });
  const notification = await db.notification.findFirstOrThrow({
    where: {
      userId: sourceOwner.id,
      type: 'AccessRequest',
    },
  });
  await db.notification.delete({ where: { id: notification.id } });
  await db.notificationRefresh.deleteMany({
    where: { userId: sourceOwner.id },
  });
  const backfillSql = await readFile(
    new URL(
      '../../../migrations/20260905021000_access_request_notifications_backfill/migration.sql',
      import.meta.url
    ),
    'utf8'
  );
  await db.$executeRawUnsafe(backfillSql);
  await db.$executeRawUnsafe(backfillSql);
  t.is(await db.notification.count({ where: { id: notification.id } }), 1);
  t.truthy(
    await db.notificationRefresh.findUnique({
      where: { userId: sourceOwner.id },
    })
  );
  t.deepEqual(notification.body, {
    workspaceId: workspace.id,
    createdByUserId: requester.id,
    requestId,
  });
  t.like(
    await authorization.getAccessRequestNotification(requestId, sourceOwner.id),
    {
      canDecide: true,
      projectId: project.id,
      requestedLevel: 'read',
      docId: 'notification-doc',
    }
  );
  t.deepEqual(
    await authorization.getAccessRequestNotification(requestId, outsider.id),
    {
      requestId,
      status: 'unavailable',
      canDecide: false,
    }
  );
  await t.throwsAsync(
    authorization.approveAccessRequest({ requestId, actorUserId: requester.id })
  );
  t.is(
    await db.notification.count({ where: { type: 'AccessRequestResolved' } }),
    0
  );
  await authorization.rejectAccessRequest({
    requestId,
    actorUserId: sourceOwner.id,
    resolutionReason: 'Not for this project',
  });
  await authorization.rejectAccessRequest({
    requestId,
    actorUserId: sourceOwner.id,
  });
  t.is(
    (
      await models.notification.acknowledgeRefresh(
        sourceOwner.id,
        refreshBeforeDecision.revision
      )
    ).count,
    0
  );
  const refreshAfterDecision = await db.notificationRefresh.findUniqueOrThrow({
    where: { userId: sourceOwner.id },
  });
  t.not(refreshBeforeDecision.revision, refreshAfterDecision.revision);
  t.is(
    (
      await models.notification.acknowledgeRefresh(
        sourceOwner.id,
        refreshAfterDecision.revision
      )
    ).count,
    1
  );
  t.truthy(
    await db.notificationRefresh.findUnique({ where: { userId: requester.id } })
  );
  t.true((await models.notification.get(notification.id)).read);
  t.is(
    await db.notification.count({
      where: { userId: requester.id, type: 'AccessRequestResolved' },
    }),
    1
  );
  t.like(
    await authorization.getAccessRequestNotification(requestId, requester.id),
    {
      status: 'rejected',
      canDecide: false,
      resolutionReason: 'Not for this project',
    }
  );
  await db.workspaceMember.deleteMany({
    where: { workspaceId: workspace.id, userId: sourceOwner.id },
  });
  t.deepEqual(
    await authorization.getAccessRequestNotification(requestId, sourceOwner.id),
    {
      requestId,
      status: 'unavailable',
      canDecide: false,
    }
  );
});

test('pending notifications follow new admins and document owners without realtime', async t => {
  const { models, db, authorization } = t.context;
  const owner = await createUser(t.context, 'recipient-owner');
  const requester = await createUser(t.context, 'recipient-requester');
  const nextAdmin = await createUser(t.context, 'recipient-admin');
  const nextDocOwner = await createUser(t.context, 'recipient-doc-owner');
  const workspace = await createWorkspace(t.context, owner);
  const project = await createProject(t.context, requester);
  const { request } = await authorization.requestProjectDocumentAccess({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'recipient-doc',
    requesterUserId: requester.id,
    requestedLevel: 'read',
    idempotencyKey: 'recipient-request',
  });
  await addWorkspaceMember(t.context, workspace, nextAdmin, 'admin');
  await setDocRole(
    t.context,
    workspace.id,
    request.docId,
    nextDocOwner.id,
    'owner'
  );
  t.is(await models.notification.reconcileAccessRequestRecipients(), 2);
  for (const user of [nextAdmin, nextDocOwner]) {
    t.truthy(
      await db.notification.findUnique({
        where: { id: `access:${request.id}:${user.id}` },
      })
    );
    t.like(
      await authorization.getAccessRequestNotification(request.id, user.id),
      {
        canDecide: true,
        status: 'pending',
      }
    );
  }
  const revision = await db.notificationRefresh.findUniqueOrThrow({
    where: { userId: nextAdmin.id },
  });
  t.is(await models.notification.reconcileAccessRequestRecipients(), 0);
  t.is(
    (
      await db.notificationRefresh.findUniqueOrThrow({
        where: { userId: nextAdmin.id },
      })
    ).revision,
    revision.revision
  );
  await db.workspaceMember.update({
    where: {
      workspaceId_userId_state: {
        workspaceId: workspace.id,
        userId: nextAdmin.id,
        state: 'active',
      },
    },
    data: { role: 'member' },
  });
  t.like(
    await authorization.getAccessRequestNotification(request.id, nextAdmin.id),
    {
      canDecide: false,
    }
  );
  await t.throwsAsync(
    authorization.approveAccessRequest({
      requestId: request.id,
      actorUserId: nextAdmin.id,
    })
  );
  await authorization.rejectAccessRequest({
    requestId: request.id,
    actorUserId: nextDocOwner.id,
  });
  t.is(await models.notification.reconcileAccessRequestRecipients(), 0);
  t.is(
    await db.notification.count({
      where: { type: 'AccessRequestResolved', userId: requester.id },
    }),
    1
  );
});

test('access request terminal transitions are idempotent only after actor authorization', async t => {
  const sourceOwner = await createUser(t.context, 'decision-owner');
  const requester = await createUser(t.context, 'decision-requester');
  const stranger = await createUser(t.context, 'decision-stranger');
  const workspace = await createWorkspace(t.context, sourceOwner);

  const approvedRequest =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'approve-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      idempotencyKey: 'approve',
    });
  const approved = await t.context.authorization.approveAccessRequest({
    requestId: approvedRequest.request.id,
    actorUserId: sourceOwner.id,
  });
  t.is(approved.status, 'approved');
  t.is(
    (
      await t.context.authorization.approveAccessRequest({
        requestId: approved.id,
        actorUserId: sourceOwner.id,
      })
    ).id,
    approved.id
  );
  await t.throwsAsync(
    t.context.authorization.approveAccessRequest({
      requestId: approved.id,
      actorUserId: stranger.id,
    }),
    { message: 'Access request not found' }
  );
  t.is(
    await t.context.db.accessRequestAuditEvent.count({
      where: { accessRequestId: approved.id },
    }),
    2
  );
  const approvedReplay =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'approve-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      idempotencyKey: 'approve',
    });
  t.false(approvedReplay.created);
  t.is(approvedReplay.request.id, approved.id);
  t.is(approvedReplay.request.status, 'approved');

  const rejectedRequest =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'reject-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      idempotencyKey: 'reject',
    });
  const rejected = await t.context.authorization.rejectAccessRequest({
    requestId: rejectedRequest.request.id,
    actorUserId: sourceOwner.id,
  });
  t.is(rejected.status, 'rejected');
  t.is(
    (
      await t.context.authorization.rejectAccessRequest({
        requestId: rejected.id,
        actorUserId: sourceOwner.id,
      })
    ).status,
    'rejected'
  );
  const rejectedReplay =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'reject-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      idempotencyKey: 'reject',
    });
  t.false(rejectedReplay.created);
  t.is(rejectedReplay.request.id, rejected.id);
  t.is(rejectedReplay.request.status, 'rejected');

  const expiresAt = new Date(Date.now() + 60_000);
  const expiringRequest =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'expire-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      expiresAt,
      idempotencyKey: 'expire',
    });
  t.is(
    await t.context.authorization.expireDueAccessRequests({
      now: new Date(expiresAt.getTime() + 1),
    }),
    1
  );
  t.is(
    (
      await t.context.authorization.expireAccessRequest({
        requestId: expiringRequest.request.id,
        now: new Date(expiresAt.getTime() + 2),
      })
    ).status,
    'expired'
  );
  const expiredReplay = await t.context.authorization.requestUserDocumentAccess(
    {
      workspaceId: workspace.id,
      docId: 'expire-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      expiresAt,
      idempotencyKey: 'expire',
    }
  );
  t.false(expiredReplay.created);
  t.is(expiredReplay.request.id, expiringRequest.request.id);
  t.is(expiredReplay.request.status, 'expired');

  await t.throwsAsync(
    t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'past-expiry-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      expiresAt: new Date(Date.now() - 1),
      idempotencyKey: 'past-expiry-first-attempt',
    }),
    { message: 'Access request expiration must be in the future' }
  );

  const withdrawnRequest =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'withdraw-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      idempotencyKey: 'withdraw',
    });
  const withdrawn = await t.context.authorization.withdrawAccessRequest({
    requestId: withdrawnRequest.request.id,
    actorUserId: requester.id,
  });
  t.is(withdrawn.status, 'withdrawn');
  t.is(
    (
      await t.context.authorization.withdrawAccessRequest({
        requestId: withdrawn.id,
        actorUserId: requester.id,
      })
    ).status,
    'withdrawn'
  );
  const withdrawnReplay =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'withdraw-doc',
      requesterUserId: requester.id,
      requestedLevel: 'read',
      idempotencyKey: 'withdraw',
    });
  t.false(withdrawnReplay.created);
  t.is(withdrawnReplay.request.id, withdrawn.id);
  t.is(withdrawnReplay.request.status, 'withdrawn');
  await t.throwsAsync(
    t.context.authorization.withdrawAccessRequest({
      requestId: withdrawn.id,
      actorUserId: stranger.id,
    }),
    { message: 'Access request not found' }
  );
});

test('personal access approval never lowers an existing document role', async t => {
  const sourceOwner = await createUser(t.context, 'personal-source-owner');
  const requester = await createUser(t.context, 'personal-requester');
  const workspace = await createWorkspace(t.context, sourceOwner);
  await setDocRole(
    t.context,
    workspace.id,
    'personal-role-doc',
    requester.id,
    'commenter'
  );

  const readRequest = await t.context.authorization.requestUserDocumentAccess({
    workspaceId: workspace.id,
    docId: 'personal-role-doc',
    requesterUserId: requester.id,
    requestedLevel: 'read',
  });
  await t.context.authorization.approveAccessRequest({
    requestId: readRequest.request.id,
    actorUserId: sourceOwner.id,
  });
  t.is(
    (
      await t.context.db.docGrant.findUnique({
        where: {
          workspaceId_docId_principalType_principalId: {
            workspaceId: workspace.id,
            docId: 'personal-role-doc',
            principalType: 'user',
            principalId: requester.id,
          },
        },
      })
    )?.role,
    'commenter'
  );

  const writeRequest = await t.context.authorization.requestUserDocumentAccess({
    workspaceId: workspace.id,
    docId: 'personal-role-doc',
    requesterUserId: requester.id,
    requestedLevel: 'write',
  });
  await t.context.authorization.approveAccessRequest({
    requestId: writeRequest.request.id,
    actorUserId: sourceOwner.id,
  });
  t.is(
    (
      await t.context.db.docGrant.findUnique({
        where: {
          workspaceId_docId_principalType_principalId: {
            workspaceId: workspace.id,
            docId: 'personal-role-doc',
            principalType: 'user',
            principalId: requester.id,
          },
        },
      })
    )?.role,
    'editor'
  );
});

test('an exact project request replay does not bypass current membership', async t => {
  const sourceOwner = await createUser(t.context, 'replay-source-owner');
  const projectOwner = await createUser(t.context, 'replay-project-owner');
  const requester = await createUser(t.context, 'replay-requester');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, projectOwner, [
    { user: requester },
  ]);
  const requestInput = {
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'membership-bound-replay',
    requesterUserId: requester.id,
    requestedLevel: 'read' as const,
    idempotencyKey: 'membership-bound-replay',
  };
  const created =
    await t.context.authorization.requestProjectDocumentAccess(requestInput);
  t.true(created.created);
  t.true(
    await t.context.authorization.removeProjectMember({
      projectId: project.id,
      actorUserId: projectOwner.id,
      memberUserId: requester.id,
    })
  );

  await t.throwsAsync(
    t.context.authorization.requestProjectDocumentAccess(requestInput),
    { message: 'Project not found' }
  );
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

test('a project grant survives its grantor leaving and repeat add cannot reorder it', async t => {
  const sourceOwner = await createUser(t.context, 'grant-source-owner');
  const projectOwner = await createUser(t.context, 'grant-project-owner');
  const grantor = await createUser(t.context, 'grantor');
  const workspace = await createWorkspace(t.context, sourceOwner);
  await addWorkspaceMember(t.context, workspace, grantor);
  await setDocRole(
    t.context,
    workspace.id,
    'durable-grant-doc',
    grantor.id,
    'manager'
  );
  const project = await createProject(t.context, projectOwner, [
    { user: grantor, role: 'owner' },
  ]);
  const added = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'durable-grant-doc',
    requesterUserId: grantor.id,
    requestedLevel: 'write',
    groupId: 'original',
    sortOrder: 4,
  });
  t.is(added.kind, 'granted');
  if (added.kind !== 'granted') throw new Error('Expected direct grant');
  await setDocRole(
    t.context,
    workspace.id,
    'durable-grant-doc',
    grantor.id,
    'reader'
  );
  const replay = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'durable-grant-doc',
    requesterUserId: grantor.id,
    requestedLevel: 'read',
    groupId: 'unauthorized-reorder',
    sortOrder: 99,
  });
  t.is(replay.kind, 'granted');
  t.like(
    await t.context.db.aiContextProjectDoc.findUnique({
      where: {
        projectId_workspaceId_docId: {
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'durable-grant-doc',
        },
      },
    }),
    { groupId: 'original', sortOrder: 4, status: 'granted' }
  );
  t.true(
    await t.context.authorization.leaveProject({
      projectId: project.id,
      userId: grantor.id,
    })
  );
  t.like(
    await t.context.db.aiContextProjectGrant.findUnique({
      where: { id: added.grant.id },
    }),
    { status: 'active', level: 'write' }
  );
});

test('revocation quarantines exact memories and removed placeholders cannot be approved', async t => {
  const sourceOwner = await createUser(t.context, 'revoke-source');
  const projectOwner = await createUser(t.context, 'revoke-project');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, projectOwner, [
    { user: sourceOwner, role: 'owner' },
  ]);
  const added = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'memory-source',
    requesterUserId: sourceOwner.id,
    requestedLevel: 'read',
  });
  if (added.kind !== 'granted') throw new Error('Expected direct grant');
  await t.throwsAsync(
    t.context.models.copilotContextMemory.put({
      ownerUserId: projectOwner.id,
      projectId: project.id,
      scope: 'project',
      kind: 'project_summary',
      visibility: 'private',
      content: 'A project memory without explicit source provenance.',
    }),
    { message: 'Project memory requires at least one source document' }
  );
  const memory = await t.context.models.copilotContextMemory.put({
    ownerUserId: projectOwner.id,
    projectId: project.id,
    scope: 'project',
    kind: 'project_summary',
    visibility: 'private',
    content: 'Only this granted document supports the project memory.',
    sourceDocuments: [{ workspaceId: workspace.id, docId: 'memory-source' }],
  });
  const revoked = await t.context.authorization.revokeProjectGrantById({
    grantId: added.grant.id,
    actorUserId: sourceOwner.id,
  });
  t.is(revoked.quarantinedMemoryCount, 1);
  t.like(
    await t.context.db.aiContextMemory.findUnique({ where: { id: memory.id } }),
    {
      status: 'disabled',
      quarantinedByProjectGrantId: added.grant.id,
    }
  );
  const retrievedAfterRevocation = await new ContextMemoryService(
    t.context.models
  ).retrieveVisible({
    userId: projectOwner.id,
    workspaceId: workspace.id,
    docIds: [],
    projectIds: [project.id],
    query: 'Only this granted document supports the project memory.',
  });
  t.false(
    retrievedAfterRevocation.some(candidate => candidate.id === memory.id)
  );

  const rerequest =
    await t.context.authorization.reRequestRevokedProjectDocument({
      grantId: added.grant.id,
      requesterUserId: projectOwner.id,
      idempotencyKey: 'rerequest',
    });
  t.is(rerequest.request.status, 'pending');
  t.false(rerequest.request.requesterSuppliedIdentity);
  t.like(
    await t.context.db.aiContextProjectDoc.findUnique({
      where: {
        projectId_workspaceId_docId: {
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'memory-source',
        },
      },
    }),
    {
      status: 'pending',
      placeholderInitiatorUserId: null,
      suppliedTitle: null,
    }
  );
  const rerequestTask = (
    await t.context.projection.listAll({ userId: projectOwner.id })
  ).items.find(item => item.entityId === rerequest.request.id);
  t.like(rerequestTask, {
    documentId: null,
    redacted: true,
    title: null,
  });
  const removed = await t.context.authorization.removeProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'memory-source',
    actorUserId: projectOwner.id,
  });
  t.true(removed.removed);
  const afterRemoval = await t.context.authorization.approveAccessRequest({
    requestId: rerequest.request.id,
    actorUserId: sourceOwner.id,
  });
  t.is(afterRemoval.status, 'withdrawn');
  t.is(
    await t.context.db.aiContextProjectGrant.count({
      where: {
        projectId: project.id,
        workspaceId: workspace.id,
        docId: 'memory-source',
        status: 'active',
      },
    }),
    0
  );
});

test('source document deletion revokes grants, quarantines memory, and withdraws requests atomically', async t => {
  const sourceOwner = await createUser(t.context, 'delete-source');
  const projectOwner = await createUser(t.context, 'delete-project');
  const requester = await createUser(t.context, 'delete-requester');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, projectOwner, [
    { user: sourceOwner, role: 'owner' },
  ]);
  const added = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'deleted-source',
    requesterUserId: sourceOwner.id,
    requestedLevel: 'read',
  });
  if (added.kind !== 'granted') throw new Error('Expected direct grant');
  const memory = await t.context.models.copilotContextMemory.put({
    ownerUserId: projectOwner.id,
    projectId: project.id,
    scope: 'project',
    kind: 'project_summary',
    visibility: 'private',
    content: 'Memory removed from active context when its source is deleted.',
    sourceDocuments: [{ workspaceId: workspace.id, docId: 'deleted-source' }],
  });
  const request = await t.context.authorization.requestUserDocumentAccess({
    workspaceId: workspace.id,
    docId: 'deleted-source',
    requesterUserId: requester.id,
    requestedLevel: 'read',
  });

  const removed =
    await t.context.models.copilotContextMemory.removeDocumentReferences({
      workspaceId: workspace.id,
      docId: 'deleted-source',
    });
  t.is(removed.projectDocumentCount, 1);
  t.like(
    await t.context.db.aiContextProjectGrant.findUnique({
      where: { id: added.grant.id },
    }),
    {
      status: 'revoked',
      revokerUserIdSnapshot: 'system:source-document-deleted',
    }
  );
  t.like(
    await t.context.db.aiContextMemory.findUnique({ where: { id: memory.id } }),
    { status: 'disabled', quarantineReason: 'source_document_deleted' }
  );
  t.is(
    (
      await t.context.db.accessRequest.findUnique({
        where: { id: request.request.id },
      })
    )?.status,
    'withdrawn'
  );
  t.is(
    await t.context.db.aiContextProjectDoc.count({
      where: { workspaceId: workspace.id, docId: 'deleted-source' },
    }),
    0
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

test('source listings apply actor ACL before ordering and limiting', async t => {
  const sourceOwner = await createUser(t.context, 'source-list-owner');
  const documentOwner = await createUser(t.context, 'source-list-doc-owner');
  const requester = await createUser(t.context, 'source-list-requester');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, sourceOwner);
  await setDocRole(
    t.context,
    workspace.id,
    'source-list-allowed',
    documentOwner.id,
    'owner'
  );

  for (const docId of ['source-list-allowed', 'source-list-denied']) {
    const result = await t.context.authorization.addProjectDocument({
      projectId: project.id,
      workspaceId: workspace.id,
      docId,
      requesterUserId: sourceOwner.id,
      requestedLevel: 'read',
    });
    if (result.kind !== 'granted') throw new Error('Expected direct grant');
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId,
      requesterUserId: requester.id,
      requestedLevel: 'read',
    });
  }
  const older = new Date('2026-01-01T00:00:00Z');
  const newer = new Date('2026-01-02T00:00:00Z');
  await Promise.all([
    t.context.db.aiContextProjectGrant.updateMany({
      where: { docId: 'source-list-allowed' },
      data: { updatedAt: older },
    }),
    t.context.db.aiContextProjectGrant.updateMany({
      where: { docId: 'source-list-denied' },
      data: { updatedAt: newer },
    }),
    t.context.db.accessRequest.updateMany({
      where: { docId: 'source-list-allowed' },
      data: { updatedAt: older },
    }),
    t.context.db.accessRequest.updateMany({
      where: { docId: 'source-list-denied' },
      data: { updatedAt: newer },
    }),
  ]);

  const grants = await t.context.authorization.listProjectGrantsForSource({
    actorUserId: documentOwner.id,
    workspaceId: workspace.id,
    limit: 1,
  });
  t.deepEqual(
    grants.map(grant => grant.docId),
    ['source-list-allowed']
  );
  const requests = await t.context.authorization.listAccessRequests({
    actorUserId: documentOwner.id,
    view: 'source',
    workspaceId: workspace.id,
    statuses: ['pending'],
    limit: 1,
  });
  t.deepEqual(
    requests.map(request => request.docId),
    ['source-list-allowed']
  );
});

test('task projection filters unrelated authorization work', async t => {
  const sourceOwner = await createUser(t.context, 'projection-source');
  const requester = await createUser(t.context, 'projection-requester');
  const stranger = await createUser(t.context, 'projection-stranger');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, sourceOwner);
  await t.context.authorization.requestUserDocumentAccess({
    workspaceId: workspace.id,
    docId: 'private-request',
    requesterUserId: requester.id,
    requestedLevel: 'read',
  });
  const grant = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'private-grant',
    requesterUserId: sourceOwner.id,
    requestedLevel: 'read',
  });
  t.is(grant.kind, 'granted');

  const panel = await t.context.projection.listPanel({ userId: stranger.id });
  t.deepEqual(panel.todo.items, []);
  t.deepEqual(panel.inProgress.items, []);
  t.deepEqual(panel.done.items, []);
});

test('task projection uses the grant as the canonical approved project card', async t => {
  const sourceOwner = await createUser(t.context, 'canonical-source');
  const projectOwner = await createUser(t.context, 'canonical-project');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, projectOwner);
  const projectRequest = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'canonical-project-doc',
    requesterUserId: projectOwner.id,
    requestedLevel: 'read',
  });
  if (projectRequest.kind !== 'requested') throw new Error('Expected request');
  await t.context.authorization.approveAccessRequest({
    requestId: projectRequest.request.id,
    actorUserId: sourceOwner.id,
  });
  const personalRequest =
    await t.context.authorization.requestUserDocumentAccess({
      workspaceId: workspace.id,
      docId: 'canonical-personal-doc',
      requesterUserId: projectOwner.id,
      requestedLevel: 'read',
    });
  await t.context.authorization.approveAccessRequest({
    requestId: personalRequest.request.id,
    actorUserId: sourceOwner.id,
  });

  const projection = await t.context.projection.listAll({
    userId: projectOwner.id,
  });
  t.false(
    projection.items.some(
      item =>
        item.kind === 'access_request' &&
        item.entityId === projectRequest.request.id
    )
  );
  t.true(
    projection.items.some(
      item =>
        item.kind === 'project_grant' &&
        item.documentId === 'canonical-project-doc'
    )
  );
  t.true(
    projection.items.some(
      item =>
        item.kind === 'access_request' &&
        item.entityId === personalRequest.request.id
    )
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
      beneficiaryType: 'user',
      beneficiaryUserId: requester.id,
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

test('actionable revoked grant is not hidden by newer ineligible grants', async t => {
  const sourceOwner = await createUser(t.context, 'projection-grant-source');
  const projectOwner = await createUser(t.context, 'projection-grant-project');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, projectOwner);
  const grantedAt = new Date('2026-01-01T00:00:00Z');
  const revokedAt = new Date();
  const ineligible = Array.from({ length: 51 }, (_, index) => ({
    docId: `ineligible-revoked-${index}`,
    grantId: randomUUID(),
  }));
  await t.context.db.$transaction(async transaction => {
    await transaction.aiContextProjectDoc.createMany({
      data: [
        ...ineligible.map(({ docId }) => ({
          projectId: project.id,
          workspaceId: workspace.id,
          docId,
          status: 'pending',
          requestedLevel: 'read',
          addedByUserId: projectOwner.id,
          placeholderInitiatorUserId: projectOwner.id,
          createdAt: revokedAt,
          updatedAt: revokedAt,
        })),
        {
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'actionable-revoked',
          status: 'revoked',
          requestedLevel: 'read',
          addedByUserId: projectOwner.id,
          revokedAt,
          createdAt: grantedAt,
          updatedAt: grantedAt,
        },
      ],
    });
    await transaction.aiContextProjectGrant.createMany({
      data: [
        ...ineligible.map(({ docId, grantId }) => ({
          id: grantId,
          projectId: project.id,
          workspaceId: workspace.id,
          docId,
          level: 'read',
          status: 'revoked',
          source: 'direct',
          approvingSide: 'source',
          revocable: true,
          grantedByUserId: sourceOwner.id,
          grantorUserIdSnapshot: sourceOwner.id,
          grantedAt,
          revokedByUserId: sourceOwner.id,
          revokerUserIdSnapshot: sourceOwner.id,
          revokedAt,
          createdAt: grantedAt,
          updatedAt: revokedAt,
        })),
        {
          id: randomUUID(),
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'actionable-revoked',
          level: 'read',
          status: 'revoked',
          source: 'direct',
          approvingSide: 'source',
          revocable: true,
          grantedByUserId: sourceOwner.id,
          grantorUserIdSnapshot: sourceOwner.id,
          grantedAt,
          revokedByUserId: sourceOwner.id,
          revokerUserIdSnapshot: sourceOwner.id,
          revokedAt,
          createdAt: grantedAt,
          updatedAt: grantedAt,
        },
      ],
    });
  });

  const panel = await t.context.projection.listPanel({
    userId: projectOwner.id,
  });
  const grantCards = panel.todo.items.filter(
    item => item.kind === 'project_grant'
  );
  t.is(grantCards.length, 1);
  t.is(grantCards[0].documentId, null);
  t.true(grantCards[0].redacted);
  t.deepEqual(grantCards[0].availableActions, ['request_project_access']);
});

test('only the latest revoked grant for a document is an actionable re-request', async t => {
  const owner = await createUser(t.context, 'latest-revoked-owner');
  const workspace = await createWorkspace(t.context, owner);
  const project = await createProject(t.context, owner);
  const first = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'regranted-document',
    requesterUserId: owner.id,
    requestedLevel: 'write',
  });
  if (first.kind !== 'granted') throw new Error('Expected direct grant');
  await t.context.authorization.revokeProjectGrantById({
    grantId: first.grant.id,
    actorUserId: owner.id,
  });
  const second = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'regranted-document',
    requesterUserId: owner.id,
    requestedLevel: 'read',
  });
  if (second.kind !== 'granted') throw new Error('Expected replacement grant');
  await t.context.authorization.revokeProjectGrantById({
    grantId: second.grant.id,
    actorUserId: owner.id,
  });

  const panel = await t.context.projection.listPanel({ userId: owner.id });
  const actionable = panel.todo.items.filter(
    item =>
      item.kind === 'project_grant' && item.documentId === 'regranted-document'
  );
  t.deepEqual(
    actionable.map(item => item.entityId),
    [second.grant.id]
  );

  const fullList = await t.context.projection.listAll({ userId: owner.id });
  const history = fullList.items.filter(
    item =>
      item.kind === 'project_grant' && item.documentId === 'regranted-document'
  );
  t.is(history.find(item => item.entityId === first.grant.id)?.segment, 'done');
  t.is(
    history.find(item => item.entityId === second.grant.id)?.segment,
    'todo'
  );
});

test('historical revoked grants cannot consume the To do segment cap', async t => {
  const owner = await createUser(t.context, 'revoked-cap-owner');
  const workspace = await createWorkspace(t.context, owner);
  const project = await createProject(t.context, owner);
  const now = new Date();
  const grantedAt = new Date(now.getTime() - 120_000);
  const crowdedGrantIds = Array.from({ length: 55 }, () => randomUUID());
  const otherGrantId = randomUUID();

  await t.context.db.$transaction(async transaction => {
    await transaction.aiContextProjectDoc.createMany({
      data: [
        {
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'crowded-history-document',
          status: 'revoked',
          requestedLevel: 'read',
          addedByUserId: owner.id,
          revokedAt: new Date(now.getTime() - 1_000),
        },
        {
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'independent-revoked-document',
          status: 'revoked',
          requestedLevel: 'read',
          addedByUserId: owner.id,
          revokedAt: new Date(now.getTime() - 70_000),
        },
      ],
    });
    await transaction.aiContextProjectGrant.createMany({
      data: [
        ...crowdedGrantIds.map((id, index) => {
          const revokedAt = new Date(
            now.getTime() - (crowdedGrantIds.length - index) * 1_000
          );
          return {
            id,
            projectId: project.id,
            workspaceId: workspace.id,
            docId: 'crowded-history-document',
            level: 'read',
            status: 'revoked',
            source: 'direct',
            approvingSide: 'source',
            revocable: true,
            grantedByUserId: owner.id,
            grantorUserIdSnapshot: owner.id,
            grantedAt,
            revokedByUserId: owner.id,
            revokerUserIdSnapshot: owner.id,
            revokedAt,
            createdAt: grantedAt,
            updatedAt: revokedAt,
          };
        }),
        {
          id: otherGrantId,
          projectId: project.id,
          workspaceId: workspace.id,
          docId: 'independent-revoked-document',
          level: 'read',
          status: 'revoked',
          source: 'direct',
          approvingSide: 'source',
          revocable: true,
          grantedByUserId: owner.id,
          grantorUserIdSnapshot: owner.id,
          grantedAt,
          revokedByUserId: owner.id,
          revokerUserIdSnapshot: owner.id,
          revokedAt: new Date(now.getTime() - 70_000),
          createdAt: grantedAt,
          updatedAt: new Date(now.getTime() - 70_000),
        },
      ],
    });
  });

  const panel = await t.context.projection.listPanel({ userId: owner.id, now });
  const grantCards = panel.todo.items.filter(
    item => item.kind === 'project_grant'
  );
  t.false(panel.todo.capped);
  t.deepEqual(
    new Set(grantCards.map(item => item.entityId)),
    new Set([crowdedGrantIds.at(-1), otherGrantId])
  );
});

test('archiving a project audits and withdraws pending requests and invitations', async t => {
  const sourceOwner = await createUser(t.context, 'archive-source');
  const projectOwner = await createUser(t.context, 'archive-project');
  const invitee = await createUser(t.context, 'archive-invitee');
  const workspace = await createWorkspace(t.context, sourceOwner);
  const project = await createProject(t.context, projectOwner);
  const requested = await t.context.authorization.addProjectDocument({
    projectId: project.id,
    workspaceId: workspace.id,
    docId: 'archive-pending-doc',
    requesterUserId: projectOwner.id,
    requestedLevel: 'read',
    requestedTitle: 'Visible only to initiator',
  });
  if (requested.kind !== 'requested') throw new Error('Expected request');
  const invited = await t.context.authorization.sendProjectInvitation({
    projectId: project.id,
    inviterUserId: projectOwner.id,
    inviteeUserId: invitee.id,
  });

  const archived = await t.context.models.copilotContextMemory.updateProject(
    project.id,
    projectOwner.id,
    { status: 'archived' }
  );
  t.is(archived?.status, 'archived');
  t.like(
    await t.context.db.accessRequest.findUnique({
      where: { id: requested.request.id },
    }),
    {
      status: 'withdrawn',
      resolverUserIdSnapshot: 'system:project_archived',
      resolutionReason: 'project_archived',
    }
  );
  t.like(
    await t.context.db.aiContextProjectInvitation.findUnique({
      where: { id: invited.invitation.id },
    }),
    { status: 'withdrawn' }
  );
  t.like(
    await t.context.db.accessRequestAuditEvent.findFirst({
      where: {
        accessRequestId: requested.request.id,
        eventType: 'withdrawn',
      },
    }),
    { actorUserId: null, actorUserIdSnapshot: 'system:project_archived' }
  );
  t.like(
    await t.context.db.aiContextProjectInvitationAuditEvent.findFirst({
      where: {
        invitationId: invited.invitation.id,
        eventType: 'withdrawn',
      },
    }),
    { actorUserId: null, actorUserIdSnapshot: 'system:project_archived' }
  );

  for (const userId of [projectOwner.id, sourceOwner.id, invitee.id]) {
    const panel = await t.context.projection.listPanel({ userId });
    t.false(
      panel.todo.items.some(
        item =>
          item.entityId === requested.request.id ||
          item.entityId === invited.invitation.id
      )
    );
  }
});

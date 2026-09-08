import { PrismaClient } from '@prisma/client';
import test from 'ava';

import { ProjectModule } from '../../core/project';
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

async function fixture() {
  const owner = await app.models.user.create({
    email: 'lease-owner@example.com',
    name: 'Owner',
  });
  const member = await app.models.user.create({
    email: 'lease-member@example.com',
    name: 'Editor',
  });
  const outsider = await app.models.user.create({
    email: 'lease-outsider@example.com',
  });
  const db = app.get(PrismaClient);
  const project = await db.aiContextProject.create({
    data: {
      name: 'Lease project',
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: member.id, role: 'member' },
        ],
      },
    },
  });
  const resource = await app.get(ProjectResourceService).createDocument({
    projectId: project.id,
    actorId: owner.id,
    title: 'Shared document',
    markdown: 'Initial content',
    requestKey: 'create',
  });
  const scope = {
    projectId: project.id,
    resourceId: resource.id,
    actorId: owner.id,
    kind: 'user' as const,
    tabId: 'tab-one',
  };
  return {
    db,
    project,
    resource,
    owner,
    member,
    outsider,
    scope,
    leases: app.models.projectResourceEditLease,
  };
}

test.serial(
  'two tabs and two users contend for one lease; no role can release another holder',
  async t => {
    const { scope, leases, member } = await fixture();
    const contenders = [
      scope,
      { ...scope, tabId: 'tab-two' },
      { ...scope, actorId: member.id, tabId: 'member-tab' },
    ];
    const acquired = await Promise.all(
      contenders.map(input => leases.acquire(input))
    );
    t.is(acquired.filter(result => result.acquired).length, 1);
    const winnerIndex = acquired.findIndex(result => result.acquired);
    const winner = acquired[winnerIndex].lease!;
    t.true(winner.expiresAt.getTime() - winner.acquiredAt.getTime() <= 60001);
    for (const [index, contender] of contenders.entries()) {
      if (index === winnerIndex) continue;
      t.false(await leases.release({ ...contender, leaseId: winner.leaseId }));
      const result = await leases.renew({
        ...contender,
        leaseId: winner.leaseId,
      });
      t.false(result.acquired);
      t.is(leases.view(result.lease, contender)?.leaseId, null);
      t.is(
        leases.view(result.lease, contender)?.holderName,
        winner.holder.name
      );
    }
    t.true(
      await leases.release({
        ...contenders[winnerIndex],
        leaseId: winner.leaseId,
      })
    );
    t.is(await leases.get(scope), null);
  }
);

test.serial(
  'expired leases are replaced atomically and stale requests cannot renew or release the new lease',
  async t => {
    const { db, leases, scope } = await fixture();
    const first = (await leases.acquire(scope)).lease!;
    await db.$executeRaw`UPDATE project_resource_edit_leases SET acquired_at = clock_timestamp() - interval '70 seconds', expires_at = clock_timestamp() - interval '1 second' WHERE resource_id = ${scope.resourceId}`;
    const replacement = (await leases.acquire(scope)).lease!;
    t.not(first.leaseId, replacement.leaseId);
    t.false(
      (await leases.renew({ ...scope, leaseId: first.leaseId })).acquired
    );
    t.false(await leases.release({ ...scope, leaseId: first.leaseId }));
    t.true(
      (await leases.renew({ ...scope, leaseId: replacement.leaseId })).acquired
    );
    const actions = await db.projectResourceAuditEvent.findMany({
      where: {
        resourceId: scope.resourceId,
        action: { startsWith: 'edit_lease_' },
      },
    });
    t.is(
      actions.filter(event => event.action === 'edit_lease_acquired').length,
      2
    );
    t.is(
      actions.filter(event => event.action === 'edit_lease_expired').length,
      1
    );
    t.is(
      actions.filter(event => event.action === 'edit_lease_renewal_denied')
        .length,
      1
    );
    t.true(
      (await db.projectRealtimeOutbox.count({
        where: { topic: 'project.lease.changed', resourceId: scope.resourceId },
      })) >= 3
    );
  }
);

test.serial(
  'membership gates snapshots and acquisition; revocation still permits exact holder release',
  async t => {
    const { db, scope, leases, outsider, member } = await fixture();
    await t.throwsAsync(leases.get({ ...scope, actorId: outsider.id }));
    await t.throwsAsync(leases.acquire({ ...scope, actorId: outsider.id }));
    const holder = { ...scope, actorId: member.id };
    const lease = (await leases.acquire(holder)).lease!;
    await db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: member.id },
      },
    });
    await t.throwsAsync(leases.renew({ ...holder, leaseId: lease.leaseId }));
    t.true(await leases.release({ ...holder, leaseId: lease.leaseId }));
  }
);

test.serial(
  'AI waiting survives worker handoff and release resumes only once',
  async t => {
    const { scope, leases, member, db } = await fixture();
    const held = (await leases.acquire(scope)).lease!;
    const actor = { projectId: scope.projectId, actorId: member.id };
    const runtime = app.models.copilotProjectAgentRuntime;
    const prepared = await runtime.prepare({
      ...actor,
      requestKey: 'waiting-ai',
      workflow: 'agent_runtime_project_resource',
      sourceType: 'project_resource',
      title: 'AI write',
      command: { version: 1 },
    });
    const running = (await runtime.acquire({
      projectId: scope.projectId,
      runId: prepared.id,
      workerLeaseId: 'worker-one',
    }))!;
    const worker = {
      ...actor,
      runId: running.id,
      workerLeaseId: 'worker-one',
      workerAttempt: running.workerAttempt,
    };
    const editing = await leases.acquire({
      ...actor,
      resourceId: scope.resourceId,
      kind: 'ai_task',
      taskId: running.id,
      tabId: worker.workerLeaseId,
    });
    t.false(editing.acquired);
    await runtime.waitForEditLease({
      ...worker,
      resourceId: scope.resourceId,
      leaseId: held.leaseId,
    });
    t.is(
      (await runtime.get({ ...actor, runId: running.id })).status,
      'waiting_lease'
    );
    t.deepEqual(await runtime.resumeWaitingLeases(scope.projectId), []);
    await leases.release({ ...scope, leaseId: held.leaseId });
    const results = await Promise.all([
      runtime.resumeWaitingLeases(scope.projectId),
      runtime.resumeWaitingLeases(scope.projectId),
    ]);
    t.is(results.flat().length, 1);
    const retried = (await runtime.acquire({
      projectId: scope.projectId,
      runId: running.id,
      workerLeaseId: 'worker-two',
    }))!;
    t.is(retried.leaseRetryCount, 1);
    const ai = await leases.acquire({
      ...actor,
      resourceId: scope.resourceId,
      kind: 'ai_task',
      taskId: running.id,
      tabId: 'worker-two',
    });
    t.true(ai.acquired);
    t.false((await leases.acquire(scope)).acquired);
    t.true(ai.lease!.expiresAt <= retried.workerLeaseExpiresAt!);
    await leases.releaseTask({
      ...actor,
      runId: running.id,
      workerLeaseId: 'worker-one',
    });
    t.is((await leases.get(scope))?.leaseId, ai.lease!.leaseId);
    await leases.releaseTask({
      ...actor,
      runId: running.id,
      workerLeaseId: 'worker-two',
    });
    const secondHolder = (await leases.acquire(scope)).lease!;
    await runtime.waitForEditLease({
      ...actor,
      runId: running.id,
      workerLeaseId: 'worker-two',
      workerAttempt: retried.workerAttempt,
      resourceId: scope.resourceId,
      leaseId: secondHolder.leaseId,
    });
    await leases.release({ ...scope, leaseId: secondHolder.leaseId });
    t.deepEqual(await runtime.resumeWaitingLeases(scope.projectId), []);
    await runtime.cancel({ ...actor, runId: running.id });
    t.is(
      (await db.aiAgentRun.findUniqueOrThrow({ where: { id: running.id } }))
        .status,
      'cancelled'
    );
  }
);

test.serial(
  'Project decisions serialize competing views and preserve decision identity and actor',
  async t => {
    const { project, owner, outsider } = await fixture();
    const runtime = app.models.copilotProjectAgentRuntime;
    const actor = { projectId: project.id, actorId: owner.id };
    const run = await runtime.prepare({
      ...actor,
      workflow: 'agent_runtime_project_resource',
      sourceType: 'project_resource',
      title: 'Approved operation',
      requestKey: 'decision-run',
      command: { operation: 'test' },
      status: 'waiting_approval',
    });
    const decision = {
      ...actor,
      runId: run.id,
      targetFingerprint: run.targetFingerprint,
      expectedStatus: 'waiting_approval',
      action: 'approve' as const,
      requestKey: 'chat-card',
    };
    await t.throwsAsync(runtime.decide({ ...decision, actorId: outsider.id }));
    const results = await Promise.all([
      runtime.decide(decision),
      runtime.decide({
        ...decision,
        action: 'reject',
        requestKey: 'task-panel',
      }),
    ]);
    t.is(results.filter(result => result.applied).length, 1);
    t.true(results.every(result => result.processedById === owner.id));
    const winner = results.find(result => result.applied)!;
    t.is(
      results.find(result => !result.applied)!.run.status,
      winner.run.status
    );
    const replay = await runtime.decide(
      winner === results[0]
        ? decision
        : { ...decision, action: 'reject', requestKey: 'task-panel' }
    );
    t.false(replay.applied);
    t.is(replay.decision, winner.decision);
    t.is(winner.decision, winner === results[0] ? 'approve' : 'reject');
    t.is(replay.processedAt.getTime(), winner.processedAt.getTime());
    await t.throwsAsync(
      runtime.decide({
        ...decision,
        requestKey: winner === results[0] ? 'chat-card' : 'task-panel',
        action: 'cancel',
      })
    );
    t.is(
      (await runtime.get({ ...actor, runId: run.id })).timelineEvents.filter(
        event =>
          (event.payload as { action?: string }).action === 'task_decision'
      ).length,
      1
    );
  }
);

test.serial(
  'native tasks include waiting editors in To do and task history without a Workspace',
  async t => {
    const { scope, leases } = await fixture();
    const runtime = app.models.copilotProjectAgentRuntime;
    const held = (await leases.acquire(scope)).lease!;
    const run = await runtime.prepare({
      ...scope,
      workflow: 'agent_runtime_project_resource',
      sourceType: 'project_resource',
      title: 'Waiting document',
      requestKey: 'projection',
      command: { operation: 'test' },
    });
    const running = (await runtime.acquire({
      projectId: scope.projectId,
      runId: run.id,
      workerLeaseId: 'projection-worker',
    }))!;
    await runtime.waitForEditLease({
      ...scope,
      runId: run.id,
      workerLeaseId: 'projection-worker',
      workerAttempt: running.workerAttempt,
      resourceId: scope.resourceId,
      leaseId: held.leaseId,
    });
    const projection = app.models.intelligenceWorkbenchTaskProjection;
    const panel = await projection.listPanel({
      userId: scope.actorId,
      projectId: scope.projectId,
    });
    const task = panel.todo.items.find(item => item.entityId === run.id)!;
    t.is(task.kind, 'project_run');
    t.is(task.attention, 'waiting_on_others');
    t.is(task.projectTask?.status, 'waiting_lease');
    const history = await projection.listAll({
      userId: scope.actorId,
      filter: 'approval',
      taskId: task.id,
    });
    t.is(history.items[0]?.entityId, run.id);
  }
);

test.serial(
  'worker renewal persists evidence and cancellation releases authority before a prepared write commits',
  async t => {
    const { scope, leases, db } = await fixture();
    const runtime = app.models.copilotProjectAgentRuntime;
    const run = await runtime.prepare({
      ...scope,
      workflow: 'agent_runtime_project_resource',
      sourceType: 'project_resource',
      title: 'Long operation',
      requestKey: 'renewal',
      command: { operation: 'test' },
    });
    const acquired = (await runtime.acquire({
      ...scope,
      runId: run.id,
      workerLeaseId: 'long-worker',
    }))!;
    const worker = {
      ...scope,
      runId: run.id,
      workerLeaseId: 'long-worker',
      workerAttempt: acquired.workerAttempt,
    };
    const editor = {
      ...scope,
      kind: 'ai_task' as const,
      taskId: run.id,
      tabId: worker.workerLeaseId,
    };
    const held = (await leases.acquire(editor)).lease!;
    t.true(await runtime.renew(worker));
    const renewed = await runtime.get(worker);
    t.true(renewed.workerLeaseExpiresAt! >= acquired.workerLeaseExpiresAt!);
    t.true((await leases.get(scope))!.expiresAt >= held.expiresAt);
    t.is(
      renewed.timelineEvents.filter(
        event =>
          (event.payload as { action?: string }).action ===
          'worker_lease_renewed'
      ).length,
      1
    );
    const decisions = await Promise.all(
      ['chat-cancel', 'panel-cancel'].map(requestKey =>
        runtime.decide({
          ...worker,
          targetFingerprint: run.targetFingerprint,
          expectedStatus: 'running',
          action: 'cancel',
          requestKey,
        })
      )
    );
    t.is(decisions.filter(result => result.applied).length, 1);
    t.is(
      decisions[0].processedAt.getTime(),
      decisions[1].processedAt.getTime()
    );
    t.false(await runtime.renew(worker));
    t.is((await runtime.get(worker)).status, 'cancelled');
    t.is(await leases.get(scope), null);
    let wrote = false;
    await t.throwsAsync(
      runtime.execute(worker, async () => {
        wrote = true;
        return { wrote };
      })
    );
    t.false(wrote);
    t.is(
      await db.aiAgentRuntimeExecutionResult.count({
        where: { runId: run.id },
      }),
      0
    );
  }
);

test.serial(
  'expired worker handoff fences renewal, execution and stale release',
  async t => {
    const { scope, leases, db } = await fixture();
    const runtime = app.models.copilotProjectAgentRuntime;
    const run = await runtime.prepare({
      ...scope,
      workflow: 'agent_runtime_project_resource',
      sourceType: 'project_resource',
      title: 'Handoff operation',
      requestKey: 'handoff',
      command: { operation: 'test' },
    });
    const acquired = (await runtime.acquire({
      ...scope,
      runId: run.id,
      workerLeaseId: 'old-worker',
    }))!;
    const old = {
      ...scope,
      runId: run.id,
      workerLeaseId: 'old-worker',
      workerAttempt: acquired.workerAttempt,
    };
    await leases.acquire({
      ...scope,
      kind: 'ai_task',
      taskId: run.id,
      tabId: old.workerLeaseId,
    });
    await db.$executeRaw`UPDATE ai_agent_runs SET worker_lease_expires_at = clock_timestamp() - interval '1 second' WHERE id = ${run.id}`;
    await db.$executeRaw`UPDATE project_resource_edit_leases SET acquired_at = clock_timestamp() - interval '70 seconds', expires_at = clock_timestamp() - interval '1 second' WHERE resource_id = ${scope.resourceId}`;
    await t.throwsAsync(runtime.renew(old));
    const next = (await runtime.acquire({
      ...scope,
      runId: run.id,
      workerLeaseId: 'new-worker',
    }))!;
    const current = {
      ...old,
      workerLeaseId: 'new-worker',
      workerAttempt: next.workerAttempt,
    };
    const held = (
      await leases.acquire({
        ...scope,
        kind: 'ai_task',
        taskId: run.id,
        tabId: current.workerLeaseId,
      })
    ).lease!;
    await leases.releaseTask(old);
    t.is((await leases.get(scope))?.leaseId, held.leaseId);
    await t.throwsAsync(runtime.execute(old, async () => ({ stale: true })));
    t.true(await runtime.renew(current));
    await runtime.execute(current, async () => ({ handedOff: true }));
    await leases.releaseTask(current);
    t.is((await runtime.get(current)).status, 'completed');
    t.is(await leases.get(scope), null);
  }
);

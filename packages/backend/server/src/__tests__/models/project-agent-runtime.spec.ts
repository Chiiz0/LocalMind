import { setTimeout } from 'node:timers/promises';

import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';

import { ProjectModule, ProjectResourceService } from '../../core/project';
import { Models } from '../../models';
import { PROJECT_AGENT_WORKFLOW } from '../../models/copilot-project-agent-runtime';
import { createTestingModule, type TestingModule } from '../utils';

const test = ava.serial as TestFn<{
  module: TestingModule;
  models: Models;
  db: PrismaClient;
  resources: ProjectResourceService;
  projectId: string;
  actorId: string;
}>;

test.before(async t => {
  const module = await createTestingModule({ imports: [ProjectModule] });
  Object.assign(t.context, {
    module,
    models: module.get(Models),
    db: module.get(PrismaClient),
    resources: module.get(ProjectResourceService),
  });
});
test.beforeEach(async t => {
  await t.context.module.initTestingDB();
  const actor = await t.context.models.user.create({
    email: 'project-runtime-member@example.com',
  });
  const owner = await t.context.models.user.create({
    email: 'project-runtime-owner@example.com',
  });
  const project = await t.context.db.aiContextProject.create({
    data: {
      name: 'Project runtime',
      members: {
        create: [
          { userId: actor.id, role: 'member' },
          { userId: owner.id, role: 'owner' },
        ],
      },
    },
  });
  Object.assign(t.context, { actorId: actor.id, projectId: project.id });
});
test.after.always(async t => {
  await t.context.module.close();
});

test('a clock step backwards does not prevent a durable worker failure receipt', async t => {
  const model = t.context.models.copilotProjectAgentRuntime;
  const prepared = await model.prepare(input(t.context));
  const workerLeaseId = 'clock-regression-worker';
  const acquired = await model.acquire({
    projectId: t.context.projectId,
    runId: prepared.id,
    workerLeaseId,
  });
  t.truthy(acquired);
  const clock = Sinon.useFakeTimers({
    now: Date.now() - 1000,
    toFake: ['Date'],
  });
  try {
    const failed = await model.fail(
      {
        projectId: t.context.projectId,
        actorId: t.context.actorId,
        runId: prepared.id,
        workerLeaseId,
        workerAttempt: acquired!.workerAttempt,
      },
      'test_failure',
      'Controlled worker failure'
    );
    t.is(failed.status, 'failed');
    t.is(failed.projectExecutionResults.length, 1);
    t.true(failed.updatedAt >= acquired!.updatedAt);
  } finally {
    clock.restore();
  }
});

function input(context: { actorId: string; projectId: string }) {
  return {
    actorId: context.actorId,
    projectId: context.projectId,
    requestKey: 'intent-1',
    workflow: PROJECT_AGENT_WORKFLOW,
    sourceType: 'project_resource' as const,
    title: 'Create document',
    command: { title: 'Document' },
  };
}

test('Project approval is bound to the actor and fingerprint and is separate from cancellation', async t => {
  const { models } = t.context;
  const prepared = await models.copilotProjectAgentRuntime.prepare({
    ...input(t.context),
    status: 'waiting_approval',
  });
  const scope = { ...input(t.context), runId: prepared.id };
  t.is(
    await models.copilotProjectAgentRuntime.acquire({
      ...scope,
      workerLeaseId: 'unapproved',
    }),
    null
  );
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.approve({
      ...scope,
      targetFingerprint: 'wrong',
    })
  );
  const approved = await models.copilotProjectAgentRuntime.approve({
    ...scope,
    targetFingerprint: prepared.targetFingerprint,
  });
  t.is(approved.status, 'queued');
  t.is(
    approved.steps.find(step => step.stepType === 'approval')?.status,
    'completed'
  );
  t.is(
    (
      await models.copilotProjectAgentRuntime.approve({
        ...scope,
        targetFingerprint: prepared.targetFingerprint,
      })
    ).id,
    approved.id
  );
  await models.copilotProjectAgentRuntime.cancel(scope);
  t.is(
    await models.copilotProjectAgentRuntime.acquire({
      ...scope,
      workerLeaseId: 'cancelled',
    }),
    null
  );
  const cancelled = await models.copilotProjectAgentRuntime.prepare({
    ...input(t.context),
    requestKey: 'reject',
    status: 'waiting_approval',
  });
  await models.copilotProjectAgentRuntime.cancel({
    ...scope,
    runId: cancelled.id,
  });
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.approve({
      ...scope,
      runId: cancelled.id,
      targetFingerprint: cancelled.targetFingerprint,
    })
  );
});

test('Project lease commits the resource and immutable execution evidence together, with no Workspace', async t => {
  const { models, resources, db } = t.context;
  const prepared = await models.copilotProjectAgentRuntime.prepare(
    input(t.context)
  );
  t.is(prepared.workspaceId, null);
  t.is(prepared.steps[0].projectId, t.context.projectId);
  t.is(
    (await models.copilotAgentRuntime.listQueuedStandaloneRuns({})).length,
    0
  );
  t.is(
    await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workerId: 'legacy',
      leaseMs: 10000,
    }),
    null
  );
  const workerLeaseId = 'project-lease-1';
  const run = await models.copilotProjectAgentRuntime.acquire({
    projectId: t.context.projectId,
    runId: prepared.id,
    workerLeaseId,
  });
  t.truthy(run);
  const lease = {
    ...input(t.context),
    runId: prepared.id,
    workerLeaseId,
    workerAttempt: run!.workerAttempt,
  };
  const receipt = await models.copilotProjectAgentRuntime.execute(
    lease,
    async () => {
      const doc = await resources.createDocument({
        ...input(t.context),
        title: 'Document',
        markdown: 'Persistent body',
      });
      return {
        status: 'saved',
        resourceId: doc.id,
        contentVersion: doc.contentVersion,
      };
    }
  );
  const completed = await models.copilotProjectAgentRuntime.get(lease);
  t.is(completed.status, 'completed');
  t.is(completed.projectExecutionResults.length, 1);
  t.is(completed.projectExecutionResults[0].sideEffectMode, 'project_write');
  t.deepEqual(
    (
      completed.projectExecutionResults[0].resultPayload as {
        sideEffectSummary: unknown;
      }
    ).sideEffectSummary,
    receipt
  );
  t.is(
    (await models.copilotProjectAgentRuntime.prepare(input(t.context))).id,
    prepared.id
  );
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.prepare({
      ...input(t.context),
      command: { title: 'Changed' },
    })
  );
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.execute(lease, async () => ({
      invalid: true,
    }))
  );
  await t.throwsAsync(
    db.aiAgentRuntimeExecutionResult.update({
      where: { id: completed.projectExecutionResults[0].id },
      data: { summary: 'Rewritten' },
    })
  );
  await t.throwsAsync(
    db.aiAgentStep.update({
      where: { id: prepared.steps[0].id },
      data: { input: { changed: true } },
    })
  );
  t.is(await db.projectResource.count(), 1);
  t.is(await db.workspace.count(), 0);
  t.is(
    (await models.copilotProjectAgentRuntime.cancel(lease)).status,
    'completed'
  );
});

test('Expired lease handoff rejects the old worker and preserves each timeline', async t => {
  const { models, db } = t.context;
  const prepared = await models.copilotProjectAgentRuntime.prepare(
    input(t.context)
  );
  const scope = { ...input(t.context), runId: prepared.id };
  const old = await models.copilotProjectAgentRuntime.acquire({
    ...scope,
    workerLeaseId: 'old',
    leaseMs: 100,
  });
  await setTimeout(130);
  const next = await models.copilotProjectAgentRuntime.acquire({
    ...scope,
    workerLeaseId: 'new',
  });
  t.is(next?.workerAttempt, 2);
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.execute(
      { ...scope, workerLeaseId: 'old', workerAttempt: old!.workerAttempt },
      async () => ({ invalid: true })
    )
  );
  await models.copilotProjectAgentRuntime.execute(
    { ...scope, workerLeaseId: 'new', workerAttempt: next!.workerAttempt },
    async () => ({ status: 'saved' })
  );
  t.is(await db.aiAgentRuntimeExecutionResult.count(), 1);
  t.true(
    (await models.copilotProjectAgentRuntime.get(scope)).timelineEvents.some(
      e => e.summary === 'Expired Project lease recovered'
    )
  );
});

test('Cooperative cancellation persists and executes zero resource writes', async t => {
  const { models, db } = t.context;
  const prepared = await models.copilotProjectAgentRuntime.prepare(
    input(t.context)
  );
  const scope = { ...input(t.context), runId: prepared.id };
  const run = await models.copilotProjectAgentRuntime.acquire({
    ...scope,
    workerLeaseId: 'cancel-me',
  });
  await models.copilotProjectAgentRuntime.cancel(scope);
  const result = await models.copilotProjectAgentRuntime.execute(
    { ...scope, workerLeaseId: 'cancel-me', workerAttempt: run!.workerAttempt },
    async () => {
      t.fail('Cancelled operation must not run');
      return { invalid: true };
    }
  );
  t.is(result, null);
  t.is(
    (await models.copilotProjectAgentRuntime.get(scope)).status,
    'cancelled'
  );
  t.is(await db.aiAgentRuntimeExecutionResult.count(), 0);
  t.is(await db.projectResource.count(), 0);
});

test('Membership revocation and failed transaction preserve failure evidence without partial resource commits', async t => {
  const { models, db, resources } = t.context;
  const prepared = await models.copilotProjectAgentRuntime.prepare(
    input(t.context)
  );
  const scope = { ...input(t.context), runId: prepared.id };
  const run = await models.copilotProjectAgentRuntime.acquire({
    ...scope,
    workerLeaseId: 'rollback',
  });
  const lease = {
    ...scope,
    workerLeaseId: 'rollback',
    workerAttempt: run!.workerAttempt,
  };
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.execute(lease, async () => {
      await resources.createDocument({
        ...input(t.context),
        title: 'Rollback',
        markdown: 'Must not commit',
      });
      throw new Error('Connection lost before receipt');
    })
  );
  t.is(await db.projectResource.count(), 0);
  await db.aiContextProjectMember.delete({
    where: {
      projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
    },
  });
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.execute(lease, async () => ({
      invalid: true,
    }))
  );
  await models.copilotProjectAgentRuntime.fail(
    lease,
    'authorization_changed',
    'Project membership changed'
  );
  const failed = await db.aiAgentRun.findUniqueOrThrow({
    where: { id: prepared.id },
    include: { projectExecutionResults: true },
  });
  t.is(failed.status, 'failed');
  t.false(failed.projectExecutionResults[0].sideEffectsApplied);
  await t.throwsAsync(models.copilotProjectAgentRuntime.get(scope));
});

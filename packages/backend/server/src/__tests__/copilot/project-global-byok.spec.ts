import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';

import { Config, CryptoHelper, type safeFetch } from '../../base';
import { Models } from '../../models';
import { CopilotAccessPolicy } from '../../plugins/copilot/access';
import { ByokService } from '../../plugins/copilot/byok';
import { ByokProvider } from '../../plugins/copilot/byok/types';
import { CopilotProviderFactory } from '../../plugins/copilot/providers';
import { ModelOutputType } from '../../plugins/copilot/providers/types';
import { CapabilityRuntime } from '../../plugins/copilot/runtime/capability-runtime';
import { PromptRuntime } from '../../plugins/copilot/runtime/prompt-runtime';
import { type MockedUser, MockUser } from '../mocks';
import { createTestingApp, type TestingApp } from '../utils';

const test = ava.serial as TestFn<{
  app: TestingApp;
  models: Models;
  db: PrismaClient;
  byok: ByokService;
  adminId: string;
  ownerId: string;
  admin: MockedUser;
  owner: MockedUser;
  workspaceId: string;
  projectId: string;
  sessionId: string;
  fetch: Sinon.SinonStub;
}>;

test.before(async t => {
  const app = await createTestingApp();
  Object.assign(t.context, {
    app,
    models: app.get(Models),
    db: app.get(PrismaClient),
    byok: app.get(ByokService),
  });
});

test.beforeEach(async t => {
  const { app, db, models, byok } = t.context;
  await app.initTestingDB();
  const owner = await app.create(MockUser);
  const admin = await app.create(MockUser);
  await models.userFeature.add(admin.id, 'administrator', 'Project BYOK test');
  const workspace = await models.workspace.create(owner.id);
  const project = await db.aiContextProject.create({
    data: {
      name: 'Cross-workspace project',
      createdByUserId: owner.id,
      members: { create: { userId: owner.id, role: 'owner' } },
    },
  });
  const prompt = await db.aiPrompt.create({
    data: {
      name: 'Project BYOK test prompt',
      model: 'legacy-workspace-model',
      modified: true,
      messages: { create: { idx: 0, role: 'user', content: 'hello' } },
    },
  });
  const session = await db.aiSession.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      selectedContextProjectId: project.id,
      promptName: prompt.name,
    },
  });
  const fetch = Sinon.stub(
    byok as unknown as { probeFetch: typeof safeFetch },
    'probeFetch'
  ).callsFake(async () => Response.json({ output_text: 'OK' }));
  Object.assign(t.context, {
    admin,
    owner,
    adminId: admin.id,
    ownerId: owner.id,
    workspaceId: workspace.id,
    projectId: project.id,
    sessionId: session.id,
    fetch,
  });
});

test.afterEach.always(() => Sinon.restore());
test.after.always(async t => {
  await t.context.app.close();
});

const config = (expectedRevision = 0) => ({
  expectedRevision,
  provider: ByokProvider.openai,
  apiKey: 'synthetic-project-secret',
  modelId: 'global-project-model',
});

test('admin saves encrypted singleton with immutable, secret-free audit and server probe', async t => {
  const { byok, adminId, db, app, fetch } = t.context;
  const preview = await byok.testProjectConfig(config(), adminId);
  t.true(preview.ok);
  t.is(await db.aiProjectByokConfig.count(), 0);
  const saved = await byok.saveProjectConfig(config(), adminId);
  t.is(fetch.callCount, 2);
  t.is(saved.revision, 1);
  t.true(saved.enabled);
  const persisted = await db.aiProjectByokConfig.findUniqueOrThrow({
    where: { id: 'global' },
  });
  t.not(persisted.encryptedApiKey, config().apiKey);
  t.is(
    app.get(CryptoHelper).decrypt(persisted.encryptedApiKey),
    config().apiKey
  );
  t.false(JSON.stringify(saved).includes(config().apiKey));
  t.false(JSON.stringify(saved).includes(persisted.encryptedApiKey));
  t.is(saved.auditEvents[0].actorId, adminId);
  await t.throwsAsync(
    db.aiProjectByokAuditEvent.updateMany({ data: { enabled: false } })
  );
  await t.throwsAsync(db.aiProjectByokAuditEvent.deleteMany());
  await t.throwsAsync(
    db.aiProjectByokConfig.create({
      data: { ...persisted, id: 'workspace-disguised-as-global' },
    })
  );
});

test('ordinary workspace owner cannot read, test, save, or disable global BYOK', async t => {
  const { byok, ownerId, fetch } = t.context;
  for (const call of [
    () => byok.getAdminProjectSettings(ownerId),
    () => byok.testProjectConfig(config(), ownerId),
    () => byok.saveProjectConfig(config(), ownerId),
    () => byok.setProjectConfigEnabled(0, false, ownerId),
  ])
    await t.throwsAsync(call, {
      message: 'BYOK settings require an instance administrator.',
    });
  t.is(fetch.callCount, 0);
});

test('failed probe, secret-bearing endpoints and stale saves preserve the active configuration', async t => {
  const { byok, adminId, fetch, db } = t.context;
  await byok.saveProjectConfig(config(), adminId);
  fetch.rejects(
    new Error('Authorization: synthetic-project-secret; private response')
  );
  await t.throwsAsync(
    byok.saveProjectConfig({ ...config(1), modelId: 'broken' }, adminId),
    {
      message:
        'Project provider test failed. Check the endpoint, model and API key.',
    }
  );
  await t.throwsAsync(byok.saveProjectConfig(config(), adminId), {
    message: /changed/,
  });
  t.is(
    (await db.aiProjectByokConfig.findFirstOrThrow()).modelId,
    'global-project-model'
  );
  t.is(await db.aiProjectByokAuditEvent.count(), 1);
  Sinon.stub(byok, 'customEndpointSupported').get(() => true);
  for (const endpoint of [
    'https://user:secret@example.com/v1',
    'https://example.com/v1?key=secret',
    'https://example.com/v1#secret',
  ]) {
    await t.throwsAsync(
      byok.saveProjectConfig({ ...config(1), endpoint }, adminId),
      { message: /must not contain/ }
    );
  }
});

test('concurrent administrator saves allow one revision and retain both audit versions', async t => {
  const { byok, adminId, db } = t.context;
  await byok.saveProjectConfig(config(), adminId);
  const results = await Promise.allSettled([
    byok.saveProjectConfig({ ...config(1), modelId: 'model-a' }, adminId),
    byok.saveProjectConfig({ ...config(1), modelId: 'model-b' }, adminId),
  ]);
  t.is(results.filter(result => result.status === 'fulfilled').length, 1);
  t.is(await db.aiProjectByokAuditEvent.count(), 2);
  t.is((await db.aiProjectByokConfig.findFirstOrThrow()).revision, 2);
});

test('different projects and session workspaces use the same global credential, ignoring workspace profiles and local leases', async t => {
  const { byok, adminId, ownerId, workspaceId, sessionId, models, db } =
    t.context;
  await byok.saveProjectConfig(config(), adminId);
  const workspaceTwo = await models.workspace.create(ownerId);
  const projectTwo = await db.aiContextProject.create({
    data: {
      name: 'Project two',
      members: { create: { userId: ownerId, role: 'owner' } },
    },
  });
  const original = await db.aiSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const sessionTwo = await db.aiSession.create({
    data: {
      userId: ownerId,
      workspaceId: workspaceTwo.id,
      promptName: original.promptName,
      selectedContextProjectId: projectTwo.id,
    },
  });
  const workspaceLookup = Sinon.spy(
    models.copilotWorkspaceByokConfig,
    'listEnabled'
  );
  const profileLookup = Sinon.spy(models.copilotAiProfile, 'getUserAssignment');
  const first = await byok.getProfiles({
    userId: ownerId,
    workspaceId,
    sessionId,
    byokLeaseId: 'ignored',
  });
  const second = await byok.getProfiles({
    userId: ownerId,
    workspaceId: workspaceTwo.id,
    sessionId: sessionTwo.id,
  });
  const withoutWorkspace = await byok.getProfiles({
    userId: ownerId,
    projectId: projectTwo.id,
  });
  t.deepEqual(first, second);
  t.deepEqual(second, withoutWorkspace);
  t.is(first[0].source, 'byok_project_global');
  t.deepEqual(first[0].models, ['global-project-model']);
  t.is(workspaceLookup.callCount, 0);
  t.is(profileLookup.callCount, 0);
});

test('project routes ignore stale client model selection and workspace route policy', async t => {
  const { byok, adminId, ownerId, workspaceId, sessionId, app } = t.context;
  await byok.saveProjectConfig(config(), adminId);
  const factory = app.get(CopilotProviderFactory);
  const applicationConfig = app.get(Config);
  const originalPolicy = applicationConfig.copilot.providers.routePolicy;
  applicationConfig.copilot.providers.routePolicy = {
    enabled: true,
    byWorkspace: {
      [workspaceId]: { allowedProviderIds: ['unrelated-workspace-provider'] },
    },
  };
  t.teardown(() => {
    applicationConfig.copilot.providers.routePolicy = originalPolicy;
  });
  const routes = await factory.resolveRoutes(
    { modelId: 'legacy-workspace-model', outputType: ModelOutputType.Text },
    {},
    { userId: ownerId, workspaceId, sessionId, featureKind: 'chat' }
  );
  t.is(routes.length, 1);
  t.is(routes[0].profile.source, 'byok_project_global');
  t.is(routes[0].modelId, 'global-project-model');
  const scope = await factory.getEffectiveModelSelectionScope({
    userId: ownerId,
    sessionId,
  });
  t.deepEqual(scope.configuredModelIds, [
    'byok-project-global-openai-r1/global-project-model',
  ]);
  const prepared = await factory.prepareRoutes(
    'streamText',
    { modelId: 'legacy-workspace-model', outputType: ModelOutputType.Text },
    [{ role: 'user', content: 'hello' }],
    { user: ownerId, workspace: workspaceId, session: sessionId }
  );
  t.is(prepared.length, 1);
  t.is(prepared[0].profile.source, 'byok_project_global');
  t.is(prepared[0].modelId, 'global-project-model');
  const text = Sinon.stub(app.get(CapabilityRuntime), 'text').resolves('ok');
  await app.get(PromptRuntime).runText(
    'Project BYOK test prompt',
    {},
    {
      modelId: 'legacy-workspace-model',
      providerOptions: {
        user: ownerId,
        workspace: workspaceId,
        session: sessionId,
      },
    }
  );
  t.is(text.firstCall.args[0].modelId, 'global-project-model');
  t.is(text.firstCall.args[2]?.session, sessionId);
});

test('missing or disabled global BYOK never falls back and later turns reload the latest revision', async t => {
  const { app, byok, adminId, ownerId, workspaceId, sessionId, fetch } =
    t.context;
  const context = {
    userId: ownerId,
    workspaceId,
    sessionId,
    featureKind: 'chat' as const,
  };
  await t.throwsAsync(
    app.get(CopilotAccessPolicy).resolveTurnRouteAccess(context)
  );
  await byok.saveProjectConfig(config(), adminId);
  const first = await byok.getProfiles(context);
  fetch.rejects(new Error('offline'));
  await byok.setProjectConfigEnabled(1, false, adminId);
  t.deepEqual(await byok.getProfiles(context), []);
  await t.throwsAsync(
    app.get(CopilotAccessPolicy).resolveTurnRouteAccess(context)
  );
  await t.throwsAsync(byok.setProjectConfigEnabled(2, true, adminId));
  fetch.callsFake(async () => Response.json({ output_text: 'OK' }));
  await byok.saveProjectConfig(
    { ...config(2), modelId: 'rotated-model', apiKey: undefined },
    adminId
  );
  const latest = await byok.getProfiles(context);
  t.not(first[0].id, latest[0].id);
  t.deepEqual(latest[0].models, ['rotated-model']);
  await byok.recordProviderFailure({
    workspaceId,
    providerId: first[0].id,
    featureKind: 'chat',
    error: new Error('old request'),
  });
  t.is((await byok.getAdminProjectSettings(adminId)).lastError, null);
});

test('revoked membership, archived projects, forged actor or workspace and deleted sessions cannot consume global BYOK', async t => {
  const { byok, adminId, ownerId, workspaceId, projectId, sessionId, db } =
    t.context;
  await byok.saveProjectConfig(config(), adminId);
  await t.throwsAsync(byok.getProfiles({ userId: adminId, sessionId }));
  await t.throwsAsync(
    byok.getProfiles({ userId: ownerId, workspaceId: 'forged', sessionId })
  );
  await t.throwsAsync(
    byok.getProfiles({ userId: ownerId, sessionId: 'missing' })
  );
  await db.aiContextProject.update({
    where: { id: projectId },
    data: { status: 'archived' },
  });
  await t.throwsAsync(byok.getProfiles({ userId: ownerId, sessionId }));
  await db.aiContextProject.update({
    where: { id: projectId },
    data: { status: 'active' },
  });
  await db.aiContextProjectMember.create({
    data: { projectId, userId: adminId, role: 'owner' },
  });
  await db.aiContextProjectMember.delete({
    where: { projectId_userId: { projectId, userId: ownerId } },
  });
  await t.throwsAsync(
    byok.getProfiles({ userId: ownerId, workspaceId, sessionId })
  );
  await db.aiSession.update({
    where: { id: sessionId },
    data: { deletedAt: new Date() },
  });
  await t.throwsAsync(byok.getProfiles({ userId: ownerId, sessionId }));
});

test('GraphQL restricts global settings to administrators and exposes only model metadata to project members', async t => {
  const { app, projectId, owner, admin } = t.context;
  await app.login(admin);
  const probe = await app
    .POST('/graphql')
    .send({
      query: testProjectByokConfigMutation.query,
      variables: { input: config() },
    })
    .expect(200);
  t.true(probe.body.data?.testProjectByokConfig.ok);
  const saved = await app
    .POST('/graphql')
    .send({
      query: saveProjectByokConfigMutation.query,
      variables: { input: config() },
    })
    .expect(200);
  t.is(saved.body.data?.saveProjectByokConfig.revision, 1);
  t.false(JSON.stringify(saved.body).includes(config().apiKey));
  await app.login(owner);
  const denied = await app
    .POST('/graphql')
    .send({ query: adminProjectByokSettingsQuery.query })
    .expect(200);
  t.is(denied.body.errors?.[0]?.extensions?.name, 'ACTION_FORBIDDEN');
  const result = await app
    .POST('/graphql')
    .send({
      query: projectAiModelQuery.query,
      variables: { projectId },
    })
    .expect(200);
  t.deepEqual(result.body.data?.projectAiModel, {
    configured: true,
    modelId: 'global-project-model',
    provider: 'openai',
  });
  t.false(JSON.stringify(result.body).includes(config().apiKey));
  const mutation = await app
    .POST('/graphql')
    .send({
      query: setProjectByokEnabledMutation.query,
      variables: { expectedRevision: 1, enabled: false },
    })
    .expect(200);
  t.is(mutation.body.errors?.[0]?.extensions?.name, 'ACTION_FORBIDDEN');
  await app.login(admin);
  const allowed = await app
    .POST('/graphql')
    .send({
      query: adminProjectByokSettingsQuery.query,
    })
    .expect(200);
  t.is(allowed.body.data?.adminProjectByokSettings.revision, 1);
  const disabled = await app
    .POST('/graphql')
    .send({
      query: setProjectByokEnabledMutation.query,
      variables: { expectedRevision: 1, enabled: false },
    })
    .expect(200);
  t.false(disabled.body.data?.setProjectByokEnabled.enabled);
  const noMembership = await app
    .POST('/graphql')
    .send({
      query: projectAiModelQuery.query,
      variables: { projectId },
    })
    .expect(200);
  t.is(noMembership.body.errors?.[0]?.extensions?.name, 'ACTION_FORBIDDEN');
});
import {
  adminProjectByokSettingsQuery,
  projectAiModelQuery,
  saveProjectByokConfigMutation,
  setProjectByokEnabledMutation,
  testProjectByokConfigMutation,
} from '@affine/graphql';

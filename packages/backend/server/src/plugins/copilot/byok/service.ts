import { createHash, createHmac, randomUUID } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import {
  BadRequest,
  Cache,
  Config,
  CopilotSessionNotFound,
  CryptoHelper,
  metrics,
  safeFetch,
} from '../../../base';
import { Models } from '../../../models';
import type { CopilotModelDefinition, CopilotProviderProfile } from '../config';
import { ModelInputType, ModelOutputType } from '../providers/types';
import { ByokEntitlementPolicy } from './policy';
import { runProviderProbe } from './probe';
import { AiProfileService } from './profile-service';
import {
  BYOK_ALLOWED_PROVIDERS,
  type ByokFeatureKind,
  ByokKeyStorage,
  ByokKeyTestStatus,
  ByokProvider,
  ByokProviderSource,
  byokProviderToCopilotType,
  isByokProvider,
} from './types';

const LOCAL_LEASE_TTL_MS = 10 * 60 * 1000;
const BYOK_PROFILE_PRIORITY_BASE = 10_000;
const SERVER_PROFILE_PRIORITY_OFFSET = 2_000;

export type ByokProviderRequestContext = {
  userId?: string;
  workspaceId?: string;
  byokLeaseId?: string;
  sessionId?: string;
  projectId?: string;
};

export type ProjectByokInput = {
  expectedRevision: number;
  provider: ByokProvider;
  apiKey?: string | null;
  endpoint?: string | null;
  modelId: string;
};

export type ByokProfileSourceFilter = {
  local?: boolean;
  server?: boolean;
};

export type ByokKeyConfig = {
  id: string;
  provider: ByokProvider;
  name: string;
  description: string | null;
  storage: ByokKeyStorage;
  configured: boolean;
  enabled: boolean;
  endpoint: string | null;
  modelId: string | null;
  endpointEditable: boolean;
  sortOrder: number;
  capabilities: string[];
  testStatus: ByokKeyTestStatus;
  disabledReason: string | null;
  lastTestedAt: Date | null;
  lastTestError: string | null;
  lastUsedAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
};

export type ByokSettings = {
  workspaceId: string;
  entitled: boolean;
  serverEntitled: boolean;
  localEntitled: boolean;
  entitlementRequired: string[];
  keys: ByokKeyConfig[];
  allowedProviders: ByokProvider[];
  localStorageSupported: boolean;
  customEndpointSupported: boolean;
  privateEndpointSupported: boolean;
  hasAiPlan: boolean;
  warnings: Array<{
    featureKind: string;
    reason: string;
    requiredProviders: ByokProvider[];
  }>;
};

export type AdminByokWorkspaceScope = {
  id: string;
  name: string | null;
  enableAi: boolean;
  memberCount: number;
};

type UpsertByokConfigInput = {
  id?: string | null;
  workspaceId: string;
  provider: ByokProvider;
  name: string;
  description?: string | null;
  storage: ByokKeyStorage;
  apiKey?: string | null;
  endpoint?: string | null;
  modelId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean | null;
  userId?: string;
};

type ReorderByokConfigsInput = {
  workspaceId: string;
  storage: ByokKeyStorage;
  ids: string[];
  userId?: string;
};

type TestByokConfigInput = {
  workspaceId: string;
  provider: ByokProvider;
  storage: ByokKeyStorage;
  apiKey?: string | null;
  endpoint?: string | null;
  modelId?: string | null;
  configId?: string | null;
  userId?: string;
};

export type ByokLocalLeaseProvider = {
  provider: ByokProvider;
  name: string;
  description?: string | null;
  apiKey: string;
  endpoint?: string | null;
  modelId?: string | null;
  sortOrder?: number | null;
  enabled?: boolean | null;
};

type LocalLeasePayload = {
  workspaceId: string;
  userId: string;
  providers: Array<
    Omit<ByokLocalLeaseProvider, 'apiKey'> & { encryptedApiKey: string }
  >;
};

type LocalLeaseActive = {
  leaseId: string;
  expiresAt: string;
};

type ByokProfileMeta = {
  source:
    | ByokProviderSource.Server
    | ByokProviderSource.Local
    | ByokProviderSource.ProjectGlobal;
  keyId?: string;
  revision?: number;
  provider: ByokProvider;
};

@Injectable()
export class ByokService {
  private readonly probeFetch = safeFetch;

  constructor(
    private readonly models: Models,
    private readonly crypto: CryptoHelper,
    private readonly cache: Cache,
    private readonly entitlement: ByokEntitlementPolicy,
    private readonly profiles: AiProfileService,
    private readonly config: Config
  ) {}

  get customEndpointSupported() {
    return env.selfhosted && this.config.copilot.byok.allowCustomEndpoint;
  }

  get privateEndpointSupported() {
    return (
      this.customEndpointSupported &&
      this.config.copilot.byok.allowPrivateEndpoint
    );
  }

  async getAdminProjectSettings(userId: string) {
    await this.entitlement.assertInstanceManagementAccess(userId);
    const [current, auditEvents] = await Promise.all([
      this.models.copilotProjectByok.get(),
      this.models.copilotProjectByok.listAuditEvents(),
    ]);
    return {
      configured: Boolean(current),
      revision: current?.revision ?? 0,
      provider: current?.provider ?? ByokProvider.openai,
      endpoint: current?.endpoint ?? null,
      modelId: current?.modelId ?? null,
      enabled: current?.enabled ?? false,
      lastValidatedAt: current?.lastValidatedAt ?? null,
      lastUsedAt: current?.lastUsedAt ?? null,
      lastError: current?.lastError ?? null,
      updatedAt: current?.updatedAt ?? null,
      updatedBy: current?.updatedBy ?? null,
      allowedProviders: [
        ByokProvider.openai,
        ByokProvider.anthropic,
        ByokProvider.gemini,
      ],
      customEndpointSupported: this.customEndpointSupported,
      auditEvents,
    };
  }

  private async prepareProjectConfig(input: ProjectByokInput, userId: string) {
    await this.entitlement.assertInstanceManagementAccess(userId);
    this.assertProvider(input.provider);
    if (input.provider === ByokProvider.fal) {
      throw new BadRequestException('Project BYOK requires a text provider.');
    }
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    ) {
      throw new BadRequestException('Invalid Project BYOK revision.');
    }
    const current = await this.models.copilotProjectByok.get();
    if ((current?.revision ?? 0) !== input.expectedRevision) {
      throw new BadRequest(
        'Project BYOK changed. Reload the settings and try again.'
      );
    }
    const apiKey = input.apiKey?.trim();
    if (apiKey && apiKey.length > 8192) {
      throw new BadRequestException('API key is too long.');
    }
    if (!apiKey && (!current || current.provider !== input.provider)) {
      throw new BadRequestException(
        'An API key is required for this provider.'
      );
    }
    const encryptedApiKey = apiKey
      ? this.crypto.encrypt(apiKey)
      : current?.encryptedApiKey;
    if (!encryptedApiKey) {
      throw new BadRequestException(
        'An API key is required for this provider.'
      );
    }
    const endpoint = this.normalizeEndpoint(input.endpoint);
    if (endpoint) {
      const url = new URL(endpoint);
      if (
        endpoint.length > 2048 ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new BadRequestException(
          'Endpoint must not contain credentials, a query, or a fragment.'
        );
      }
    }
    const modelId = this.normalizeModelId(input.modelId);
    if (!modelId) throw new BadRequestException('Model ID is required.');
    return {
      current,
      encryptedApiKey,
      endpoint,
      modelId,
      credentialChanged: Boolean(apiKey),
    };
  }

  private async probeProjectConfig(input: {
    provider: ByokProvider;
    encryptedApiKey: string;
    endpoint: string | null;
    modelId: string;
  }) {
    try {
      await runProviderProbe(
        this.probeFetch,
        input.provider,
        this.crypto.decrypt(input.encryptedApiKey),
        input.endpoint,
        this.privateEndpointSupported,
        input.modelId
      );
    } catch {
      // Provider errors can contain authorization headers or response bodies.
      throw new BadRequestException(
        'Project provider test failed. Check the endpoint, model and API key.'
      );
    }
  }

  async testProjectConfig(input: ProjectByokInput, userId: string) {
    const prepared = await this.prepareProjectConfig(input, userId);
    try {
      await this.probeProjectConfig({ ...prepared, provider: input.provider });
      return { ok: true, message: null };
    } catch {
      return {
        ok: false,
        message:
          'Project provider test failed. Check the endpoint, model and API key.',
      };
    }
  }

  async saveProjectConfig(input: ProjectByokInput, userId: string) {
    const prepared = await this.prepareProjectConfig(input, userId);
    await this.probeProjectConfig({ ...prepared, provider: input.provider });
    await this.models.copilotProjectByok.save({
      ...prepared,
      expectedRevision: input.expectedRevision,
      provider: input.provider,
      enabled: true,
      lastValidatedAt: new Date(),
      actorId: userId,
    });
    return this.getAdminProjectSettings(userId);
  }

  async setProjectConfigEnabled(
    expectedRevision: number,
    enabled: boolean,
    userId: string
  ) {
    await this.entitlement.assertInstanceManagementAccess(userId);
    const current = await this.models.copilotProjectByok.get();
    if (!current || current.revision !== expectedRevision) {
      throw new BadRequest(
        'Project BYOK changed. Reload the settings and try again.'
      );
    }
    if (enabled) {
      await this.probeProjectConfig({
        ...current,
        provider: current.provider as ByokProvider,
      });
    }
    await this.models.copilotProjectByok.save({
      ...current,
      expectedRevision,
      enabled,
      lastValidatedAt: enabled ? new Date() : current.lastValidatedAt,
      actorId: userId,
      credentialChanged: false,
    });
    return this.getAdminProjectSettings(userId);
  }

  async getSettings(
    workspaceId: string,
    userId?: string
  ): Promise<ByokSettings> {
    if (!(await this.entitlement.hasManagementAccess(workspaceId, userId))) {
      return {
        workspaceId,
        entitled: false,
        serverEntitled: false,
        localEntitled: false,
        entitlementRequired: ['Workspace owner or admin'],
        keys: [],
        allowedProviders: [...BYOK_ALLOWED_PROVIDERS],
        localStorageSupported: false,
        customEndpointSupported: this.customEndpointSupported,
        privateEndpointSupported: this.privateEndpointSupported,
        hasAiPlan: await this.entitlement.hasAiPlan(userId),
        warnings: [],
      };
    }

    return await this.getAuthorizedSettings(workspaceId, userId);
  }

  private async getAuthorizedSettings(
    workspaceId: string,
    userId?: string
  ): Promise<ByokSettings> {
    const [serverEntitled, localEntitled] =
      await this.entitlement.hasEntitlement(workspaceId, userId);
    const entitled = serverEntitled || localEntitled;
    if (!entitled) {
      return {
        workspaceId,
        entitled: false,
        serverEntitled: false,
        localEntitled: false,
        entitlementRequired: ['Pro', 'Team', 'Believer'],
        keys: [],
        allowedProviders: [...BYOK_ALLOWED_PROVIDERS],
        localStorageSupported: false,
        customEndpointSupported: this.customEndpointSupported,
        privateEndpointSupported: this.privateEndpointSupported,
        hasAiPlan: await this.entitlement.hasAiPlan(userId),
        warnings: [],
      };
    }

    const rows = serverEntitled
      ? await this.models.copilotWorkspaceByokConfig.list(workspaceId)
      : [];
    const keys = rows.map(row => this.toKeyConfig(row));

    return {
      workspaceId,
      entitled: true,
      serverEntitled,
      localEntitled,
      entitlementRequired: ['Pro', 'Team', 'Believer'],
      keys,
      allowedProviders: [...BYOK_ALLOWED_PROVIDERS],
      localStorageSupported: false,
      customEndpointSupported: this.customEndpointSupported,
      privateEndpointSupported: this.privateEndpointSupported,
      hasAiPlan: await this.entitlement.hasAiPlan(userId),
      warnings: this.buildWarnings(keys),
    };
  }

  async listAdminWorkspaceScopes(input: {
    userId: string;
    keyword?: string | null;
    first?: number | null;
  }): Promise<AdminByokWorkspaceScope[]> {
    await this.entitlement.assertInstanceManagementAccess(input.userId);
    const first = Math.min(Math.max(input.first ?? 100, 1), 200);
    const { rows } = await this.models.workspace.adminListWorkspaces({
      skip: 0,
      first,
      keyword: input.keyword,
      order: 'createdAt',
      includeTotal: false,
    });
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      enableAi: row.enableAi,
      memberCount: row.memberCount,
    }));
  }

  async getAdminSettings(workspaceId: string, userId: string) {
    await this.entitlement.assertInstanceManagementAccess(userId);
    await this.assertWorkspaceExists(workspaceId);
    return await this.getAuthorizedSettings(workspaceId, userId);
  }

  async getAdminUsage(
    workspaceId: string,
    from: Date,
    to: Date,
    userId: string
  ) {
    await this.entitlement.assertInstanceManagementAccess(userId);
    await this.assertWorkspaceExists(workspaceId);
    return await this.getUsage(workspaceId, from, to);
  }

  async testAdminConfig(input: TestByokConfigInput & { userId: string }) {
    await this.entitlement.assertInstanceManagementAccess(input.userId);
    await this.assertWorkspaceExists(input.workspaceId);
    if (input.storage !== ByokKeyStorage.server) {
      throw new BadRequestException(
        'Instance administrators may only test server BYOK keys.'
      );
    }
    return await this.testAuthorizedConfig(input);
  }

  async upsertAdminConfig(input: UpsertByokConfigInput & { userId: string }) {
    await this.entitlement.assertInstanceManagementAccess(input.userId);
    await this.assertWorkspaceExists(input.workspaceId);
    return await this.upsertAuthorizedConfig(input);
  }

  async reorderAdminConfigs(
    input: ReorderByokConfigsInput & { userId: string }
  ) {
    await this.entitlement.assertInstanceManagementAccess(input.userId);
    await this.assertWorkspaceExists(input.workspaceId);
    return await this.reorderAuthorizedConfigs(input);
  }

  async deleteAdminConfig(workspaceId: string, id: string, userId: string) {
    await this.entitlement.assertInstanceManagementAccess(userId);
    await this.assertWorkspaceExists(workspaceId);
    return await this.deleteAuthorizedConfig(workspaceId, id);
  }

  async clearAdminConfigs(
    workspaceId: string,
    provider: ByokProvider | null | undefined,
    userId: string
  ) {
    await this.entitlement.assertInstanceManagementAccess(userId);
    await this.assertWorkspaceExists(workspaceId);
    return await this.clearAuthorizedConfigs(workspaceId, provider);
  }

  async upsertConfig(input: UpsertByokConfigInput): Promise<ByokKeyConfig> {
    await this.entitlement.assertManagementAccess(
      input.workspaceId,
      input.userId
    );
    return await this.upsertAuthorizedConfig(input);
  }

  private async upsertAuthorizedConfig(
    input: UpsertByokConfigInput
  ): Promise<ByokKeyConfig> {
    await this.entitlement.assertServerEntitled(input.workspaceId);
    this.assertProvider(input.provider);
    if (input.storage !== ByokKeyStorage.server) {
      throw new BadRequestException('Only server BYOK keys are persisted.');
    }
    const existing = input.id
      ? await this.models.copilotWorkspaceByokConfig.get(input.id)
      : null;
    if (input.id && (!existing || existing.workspaceId !== input.workspaceId)) {
      throw new BadRequest('BYOK config not found.');
    }
    const encryptedApiKey = input.apiKey
      ? this.crypto.encrypt(input.apiKey)
      : undefined;

    if (!input.id && !encryptedApiKey) {
      throw new BadRequestException('apiKey is required.');
    }

    const description =
      input.description !== undefined
        ? input.description?.trim() || null
        : (existing?.description ?? null);
    const endpoint =
      input.endpoint !== undefined
        ? this.normalizeEndpoint(input.endpoint)
        : (existing?.endpoint ?? null);
    const modelId =
      input.modelId !== undefined
        ? (this.normalizeModelId(input.modelId) ?? null)
        : (existing?.modelId ?? null);
    const sortOrder = input.sortOrder ?? existing?.sortOrder ?? 0;
    const enabled = input.enabled ?? existing?.enabled ?? true;

    const row = await this.models.copilotWorkspaceByokConfig.upsert({
      id: input.id,
      workspaceId: input.workspaceId,
      provider: input.provider,
      name: input.name.trim(),
      description,
      encryptedApiKey,
      endpoint,
      modelId,
      sortOrder,
      enabled,
      userId: input.userId,
    });

    return this.toKeyConfig(row);
  }

  async reorderConfigs(input: ReorderByokConfigsInput) {
    await this.entitlement.assertManagementAccess(
      input.workspaceId,
      input.userId
    );
    return await this.reorderAuthorizedConfigs(input);
  }

  private async reorderAuthorizedConfigs(input: ReorderByokConfigsInput) {
    await this.entitlement.assertServerEntitled(input.workspaceId);
    if (input.storage !== ByokKeyStorage.server) {
      throw new BadRequestException('Only server BYOK keys are persisted.');
    }
    await this.models.copilotWorkspaceByokConfig.reorder(
      input.workspaceId,
      input.ids,
      input.userId
    );
    return (
      await this.models.copilotWorkspaceByokConfig.list(input.workspaceId)
    ).map(row => this.toKeyConfig(row));
  }

  async deleteConfig(workspaceId: string, id: string, _userId?: string) {
    await this.entitlement.assertManagementAccess(workspaceId, _userId);
    return await this.deleteAuthorizedConfig(workspaceId, id);
  }

  private async deleteAuthorizedConfig(workspaceId: string, id: string) {
    await this.entitlement.assertServerEntitled(workspaceId);
    await this.models.copilotWorkspaceByokConfig.delete(workspaceId, id);
    return true;
  }

  async clearConfigs(
    workspaceId: string,
    provider: ByokProvider | null | undefined,
    _userId?: string
  ) {
    await this.entitlement.assertManagementAccess(workspaceId, _userId);
    return await this.clearAuthorizedConfigs(workspaceId, provider);
  }

  private async clearAuthorizedConfigs(
    workspaceId: string,
    provider: ByokProvider | null | undefined
  ) {
    await this.entitlement.assertServerEntitled(workspaceId);
    await this.models.copilotWorkspaceByokConfig.clear(workspaceId, provider);
    return true;
  }

  async testConfig(input: TestByokConfigInput) {
    await this.entitlement.assertManagementAccess(
      input.workspaceId,
      input.userId
    );
    return await this.testAuthorizedConfig(input);
  }

  private async testAuthorizedConfig(input: TestByokConfigInput) {
    if (input.storage === ByokKeyStorage.server) {
      await this.entitlement.assertServerEntitled(input.workspaceId);
    } else {
      await this.entitlement.assertLocalEntitled(
        input.workspaceId,
        input.userId
      );
    }
    this.assertProvider(input.provider);
    let apiKey = input.apiKey;
    let endpoint = this.normalizeEndpoint(input.endpoint);
    let modelId = this.normalizeModelId(input.modelId);
    if (!apiKey && input.configId && input.storage === ByokKeyStorage.server) {
      const config = await this.models.copilotWorkspaceByokConfig.get(
        input.configId
      );
      if (
        !config ||
        config.workspaceId !== input.workspaceId ||
        config.provider !== input.provider
      ) {
        throw new BadRequestException('BYOK config not found.');
      }
      apiKey = this.crypto.decrypt(config.encryptedApiKey);
      endpoint =
        input.endpoint !== undefined
          ? endpoint
          : this.normalizeEndpoint(config.endpoint);
      modelId =
        input.modelId !== undefined
          ? modelId
          : this.normalizeModelId(config.modelId);
    }
    if (!apiKey) {
      throw new BadRequestException('apiKey is required.');
    }

    try {
      await runProviderProbe(
        this.probeFetch,
        input.provider,
        apiKey,
        endpoint,
        this.privateEndpointSupported,
        modelId
      );
      if (input.configId && input.storage === ByokKeyStorage.server) {
        await this.models.copilotWorkspaceByokConfig.markValidated(
          input.workspaceId,
          input.configId,
          input.userId
        );
      }
      metrics.ai.counter('byok_test_key').add(1, {
        workspace: input.workspaceId,
        provider: input.provider,
        storage: input.storage,
        result: 'passed',
      });
      return { ok: true, status: ByokKeyTestStatus.passed, message: null };
    } catch (error) {
      const message = this.sanitizeError(error);
      if (input.configId && input.storage === ByokKeyStorage.server) {
        await this.models.copilotWorkspaceByokConfig.markFailure(
          input.workspaceId,
          input.configId,
          message
        );
      }
      metrics.ai.counter('byok_test_key').add(1, {
        workspace: input.workspaceId,
        provider: input.provider,
        storage: input.storage,
        result: 'failed',
      });
      return { ok: false, status: ByokKeyTestStatus.failed, message };
    }
  }

  async createLocalLease(input: {
    workspaceId: string;
    providers: ByokLocalLeaseProvider[];
    userId: string;
  }) {
    await this.entitlement.assertManagementAccess(
      input.workspaceId,
      input.userId
    );
    await this.entitlement.assertLocalEntitled(input.workspaceId, input.userId);
    const providers = input.providers.map(provider => {
      this.assertProvider(provider.provider);
      const endpoint = this.normalizeEndpoint(provider.endpoint);
      const modelId = this.normalizeModelId(provider.modelId);
      return { ...provider, endpoint, modelId };
    });
    const activeCacheKey = this.localLeaseActiveCacheKey({
      ...input,
      providers,
    });
    const activeLease = await this.getActiveLocalLease(activeCacheKey);
    if (activeLease) return activeLease;

    const leaseId = randomUUID();
    const expiresAt = new Date(Date.now() + LOCAL_LEASE_TTL_MS);
    const payload: LocalLeasePayload = {
      workspaceId: input.workspaceId,
      userId: input.userId,
      providers: providers.map(provider => ({
        provider: provider.provider,
        name: provider.name,
        description: provider.description,
        encryptedApiKey: this.crypto.encrypt(provider.apiKey),
        endpoint: provider.endpoint,
        modelId: provider.modelId,
        sortOrder: provider.sortOrder,
        enabled: provider.enabled,
      })),
    };
    await this.cache.set(this.leaseCacheKey(leaseId), payload, {
      ttl: LOCAL_LEASE_TTL_MS,
    });
    const registered = await this.cache.setnx<LocalLeaseActive>(
      activeCacheKey,
      { leaseId, expiresAt: expiresAt.toISOString() },
      { ttl: LOCAL_LEASE_TTL_MS }
    );
    if (!registered) {
      const current = await this.getActiveLocalLease(activeCacheKey);
      if (current) {
        await this.cache.delete(this.leaseCacheKey(leaseId));
        return current;
      }
    }
    return { leaseId, expiresAt };
  }

  async getProfiles(
    context: ByokProviderRequestContext = {},
    sources: ByokProfileSourceFilter = { local: true, server: true }
  ): Promise<CopilotProviderProfile[]> {
    if (!sources.local && !sources.server) return [];
    let projectId = context.projectId;
    if (context.sessionId) {
      const session = await this.models.copilotSession.getMeta(
        context.sessionId
      );
      if (
        !session ||
        !context.userId ||
        session.userId !== context.userId ||
        (context.workspaceId && session.workspaceId !== context.workspaceId) ||
        (projectId && session.selectedContextProjectId !== projectId)
      ) {
        throw new CopilotSessionNotFound();
      }
      projectId = session.selectedContextProjectId ?? undefined;
    }
    if (projectId) {
      await this.models.copilotProjectByok.assertProjectMember(
        projectId,
        context.userId
      );
      const row = await this.models.copilotProjectByok.get();
      if (!row?.enabled || !isByokProvider(row.provider)) return [];
      return [
        {
          id: `byok-project-global-${row.provider}-r${row.revision}`,
          type: byokProviderToCopilotType(row.provider),
          source: ByokProviderSource.ProjectGlobal,
          priority: BYOK_PROFILE_PRIORITY_BASE,
          models: [row.modelId],
          modelDefinitions: [this.modelDefinition(row.provider, row.modelId)],
          config: this.providerConfig(
            row.provider,
            row.encryptedApiKey,
            row.endpoint
          ),
        } as CopilotProviderProfile,
      ];
    }
    if (!context.workspaceId) {
      return [];
    }
    const [localEntitled, serverEntitled] = await Promise.all([
      this.entitlement.hasLocalEntitlement(context.workspaceId, context.userId),
      this.entitlement.hasServerEntitlement(context.workspaceId),
    ]);
    const [localProfiles, serverProfiles] = await Promise.all([
      sources.local && localEntitled
        ? this.getLocalProfiles(context)
        : Promise.resolve([]),
      sources.server && serverEntitled
        ? this.getServerProfiles(context.workspaceId, context.userId)
        : Promise.resolve([]),
    ]);

    return [...localProfiles, ...serverProfiles];
  }

  async recordUsage(input: {
    workspaceId?: string;
    userId?: string;
    providerId?: string;
    model?: string | null;
    featureKind: ByokFeatureKind;
    sessionId?: string;
    taskId?: string;
    actionId?: string;
    billingUnitId?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      cached_tokens?: number;
    };
  }) {
    if (!input.workspaceId || !input.providerId) return;
    const meta = this.parseProfileMeta(input.providerId, input.workspaceId);
    if (!meta) return;

    metrics.ai.counter('byok_usage').add(1, {
      workspace: input.workspaceId,
      provider: meta.provider,
      source: meta.source,
      feature: input.featureKind,
    });
    await this.models.copilotUsage.create({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: meta.provider,
      providerSource: meta.source,
      featureKind: input.featureKind,
      model: input.model ?? null,
      sessionId: input.sessionId,
      taskId: input.taskId,
      actionId: input.actionId,
      billingUnitId: input.billingUnitId,
      promptTokens: input.usage?.prompt_tokens ?? 0,
      completionTokens: input.usage?.completion_tokens ?? 0,
      totalTokens: input.usage?.total_tokens ?? 0,
      cachedTokens: input.usage?.cached_tokens ?? 0,
    });
    if (meta.source === ByokProviderSource.Server && meta.keyId) {
      await this.models.copilotWorkspaceByokConfig.touchUsed(
        input.workspaceId,
        meta.keyId
      );
    }
    if (meta.source === ByokProviderSource.ProjectGlobal && meta.revision) {
      await this.models.copilotProjectByok.touchUsed(meta.revision);
    }
  }

  async recordProviderFailure(input: {
    workspaceId?: string;
    providerId?: string;
    featureKind: ByokFeatureKind;
    error: unknown;
  }) {
    if (!input.workspaceId || !input.providerId) return;
    const meta = this.parseProfileMeta(input.providerId, input.workspaceId);
    if (!meta) return;

    const message = this.sanitizeError(input.error);
    metrics.ai.counter('byok_route_failure').add(1, {
      workspace: input.workspaceId,
      provider: meta.provider,
      source: meta.source,
      feature: input.featureKind,
    });
    if (meta.source === ByokProviderSource.Server && meta.keyId) {
      await this.models.copilotWorkspaceByokConfig.markFailure(
        input.workspaceId,
        meta.keyId,
        message
      );
    }
    if (meta.source === ByokProviderSource.ProjectGlobal && meta.revision) {
      await this.models.copilotProjectByok.recordFailure(
        meta.revision,
        'Provider request failed.'
      );
    }
  }

  async getUsage(workspaceId: string, from: Date, to: Date) {
    return await this.models.copilotUsage.aggregateByDay({
      workspaceId,
      from,
      to,
      providerSources: [ByokProviderSource.Server, ByokProviderSource.Local],
    });
  }

  private async getServerProfiles(workspaceId: string, userId?: string) {
    const credentialIds = await this.profiles.resolveCredentialIds(
      workspaceId,
      userId
    );
    const rows = (
      await this.models.copilotWorkspaceByokConfig.listEnabled(workspaceId)
    ).filter(row => credentialIds === null || credentialIds.includes(row.id));

    return rows
      .filter(row => isByokProvider(row.provider))
      .map((row, index): CopilotProviderProfile => {
        const provider = row.provider as ByokProvider;
        return {
          id: this.profileId(workspaceId, provider, row.id, 'server'),
          type: byokProviderToCopilotType(provider),
          priority:
            BYOK_PROFILE_PRIORITY_BASE - SERVER_PROFILE_PRIORITY_OFFSET - index,
          source: ByokProviderSource.Server,
          ...(row.modelId
            ? {
                models: [row.modelId],
                modelDefinitions: [this.modelDefinition(provider, row.modelId)],
              }
            : {}),
          config: this.providerConfig(
            provider,
            row.encryptedApiKey,
            row.endpoint
          ),
        } as CopilotProviderProfile;
      });
  }

  private async getLocalProfiles(context: ByokProviderRequestContext) {
    if (!context.byokLeaseId || !context.workspaceId || !context.userId) {
      return [];
    }
    if (
      !(await this.entitlement.hasManagementAccess(
        context.workspaceId,
        context.userId
      ))
    ) {
      return [];
    }
    const lease = await this.cache.get<LocalLeasePayload>(
      this.leaseCacheKey(context.byokLeaseId)
    );
    if (
      !lease ||
      lease.workspaceId !== context.workspaceId ||
      lease.userId !== context.userId
    ) {
      return [];
    }
    return lease.providers
      .filter(provider => provider.enabled !== false)
      .map((provider, index): CopilotProviderProfile => {
        return {
          id: this.profileId(
            context.workspaceId ?? lease.workspaceId,
            provider.provider,
            `${index}`,
            'local'
          ),
          type: byokProviderToCopilotType(provider.provider),
          priority: BYOK_PROFILE_PRIORITY_BASE - index,
          source: ByokProviderSource.Local,
          ...(provider.modelId
            ? {
                models: [provider.modelId],
                modelDefinitions: [
                  this.modelDefinition(provider.provider, provider.modelId),
                ],
              }
            : {}),
          config: this.providerConfig(
            provider.provider,
            provider.encryptedApiKey,
            provider.endpoint ?? null
          ),
        } as CopilotProviderProfile;
      });
  }

  private providerConfig(
    provider: ByokProvider,
    encryptedApiKey: string,
    endpoint: string | null
  ) {
    const apiKey = this.crypto.decrypt(encryptedApiKey);
    switch (provider) {
      case ByokProvider.openai:
      case ByokProvider.gemini:
      case ByokProvider.anthropic:
        return { apiKey, ...(endpoint ? { baseURL: endpoint } : {}) };
      case ByokProvider.fal:
        return { apiKey };
    }
  }

  private profileId(
    workspaceId: string,
    provider: ByokProvider,
    keyId: string,
    storage: 'server' | 'local'
  ) {
    const hash = this.workspaceHash(workspaceId);
    const sanitizedKeyId = keyId.replaceAll(/[^a-zA-Z0-9-_]/g, '');
    return storage === 'local'
      ? `byok-${hash}-${provider}-local-${sanitizedKeyId}`
      : `byok-${hash}-${provider}-${sanitizedKeyId}`;
  }

  parseProfileMeta(
    providerId: string,
    workspaceId?: string
  ): ByokProfileMeta | null {
    const globalMatch =
      /^byok-project-global-(openai|anthropic|gemini)-r([1-9][0-9]*)$/.exec(
        providerId
      );
    if (globalMatch) {
      return {
        provider: globalMatch[1] as ByokProvider,
        source: ByokProviderSource.ProjectGlobal,
        revision: Number(globalMatch[2]),
      };
    }
    const match =
      /^byok-([a-f0-9]{12})-(openai|anthropic|gemini|fal)-(.+)$/.exec(
        providerId
      );
    if (!match) return null;
    if (workspaceId && match[1] !== this.workspaceHash(workspaceId)) {
      return null;
    }

    const keyId = match[3];
    return {
      provider: match[2] as ByokProvider,
      source: keyId.startsWith('local-')
        ? ByokProviderSource.Local
        : ByokProviderSource.Server,
      keyId: keyId.startsWith('local-') ? undefined : keyId,
    };
  }

  private toKeyConfig(row: {
    id: string;
    provider: string;
    name: string;
    description: string | null;
    endpoint: string | null;
    modelId: string | null;
    sortOrder: number;
    enabled: boolean;
    disabledReason: string | null;
    lastValidatedAt: Date | null;
    lastValidationError: string | null;
    lastUsedAt: Date | null;
    lastErrorAt: Date | null;
    lastError: string | null;
  }): ByokKeyConfig {
    const provider = row.provider as ByokProvider;
    return {
      id: row.id,
      provider,
      name: row.name,
      description: row.description,
      storage: ByokKeyStorage.server,
      configured: true,
      enabled: row.enabled,
      endpoint: row.endpoint,
      modelId: row.modelId,
      endpointEditable: this.customEndpointSupported,
      sortOrder: row.sortOrder,
      capabilities: this.capabilities(provider, 'server'),
      testStatus: row.lastValidationError
        ? ByokKeyTestStatus.failed
        : row.lastValidatedAt
          ? ByokKeyTestStatus.passed
          : ByokKeyTestStatus.untested,
      disabledReason: row.disabledReason,
      lastTestedAt: row.lastValidatedAt,
      lastTestError: row.lastValidationError,
      lastUsedAt: row.lastUsedAt,
      lastErrorAt: row.lastErrorAt,
      lastError: row.lastError,
    };
  }

  private capabilities(provider: ByokProvider, storage: 'server' | 'local') {
    switch (provider) {
      case ByokProvider.openai:
        return ['Text', 'Image input', 'Actions', 'Image generate'];
      case ByokProvider.anthropic:
        return ['Text', 'Image input'];
      case ByokProvider.gemini:
        return storage === 'server'
          ? [
              'Text',
              'Image input',
              'Actions',
              'Image generate',
              'Transcript',
              'Indexing',
            ]
          : ['Text', 'Image input', 'Actions', 'Image generate'];
      case ByokProvider.fal:
        return ['Image generate'];
    }
  }

  private buildWarnings(keys: ByokKeyConfig[]) {
    const activeServerGemini = keys.some(
      key =>
        key.provider === ByokProvider.gemini &&
        key.storage === ByokKeyStorage.server &&
        key.enabled
    );
    if (activeServerGemini) {
      return [];
    }
    return [
      {
        featureKind: 'transcript',
        reason:
          'Transcript and workspace indexing require an enabled server Gemini BYOK key.',
        requiredProviders: [ByokProvider.gemini],
      },
      {
        featureKind: 'workspace_indexing',
        reason:
          'Workspace indexing requires an enabled server Gemini BYOK key.',
        requiredProviders: [ByokProvider.gemini],
      },
    ];
  }

  private async assertWorkspaceExists(workspaceId: string) {
    if (!(await this.models.workspace.get(workspaceId))) {
      throw new BadRequestException('Workspace not found.');
    }
  }

  private normalizeEndpoint(endpoint?: string | null) {
    if (!endpoint) return null;
    if (!this.customEndpointSupported) {
      throw new BadRequestException('Custom BYOK endpoint is not supported.');
    }
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new BadRequestException('Invalid BYOK endpoint.');
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      throw new BadRequestException('BYOK endpoint must use HTTP or HTTPS.');
    }
    return parsed.toString().replace(/\/$/, '');
  }

  private normalizeModelId(modelId?: string | null) {
    if (modelId === undefined || modelId === null) return modelId;
    const normalized = modelId.trim();
    if (!normalized) {
      throw new BadRequestException('BYOK model ID must not be blank.');
    }
    if (normalized.length > 255) {
      throw new BadRequestException(
        'BYOK model ID must not exceed 255 characters.'
      );
    }
    return normalized;
  }

  private modelDefinition(
    provider: ByokProvider,
    modelId: string
  ): CopilotModelDefinition {
    if (provider === ByokProvider.fal) {
      return {
        id: modelId,
        rawModelId: modelId,
        backendKind: 'fal',
        capabilities: [
          {
            input: [ModelInputType.Text],
            output: [ModelOutputType.Image],
            defaultForOutputType: true,
          },
        ],
      };
    }

    const backendKind =
      provider === ByokProvider.openai
        ? ('openai_responses' as const)
        : provider === ByokProvider.anthropic
          ? ('anthropic' as const)
          : ('gemini_api' as const);
    return {
      id: modelId,
      rawModelId: modelId,
      backendKind,
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [
            ModelOutputType.Text,
            ModelOutputType.Object,
            ModelOutputType.Structured,
          ],
          defaultForOutputType: true,
        },
      ],
    };
  }

  private assertProvider(provider: ByokProvider) {
    if (!BYOK_ALLOWED_PROVIDERS.includes(provider)) {
      throw new BadRequestException('Unsupported BYOK provider.');
    }
  }

  private sanitizeError(error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return 'Provider key test timed out.';
    }
    if (error instanceof BadRequestException && error.message) {
      return error.message.slice(0, 300);
    }
    return 'Provider request failed.';
  }

  private workspaceHash(workspaceId: string) {
    return createHash('sha256').update(workspaceId).digest('hex').slice(0, 12);
  }

  private leaseCacheKey(leaseId: string) {
    return `copilot:byok:lease:${leaseId}`;
  }

  private async getActiveLocalLease(activeCacheKey: string) {
    const active = await this.cache.get<LocalLeaseActive>(activeCacheKey);
    if (!active) return null;
    if (await this.cache.has(this.leaseCacheKey(active.leaseId))) {
      return { leaseId: active.leaseId, expiresAt: new Date(active.expiresAt) };
    }
    await this.cache.delete(activeCacheKey);
    return null;
  }

  private localLeaseActiveCacheKey(input: {
    workspaceId: string;
    userId: string;
    providers: ByokLocalLeaseProvider[];
  }) {
    const fingerprint = createHmac(
      'sha256',
      this.crypto.keyPair.sha256.privateKey
    )
      .update(
        JSON.stringify(
          input.providers.map(provider => ({
            provider: provider.provider,
            name: provider.name,
            description: provider.description ?? null,
            apiKey: provider.apiKey,
            endpoint: provider.endpoint ?? null,
            modelId: provider.modelId ?? null,
            sortOrder: provider.sortOrder ?? 0,
            enabled: provider.enabled ?? true,
          }))
        )
      )
      .digest('hex');
    return `copilot:byok:lease:active:${input.workspaceId}:${input.userId}:${fingerprint}`;
  }
}

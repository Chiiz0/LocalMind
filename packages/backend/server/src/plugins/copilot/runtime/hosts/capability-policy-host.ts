import type { OfficeAiContext } from '@localmind/office';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { ServerFeature, ServerService } from '../../../../core';
import { QuotaStateService } from '../../../../core/quota/state';
import type { CopilotAccessContext } from '../../access';
import type { CopilotProviderRoutePolicyFeatureKind } from '../../config';
import { CopilotProviderFactory } from '../../providers/factory';
import { ModelOutputType } from '../../providers/types';
import type { ChatSession } from '../../session';
import { type ToolsConfig } from '../../types';
import { getTools } from '../../utils';
import {
  ModelSelectionPolicy,
  type ResolveModelInput,
} from '../model-selection-policy';

export type ChatSelectionOptions = {
  responseMode: 'text' | 'object' | 'image';
  modelId?: string;
  reasoning?: boolean;
  webSearch?: boolean;
  chatSurface?: 'intelligence_workbench';
  toolsConfig?: ToolsConfig;
  byokLeaseId?: string;
  billingUnitId?: string;
  featureKind?: CopilotProviderRoutePolicyFeatureKind;
  quotaBackedRoutesAllowed?: boolean;
  officeContext?: OfficeAiContext;
};

type ResolvePolicyModelInput = ResolveModelInput & {
  proModels?: string[] | null;
  userId?: string;
  paymentEnabled?: boolean;
  routeContext?: CopilotAccessContext;
  outputType?: ModelOutputType;
};

@Injectable()
export class CapabilityPolicyHost {
  constructor(
    private readonly server: ServerService,
    private readonly moduleRef: ModuleRef,
    private readonly modelSelection: ModelSelectionPolicy,
    private readonly providerFactory: CopilotProviderFactory
  ) {}

  private async hasAiProAccess(
    userId: string | undefined,
    paymentEnabled: boolean | undefined
  ) {
    if (!paymentEnabled || !userId) {
      return false;
    }

    try {
      const state = await this.moduleRef
        .get(QuotaStateService, { strict: false })
        .reconcileUserQuotaState(userId);
      const flags = state.flags as { unlimitedCopilot?: boolean };
      return (
        !!flags.unlimitedCopilot ||
        ['pro', 'lifetime_pro', 'ai'].includes(state.plan)
      );
    } catch {
      return false;
    }
  }

  private async resolveModel(
    input: ResolvePolicyModelInput,
    outputType: ModelOutputType = ModelOutputType.Text
  ) {
    const resolveDefaultOrAuto = async () => {
      const defaultRoute = await this.providerFactory.resolveModelId(
        {
          modelId: input.defaultModel,
          outputType,
        },
        {},
        input.routeContext
      );
      if (defaultRoute) {
        return input.defaultModel;
      }

      return (
        (await this.providerFactory.resolveModelId(
          { outputType },
          {},
          input.routeContext
        )) ?? input.defaultModel
      );
    };
    const modelSelectionScope = await this.resolveModelSelectionScope(
      input.routeContext
    );
    if (modelSelectionScope.projectModelId) {
      return modelSelectionScope.projectModelId;
    }
    const resolved = this.modelSelection.resolveRequestedModel({
      ...input,
      extraModels: modelSelectionScope.configuredModelIds,
      providerIds: modelSelectionScope.providerIds,
      routeContext: input.routeContext,
    });

    if (
      resolved.matchedOptionalModel &&
      input.paymentEnabled &&
      this.modelSelection.matchesModelList(
        input.proModels ?? [],
        input.requestedModelId,
        input.routeContext,
        modelSelectionScope.providerIds
      ) &&
      !(await this.hasAiProAccess(input.userId, input.paymentEnabled))
    ) {
      return await resolveDefaultOrAuto();
    }

    const resolvedRoute = await this.providerFactory.resolveModelId(
      {
        modelId: resolved.selectedModel,
        outputType,
      },
      {},
      input.routeContext
    );
    if (resolved.matchedOptionalModel && !resolvedRoute) {
      return await resolveDefaultOrAuto();
    }
    if (!resolved.matchedOptionalModel) {
      return await resolveDefaultOrAuto();
    }

    return resolved.selectedModel;
  }

  private async resolveModelSelectionScope(
    routeContext?: CopilotAccessContext
  ) {
    if (this.providerFactory.getEffectiveModelSelectionScope) {
      return await this.providerFactory.getEffectiveModelSelectionScope(
        routeContext
      );
    }

    return {
      projectModelId: undefined,
      providerIds: undefined,
      configuredModelIds:
        this.providerFactory.getConfiguredModelIds(routeContext),
    };
  }

  private outputTypeForResponseMode(
    responseMode: ChatSelectionOptions['responseMode']
  ) {
    return responseMode === 'image'
      ? ModelOutputType.Image
      : responseMode === 'object'
        ? ModelOutputType.Object
        : ModelOutputType.Text;
  }

  async selectChat(session: ChatSession, options: ChatSelectionOptions) {
    const outputType = this.outputTypeForResponseMode(options.responseMode);
    const quotaBackedRoutesAllowed = options.officeContext
      ? false
      : options.quotaBackedRoutesAllowed;
    const routeContext = {
      userId: session.config.userId,
      sessionId: session.config.sessionId,
      workspaceId: session.config.workspaceId ?? undefined,
      projectId: session.config.selectedContextProjectId ?? undefined,
      byokLeaseId: options.byokLeaseId,
      featureKind:
        options.featureKind ??
        (options.responseMode === 'image' ? 'image' : 'chat'),
      quotaBackedRoutesAllowed,
    };
    const model = await this.resolveModel(
      {
        userId: session.config.userId,
        defaultModel: session.model,
        optionalModels: session.optionalModels,
        proModels: session.config.promptConfig?.proModels,
        requestedModelId: options.modelId,
        paymentEnabled: this.server.features.includes(ServerFeature.Payment),
        routeContext,
      },
      outputType
    );
    const contextWindow = await this.providerFactory.resolveModelContextWindow(
      {
        modelId: model,
        outputType,
      },
      {},
      routeContext
    );
    const promptTools = getTools(
      session.config.promptConfig?.tools,
      options.toolsConfig
    );
    // Native Project collaboration is a product capability, including for legacy prompts without tools.
    const projectTools =
      session.config.workspaceId === null &&
      session.config.selectedContextProjectId
        ? [...new Set([...(promptTools ?? []), 'blocker' as const])]
        : promptTools;
    const tools = options.officeContext ? (['office'] as const) : projectTools;
    return {
      model,
      contextWindow,
      providerOptions: {
        ...session.config.promptConfig,
        user: session.config.userId,
        session: session.config.sessionId,
        workspace: session.config.workspaceId ?? undefined,
        byokLeaseId: options.byokLeaseId,
        billingUnitId: options.billingUnitId,
        featureKind: routeContext.featureKind,
        quotaBackedRoutesAllowed,
        officeContext: options.officeContext,
        reasoning: options.reasoning,
        webSearch: options.webSearch,
        chatSurface: options.chatSurface,
        tools,
      },
    };
  }

  async resolveChatModel(input: ResolvePolicyModelInput) {
    return await this.resolveModel(input, ModelOutputType.Text);
  }

  async selectPrompt(
    input: ResolveModelInput & {
      outputType?: ModelOutputType;
      routeContext?: CopilotAccessContext;
    }
  ) {
    const outputType = input.outputType ?? ModelOutputType.Text;
    const model = await this.resolveModel(input, outputType);
    const contextWindow = await this.providerFactory.resolveModelContextWindow(
      {
        modelId: model,
        outputType,
      },
      {},
      input.routeContext
    );

    return {
      model,
      contextWindow,
    };
  }

  async resolvePromptModel(
    input: ResolveModelInput & {
      outputType?: ModelOutputType;
      routeContext?: CopilotAccessContext;
    }
  ) {
    return (await this.selectPrompt(input)).model;
  }

  async resolveFixedTaskModel(input: ResolveModelInput) {
    return await this.resolveModel(
      {
        ...input,
        routeContext: input.routeContext ?? undefined,
      },
      ModelOutputType.Text
    );
  }
}

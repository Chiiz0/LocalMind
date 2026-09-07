import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CopilotPromptNotFound } from '../../../base';
import { Models } from '../../../models';
import type { CopilotProviderRoutePolicyFeatureKind } from '../config';
import type { ResolvedPrompt } from '../prompt';
import {
  isImagePromptCategory,
  isTranscriptPromptCategory,
} from '../prompt/category';
import { PromptService } from '../prompt/service';
import {
  type CopilotChatOptions,
  type CopilotProviderType,
  type CopilotStructuredOptions,
  ModelOutputType,
  type PromptMessage,
  type PromptParams,
} from '../providers/types';
import { CapabilityRuntime } from './capability-runtime';
import type { RequiredStructuredOutputContract } from './contracts';
import { CapabilityPolicyHost } from './hosts/capability-policy-host';

type PromptRuntimeStructuredContract = RequiredStructuredOutputContract;

type PromptRuntimeStructuredProviderOptions = Omit<
  NonNullable<CopilotStructuredOptions>,
  'responseSchemaJson' | 'schemaHash'
>;

type PromptRuntimeProviderOptions =
  | NonNullable<CopilotChatOptions>
  | PromptRuntimeStructuredProviderOptions;

function resolveEffectiveMaxTokenSize(
  promptMaxTokenSize: number | null | undefined,
  contextWindow?: number
) {
  const maxTokenSize = promptMaxTokenSize || 128 * 1024;
  return contextWindow ? Math.min(maxTokenSize, contextWindow) : maxTokenSize;
}

function resolvePromptRouteFeatureKind(
  prompt: ResolvedPrompt
): CopilotProviderRoutePolicyFeatureKind {
  if (isImagePromptCategory(prompt)) {
    return 'image';
  }

  if (isTranscriptPromptCategory(prompt)) {
    return 'transcript';
  }

  return 'action';
}

@Injectable()
export class PromptRuntime {
  constructor(
    private readonly prompts: PromptService,
    private readonly capabilityPolicy: CapabilityPolicyHost,
    private readonly runtime: CapabilityRuntime,
    private readonly models: Models
  ) {}

  private async preparePrompt(
    promptName: string,
    params: PromptParams,
    options: {
      modelId?: string;
      prefer?: CopilotProviderType;
      appendMessages?: PromptMessage[];
      providerOptions?: PromptRuntimeProviderOptions;
      outputType?: 'text' | 'structured';
    } = {}
  ) {
    const prompt = await this.prompts.get(promptName);
    if (!prompt) {
      throw new CopilotPromptNotFound({ name: promptName });
    }

    const providerOptions: PromptRuntimeProviderOptions =
      options.providerOptions ?? {};
    if (providerOptions.session) {
      const session = await this.models.copilotSession.getMeta(
        providerOptions.session
      );
      if (
        !session ||
        session.userId !== providerOptions.user ||
        session.workspaceId !== (providerOptions.workspace ?? null)
      )
        throw new Error('Prompt conversation authorization is unavailable');
      await this.models.copilotContext.recordInputSources({
        sessionId: session.id,
        actorId: session.userId,
        projectId: session.selectedContextProjectId,
        sources: [
          {
            workspaceId: session.workspaceId,
            kind: 'workspace',
            sourceId: `system-prompt:${createHash('sha256').update(JSON.stringify(prompt)).digest('hex')}`,
          },
        ],
      });
    }
    const featureKind =
      providerOptions.featureKind ?? resolvePromptRouteFeatureKind(prompt);
    const selection = await this.capabilityPolicy.selectPrompt({
      defaultModel: prompt.model,
      optionalModels: prompt.optionalModels,
      requestedModelId: options.modelId,
      outputType: options.outputType ?? ModelOutputType.Text,
      routeContext: {
        userId: providerOptions.user,
        sessionId: providerOptions.session,
        workspaceId: providerOptions.workspace,
        byokLeaseId: providerOptions.byokLeaseId,
        featureKind,
        quotaBackedRoutesAllowed: providerOptions.quotaBackedRoutesAllowed,
      },
    });
    const baseMessages = options.appendMessages?.length
      ? this.prompts.renderSession(
          prompt,
          options.appendMessages,
          params,
          resolveEffectiveMaxTokenSize(
            prompt.config?.maxTokens,
            selection.contextWindow
          ),
          providerOptions.session
        )
      : this.prompts.finish(prompt, params, providerOptions.session);

    return {
      prompt,
      modelId: selection.model,
      finalMessages: baseMessages,
      prefer: options.prefer,
      providerOptions,
      featureKind,
    };
  }

  async runText(
    promptName: string,
    params: PromptParams,
    options: {
      modelId?: string;
      prefer?: CopilotProviderType;
      appendMessages?: PromptMessage[];
      providerOptions?: NonNullable<CopilotChatOptions>;
    } = {}
  ) {
    const prepared = await this.preparePrompt(promptName, params, options);

    return await this.runtime.text(
      { modelId: prepared.modelId },
      prepared.finalMessages,
      {
        ...prepared.prompt.config,
        ...options.providerOptions,
        featureKind: prepared.featureKind,
      },
      { prefer: prepared.prefer }
    );
  }

  async runStructured(
    promptName: string,
    params: PromptParams,
    options: {
      responseContract: PromptRuntimeStructuredContract;
      modelId?: string;
      prefer?: CopilotProviderType;
      appendMessages?: PromptMessage[];
      providerOptions?: PromptRuntimeStructuredProviderOptions;
      strict?: boolean;
    }
  ) {
    const prepared = await this.preparePrompt(promptName, params, {
      ...options,
      outputType: ModelOutputType.Structured,
    });

    return await this.runtime.generateStructuredValue(
      { modelId: prepared.modelId },
      prepared.finalMessages,
      {
        ...prepared.prompt.config,
        ...options.providerOptions,
        featureKind: prepared.featureKind,
        responseSchemaJson: options.responseContract.responseSchemaJson,
        schemaHash: options.responseContract.schemaHash,
        strict: options.strict,
      },
      options.responseContract,
      { prefer: prepared.prefer }
    );
  }
}

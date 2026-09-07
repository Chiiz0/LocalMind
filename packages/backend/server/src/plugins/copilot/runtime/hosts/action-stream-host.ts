import { Injectable } from '@nestjs/common';

import { BadRequest } from '../../../../base';
import type { LlmImageResponse } from '../../../../native';
import { PromptService } from '../../prompt';
import { CopilotProviderFactory } from '../../providers/factory';
import { ModelOutputType, type PromptMessage } from '../../providers/types';
import type { ChatSession } from '../../session';
import { ChatQuerySchema } from '../../types';
import { projectActionEventToChatEvent } from '../action-output-projector';
import type { ActionRuntimeBridgeEvent } from '../action-runtime-bridge';
import { ActionRuntimeBridge } from '../action-runtime-bridge';
import { ConversationHost } from './conversation-host';
import { ImageResultHost } from './image-result-host';

export { projectActionEventToChatEvent };

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const ACTION_PROMPTS: Record<string, string> = {
  'mindmap.generate': 'mindmap.generate',
  'slides.outline': 'slides.outline',
};

type ImageActionRoutePreparation = {
  modelId?: string;
  modelSelectionSource?: string;
  messages: PromptMessage[];
  options: Record<string, unknown>;
};

function isImageAction(id: string) {
  return id.startsWith('image.filter.');
}

function actionTextResultSchema() {
  return {
    type: 'object',
    properties: {
      result: { type: 'string' },
    },
    required: ['result'],
    additionalProperties: false,
  };
}

@Injectable()
export class ActionStreamHost {
  constructor(
    private readonly conversations: ConversationHost,
    private readonly bridge: ActionRuntimeBridge,
    private readonly prompts: PromptService,
    private readonly imageResults: ImageResultHost,
    private readonly providers: CopilotProviderFactory
  ) {}

  async stream(
    userId: string,
    sessionId: string,
    query: Record<string, string | string[]>,
    signal?: AbortSignal
  ): Promise<{
    messageId?: string;
    actionId: string;
    actionVersion: string;
    stream: AsyncIterableIterator<ActionRuntimeBridgeEvent>;
  }> {
    const parsedQuery = ChatQuerySchema.parse(query);
    const prepared = await this.conversations.prepareTurn(
      userId,
      sessionId,
      query
    );
    const workspaceId = prepared.session.config.workspaceId;
    if (!workspaceId)
      throw new BadRequest(
        'Use Project resource commands in a Project conversation.'
      );
    const requestedActionId =
      firstQueryValue(query.actionId) ?? prepared.session.config.promptName;
    const actionId = requestedActionId;
    const actionVersion = firstQueryValue(query.actionVersion) ?? 'v1';
    const retryOf = parsedQuery.retry
      ? firstQueryValue(query.runId)
      : undefined;
    const params = {
      ...prepared.params,
      ...this.conversations.buildLatestTurnPromptParams(prepared.latestTurn),
    };
    const finalMessage = await this.preparePromptMessages(
      actionId,
      prepared.session,
      params,
      {
        userId,
        modelId: parsedQuery.modelId,
        byokLeaseId: parsedQuery.byokLeaseId,
        quotaBackedRoutesAllowed: prepared.quotaBackedRoutesAllowed,
      }
    );
    const imageRoutes = await this.prepareImageRoutes(
      actionId,
      prepared.session,
      params,
      userId,
      parsedQuery.modelId,
      parsedQuery.modelSelectionSource,
      parsedQuery.byokLeaseId,
      prepared.quotaBackedRoutesAllowed,
      signal
    );
    const runStream = this.bridge.runStream({
      userId,
      workspaceId,
      docId: prepared.session.config.docId,
      session: prepared.session,
      userMessageId: prepared.latestTurn?.id,
      compatSubmissionId: prepared.messageId,
      actionId,
      actionVersion,
      retryOf,
      inputSnapshot: {
        params,
        messageId: prepared.messageId,
      },
      persistAttachment: isImageAction(actionId)
        ? attachment =>
            this.persistImageAttachment(userId, workspaceId, attachment)
        : undefined,
      prepareStructuredRoutes: isImageAction(actionId)
        ? undefined
        : {
            stepId: 'generate',
            modelId: parsedQuery.modelId,
            modelSelectionSource: parsedQuery.modelSelectionSource,
            messages: finalMessage,
            responseSchemaJson: actionTextResultSchema(),
            options: {
              ...prepared.session.config.promptConfig,
              signal,
              user: userId,
              workspace: workspaceId,
              session: sessionId,
              byokLeaseId: parsedQuery.byokLeaseId,
              quotaBackedRoutesAllowed: prepared.quotaBackedRoutesAllowed,
              featureKind: 'action',
            },
          },
      prepareImageRoutes: imageRoutes
        ? {
            stepId: 'generate-image',
            modelId: imageRoutes.modelId,
            modelSelectionSource: imageRoutes.modelSelectionSource,
            messages: imageRoutes.messages,
            options: imageRoutes.options,
          }
        : undefined,
      signal,
    });

    return {
      messageId: prepared.messageId,
      actionId,
      actionVersion,
      stream: runStream,
    };
  }

  private async preparePromptMessages(
    actionId: string,
    session: ChatSession,
    params: Record<string, unknown>,
    routeContext: {
      userId: string;
      modelId?: string;
      byokLeaseId?: string;
      quotaBackedRoutesAllowed?: boolean;
    }
  ): Promise<PromptMessage[]> {
    const promptName = ACTION_PROMPTS[actionId];
    if (!promptName) {
      const contextWindow = isImageAction(actionId)
        ? undefined
        : await this.providers.resolveModelContextWindow(
            {
              modelId: routeContext.modelId,
              outputType: ModelOutputType.Structured,
            },
            {},
            {
              userId: routeContext.userId,
              sessionId: session.config.sessionId,
              workspaceId: session.config.workspaceId ?? undefined,
              byokLeaseId: routeContext.byokLeaseId,
              featureKind: 'action',
              quotaBackedRoutesAllowed: routeContext.quotaBackedRoutesAllowed,
            }
          );

      return session.finish(params, { contextWindow });
    }

    const prompt = await this.prompts.get(promptName);
    if (!prompt) {
      throw new Error(`Prompt ${promptName} not found`);
    }
    return this.prompts.finish(
      prompt,
      params as Record<string, string>,
      session.config.sessionId
    );
  }

  private async prepareImageRoutes(
    actionId: string,
    session: ChatSession,
    params: Record<string, unknown>,
    userId: string,
    modelId?: string,
    modelSelectionSource?: string,
    byokLeaseId?: string,
    quotaBackedRoutesAllowed?: boolean,
    signal?: AbortSignal
  ): Promise<ImageActionRoutePreparation | undefined> {
    if (!isImageAction(actionId)) {
      return undefined;
    }

    const prompt = await this.prompts.get(actionId);
    if (!prompt) {
      throw new Error(`Prompt ${actionId} not found`);
    }
    const finalMessage = this.prompts.finish(
      prompt,
      params as Record<string, string>,
      session.config.sessionId
    );
    return {
      modelId: modelId ?? prompt.model,
      modelSelectionSource,
      messages: finalMessage,
      options: {
        ...prompt.config,
        signal,
        user: userId,
        workspace: session.config.workspaceId,
        session: session.config.sessionId,
        byokLeaseId,
        quotaBackedRoutesAllowed,
        featureKind: 'image',
      },
    };
  }

  private async persistImageAttachment(
    userId: string,
    workspaceId: string,
    attachment: unknown
  ) {
    if (!attachment || typeof attachment !== 'object') {
      return attachment;
    }

    const artifact = attachment as LlmImageResponse['images'][number] & {
      url?: unknown;
      data_base64?: unknown;
      media_type?: unknown;
      width?: unknown;
      height?: unknown;
      providerMetadata?: unknown;
    };
    const persisted = await this.imageResults.persistNativeArtifact(
      userId,
      workspaceId,
      artifact
    );
    if (!persisted) {
      return attachment;
    }

    return {
      url: persisted,
      ...(typeof artifact.media_type === 'string'
        ? { mimeType: artifact.media_type }
        : {}),
      ...(typeof artifact.width === 'number' ? { width: artifact.width } : {}),
      ...(typeof artifact.height === 'number'
        ? { height: artifact.height }
        : {}),
      ...(artifact.providerMetadata !== undefined
        ? { providerMetadata: artifact.providerMetadata }
        : {}),
    };
  }
}

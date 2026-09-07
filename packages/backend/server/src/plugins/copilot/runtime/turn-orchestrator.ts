import type { OfficeAiContext } from '@localmind/office';
import { Injectable } from '@nestjs/common';

import { BadRequest } from '../../../base';
import { CopilotContextService } from '../context/service';
import { type Turn } from '../core';
import { OfficeAgentCommandService } from '../office-agent-command';
import { ProjectContextService } from '../project-context-service';
import {
  ModelInputType,
  type PromptMessage,
  type PromptParams,
  type StreamObject,
} from '../providers/types';
import { ChatSession } from '../session';
import { PROJECT_COLLABORATION_POLICY } from '../tools/project-file-request';
import { ChatQuerySchema } from '../types';
import { CapabilityRuntime } from './capability-runtime';
import { CapabilityPolicyHost } from './hosts/capability-policy-host';
import { ConversationHost } from './hosts/conversation-host';
import { ImageResultHost } from './hosts/image-result-host';
import { TurnPersistence } from './hosts/turn-persistence';

export function appendChatSystemPolicy(
  messages: PromptMessage[],
  policy: PromptMessage
): PromptMessage[] {
  const [first, ...rest] = messages;
  // Native request construction retains only the first system message.
  return first?.role === 'system'
    ? [{ ...first, content: `${first.content}\n\n${policy.content}` }, ...rest]
    : [policy, ...messages];
}

@Injectable()
export class TurnOrchestrator {
  constructor(
    private readonly conversations: ConversationHost,
    private readonly context: CopilotContextService,
    private readonly office: OfficeAgentCommandService,
    private readonly capabilityPolicy: CapabilityPolicyHost,
    private readonly runtime: CapabilityRuntime,
    private readonly imageResults: ImageResultHost,
    private readonly turnPersistence: TurnPersistence,
    private readonly projectContext: ProjectContextService
  ) {}

  private async resolveOfficeContext(
    latestTurn: Turn | undefined,
    session: ChatSession
  ) {
    if (!latestTurn || !Object.hasOwn(latestTurn.metadata, 'officeContext')) {
      return null;
    }
    if (!session.config.workspaceId && !session.config.selectedContextProjectId)
      throw new BadRequest('Office context requires a resource owner.');
    return await this.office.validateAiContext({
      ...(session.config.workspaceId
        ? { workspaceId: session.config.workspaceId }
        : { projectId: session.config.selectedContextProjectId as string }),
      actorId: session.config.userId,
      context: latestTurn.metadata.officeContext,
    });
  }

  private appendOfficePlannerPolicy(
    messages: PromptMessage[],
    office: {
      context: OfficeAiContext;
      artifact: { title: string; sourceFileName: string };
      revision: { sequence: number };
    }
  ) {
    const policy: PromptMessage = {
      role: 'system',
      content: [
        'You are editing the current LocalMind native Office artifact through audited tools.',
        `Validated context: ${JSON.stringify(office.context)}.`,
        `File: ${office.artifact.title} (${office.artifact.sourceFileName}), immutable revision ${office.revision.sequence}.`,
        'Before every write request, call office_read in this tool loop and use only its returned revision and stable IDs. office_read is already bound to the validated current artifact and revision, so pass only an optional selector and never ask the user for an artifact ID.',
        'Start with office_read({"selector":null}) to discover stable IDs, then read a narrower selection if needed. Do not guess current/active/sheet1 as worksheet IDs. A failed read is not revision evidence; retry without a selector.',
        'Use office_command_request for one change and office_command_batch_request when all changes must succeed atomically.',
        'Never invent stable IDs, directly rewrite an OOXML/PDF package, or use another artifact.',
        'A command request only creates a persisted preview awaiting approval. Say that approval is required and do not claim the edit completed.',
        'Only a later completed Agent Runtime result with a new immutable revision is completion evidence.',
        office.context.artifactKind === 'pdf'
          ? 'PDF is fixed-layout. Only use supported annotation, form, page, signature appearance, and redaction commands; reject body-text rewrite or reflow requests.'
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
    return appendChatSystemPolicy(messages, policy);
  }

  private async buildPromptParams(
    userId: string,
    sessionId: string,
    options: {
      latestTurn?: Turn;
      includeContextFiles?: boolean;
    } = {}
  ): Promise<Record<string, unknown>> {
    const current = await this.context.getOwnedBySessionId(userId, sessionId);
    const contextFiles =
      options.includeContextFiles &&
      current &&
      (current.files.length > 0 || current.blobs.length > 0)
        ? [...current.files, ...(await current.getBlobMetadata())]
        : [];
    const latestTurn = options.latestTurn;

    return {
      ...this.conversations.buildLatestTurnPromptParams(latestTurn),
      ...(contextFiles.length ? { contextFiles } : {}),
    };
  }

  private async prepareChatSelection(
    userId: string,
    sessionId: string,
    query: Record<string, string | string[]>,
    selection: {
      responseMode: 'text' | 'object' | 'image';
      includeContextFiles?: boolean;
    }
  ) {
    const prepared = await this.conversations.prepareTurn(
      userId,
      sessionId,
      query
    );
    const {
      modelId,
      reasoning,
      webSearch,
      chatSurface,
      toolsConfig,
      byokLeaseId,
    } = ChatQuerySchema.parse(query);
    const office = await this.resolveOfficeContext(
      prepared.latestTurn,
      prepared.session
    );
    if (office && selection.responseMode === 'image') {
      throw new BadRequest(
        'Office AI context does not support image generation'
      );
    }
    const promptParams = await this.buildPromptParams(userId, sessionId, {
      latestTurn: prepared.latestTurn,
      includeContextFiles: selection.includeContextFiles,
    });
    const selected = await this.capabilityPolicy.selectChat(prepared.session, {
      responseMode: selection.responseMode,
      modelId,
      reasoning,
      webSearch,
      chatSurface,
      toolsConfig,
      byokLeaseId,
      billingUnitId: prepared.latestTurn?.id,
      quotaBackedRoutesAllowed: office
        ? false
        : prepared.quotaBackedRoutesAllowed,
      officeContext: office?.context,
      featureKind:
        selection.responseMode === 'image'
          ? 'image'
          : selection.responseMode === 'object'
            ? 'action'
            : 'chat',
    });
    const projectSource =
      !prepared.session.config.workspaceId &&
      prepared.session.config.selectedContextProjectId &&
      prepared.latestTurn?.metadata.projectContext
        ? await this.projectContext.materialize({
            projectId: prepared.session.config.selectedContextProjectId,
            actorId: userId,
            sessionId,
            snapshot: prepared.latestTurn.metadata.projectContext,
            maxCharacters: Math.min(
              32000,
              Math.floor((selected.contextWindow ?? 128 * 1024) / 4)
            ),
          })
        : null;
    const renderedMessages = prepared.session.finish(
      {
        ...prepared.params,
        ...promptParams,
      },
      {
        contextWindow: selected.contextWindow,
        referenceMessages: projectSource ? [projectSource] : [],
      }
    );
    const messagesWithOfficePolicy = office
      ? this.appendOfficePlannerPolicy(renderedMessages, office)
      : renderedMessages;
    const managementPolicy: PromptMessage = {
      role: 'system',
      content:
        'LocalMind Projects are managed by people. You must not create a Project, manage its members, change its permissions or AI policy, or approve/reject access requests. If asked to create a Project, explain that the user must create it in Intelligence. Never create a folder as a substitute. Report only actual tool execution outcomes; an access request is not a grant and a write preview is not a completed edit. ' +
        (prepared.session.config.workspaceId === null
          ? `This conversation owns native Project resources in ${prepared.session.config.selectedContextProjectId}. Create folders and documents in this Project by default. Use project_resource_list to resolve exact internal parent IDs. doc_create saves the real internal document immediately; no Workspace location is needed. Workspace documents and Project resources are independent copies. Ordinary edits and retries must stay inside the Project. Only an explicit user request can start a separate external publication or source refresh. Cancellation or failure of publication must preserve the internal resource. Use doc_read before doc_update and handle version conflicts without overwriting.`
          : 'Document creation requires an explicitly chosen destination workspace and location, including an explicit root choice.') +
        (prepared.session.config.workspaceId === null
          ? `\n${PROJECT_COLLABORATION_POLICY}`
          : ''),
    };
    const finalMessage = appendChatSystemPolicy(
      messagesWithOfficePolicy,
      managementPolicy
    );

    return {
      prepared,
      finalMessage,
      selection: selected,
    };
  }

  async streamText(
    userId: string,
    sessionId: string,
    query: Record<string, string | string[]>,
    signal?: AbortSignal,
    wasAborted: () => boolean = () => false
  ) {
    const { prepared, finalMessage, selection } =
      await this.prepareChatSelection(userId, sessionId, query, {
        responseMode: 'text',
        includeContextFiles: true,
      });

    const stream = this.streamTextResult(
      prepared.session,
      selection.model,
      finalMessage,
      {
        ...selection.providerOptions,
        signal,
      },
      wasAborted
    );

    return {
      messageId: prepared.messageId,
      model: selection.model,
      finalMessage,
      stream,
    };
  }

  private async *streamTextResult(
    session: ChatSession,
    model: string,
    finalMessage: ReturnType<ChatSession['finish']>,
    options: Record<string, unknown>,
    wasAborted: () => boolean
  ) {
    let buffer = '';
    for await (const chunk of this.runtime.streamText(
      { modelId: model },
      finalMessage,
      options
    )) {
      buffer += chunk;
      yield chunk;
    }
    await this.turnPersistence.persistTextResult(session, buffer, wasAborted());
  }

  async streamObject(
    userId: string,
    sessionId: string,
    query: Record<string, string | string[]>,
    signal?: AbortSignal,
    wasAborted: () => boolean = () => false
  ) {
    const { prepared, finalMessage, selection } =
      await this.prepareChatSelection(userId, sessionId, query, {
        responseMode: 'object',
        includeContextFiles: true,
      });

    return {
      messageId: prepared.messageId,
      model: selection.model,
      finalMessage,
      stream: this.streamObjectResult(
        prepared.session,
        selection.model,
        finalMessage,
        {
          ...selection.providerOptions,
          signal,
        },
        wasAborted
      ),
    };
  }

  private async *streamObjectResult(
    session: ChatSession,
    model: string,
    finalMessage: ReturnType<ChatSession['finish']>,
    options: Record<string, unknown>,
    wasAborted: () => boolean
  ): AsyncIterableIterator<StreamObject> {
    const chunks: StreamObject[] = [];
    for await (const chunk of this.runtime.streamObject(
      { modelId: model },
      finalMessage,
      options
    )) {
      chunks.push(chunk);
      yield chunk;
    }
    await this.turnPersistence.persistObjectResult(
      session,
      chunks,
      wasAborted()
    );
  }

  async streamImages(
    userId: string,
    sessionId: string,
    query: Record<string, string | string[]>,
    signal?: AbortSignal,
    wasAborted: () => boolean = () => false
  ) {
    const { prepared, finalMessage, selection } =
      await this.prepareChatSelection(userId, sessionId, query, {
        responseMode: 'image',
      });
    const [systemMessage] = finalMessage;
    const finalParams: PromptParams = systemMessage?.params ?? {};
    const hasAttachment =
      !!prepared.session.latestUserTurn?.attachments?.length;

    return {
      messageId: prepared.messageId,
      model: selection.model,
      finalMessage,
      stream: this.streamImageResult(
        userId,
        sessionId,
        prepared.session,
        selection.model,
        hasAttachment,
        finalMessage,
        {
          ...selection.providerOptions,
          quality:
            typeof finalParams.quality === 'string'
              ? finalParams.quality
              : undefined,
          seed: this.parseNumber(finalParams.seed),
          signal,
        },
        wasAborted
      ),
    };
  }

  private async *streamImageResult(
    userId: string,
    sessionId: string,
    session: ChatSession,
    model: string | undefined,
    hasAttachment: boolean,
    finalMessage: ReturnType<ChatSession['finish']>,
    options: Record<string, unknown>,
    wasAborted: () => boolean
  ): AsyncIterableIterator<string> {
    const attachments: string[] = [];
    for await (const artifact of this.runtime.streamImageArtifacts(
      {
        modelId: model,
        inputTypes: hasAttachment
          ? [ModelInputType.Image]
          : [ModelInputType.Text],
      },
      finalMessage,
      options
    )) {
      const handled = await this.imageResults.persistNativeArtifact(
        userId,
        sessionId,
        artifact
      );
      if (handled) {
        attachments.push(handled);
        yield handled;
      }
    }
    await this.turnPersistence.persistImageResult(
      session,
      attachments,
      wasAborted()
    );
  }

  private parseNumber(value: unknown) {
    if (!value) {
      return undefined;
    }
    const num = Number.parseInt(String(value), 10);
    return Number.isNaN(num) ? undefined : num;
  }
}

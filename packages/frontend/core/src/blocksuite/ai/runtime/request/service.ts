import type { NbstoreService } from '@affine/core/modules/storage';
import {
  ContextCategories,
  type CopilotChatHistoryFragment,
  type getCopilotHistoriesQuery,
  type GraphQLQuery,
  type ProjectChatContextItemInput,
  projectChatContextQuery,
  projectOfficeArtifactQuery,
  projectResourceQuery,
  type QueryChatSessionsInput,
  type QueryOptions,
  type QueryResponse,
  type RequestOptions,
  type UpdateChatSessionInput,
  updateProjectChatContextMutation,
  uploadProjectChatContextFileMutation,
} from '@affine/graphql';
import { Subject } from 'rxjs';

import type { ActionEventType } from '../../provider';
import {
  type AIActionId,
  type AIActionModelSelection,
  type AIActionOptions,
  getActionDefinition,
  resolveActionDefinitionPromptName,
  resolveDefinitionValue,
} from './action-definitions';
import {
  CopilotClient,
  type CopilotClient as CopilotClientType,
} from './copilot-client';
import { textToText, toImage } from './message-transport';

type CreateSessionOptions = Omit<
  BlockSuitePresets.AICreateSessionOptions,
  'workspaceId'
> & {
  workspaceId?: string;
  projectId?: string;
};

export type AIRequestActionEvent = {
  action: AIActionId;
  options: AIActionOptions;
  event: ActionEventType;
  modelSelection?: AIActionModelSelection;
  promptName: CreateSessionOptions['promptName'];
};

export class AIRequestService {
  private lastActionSessionId = '';
  private readonly actionHistory: {
    action: AIActionId;
    options: AIActionOptions;
    promptName: CreateSessionOptions['promptName'];
  }[] = [];
  readonly actionEvents$ = new Subject<AIRequestActionEvent>();

  constructor(readonly client: CopilotClientType) {}

  isReady() {
    return true;
  }

  readonly projectContext = {
    get: async (projectId: string, sessionId: string) =>
      (
        await this.client.gql({
          query: projectChatContextQuery,
          variables: { projectId, sessionId },
        })
      ).projectChatContext,
    set: async (
      projectId: string,
      sessionId: string,
      expectedVersion: number,
      items: ProjectChatContextItemInput[]
    ) =>
      (
        await this.client.gql({
          query: updateProjectChatContextMutation,
          variables: { projectId, sessionId, expectedVersion, items },
        })
      ).updateProjectChatContext,
    upload: async (
      projectId: string,
      sessionId: string,
      expectedVersion: number,
      file: File
    ) =>
      (
        await this.client.gql({
          query: uploadProjectChatContextFileMutation,
          variables: { projectId, sessionId, expectedVersion, file },
        })
      ).uploadProjectChatContextFile,
    resource: async (projectId: string, resourceId: string) => {
      const { projectResource: resource } = await this.client.gql({
        query: projectResourceQuery,
        variables: { projectId, resourceId },
      });
      const sequence = resource.officeArtifactId
        ? (
            await this.client.gql({
              query: projectOfficeArtifactQuery,
              variables: { projectId, artifactId: resource.officeArtifactId },
            })
          ).projectOfficeArtifact.currentRevision.sequence
        : resource.contentVersion;
      return {
        kind: 'resource',
        resourceId,
        sequence,
      } satisfies ProjectChatContextItemInput;
    },
  };

  async createSession(options: CreateSessionOptions) {
    if (options.sessionId) return options.sessionId;
    if (options.retry) return this.lastActionSessionId;
    return this.client.createSession({
      workspaceId: options.workspaceId,
      projectId: options.projectId,
      docId: options.docId,
      promptName: options.promptName,
      pinned: options.pinned,
      reuseLatestChat: options.reuseLatestChat,
    });
  }

  async createSessionWithHistory(options: CreateSessionOptions) {
    if (!options.sessionId && !options.retry) {
      return this.client.createSessionWithHistory({
        workspaceId: options.workspaceId,
        projectId: options.projectId,
        docId: options.docId,
        promptName: options.promptName,
        pinned: options.pinned,
        reuseLatestChat: options.reuseLatestChat,
      });
    }

    const sessionId = await this.createSession(options);
    if (!sessionId) return undefined;
    if (options.projectId)
      return this.getProjectSession(options.projectId, sessionId);
    if (!options.workspaceId)
      throw new Error('A session resource owner is required');
    return this.getSession(options.workspaceId, sessionId);
  }

  getProjectSession(projectId: string, sessionId: string) {
    return this.client.getProjectSession(projectId, sessionId);
  }

  getProjectSessions(...args: Parameters<CopilotClient['getProjectSessions']>) {
    return this.client.getProjectSessions(...args);
  }

  cleanupProjectSessions(projectId: string, sessionIds: string[]) {
    return this.client.cleanupProjectSessions(projectId, sessionIds);
  }

  getSession(workspaceId: string, sessionId: string) {
    return this.client
      .getHistories(workspaceId, {}, undefined, {
        sessionId,
        withMessages: true,
      } as RequestOptions<
        typeof getCopilotHistoriesQuery
      >['variables']['options'])
      .then(
        histories =>
          (histories?.[0] ?? null) as CopilotChatHistoryFragment | null
      );
  }

  getSessions(
    workspaceId: string,
    docId?: string,
    options?: QueryChatSessionsInput,
    signal?: AbortSignal
  ) {
    return this.client.getSessions(
      workspaceId,
      {},
      docId,
      { ...options, withMessages: true },
      signal
    );
  }

  getRecentSessions(workspaceId: string, limit?: number, offset?: number) {
    return this.client.getHistories(
      workspaceId,
      { first: limit, offset },
      undefined,
      {
        action: false,
        fork: false,
        sessionOrder: 'desc',
        withMessages: true,
      } as RequestOptions<
        typeof getCopilotHistoriesQuery
      >['variables']['options']
    );
  }

  updateSession(options: UpdateChatSessionInput) {
    return this.client.updateSession(options);
  }

  cleanupSessions(input: {
    workspaceId: string;
    docId: string | undefined;
    sessionIds: string[];
  }) {
    return this.client.cleanupSessions(input);
  }

  histories = {
    actions: async (
      workspaceId: string,
      docId: string
    ): Promise<BlockSuitePresets.AIHistory[]> => {
      return ((await this.client.getHistories(workspaceId, {}, docId, {
        action: true,
        withPrompt: true,
        withMessages: true,
      } as RequestOptions<
        typeof getCopilotHistoriesQuery
      >['variables']['options'])) ?? []) as BlockSuitePresets.AIHistory[];
    },
    chats: async (
      workspaceId: string,
      sessionId: string,
      docId?: string
    ): Promise<BlockSuitePresets.AIHistory[]> => {
      return ((await this.client.getHistories(workspaceId, {}, docId, {
        sessionId,
        withMessages: true,
      } as RequestOptions<
        typeof getCopilotHistoriesQuery
      >['variables']['options'])) ?? []) as BlockSuitePresets.AIHistory[];
    },
    cleanup: async (
      workspaceId: string,
      docId: string | undefined,
      sessionIds: string[]
    ) => {
      await this.cleanupSessions({ workspaceId, docId, sessionIds });
    },
    ids: async (
      workspaceId: string,
      docId?: string,
      options?: RequestOptions<
        typeof getCopilotHistoriesQuery
      >['variables']['options']
    ): Promise<BlockSuitePresets.AIHistoryIds[]> => {
      return (await this.client.getHistoryIds(
        workspaceId,
        {},
        docId,
        options
      )) as unknown as BlockSuitePresets.AIHistoryIds[];
    },
  };

  context = {
    getSessionScope: (workspaceId: string, sessionId: string) =>
      this.client.getContextSessionScope(workspaceId, sessionId),
    createContext: (workspaceId: string, sessionId: string) =>
      this.client.createContext(workspaceId, sessionId),
    getContextId: (workspaceId: string, sessionId: string) =>
      this.client.getContextId(workspaceId, sessionId),
    addContextDoc: (options: { contextId: string; docId: string }) =>
      this.client.addContextDoc(options),
    removeContextDoc: (options: { contextId: string; docId: string }) =>
      this.client.removeContextDoc(options),
    addContextFile: (
      file: File,
      options: Parameters<CopilotClient['addContextFile']>[1]
    ) => this.client.addContextFile(file, options),
    removeContextFile: (options: { contextId: string; fileId: string }) =>
      this.client.removeContextFile(options),
    addContextTag: (options: {
      contextId: string;
      tagId: string;
      docIds: string[];
    }) =>
      this.client.addContextCategory({
        contextId: options.contextId,
        type: ContextCategories.Tag,
        categoryId: options.tagId,
        docs: options.docIds,
      }),
    removeContextTag: (options: { contextId: string; tagId: string }) =>
      this.client.removeContextCategory({
        contextId: options.contextId,
        type: ContextCategories.Tag,
        categoryId: options.tagId,
      }),
    addContextCollection: (options: {
      contextId: string;
      collectionId: string;
      docIds: string[];
    }) =>
      this.client.addContextCategory({
        contextId: options.contextId,
        type: ContextCategories.Collection,
        categoryId: options.collectionId,
        docs: options.docIds,
      }),
    removeContextCollection: (options: {
      contextId: string;
      collectionId: string;
    }) =>
      this.client.removeContextCategory({
        contextId: options.contextId,
        type: ContextCategories.Collection,
        categoryId: options.collectionId,
      }),
    getContextDocsAndFiles: (
      workspaceId: string,
      sessionId: string,
      contextId: string
    ) => this.client.getContextDocsAndFiles(workspaceId, sessionId, contextId),
    matchContext: (
      content: string,
      contextId?: string,
      workspaceId?: string,
      limit?: number,
      scopedThreshold?: number,
      threshold?: number
    ) =>
      this.client.matchContext(
        content,
        contextId,
        workspaceId,
        limit,
        scopedThreshold,
        threshold
      ),
    addContextBlob: (options: { blobId: string; contextId: string }) =>
      this.client.addContextBlob({
        contextId: options.contextId,
        blobId: options.blobId,
      }),
    removeContextBlob: (options: { blobId: string; contextId: string }) =>
      this.client.removeContextBlob({
        contextId: options.contextId,
        blobId: options.blobId,
      }),
    pollContextDocsAndFiles: async (
      workspaceId: string,
      sessionId: string,
      contextId: string,
      onPoll: (
        result: BlockSuitePresets.AIDocsAndFilesContext | undefined
      ) => void,
      abortSignal: AbortSignal
    ) => {
      let attempts = 0;
      const minInterval = 1000;
      const maxInterval = 30 * 1000;

      while (!abortSignal.aborted) {
        const result = await this.client.getContextDocsAndFiles(
          workspaceId,
          sessionId,
          contextId
        );
        onPoll(result);
        const interval = Math.min(
          minInterval * Math.pow(1.5, attempts),
          maxInterval
        );
        attempts++;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    pollEmbeddingStatus: async (
      workspaceId: string,
      onPoll: (
        result: Awaited<ReturnType<CopilotClientType['getEmbeddingStatus']>>
      ) => void,
      abortSignal: AbortSignal
    ) => {
      const interval = 10 * 1000;
      while (!abortSignal.aborted) {
        onPoll(await this.client.getEmbeddingStatus(workspaceId));
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
  };

  forkChat(options: BlockSuitePresets.AIForkChatSessionOptions) {
    return this.client.forkSession(options);
  }

  reportLastAction(event: ActionEventType, host?: unknown) {
    const lastAction = host
      ? this.actionHistory.findLast(item => item.options.host === host)
      : this.actionHistory.at(-1);
    if (!lastAction) return;
    const actionEvent = {
      action: lastAction.action,
      options: lastAction.options,
      event,
      modelSelection: lastAction.options.modelSelection,
      promptName: lastAction.promptName,
    };
    this.actionEvents$.next(actionEvent);
    return actionEvent;
  }

  private wrapTextStream(
    stream: AsyncIterable<string>,
    id: AIActionId,
    options: AIActionOptions,
    promptName: CreateSessionOptions['promptName']
  ): AsyncIterable<string> {
    const actionEvents$ = this.actionEvents$;
    return {
      async *[Symbol.asyncIterator]() {
        try {
          yield* stream;
          actionEvents$.next({
            action: id,
            options,
            event: 'finished',
            modelSelection: options.modelSelection,
            promptName,
          });
        } catch (error) {
          actionEvents$.next({
            action: id,
            options,
            event: 'error',
            modelSelection: options.modelSelection,
            promptName,
          });
          throw error;
        }
      },
    };
  }

  async executeAction(id: AIActionId, options: AIActionOptions) {
    const definition = getActionDefinition(id);
    definition.validate?.(options);
    const promptName = resolveActionDefinitionPromptName(definition, options);

    this.actionHistory.push({ action: id, options, promptName });
    if (this.actionHistory.length > 10) {
      this.actionHistory.shift();
    }
    this.actionEvents$.next({
      action: id,
      options,
      event: 'started',
      modelSelection: options.modelSelection,
      promptName,
    });
    const sessionId = await this.createSession({
      ...options,
      promptName,
    } as CreateSessionOptions);
    this.lastActionSessionId = sessionId;

    const actionId = resolveDefinitionValue(definition.actionId, options);
    const actionVersion = resolveDefinitionValue(
      definition.actionVersion,
      options
    );
    const transportOptions = {
      ...options,
      client: this.client,
      sessionId,
      content: definition.buildContent?.(options) ?? options.input,
      params: definition.buildParams?.(options),
      timeout: definition.timeout,
      endpoint: definition.endpoint,
      actionId,
      actionVersion,
      modelSelectionSource: options.modelSelection?.source,
    };

    const stream =
      definition.responseType === 'image'
        ? toImage(transportOptions)
        : textToText(transportOptions);
    return this.wrapTextStream(
      stream as AsyncIterable<string>,
      id,
      options,
      promptName
    );
  }
}

export function createAIRequestService(
  gql: <Query extends GraphQLQuery>(
    options: QueryOptions<Query>
  ) => Promise<QueryResponse<Query>>,
  eventSource: (
    url: string,
    eventSourceInitDict?: EventSourceInit
  ) => EventSource,
  realtime?: Pick<NbstoreService['realtime'], 'request'>
) {
  return new AIRequestService(new CopilotClient(gql, eventSource, realtime));
}

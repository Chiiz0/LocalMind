import type { AIToolsConfig } from '@affine/core/modules/ai-button';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { I18n } from '@affine/i18n';

export type AIChatScope =
  | {
      kind: 'project';
      projectId: string;
      workspaceId?: never;
    }
  | {
      kind: 'doc';
      workspaceId: string;
      docId: string;
      pendingSessionId?: string;
    }
  | {
      kind: 'workspace';
      workspaceId: string;
    }
  | {
      kind: 'fork';
      workspaceId: string;
      parentSessionId: string;
      latestMessageId?: string;
      docId?: string;
    }
  | {
      kind: 'chat-block';
      workspaceId: string;
      docId: string;
      blockId: string;
      parentSessionId?: string;
      latestMessageId?: string;
    }
  | {
      kind: 'playground';
      workspaceId: string;
      docId?: string;
      parentSessionId?: string;
      latestMessageId?: string;
    };

export type AIChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  streamObjects?: unknown[];
  attachments?: string[];
  userId?: string;
  userName?: string;
  avatarUrl?: string;
};

export type AIChatTab =
  | {
      kind: 'draft';
      id: string;
      title: string;
      scope: AIChatScope;
      hasMessages: false;
    }
  | {
      kind: 'session';
      id: string;
      sessionId: string;
      title: string;
      docId: string | null;
      pinned: boolean;
      hasMessages: boolean;
    };

export type AIChatStatus =
  | 'idle'
  | 'loading'
  | 'transmitting'
  | 'success'
  | 'error';

export type AIChatHistoryGroups = {
  currentDoc: CopilotChatHistoryFragment[];
  recent: CopilotChatHistoryFragment[];
  loading: boolean;
  error: Error | null;
};

export type AIChatContextItem =
  | {
      kind: 'doc';
      docId: string;
      state?: string;
      createdAt?: number;
      tooltip?: string;
    }
  | {
      kind: 'file';
      file: File;
      blobId?: string;
      fileId?: string;
      state?: string;
      createdAt?: number;
      tooltip?: string;
    }
  | {
      kind: 'tag';
      tagId: string;
      docIds: string[];
      state?: string;
      createdAt?: number;
      tooltip?: string;
    }
  | {
      kind: 'collection';
      collectionId: string;
      docIds: string[];
      state?: string;
      createdAt?: number;
      tooltip?: string;
    }
  | {
      kind: 'blob';
      blobId: string;
      state?: string;
      createdAt?: number;
      tooltip?: string;
    };

export type AIChatModifiedDocument = {
  docId: string;
  updatedAt: number;
};

export type AIChatContextState = {
  contextId: string | null;
  items: AIChatContextItem[];
  modifiedDocuments: AIChatModifiedDocument[];
  loading: boolean;
  polling: boolean;
  error: Error | null;
  embeddingCompleted: boolean;
  embeddingCount: Record<'finished' | 'processing' | 'failed', number>;
};

export type AIChatProjectScopeState = {
  loading: boolean;
  error: Error | null;
  projectResolution: string;
  selectedProjectId: string | null;
  candidates: Array<{ id: string; name: string }>;
};

export type AIChatComposerState = {
  text: string;
  attachments: (string | Blob | File)[];
  context: AIChatContextState;
  projectScope: AIChatProjectScopeState;
  reasoning: boolean;
  toolsConfig?: AIToolsConfig;
  modelId?: string;
};

export type AIChatNavigationRequest = {
  workspaceId: string;
  docId: string;
  sessionId: string;
  resetTabs: true;
};

export type AIChatSnapshot = {
  scope: AIChatScope;
  readiness: 'initializing' | 'ready' | 'unavailable';
  activeSessionId: string | null;
  activeTabId: string | null;
  tabs: AIChatTab[];
  sessions: CopilotChatHistoryFragment[];
  history: AIChatHistoryGroups;
  messages: AIChatMessage[];
  status: AIChatStatus;
  error: Error | null;
  composer: AIChatComposerState;
  navigationRequest: AIChatNavigationRequest | null;
  uiPolicy: {
    showDraftTab: boolean;
    canCreateNewSession: boolean;
    canCloseActiveTab: boolean;
    canPinActiveSession: boolean;
    canSend: boolean;
  };
};

export function createInitialComposerState(): AIChatComposerState {
  return {
    text: '',
    attachments: [],
    context: {
      contextId: null,
      items: [],
      modifiedDocuments: [],
      loading: false,
      polling: false,
      error: null,
      embeddingCompleted: false,
      embeddingCount: {
        finished: 0,
        processing: 0,
        failed: 0,
      },
    },
    projectScope: {
      loading: false,
      error: null,
      projectResolution: 'none',
      selectedProjectId: null,
      candidates: [],
    },
    reasoning: false,
  };
}

export function sessionToTab(session: CopilotChatHistoryFragment): AIChatTab {
  return {
    kind: 'session',
    id: session.sessionId,
    sessionId: session.sessionId,
    title: session.title || 'New chat',
    docId: session.docId ?? null,
    pinned: !!session.pinned,
    hasMessages: !!session.messages?.length,
  };
}

export function createDraftTab(scope: AIChatScope): AIChatTab {
  return {
    kind: 'draft',
    id: `draft:${scope.kind}:${scope.kind === 'project' ? scope.projectId : 'docId' in scope ? (scope.docId ?? '') : ''}`,
    get title() {
      return I18n['com.affine.localmind.documentUpdate.newChat']();
    },
    scope,
    hasMessages: false,
  };
}

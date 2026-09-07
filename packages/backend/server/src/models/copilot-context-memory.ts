import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';

import { BadRequest, NotFound } from '../base';
import { BaseModel } from './base';
import { toPgVector } from './common';

export const AUTO_MEMORY_SCOPE_LIMIT = 200;
const CONTEXT_PROJECT_DOCUMENT_LIMIT = 100;

export const COPILOT_CONTEXT_MEMORY_SCOPES = [
  'user',
  'workspace',
  'document',
  'project',
] as const;
export type CopilotContextMemoryScope =
  (typeof COPILOT_CONTEXT_MEMORY_SCOPES)[number];

export const COPILOT_CONTEXT_MEMORY_KINDS = [
  'rule',
  'auto_memory',
  'project_summary',
] as const;
export type CopilotContextMemoryKind =
  (typeof COPILOT_CONTEXT_MEMORY_KINDS)[number];

export const COPILOT_CONTEXT_MEMORY_VISIBILITIES = ['private'] as const;
export type CopilotContextMemoryVisibility =
  (typeof COPILOT_CONTEXT_MEMORY_VISIBILITIES)[number];

export const COPILOT_CONTEXT_MEMORY_STATUSES = [
  'active',
  'disabled',
  'superseded',
  'deleted',
  'expired',
] as const;
export type CopilotContextMemoryStatus =
  (typeof COPILOT_CONTEXT_MEMORY_STATUSES)[number];

export type CopilotContextMemorySourceDocumentInput = {
  workspaceId: string;
  docId: string;
};

export const COPILOT_CONTEXT_PROJECT_STATUSES = ['active', 'archived'] as const;
export type CopilotContextProjectStatus =
  (typeof COPILOT_CONTEXT_PROJECT_STATUSES)[number];

export const COPILOT_CONTEXT_PROJECT_ROLES = ['owner', 'member'] as const;
export type CopilotContextProjectRole =
  (typeof COPILOT_CONTEXT_PROJECT_ROLES)[number];

export type CopilotContextMemoryInput = {
  ownerUserId: string;
  workspaceId?: string | null;
  docId?: string | null;
  projectId?: string | null;
  sourceSessionId?: string | null;
  scope: CopilotContextMemoryScope;
  kind: CopilotContextMemoryKind;
  visibility: CopilotContextMemoryVisibility;
  status?: CopilotContextMemoryStatus;
  content: string;
  factKey?: string | null;
  confidence?: number;
  importance?: number;
  sensitivity?: 'private' | 'personal' | 'restricted';
  captureMode?: 'manual' | 'explicit' | 'implicit' | 'legacy';
  writerVersion?: string;
  validFrom?: Date | null;
  validUntil?: Date | null;
  expiresAt?: Date | null;
  supersedesId?: string | null;
  metadata?: Record<string, unknown>;
  sourceDocuments?: CopilotContextMemorySourceDocumentInput[];
};

export type CopilotContextMemoryWriterOperation =
  | 'ADD'
  | 'UPDATE'
  | 'DELETE'
  | 'NOOP';

export type CopilotContextMemoryWriterDecision = {
  operation: CopilotContextMemoryWriterOperation;
  factKey?: string | null;
  content?: string | null;
  confidence: number;
  importance: number;
  sensitivity: 'private' | 'personal' | 'restricted';
  validFrom?: Date | null;
  validUntil?: Date | null;
  expiresAt?: Date | null;
  reasonCode: string;
};

export type CopilotContextMemoryWriterInput = {
  ownerUserId: string;
  workspaceId: string | null;
  docId?: string | null;
  projectId?: string | null;
  sourceSessionId?: string | null;
  sourceTurnId?: string | null;
  scope: Exclude<CopilotContextMemoryScope, 'user'>;
  explicit: boolean;
  writerVersion: string;
  decisionFingerprint: string;
  sourceDocuments?: CopilotContextMemorySourceDocumentInput[];
  decision: CopilotContextMemoryWriterDecision;
};

export type CopilotContextCheckpointInput = {
  sessionId: string;
  strategyVersion: string;
  strategyFingerprint: string;
  summary: string;
  summarizedMessageCount: number;
  sourceFingerprint: string;
  diagnostics: Record<string, unknown>;
};

export type CopilotContextStrategyRevisionInput = {
  version: string;
  fingerprint: string;
  status: 'active' | 'archived';
  config: Record<string, unknown>;
};

export type CopilotContextPlanTraceInput = {
  sessionId: string;
  sourceTurnId?: string | null;
  strategyVersion: string;
  strategyFingerprint: string;
  inputMessageCount: number;
  retainedMessageCount: number;
  omittedMessageCount: number;
  candidateMemoryCount: number;
  selectedMemoryCount: number;
  summaryInjected: boolean;
  planningPasses: number;
  contextCharBudget: number;
  contextCharCount: number;
  sourceFingerprint: string;
  outputFingerprint: string;
  candidateMemoryIds: string[];
  selectedMemories: Array<{
    id: string | null;
    scope: CopilotContextMemoryScope;
    kind: CopilotContextMemoryKind;
    score: number;
    rank: number;
    sourceType?: 'memory' | 'rule' | 'policy';
    sourceRevisionId?: string;
    matchReason?: 'always' | 'condition' | 'semantic' | 'manual';
  }>;
  scope: Record<string, unknown>;
};

export type CopilotContextProjectInput = {
  createdByUserId: string;
  name: string;
  description?: string;
  documents: CopilotContextProjectDocumentInput[];
};

export type CopilotContextProjectDocumentInput = {
  workspaceId: string;
  docId: string;
  groupId?: string | null;
  sortOrder?: number;
};

export type CopilotContextDocumentRef = Pick<
  CopilotContextProjectDocumentInput,
  'workspaceId' | 'docId'
>;

function normalizeMemoryContent(content: string) {
  return content.replace(/\s+/g, ' ').trim();
}

function normalizeFactKey(factKey?: string | null) {
  const normalized = factKey?.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  return normalized || null;
}

function activeMemoryLifecycleWhere(now = new Date()) {
  return {
    status: 'active',
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  } satisfies Prisma.AiContextMemoryWhereInput;
}

function memoryWriterLockKey(input: {
  ownerUserId: string;
  workspaceId: string | null;
  scope: CopilotContextMemoryScope;
  docId?: string | null;
  projectId?: string | null;
  factKey?: string | null;
  fallback: string;
}) {
  return [
    'context-memory-writer/v1',
    input.scope === 'project' ? '' : input.ownerUserId,
    input.scope === 'project' ? '' : input.workspaceId,
    input.scope,
    input.docId ?? '',
    input.projectId ?? '',
    normalizeFactKey(input.factKey) ?? input.fallback,
  ].join(':');
}

function memoryScopeWorkspaceId(input: {
  scope: CopilotContextMemoryScope;
  workspaceId?: string | null;
}) {
  return input.scope === 'project' ? null : (input.workspaceId ?? null);
}

export function fingerprintContextMemory(input: {
  scope: CopilotContextMemoryScope;
  kind: CopilotContextMemoryKind;
  content: string;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        scope: input.scope,
        kind: input.kind,
        content: normalizeMemoryContent(input.content).toLowerCase(),
      })
    )
    .digest('hex');
}

function memoryIdentityWhere(input: CopilotContextMemoryInput) {
  return {
    ...(input.visibility === 'private' && input.scope !== 'project'
      ? { ownerUserId: input.ownerUserId }
      : {}),
    workspaceId: memoryScopeWorkspaceId(input),
    docId: input.docId ?? null,
    projectId: input.projectId ?? null,
    kind: input.kind,
    status: 'active',
    fingerprint: fingerprintContextMemory(input),
  } satisfies Prisma.AiContextMemoryWhereInput;
}

export function buildContextMemoryVisibilityWhere(input: {
  userId: string;
  workspaceId?: string | null;
  docId?: string | null;
  docIds?: string[];
  documentRefs?: CopilotContextDocumentRef[];
  projectIds?: string[];
  includeDisabled?: boolean;
}) {
  const documentRefs = new Map<string, CopilotContextDocumentRef>();
  if (input.workspaceId) {
    for (const docId of [input.docId, ...(input.docIds ?? [])]) {
      if (!docId) continue;
      documentRefs.set(`${input.workspaceId}\u0000${docId}`, {
        workspaceId: input.workspaceId,
        docId,
      });
    }
  }
  for (const document of input.documentRefs ?? []) {
    if (!document.workspaceId || !document.docId) continue;
    documentRefs.set(`${document.workspaceId}\u0000${document.docId}`, {
      workspaceId: document.workspaceId,
      docId: document.docId,
    });
  }
  const documentIdsByWorkspace = new Map<string, string[]>();
  for (const document of documentRefs.values()) {
    const current = documentIdsByWorkspace.get(document.workspaceId) ?? [];
    current.push(document.docId);
    documentIdsByWorkspace.set(document.workspaceId, current);
  }
  const scopes: Prisma.AiContextMemoryWhereInput[] = [
    {
      ownerUserId: input.userId,
      scope: 'user',
      workspaceId: null,
      docId: null,
      projectId: null,
    },
  ];
  if (input.workspaceId) {
    scopes.push({
      ownerUserId: input.userId,
      scope: 'workspace',
      workspaceId: input.workspaceId,
      docId: null,
      projectId: null,
    });
  }
  for (const [workspaceId, docIds] of documentIdsByWorkspace) {
    scopes.push({
      ownerUserId: input.userId,
      scope: 'document',
      workspaceId,
      docId: { in: docIds },
      projectId: null,
    });
  }
  if (input.projectIds?.length) {
    scopes.push({
      scope: 'project',
      workspaceId: null,
      docId: null,
      projectId: { in: input.projectIds },
      project: {
        status: 'active',
        members: { some: { userId: input.userId } },
      },
    });
  }

  return {
    ...(input.includeDisabled
      ? { status: { in: ['active', 'disabled'] } }
      : activeMemoryLifecycleWhere()),
    visibility: 'private',
    OR: scopes,
  } satisfies Prisma.AiContextMemoryWhereInput;
}

@Injectable()
export class CopilotContextMemoryModel extends BaseModel {
  private memoryManagementWhere(id: string, actorUserId: string) {
    return {
      id,
      OR: [
        {
          ownerUserId: actorUserId,
          scope: { not: 'project' },
        },
        {
          scope: 'project',
          project: {
            status: 'active',
            members: {
              some: { userId: actorUserId, role: 'owner' },
            },
          },
        },
      ],
    } satisfies Prisma.AiContextMemoryWhereInput;
  }

  private async lockWriterKey(key: string) {
    await this.db.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS "locked"
    `;
  }

  private projectMemorySourceDocuments(input: {
    scope: CopilotContextMemoryScope;
    projectId?: string | null;
    sourceDocuments?: CopilotContextMemorySourceDocumentInput[];
  }) {
    if (input.scope !== 'project') return null;
    const projectId = input.projectId?.trim();
    if (!projectId) {
      throw new BadRequest('Project memory requires a projectId');
    }
    const documents = new Map<
      string,
      CopilotContextMemorySourceDocumentInput
    >();
    for (const document of input.sourceDocuments ?? []) {
      const workspaceId = document.workspaceId.trim();
      const docId = document.docId.trim();
      if (!workspaceId || !docId) {
        throw new BadRequest(
          'Project memory source workspaceId and docId are required'
        );
      }
      documents.set(`${workspaceId}\0${docId}`, { workspaceId, docId });
    }
    if (!documents.size) {
      throw new BadRequest(
        'Project memory requires at least one source document'
      );
    }
    return {
      projectId,
      documents: [...documents.values()].sort(
        (left, right) =>
          left.workspaceId.localeCompare(right.workspaceId) ||
          left.docId.localeCompare(right.docId)
      ),
    };
  }

  private async attachProjectMemorySources(input: {
    memoryId: string;
    projectId: string;
    sourceDocuments: CopilotContextMemorySourceDocumentInput[];
  }) {
    await this.models.intelligenceWorkbenchAuthorization.attachProjectMemorySources(
      {
        memoryId: input.memoryId,
        projectId: input.projectId,
        documents: input.sourceDocuments,
      }
    );
  }

  private async lockProjectOwner(projectId: string, actorUserId: string) {
    await this.db.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`context-project-documents:${projectId}`}, 0)
      )
    `;
    const rows = await this.db.$queryRaw<
      Array<{ id: string; status: CopilotContextProjectStatus }>
    >`
      SELECT project.id, project.status
      FROM ai_context_projects project
      JOIN ai_context_project_members member
        ON member.project_id = project.id
       AND member.user_id = ${actorUserId}
       AND member.role = 'owner'
      WHERE project.id = ${projectId}
      LIMIT 1
      FOR UPDATE OF project, member
    `;
    return rows[0] ?? null;
  }

  private async lockActiveProjectOwner(projectId: string, actorUserId: string) {
    const project = await this.lockProjectOwner(projectId, actorUserId);
    return project?.status === 'active' ? project : null;
  }

  async getPreference(userId: string, workspaceId: string) {
    return await this.db.aiContextPreference.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    });
  }

  @Transactional()
  async putPreference(input: {
    userId: string;
    workspaceId: string;
    autoMemoryEnabled: boolean;
  }) {
    return await this.db.aiContextPreference.upsert({
      where: {
        userId_workspaceId: {
          userId: input.userId,
          workspaceId: input.workspaceId,
        },
      },
      create: input,
      update: {
        autoMemoryEnabled: input.autoMemoryEnabled,
      },
    });
  }

  @Transactional()
  async put(input: CopilotContextMemoryInput) {
    if (input.scope === 'project' && input.sourceSessionId && input.projectId) {
      await this.models.copilotContext.assertProjectSourcesShared({
        sessionId: input.sourceSessionId,
        actorId: input.ownerUserId,
        projectId: input.projectId,
        sink: {
          type: 'project_memory',
          id: input.sourceSessionId,
          phase: 'execute',
        },
      });
    }
    const projectSource = this.projectMemorySourceDocuments(input);
    const content = normalizeMemoryContent(input.content);
    const identity = memoryIdentityWhere({ ...input, content });
    const existing = await this.db.aiContextMemory.findFirst({
      where: identity,
    });
    const data = {
      ownerUserId: input.ownerUserId,
      workspaceId: memoryScopeWorkspaceId(input),
      docId: input.docId ?? null,
      projectId: input.projectId ?? null,
      sourceSessionId: input.sourceSessionId ?? null,
      scope: input.scope,
      kind: input.kind,
      visibility: input.visibility,
      status: input.status ?? 'active',
      content,
      fingerprint: identity.fingerprint as string,
      factKey: normalizeFactKey(input.factKey),
      confidence: input.confidence ?? 1,
      importance: input.importance ?? 0.5,
      sensitivity: input.sensitivity ?? 'private',
      captureMode: input.captureMode ?? 'manual',
      writerVersion: input.writerVersion ?? 'legacy/v1',
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      expiresAt: input.expiresAt ?? null,
      supersedesId: input.supersedesId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    };

    if (existing) {
      if (projectSource) {
        await this.attachProjectMemorySources({
          memoryId: existing.id,
          projectId: projectSource.projectId,
          sourceDocuments: projectSource.documents,
        });
        return existing;
      }
      return await this.db.aiContextMemory.update({
        where: { id: existing.id },
        data: {
          ...data,
          ownerUserId: data.ownerUserId,
          status: input.status ?? existing.status,
        },
      });
    }

    try {
      const created = await this.db.aiContextMemory.create({ data });
      if (projectSource) {
        await this.attachProjectMemorySources({
          memoryId: created.id,
          projectId: projectSource.projectId,
          sourceDocuments: projectSource.documents,
        });
      }
      return created;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const raced = await this.db.aiContextMemory.findFirst({
        where: identity,
      });
      if (!raced) throw error;
      if (projectSource) {
        await this.attachProjectMemorySources({
          memoryId: raced.id,
          projectId: projectSource.projectId,
          sourceDocuments: projectSource.documents,
        });
        return raced;
      }
      return await this.db.aiContextMemory.update({
        where: { id: raced.id },
        data: {
          ...data,
          ownerUserId: data.ownerUserId,
          status: input.status ?? raced.status,
        },
      });
    }
  }

  private async appendWriterEvent(input: {
    ownerUserId: string;
    workspaceId: string | null;
    sourceSessionId?: string | null;
    sourceTurnId?: string | null;
    operation: 'ADD' | 'UPDATE' | 'DELETE' | 'NOOP' | 'UNDO';
    memoryId?: string | null;
    previousMemoryId?: string | null;
    targetEventId?: string | null;
    factKey?: string | null;
    explicit: boolean;
    reasonCode: string;
    writerVersion: string;
    decisionFingerprint: string;
  }) {
    return await this.db.aiContextMemoryEvent.create({
      data: {
        ...input,
        sourceSessionId: input.sourceSessionId ?? null,
        sourceTurnId: input.sourceTurnId ?? null,
        memoryId: input.memoryId ?? null,
        previousMemoryId: input.previousMemoryId ?? null,
        targetEventId: input.targetEventId ?? null,
        factKey: normalizeFactKey(input.factKey),
      },
    });
  }

  @Transactional()
  async applyWriterDecision(input: CopilotContextMemoryWriterInput) {
    if (!input.workspaceId && input.scope !== 'project')
      throw new BadRequest('Workspace memory requires a workspace');
    if (input.scope === 'project' && !input.sourceSessionId)
      throw new BadRequest(
        'Project memory writer requires a source conversation'
      );
    let sessionDocuments: CopilotContextMemorySourceDocumentInput[] = [];
    let projectSourceCheckId: string | undefined;
    if (input.scope === 'project' && input.sourceSessionId) {
      if (!input.projectId)
        throw new BadRequest('Project memory requires a project');
      const session = await this.models.copilotSession.getMeta(
        input.sourceSessionId
      );
      if (!session || session.workspaceId !== input.workspaceId)
        throw new BadRequest('Memory conversation owner does not match');
      if (
        !input.workspaceId &&
        (!input.sourceTurnId ||
          !(await this.db.aiSessionMessage.findFirst({
            where: {
              id: input.sourceTurnId,
              sessionId: input.sourceSessionId,
              role: 'user',
            },
            select: { id: true },
          })))
      )
        throw new BadRequest('Project memory requires a persisted user turn');
      const checkId =
        await this.models.copilotContext.checkProjectSourcesShared({
          sessionId: input.sourceSessionId,
          actorId: input.ownerUserId,
          projectId: input.projectId,
          sink: {
            type: 'project_memory',
            id: input.decisionFingerprint,
            phase: input.decision.operation === 'NOOP' ? 'noop' : 'execute',
          },
        });
      if (!input.workspaceId) projectSourceCheckId = checkId;
      sessionDocuments = (
        await this.models.copilotContext.getSessionSources(
          input.sourceSessionId
        )
      ).documentRefs;
    }
    await this.lockWriterKey(
      memoryWriterLockKey({
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId,
        scope: input.scope,
        docId: input.docId,
        projectId: input.projectId,
        factKey: input.decision.factKey,
        fallback: input.decisionFingerprint,
      })
    );
    const replay = await this.db.aiContextMemoryEvent.findUnique({
      where: { decisionFingerprint: input.decisionFingerprint },
      include: { memory: true, previousMemory: true },
    });
    if (replay) return replay;
    const sourceDocuments = [
      ...(input.sourceDocuments ?? []),
      ...sessionDocuments,
    ];
    const projectSource =
      projectSourceCheckId && !sourceDocuments.length
        ? null
        : this.projectMemorySourceDocuments({
            ...input,
            sourceDocuments,
          });

    const factKey = normalizeFactKey(input.decision.factKey);
    const scopeWorkspaceId = memoryScopeWorkspaceId(input);
    const scopeWhere = {
      ...(input.scope === 'project' ? {} : { ownerUserId: input.ownerUserId }),
      workspaceId: scopeWorkspaceId,
      docId: input.docId ?? null,
      projectId: input.projectId ?? null,
      scope: input.scope,
      kind: 'auto_memory',
      visibility: 'private',
    } satisfies Prisma.AiContextMemoryWhereInput;
    const current = factKey
      ? await this.db.aiContextMemory.findFirst({
          where: {
            ...scopeWhere,
            factKey,
            status: 'active',
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        })
      : null;
    const eventBase = {
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
      sourceSessionId: input.sourceSessionId,
      sourceTurnId: input.sourceTurnId,
      factKey,
      explicit: input.explicit,
      writerVersion: input.writerVersion,
      decisionFingerprint: input.decisionFingerprint,
    };

    if (input.decision.operation === 'NOOP') {
      if (projectSource && current) {
        await this.attachProjectMemorySources({
          memoryId: current.id,
          projectId: projectSource.projectId,
          sourceDocuments: projectSource.documents,
        });
      }
      return await this.appendWriterEvent({
        ...eventBase,
        operation: 'NOOP',
        memoryId: current?.id,
        reasonCode: input.decision.reasonCode,
      });
    }

    if (input.decision.operation === 'DELETE') {
      if (!current) {
        return await this.appendWriterEvent({
          ...eventBase,
          operation: 'NOOP',
          reasonCode: 'delete_target_not_found',
        });
      }
      await this.db.aiContextMemory.update({
        where: { id: current.id },
        data: { status: 'deleted' },
      });
      return await this.appendWriterEvent({
        ...eventBase,
        operation: 'DELETE',
        memoryId: current.id,
        reasonCode: input.decision.reasonCode,
      });
    }

    const content = normalizeMemoryContent(input.decision.content ?? '');
    if (!content || !factKey) {
      return await this.appendWriterEvent({
        ...eventBase,
        operation: 'NOOP',
        memoryId: current?.id,
        reasonCode: !content ? 'empty_content' : 'missing_fact_key',
      });
    }
    const fingerprint = fingerprintContextMemory({
      scope: input.scope,
      kind: 'auto_memory',
      content,
    });
    if (current?.fingerprint === fingerprint) {
      if (projectSource) {
        await this.attachProjectMemorySources({
          memoryId: current.id,
          projectId: projectSource.projectId,
          sourceDocuments: projectSource.documents,
        });
      }
      return await this.appendWriterEvent({
        ...eventBase,
        operation: 'NOOP',
        memoryId: current.id,
        reasonCode: 'same_fact_value',
      });
    }

    const requestedValidFrom = input.decision.validFrom ?? new Date();
    const validFrom =
      current?.validFrom && requestedValidFrom <= current.validFrom
        ? new Date(current.validFrom.getTime() + 1)
        : requestedValidFrom;
    if (current) {
      await this.db.aiContextMemory.update({
        where: { id: current.id },
        data: {
          status: 'superseded',
          validUntil: validFrom,
        },
      });
    }
    const memory = await this.db.aiContextMemory.create({
      data: {
        ownerUserId: input.ownerUserId,
        workspaceId: scopeWorkspaceId,
        docId: input.docId ?? null,
        projectId: input.projectId ?? null,
        sourceSessionId: input.sourceSessionId,
        projectSourceCheckId,
        scope: input.scope,
        kind: 'auto_memory',
        visibility: 'private',
        status: 'active',
        content,
        fingerprint,
        factKey,
        confidence: input.decision.confidence,
        importance: input.decision.importance,
        sensitivity: input.decision.sensitivity,
        captureMode: input.explicit ? 'explicit' : 'implicit',
        writerVersion: input.writerVersion,
        validFrom,
        validUntil: input.decision.validUntil ?? null,
        expiresAt: input.decision.expiresAt ?? null,
        supersedesId: current?.id ?? null,
        metadata: {
          reasonCode: input.decision.reasonCode,
          sourceTurnId: input.sourceTurnId ?? null,
        },
      },
    });
    if (projectSource) {
      await this.attachProjectMemorySources({
        memoryId: memory.id,
        projectId: projectSource.projectId,
        sourceDocuments: projectSource.documents,
      });
    }
    return await this.appendWriterEvent({
      ...eventBase,
      operation: current ? 'UPDATE' : 'ADD',
      memoryId: memory.id,
      previousMemoryId: current?.id,
      reasonCode: input.decision.reasonCode,
    });
  }

  @Transactional()
  async undoWriterEvent(input: {
    eventId: string;
    ownerUserId: string;
    workspaceId: string;
  }) {
    const candidate = await this.db.aiContextMemoryEvent.findFirst({
      where: {
        id: input.eventId,
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId,
        operation: { in: ['ADD', 'UPDATE', 'DELETE'] },
        undoneAt: null,
      },
      include: { memory: true },
    });
    if (!candidate?.memoryId || !candidate.memory) return null;
    await this.lockWriterKey(
      memoryWriterLockKey({
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId,
        scope: candidate.memory.scope as CopilotContextMemoryScope,
        docId: candidate.memory.docId,
        projectId: candidate.memory.projectId,
        factKey: candidate.factKey,
        fallback: candidate.id,
      })
    );
    const event = await this.db.aiContextMemoryEvent.findFirst({
      where: {
        id: input.eventId,
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId,
        operation: { in: ['ADD', 'UPDATE', 'DELETE'] },
        undoneAt: null,
      },
      include: { memory: true },
    });
    if (!event?.memoryId || !event.memory) return null;
    const activeFact = await this.db.aiContextMemory.findFirst({
      where: {
        ...(event.memory.scope === 'project'
          ? {}
          : { ownerUserId: input.ownerUserId }),
        workspaceId: event.memory.workspaceId,
        scope: event.memory.scope,
        docId: event.memory.docId,
        projectId: event.memory.projectId,
        factKey: event.factKey,
        kind: 'auto_memory',
        status: 'active',
      },
      select: { id: true },
    });
    if (
      (event.operation === 'DELETE' && event.memory.status !== 'deleted') ||
      (event.operation !== 'DELETE' && event.memory.status !== 'active') ||
      (event.operation === 'DELETE' && activeFact) ||
      (event.operation !== 'DELETE' && activeFact?.id !== event.memoryId)
    ) {
      return null;
    }
    if (event.operation === 'ADD') {
      const deleted = await this.db.aiContextMemory.updateMany({
        where: { id: event.memoryId, status: 'active' },
        data: { status: 'deleted' },
      });
      if (deleted.count !== 1) {
        throw new Error('Context memory changed while undoing an add');
      }
    } else if (event.operation === 'UPDATE') {
      const superseded = await this.db.aiContextMemory.updateMany({
        where: { id: event.memoryId, status: 'active' },
        data: { status: 'superseded', validUntil: new Date() },
      });
      if (superseded.count !== 1) {
        throw new Error('Context memory changed while undoing an update');
      }
      if (event.previousMemoryId) {
        const restored = await this.db.aiContextMemory.updateMany({
          where: { id: event.previousMemoryId, status: 'superseded' },
          data: { status: 'active', validUntil: null },
        });
        if (restored.count !== 1) {
          throw new Error(
            'Previous context memory changed while undoing an update'
          );
        }
      }
    } else {
      const restored = await this.db.aiContextMemory.updateMany({
        where: { id: event.memoryId, status: 'deleted' },
        data: { status: 'active' },
      });
      if (restored.count !== 1) {
        throw new Error('Context memory changed while undoing a delete');
      }
    }

    const undoneAt = new Date();
    const updated = await this.db.aiContextMemoryEvent.updateMany({
      where: { id: event.id, undoneAt: null },
      data: { undoneAt },
    });
    if (updated.count !== 1) {
      throw new Error('Context memory event changed while undoing');
    }
    return await this.appendWriterEvent({
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
      sourceSessionId: event.sourceSessionId,
      sourceTurnId: event.sourceTurnId,
      operation: 'UNDO',
      memoryId: event.previousMemoryId ?? event.memoryId,
      previousMemoryId: event.memoryId,
      targetEventId: event.id,
      factKey: event.factKey,
      explicit: true,
      reasonCode: 'user_undo',
      writerVersion: event.writerVersion,
      decisionFingerprint: createHash('sha256')
        .update(`undo:${event.id}`)
        .digest('hex'),
    });
  }

  async listWriterEvents(input: {
    ownerUserId: string;
    workspaceId: string;
    limit?: number;
  }) {
    return await this.db.aiContextMemoryEvent.findMany({
      where: {
        ownerUserId: input.ownerUserId,
        workspaceId: input.workspaceId,
      },
      include: {
        memory: {
          select: {
            scope: true,
            docId: true,
            projectId: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(input.limit ?? 50, 1), 200),
    });
  }

  @Transactional()
  async expireDueMemories(now = new Date()) {
    return await this.db.aiContextMemory.updateMany({
      where: {
        status: 'active',
        OR: [{ expiresAt: { lte: now } }, { validUntil: { lte: now } }],
      },
      data: { status: 'expired' },
    });
  }

  @Transactional()
  async markMemoriesUsed(ids: string[], usedAt = new Date()) {
    if (!ids.length) return { count: 0 };
    return await this.db.aiContextMemory.updateMany({
      where: { id: { in: [...new Set(ids)] }, status: 'active' },
      data: { lastUsedAt: usedAt, useCount: { increment: 1 } },
    });
  }

  @Transactional()
  async enforceAutoMemoryQuota(
    input: {
      ownerUserId: string;
      workspaceId: string | null;
      scope: Exclude<CopilotContextMemoryScope, 'user'>;
      docId?: string | null;
      projectId?: string | null;
    },
    limit = AUTO_MEMORY_SCOPE_LIMIT
  ) {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 1_000);
    const scopeWorkspaceId = memoryScopeWorkspaceId(input);
    const ownerScope =
      input.scope === 'project'
        ? Prisma.empty
        : Prisma.sql`"owner_user_id" = ${input.ownerUserId} AND`;
    const overflow = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ai_context_memories"
      WHERE
        ${ownerScope}
        "workspace_id" IS NOT DISTINCT FROM ${scopeWorkspaceId} AND
        "scope" = ${input.scope} AND
        "doc_id" IS NOT DISTINCT FROM ${input.docId ?? null} AND
        "project_id" IS NOT DISTINCT FROM ${input.projectId ?? null} AND
        "kind" = 'auto_memory'
      ORDER BY
        CASE "status"
          WHEN 'active' THEN 0
          WHEN 'disabled' THEN 1
          ELSE 2
        END ASC,
        COALESCE("last_used_at", "updated_at") DESC,
        "updated_at" DESC,
        "id" DESC
      OFFSET ${boundedLimit}
    `;
    if (!overflow.length) return { count: 0 };
    return await this.db.aiContextMemory.deleteMany({
      where: { id: { in: overflow.map(memory => memory.id) } },
    });
  }

  async putEmbedding(id: string, embedding: number[]) {
    const vector = toPgVector(embedding);
    await this.db.$executeRaw`
      UPDATE "ai_context_memories"
      SET "embedding" = ${vector}::vector
      WHERE "id" = ${id}
    `;
  }

  async clearEmbedding(id: string) {
    await this.db.$executeRaw`
      UPDATE "ai_context_memories"
      SET "embedding" = NULL
      WHERE "id" = ${id}
    `;
  }

  async matchAuthorizedEmbeddings(
    ids: string[],
    embedding: number[],
    limit = 64
  ) {
    if (!ids.length) return [];
    const vector = toPgVector(embedding);
    return await this.db.$queryRaw<Array<{ id: string; distance: number }>>`
      SELECT "id", "embedding" <=> ${vector}::vector AS "distance"
      FROM "ai_context_memories"
      WHERE "id" IN (${Prisma.join([...new Set(ids)])})
        AND "embedding" IS NOT NULL
      ORDER BY "distance" ASC
      LIMIT ${Math.min(Math.max(limit, 1), 256)}
    `;
  }

  async get(id: string) {
    return await this.db.aiContextMemory.findUnique({ where: { id } });
  }

  async listVisible(input: {
    userId: string;
    workspaceId?: string | null;
    docId?: string | null;
    docIds?: string[];
    documentRefs?: CopilotContextDocumentRef[];
    projectIds?: string[];
    includeDisabled?: boolean;
  }) {
    return await this.db.aiContextMemory.findMany({
      where: buildContextMemoryVisibilityWhere(input),
      orderBy: [{ kind: 'asc' }, { updatedAt: 'desc' }],
      take: 512,
    });
  }

  async listManageable(input: {
    userId: string;
    workspaceId?: string | null;
    projectIds?: string[];
    includeDisabled?: boolean;
  }) {
    const personalScopes: Prisma.AiContextMemoryWhereInput[] = input.workspaceId
      ? [
          {
            ownerUserId: input.userId,
            scope: 'user',
            workspaceId: null,
            docId: null,
            projectId: null,
          },
          {
            ownerUserId: input.userId,
            workspaceId: input.workspaceId,
            OR: [{ scope: 'workspace' }, { scope: 'document' }],
          },
        ]
      : [
          {
            ownerUserId: input.userId,
            scope: { not: 'project' },
          },
        ];
    const projectScopes: Prisma.AiContextMemoryWhereInput[] =
      input.projectIds === undefined
        ? [
            {
              scope: 'project',
              workspaceId: null,
              project: {
                status: 'active',
                members: {
                  some: { userId: input.userId, role: 'owner' },
                },
              },
            },
          ]
        : input.projectIds.length
          ? [
              {
                scope: 'project',
                workspaceId: null,
                projectId: { in: input.projectIds },
                project: {
                  status: 'active',
                  members: {
                    some: { userId: input.userId, role: 'owner' },
                  },
                },
              },
            ]
          : [];
    return await this.db.aiContextMemory.findMany({
      where: {
        status: input.includeDisabled
          ? { in: ['active', 'disabled'] }
          : 'active',
        visibility: 'private',
        OR: [...personalScopes, ...projectScopes],
      },
      orderBy: [{ kind: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  @Transactional()
  async update(
    id: string,
    input: {
      content?: string;
      status?: CopilotContextMemoryStatus;
    },
    actorUserId?: string
  ) {
    const current = await this.get(id);
    if (!current) return null;
    const content =
      input.content === undefined
        ? current.content
        : normalizeMemoryContent(input.content);
    try {
      const updated = await this.db.aiContextMemory.updateMany({
        where: actorUserId
          ? this.memoryManagementWhere(id, actorUserId)
          : { id },
        data: {
          content,
          status: input.status,
          fingerprint:
            input.content === undefined
              ? current.fingerprint
              : fingerprintContextMemory({
                  scope: current.scope as CopilotContextMemoryScope,
                  kind: current.kind as CopilotContextMemoryKind,
                  content,
                }),
        },
      });
      if (updated.count !== 1) {
        throw new NotFound('AI context memory not found');
      }
      return await this.get(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequest(
            'An identical active AI context memory already exists in this scope'
          );
        }
        if (error.code === 'P2025') {
          throw new NotFound('AI context memory not found');
        }
      }
      throw error;
    }
  }

  async retireDisabledVersion(id: string, validUntil = new Date()) {
    return await this.db.aiContextMemory.updateMany({
      where: { id, status: 'disabled' },
      data: { status: 'superseded', validUntil },
    });
  }

  @Transactional()
  async delete(id: string, actorUserId?: string) {
    const result = await this.db.aiContextMemory.deleteMany({
      where: actorUserId ? this.memoryManagementWhere(id, actorUserId) : { id },
    });
    return result.count > 0;
  }

  async getProject(id: string) {
    return await this.db.aiContextProject.findUnique({
      where: { id },
      include: {
        documents: {
          where: { internalResourceId: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        members: { orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async listProjects(input: { userId: string; includeArchived?: boolean }) {
    return await this.db.aiContextProject.findMany({
      where: {
        members: { some: { userId: input.userId } },
        ...(input.includeArchived ? {} : { status: 'active' }),
      },
      include: {
        documents: {
          where: { internalResourceId: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        members: { orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async listProjectIdsForDoc(input: {
    userId: string;
    workspaceId: string;
    docId: string;
  }) {
    const projects = await this.db.aiContextProject.findMany({
      where: {
        status: 'active',
        members: { some: { userId: input.userId } },
        documents: {
          some: {
            internalResourceId: null,
            workspaceId: input.workspaceId,
            docId: input.docId,
            status: 'granted',
          },
        },
      },
      select: { id: true },
    });
    return projects.map(project => project.id);
  }

  async listProjectMembershipsForDocs(input: {
    userId: string;
    workspaceId: string;
    docIds: string[];
  }) {
    if (!input.docIds.length) return [];
    return await this.db.aiContextProjectDoc.findMany({
      where: {
        internalResourceId: null,
        workspaceId: input.workspaceId,
        docId: { in: input.docIds },
        status: 'granted',
        project: {
          status: 'active',
          members: { some: { userId: input.userId } },
        },
      },
      select: {
        workspaceId: true,
        docId: true,
        projectId: true,
      },
    });
  }

  @Transactional()
  async removeDocumentReferences(input: {
    workspaceId: string;
    docId: string;
  }) {
    const authorizations =
      await this.models.intelligenceWorkbenchAuthorization.removeSourceDocumentAuthorizations(
        input
      );
    const memories = await this.db.aiContextMemory.deleteMany({
      where: {
        workspaceId: input.workspaceId,
        docId: input.docId,
        scope: 'document',
      },
    });
    return {
      memoryCount: memories.count,
      projectDocumentCount: authorizations.projectDocumentCount,
    };
  }

  @Transactional()
  async createProject(input: CopilotContextProjectInput) {
    const project = await this.db.aiContextProject.create({
      data: {
        createdByUserId: input.createdByUserId,
        name: input.name,
        description: input.description ?? '',
        members: {
          create: {
            userId: input.createdByUserId,
            role: 'owner',
          },
        },
      },
    });
    for (const [index, document] of input.documents.entries()) {
      await this.models.intelligenceWorkbenchAuthorization.addProjectDocument({
        projectId: project.id,
        workspaceId: document.workspaceId,
        docId: document.docId,
        requesterUserId: input.createdByUserId,
        requestedLevel: 'read',
        groupId: document.groupId ?? null,
        sortOrder: document.sortOrder ?? index,
      });
    }
    const created = await this.getProject(project.id);
    if (!created) throw new Error('Created context project disappeared');
    return created;
  }

  @Transactional()
  async addProjectDocument(
    projectId: string,
    actorUserId: string,
    document: CopilotContextProjectDocumentInput
  ) {
    if (!(await this.lockActiveProjectOwner(projectId, actorUserId)))
      return null;
    await this.models.intelligenceWorkbenchAuthorization.addProjectDocument({
      projectId,
      workspaceId: document.workspaceId,
      docId: document.docId,
      requesterUserId: actorUserId,
      requestedLevel: 'read',
      groupId: document.groupId ?? null,
      sortOrder: document.sortOrder ?? 0,
    });
    await this.db.aiContextProjectDoc.updateMany({
      where: {
        projectId,
        workspaceId: document.workspaceId,
        docId: document.docId,
      },
      data: {
        groupId: document.groupId ?? null,
        sortOrder: document.sortOrder ?? 0,
      },
    });
    return await this.getProject(projectId);
  }

  @Transactional()
  async removeProjectDocument(
    projectId: string,
    actorUserId: string,
    document: CopilotContextDocumentRef
  ) {
    const result =
      await this.models.intelligenceWorkbenchAuthorization.removeProjectDocument(
        {
          projectId,
          workspaceId: document.workspaceId,
          docId: document.docId,
          actorUserId,
        }
      );
    if (!result.removed) return null;
    return await this.getProject(projectId);
  }

  @Transactional()
  async updateProjectDocument(
    projectId: string,
    actorUserId: string,
    document: CopilotContextDocumentRef,
    input: { groupId?: string | null; sortOrder?: number }
  ) {
    if (!(await this.lockActiveProjectOwner(projectId, actorUserId)))
      return null;
    const result = await this.db.aiContextProjectDoc.updateMany({
      where: {
        projectId,
        workspaceId: document.workspaceId,
        docId: document.docId,
      },
      data: {
        groupId: input.groupId,
        sortOrder: input.sortOrder,
      },
    });
    if (!result.count) return null;
    return await this.getProject(projectId);
  }

  @Transactional()
  async updateProject(
    id: string,
    actorUserId: string,
    input: {
      name?: string;
      description?: string;
      status?: CopilotContextProjectStatus;
      workspaceDocuments?: {
        workspaceId: string;
        documents: CopilotContextProjectDocumentInput[];
      };
    }
  ) {
    if (!(await this.lockActiveProjectOwner(id, actorUserId))) return null;

    let workspaceDocuments:
      | { workspaceId: string; documents: CopilotContextProjectDocumentInput[] }
      | undefined;
    if (input.workspaceDocuments) {
      const workspaceId = input.workspaceDocuments.workspaceId.trim();
      if (!workspaceId) {
        throw new BadRequest('Project document workspaceId is required');
      }
      const documents = new Map<string, CopilotContextProjectDocumentInput>();
      for (const [
        index,
        document,
      ] of input.workspaceDocuments.documents.entries()) {
        const documentWorkspaceId = document.workspaceId.trim();
        const docId = document.docId.trim();
        const groupId = document.groupId?.trim() || null;
        const sortOrder = document.sortOrder ?? index;
        if (documentWorkspaceId !== workspaceId || !docId) {
          throw new BadRequest(
            'Project replacement documents must belong to the source workspace'
          );
        }
        if (!Number.isInteger(sortOrder) || sortOrder < 0) {
          throw new BadRequest(
            'Project document sortOrder must be a non-negative integer'
          );
        }
        documents.set(docId, {
          workspaceId,
          docId,
          groupId,
          sortOrder,
        });
      }
      workspaceDocuments = { workspaceId, documents: [...documents.values()] };
      const retainedDocumentCount = await this.db.aiContextProjectDoc.count({
        where: { projectId: id, workspaceId: { not: workspaceId } },
      });
      if (
        retainedDocumentCount + workspaceDocuments.documents.length >
        CONTEXT_PROJECT_DOCUMENT_LIMIT
      ) {
        throw new BadRequest(
          `A project cannot contain more than ${CONTEXT_PROJECT_DOCUMENT_LIMIT} documents`
        );
      }
    }

    if (workspaceDocuments) {
      const current = await this.db.aiContextProjectDoc.findMany({
        where: { projectId: id, workspaceId: workspaceDocuments.workspaceId },
        select: { docId: true },
      });
      const currentIds = new Set(current.map(document => document.docId));
      const desiredIds = new Set(
        workspaceDocuments.documents.map(document => document.docId)
      );
      for (const document of current) {
        if (desiredIds.has(document.docId)) continue;
        await this.models.intelligenceWorkbenchAuthorization.removeProjectDocument(
          {
            projectId: id,
            workspaceId: workspaceDocuments.workspaceId,
            docId: document.docId,
            actorUserId,
          }
        );
      }
      for (const document of workspaceDocuments.documents) {
        if (currentIds.has(document.docId)) {
          await this.db.aiContextProjectDoc.update({
            where: {
              projectId_workspaceId_docId: {
                projectId: id,
                workspaceId: document.workspaceId,
                docId: document.docId,
              },
            },
            data: {
              groupId: document.groupId ?? null,
              sortOrder: document.sortOrder ?? 0,
            },
          });
          continue;
        }
        await this.models.intelligenceWorkbenchAuthorization.addProjectDocument(
          {
            projectId: id,
            workspaceId: document.workspaceId,
            docId: document.docId,
            requesterUserId: actorUserId,
            requestedLevel: 'read',
            groupId: document.groupId ?? null,
            sortOrder: document.sortOrder ?? 0,
          }
        );
      }
    }

    if (input.status === 'archived') {
      await this.models.intelligenceWorkbenchAuthorization.withdrawPendingProjectWorkForArchive(
        { projectId: id, actorUserId }
      );
    }

    const project = await this.db.aiContextProject.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
      },
      include: {
        documents: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        members: { orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (input.status === 'archived') {
      await this.db.aiSession.updateMany({
        where: { selectedContextProjectId: id },
        data: { selectedContextProjectId: null },
      });
    }
    return project;
  }

  @Transactional()
  async deleteProject(id: string, actorUserId: string) {
    if (!(await this.lockProjectOwner(id, actorUserId))) return null;
    const memoryCount = await this.db.aiContextMemory.count({
      where: { projectId: id },
    });
    if (memoryCount > 0) return false;
    try {
      const result = await this.db.aiContextProject.deleteMany({
        where: { id },
      });
      return result.count > 0;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return false;
      }
      throw error;
    }
  }

  async getCheckpoint(sessionId: string, strategyVersion: string) {
    return await this.db.aiContextCheckpoint.findUnique({
      where: {
        sessionId_strategyVersion: { sessionId, strategyVersion },
      },
    });
  }

  @Transactional()
  async putCheckpoint(input: CopilotContextCheckpointInput) {
    return await this.db.aiContextCheckpoint.upsert({
      where: {
        sessionId_strategyVersion: {
          sessionId: input.sessionId,
          strategyVersion: input.strategyVersion,
        },
      },
      create: {
        ...input,
        diagnostics: input.diagnostics as Prisma.InputJsonValue,
      },
      update: {
        strategyFingerprint: input.strategyFingerprint,
        summary: input.summary,
        summarizedMessageCount: input.summarizedMessageCount,
        sourceFingerprint: input.sourceFingerprint,
        diagnostics: input.diagnostics as Prisma.InputJsonValue,
      },
    });
  }

  @Transactional()
  async createPlanTrace(input: CopilotContextPlanTraceInput) {
    return await this.db.aiContextPlanTrace.create({
      data: {
        ...input,
        candidateMemoryIds: input.candidateMemoryIds as Prisma.InputJsonValue,
        selectedMemories: input.selectedMemories as Prisma.InputJsonValue,
        scope: input.scope as Prisma.InputJsonValue,
      },
    });
  }

  async listPlanTraces(sessionId: string, limit = 50) {
    return await this.db.aiContextPlanTrace.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  @Transactional()
  async ensureStrategyRevision(input: CopilotContextStrategyRevisionInput) {
    const existing = await this.db.aiContextStrategyRevision.findUnique({
      where: { version: input.version },
    });
    if (existing) {
      if (existing.fingerprint !== input.fingerprint) {
        throw new Error(
          `Context strategy ${input.version} changed without a version bump`
        );
      }
      if (existing.status !== input.status) {
        return await this.db.aiContextStrategyRevision.update({
          where: { version: input.version },
          data: { status: input.status },
        });
      }
      return existing;
    }

    try {
      return await this.db.aiContextStrategyRevision.create({
        data: {
          ...input,
          config: input.config as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const raced = await this.db.aiContextStrategyRevision.findUnique({
        where: { version: input.version },
      });
      if (!raced || raced.fingerprint !== input.fingerprint) throw error;
      return raced;
    }
  }

  async listStrategyRevisions(input: { userId: string; workspaceId: string }) {
    const [revisions, checkpointStats, traceStats] = await Promise.all([
      this.db.aiContextStrategyRevision.findMany({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      this.db.aiContextCheckpoint.groupBy({
        by: ['strategyVersion'],
        where: {
          session: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.db.aiContextPlanTrace.groupBy({
        by: ['strategyVersion'],
        where: {
          session: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);
    const statsByVersion = new Map(
      checkpointStats.map(item => [item.strategyVersion, item])
    );
    const traceStatsByVersion = new Map(
      traceStats.map(item => [item.strategyVersion, item])
    );
    return revisions.map(revision => {
      const stats = statsByVersion.get(revision.version);
      const traces = traceStatsByVersion.get(revision.version);
      return {
        ...revision,
        checkpointCount: stats?._count._all ?? 0,
        lastCheckpointAt: stats?._max.updatedAt ?? null,
        traceCount: traces?._count._all ?? 0,
        lastTraceAt: traces?._max.createdAt ?? null,
      };
    });
  }
}

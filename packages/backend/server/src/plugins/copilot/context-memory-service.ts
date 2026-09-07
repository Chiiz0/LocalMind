import { createHash } from 'node:crypto';

import {
  Injectable,
  Logger,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { z } from 'zod';

import {
  type CopilotContextDocumentRef,
  type CopilotContextMemoryInput,
  type CopilotContextMemoryKind,
  type CopilotContextMemoryScope,
  type CopilotContextMemoryStatus,
  type CopilotContextMemoryWriterDecision,
  type CopilotContextPlanTraceInput,
  type CopilotContextProjectDocumentInput,
  type CopilotContextProjectStatus,
  Models,
} from '../../models';
import {
  type ContextScopeResolution,
  ContextScopeResolver,
} from './context-scope-resolver';
import type { Turn } from './core';
import { CopilotEmbeddingClientService } from './embedding';
import { CapabilityRuntime } from './runtime/capability-runtime';
import {
  CANDIDATE_CONTEXT_PLANNER_STRATEGY_CONFIG,
  CANDIDATE_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  CANDIDATE_CONTEXT_PLANNER_STRATEGY_VERSION,
  CONTEXT_PLANNER_STRATEGY_CONFIG,
  CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  CONTEXT_PLANNER_STRATEGY_VERSION,
  type ContextPlannerCheckpoint,
  LEGACY_CONTEXT_PLANNER_STRATEGY_CONFIG,
  LEGACY_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  LEGACY_CONTEXT_PLANNER_STRATEGY_VERSION,
  PREVIOUS_CONTEXT_PLANNER_STRATEGY_CONFIG,
  PREVIOUS_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  PREVIOUS_CONTEXT_PLANNER_STRATEGY_VERSION,
  SYSTEM_CONTEXT_PLANNER_STRATEGY_CONFIG,
  SYSTEM_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  SYSTEM_CONTEXT_PLANNER_STRATEGY_VERSION,
  UNTRUSTED_CONTEXT_PLANNER_STRATEGY_CONFIG,
  UNTRUSTED_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  UNTRUSTED_CONTEXT_PLANNER_STRATEGY_VERSION,
} from './runtime/context-planner';
import { buildStructuredResponseContract } from './runtime/contracts';

const MEMORY_WRITER_VERSION = 'structured-memory-writer/v1';
const SECRET_PATTERN = new RegExp(
  [
    '\\b(password|passwd|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|private[_ -]?key|client[_ -]?secret|bearer)\\b\\s*(?:[:=]|\\bis\\b|是)',
    '\\bAKIA[0-9A-Z]{16}\\b',
    '\\bgh[pousr]_[A-Za-z0-9_]{20,}\\b',
    '\\bglpat-[A-Za-z0-9_-]{20,}\\b',
    '\\bnpm_[A-Za-z0-9]{20,}\\b',
    '\\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\\b',
    '\\bxox[baprs]-[A-Za-z0-9-]{20,}\\b',
    '\\bAIza[0-9A-Za-z_-]{30,}\\b',
    '\\bBearer\\s+[A-Za-z0-9._~+/-]{16,}',
    '\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b',
    '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    '\\b(?:postgres|mysql|mongodb(?:\\+srv)?)://[^\\s]+',
  ].join('|'),
  'iu'
);
const PERSONAL_DATA_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /(?:\+?\d(?:[ ().-]*\d){9,14})/u,
  /\b\d{3}-\d{2}-\d{4}\b/u,
  /\b(?:\d[ -]*?){13,19}\b/u,
  /\b\d{1,6}\s+[\p{L}\d.' -]+\s(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr)\b/iu,
  /\b(?:customer|client|patient|account)[_ -]?(?:id|number)\b\s*(?:[:=]|\bis\b)\s*\S+/iu,
];
const EXPLICIT_ADD_PATTERN =
  /\b(?:remember(?: that)?|save (?:this|that) as (?:a )?memory|keep in mind|from now on)\b|记住|请记下|以后(?:请)?/iu;
const EXPLICIT_DELETE_PATTERN =
  /\b(?:forget|delete (?:that |this )?memory|do not remember|don't remember|stop remembering)\b|忘记|删除(?:这条)?记忆|不要再记/iu;
const EXPLICIT_UPDATE_PATTERN =
  /\b(?:instead|change (?:it|that|my preference)?\s*to|update (?:that|my preference)?\s*to)\b|改为|改成|更新为/iu;
const IMPLICIT_CANDIDATE_PATTERN =
  /\b(?:i|we|our|my)\s+(?:prefer|use|decided|selected|work|deploy|need)|\b(?:codename|deployment region|timezone)\b[^.!?\n]{0,80}(?:\bis\b|\bare\b|:|=)|我(?:们)?(?:喜欢|偏好|决定|选择|使用)|(?:代号|部署区域|时区)[^。！？\n]{0,80}(?:是|为|：|:|=)/iu;
const IMPLICIT_QUESTION_OR_REQUEST_PATTERN =
  /^(?:please\s+)?(?:tell|show|explain|answer|reply|say)\b|\b(?:if|whether)\b|^(?:请)?(?:告诉|说明|解释|回答|回复)/iu;

const MemoryWriterDecisionSchema = z.object({
  operation: z.enum(['ADD', 'UPDATE', 'DELETE', 'NOOP']),
  factKey: z.string().max(160).nullable(),
  content: z.string().max(500).nullable(),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  reasonCode: z.string().max(80),
});
const MemoryWriterOutputSchema = z.object({
  decisions: z.array(MemoryWriterDecisionSchema).max(8),
});
const MEMORY_WRITER_RESPONSE_CONTRACT = buildStructuredResponseContract(
  MemoryWriterOutputSchema
);

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitMemoryCandidates(content: string) {
  return content
    .split(/(?<=[.!?])\s+|(?<=[。！？])(?:\s+|(?=\S))|\n+/u)
    .map(normalize)
    .filter(Boolean);
}

export function classifyContextMemoryDlp(content: string) {
  if (SECRET_PATTERN.test(content)) {
    return {
      blocked: true,
      sensitivity: 'restricted' as const,
      reasonCode: 'dlp_secret',
    };
  }
  if (PERSONAL_DATA_PATTERNS.some(pattern => pattern.test(content))) {
    return {
      blocked: true,
      sensitivity: 'personal' as const,
      reasonCode: 'dlp_personal_data',
    };
  }
  return {
    blocked: false,
    sensitivity: 'private' as const,
    reasonCode: 'dlp_clear',
  };
}

function stripExplicitDirective(content: string) {
  return normalize(
    content
      .replace(EXPLICIT_DELETE_PATTERN, '')
      .replace(EXPLICIT_ADD_PATTERN, '')
      .replace(EXPLICIT_UPDATE_PATTERN, '')
      .replace(/^(?:please|请)[,，\s]*/iu, '')
      .replace(/^[,:：，\s]+|[.!。！\s]+$/gu, '')
  );
}

export function deriveContextMemoryFactKey(content: string) {
  const normalized = normalize(content).toLocaleLowerCase();
  if (
    /\b(?:answer|respond|response|reply|preference)\b.*\b(?:english|chinese)\b|(?:english|chinese).*(?:answer|respond|response|reply)|(?:回答|回复).*(?:中文|英文)|(?:中文|英文).*(?:回答|回复)/iu.test(
      normalized
    )
  ) {
    return 'preference:response_language';
  }
  if (/\bdeployment region\b|部署区域/iu.test(normalized)) {
    return 'project:deployment_region';
  }
  if (/\bcodename\b|代号/iu.test(normalized)) return 'project:codename';
  if (/\btimezone\b|时区/iu.test(normalized)) return 'preference:timezone';

  const fact = normalized.match(
    /^(?:my |our |the )?([\p{L}\p{N}_ -]{2,80}?)\s*(?:is|are|=|:|：|是|为)\s*\S/iu
  );
  if (fact?.[1]) {
    return `fact:${fact[1].replace(/\s+/g, '_').slice(0, 80)}`;
  }
  const terms = normalized
    .replace(/[^\p{L}\p{N}_ -]+/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 8)
    .join('_');
  return terms ? `statement:${terms.slice(0, 120)}` : null;
}

export function extractExplicitMemoryDecisions(content: string) {
  const decisions: CopilotContextMemoryWriterDecision[] = [];
  for (const candidate of splitMemoryCandidates(content)) {
    if (
      candidate.length > 500 ||
      (!EXPLICIT_ADD_PATTERN.test(candidate) &&
        !EXPLICIT_DELETE_PATTERN.test(candidate) &&
        !EXPLICIT_UPDATE_PATTERN.test(candidate))
    ) {
      continue;
    }
    const value = stripExplicitDirective(candidate);
    if (!value) continue;
    const operation = EXPLICIT_DELETE_PATTERN.test(candidate)
      ? 'DELETE'
      : EXPLICIT_UPDATE_PATTERN.test(candidate)
        ? 'UPDATE'
        : 'ADD';
    decisions.push({
      operation,
      factKey: deriveContextMemoryFactKey(value),
      content: operation === 'DELETE' ? null : value,
      confidence: 1,
      importance: 0.8,
      sensitivity: 'private',
      validFrom: new Date(),
      validUntil: null,
      expiresAt: null,
      reasonCode: 'explicit_user_directive',
    });
  }
  return decisions.slice(0, 8);
}

export function extractDurableMemories(content: string) {
  return splitMemoryCandidates(content).filter(candidate => {
    if (
      candidate.length > 500 ||
      candidate.endsWith('?') ||
      candidate.endsWith('？') ||
      classifyContextMemoryDlp(candidate).blocked ||
      EXPLICIT_DELETE_PATTERN.test(candidate) ||
      EXPLICIT_UPDATE_PATTERN.test(candidate)
    ) {
      return false;
    }
    return EXPLICIT_ADD_PATTERN.test(candidate);
  });
}

export function shouldAttemptImplicitExtraction(content: string) {
  const normalized = normalize(content);
  return (
    normalized.length >= 6 &&
    normalized.length <= 1_200 &&
    !normalized.endsWith('?') &&
    !normalized.endsWith('？') &&
    !IMPLICIT_QUESTION_OR_REQUEST_PATTERN.test(normalized) &&
    IMPLICIT_CANDIDATE_PATTERN.test(normalized)
  );
}

function contextMemoryTerms(content: string) {
  return new Set(
    content
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter(term => term.length >= 2)
  );
}

function contextMemorySimilarity(left: string, right: string) {
  const leftTerms = contextMemoryTerms(left);
  const rightTerms = contextMemoryTerms(right);
  if (!leftTerms.size || !rightTerms.size) return 0;
  let intersection = 0;
  for (const term of leftTerms) {
    if (rightTerms.has(term)) intersection += 1;
  }
  return intersection / (leftTerms.size + rightTerms.size - intersection);
}

function parseOptionalDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function memoryDecisionFingerprint(input: {
  sessionId: string;
  turnId?: string | null;
  index: number;
  decision: CopilotContextMemoryWriterDecision;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        writerVersion: MEMORY_WRITER_VERSION,
        sessionId: input.sessionId,
        turnId: input.turnId ?? null,
        index: input.index,
        operation: input.decision.operation,
        factKey: input.decision.factKey,
        content: input.decision.content,
      })
    )
    .digest('hex');
}

export function sanitizeContextMemoryWriterDecision(
  originalDecision: CopilotContextMemoryWriterDecision,
  sourceContent: string,
  now = new Date()
) {
  const dlp = classifyContextMemoryDlp(
    [
      originalDecision.content ?? sourceContent,
      originalDecision.factKey ?? '',
    ].join('\n')
  );
  if (dlp.blocked) {
    return {
      ...originalDecision,
      operation: 'NOOP' as const,
      factKey: null,
      content: null,
      sensitivity: dlp.sensitivity,
      reasonCode: dlp.reasonCode,
    };
  }
  const temporalStart = originalDecision.validFrom?.getTime() ?? now.getTime();
  const invalidTemporalWindow =
    (originalDecision.validUntil !== null &&
      originalDecision.validUntil !== undefined &&
      originalDecision.validUntil.getTime() <= temporalStart) ||
    (originalDecision.expiresAt !== null &&
      originalDecision.expiresAt !== undefined &&
      originalDecision.expiresAt.getTime() <= temporalStart);
  if (invalidTemporalWindow) {
    return {
      ...originalDecision,
      operation: 'NOOP' as const,
      content: null,
      sensitivity: dlp.sensitivity,
      reasonCode: 'invalid_temporal_window',
    };
  }
  return { ...originalDecision, sensitivity: dlp.sensitivity };
}

@Injectable()
export class ContextMemoryService implements OnModuleInit {
  private readonly logger = new Logger(ContextMemoryService.name);
  private strategyHistoryReady?: Promise<void>;

  constructor(
    private readonly models: Models,
    @Optional() private readonly runtime?: CapabilityRuntime,
    @Optional()
    private readonly embeddingClientService?: CopilotEmbeddingClientService,
    @Optional() private readonly contextScopeResolver?: ContextScopeResolver
  ) {}

  async onModuleInit() {
    await this.ensureStrategyHistory();
  }

  private async projectMemorySourceDocuments(input: {
    userId: string;
    projectId: string;
    readableDocumentRefs?: CopilotContextDocumentRef[];
  }) {
    const grants =
      await this.models.intelligenceWorkbenchAuthorization.listGrantedProjectDocuments(
        { projectId: input.projectId, userId: input.userId }
      );
    const grantKeys = new Set(
      grants.map(grant => `${grant.workspaceId}\0${grant.docId}`)
    );
    const candidates = input.readableDocumentRefs ?? grants;
    const sources = new Map<string, CopilotContextDocumentRef>();
    for (const document of candidates) {
      const key = `${document.workspaceId}\0${document.docId}`;
      if (grantKeys.has(key)) sources.set(key, document);
    }
    return [...sources.values()].sort(
      (left, right) =>
        left.workspaceId.localeCompare(right.workspaceId) ||
        left.docId.localeCompare(right.docId)
    );
  }

  private async ensureStrategyHistory() {
    this.strategyHistoryReady ??= Promise.all([
      this.models.copilotContextMemory.ensureStrategyRevision({
        version: CONTEXT_PLANNER_STRATEGY_VERSION,
        fingerprint: CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
        status: 'active',
        config: CONTEXT_PLANNER_STRATEGY_CONFIG,
      }),
      this.models.copilotContextMemory.ensureStrategyRevision({
        version: UNTRUSTED_CONTEXT_PLANNER_STRATEGY_VERSION,
        fingerprint: UNTRUSTED_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
        status: 'archived',
        config: UNTRUSTED_CONTEXT_PLANNER_STRATEGY_CONFIG,
      }),
      this.models.copilotContextMemory.ensureStrategyRevision({
        version: SYSTEM_CONTEXT_PLANNER_STRATEGY_VERSION,
        fingerprint: SYSTEM_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
        status: 'archived',
        config: SYSTEM_CONTEXT_PLANNER_STRATEGY_CONFIG,
      }),
      this.models.copilotContextMemory.ensureStrategyRevision({
        version: CANDIDATE_CONTEXT_PLANNER_STRATEGY_VERSION,
        fingerprint: CANDIDATE_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
        status: 'archived',
        config: CANDIDATE_CONTEXT_PLANNER_STRATEGY_CONFIG,
      }),
      this.models.copilotContextMemory.ensureStrategyRevision({
        version: PREVIOUS_CONTEXT_PLANNER_STRATEGY_VERSION,
        fingerprint: PREVIOUS_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
        status: 'archived',
        config: PREVIOUS_CONTEXT_PLANNER_STRATEGY_CONFIG,
      }),
      this.models.copilotContextMemory.ensureStrategyRevision({
        version: LEGACY_CONTEXT_PLANNER_STRATEGY_VERSION,
        fingerprint: LEGACY_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
        status: 'archived',
        config: LEGACY_CONTEXT_PLANNER_STRATEGY_CONFIG,
      }),
    ]).then(() => undefined);
    try {
      await this.strategyHistoryReady;
    } catch (error) {
      this.strategyHistoryReady = undefined;
      throw error;
    }
  }

  async getSettings(userId: string, workspaceId: string) {
    const preference = await this.models.copilotContextMemory.getPreference(
      userId,
      workspaceId
    );
    return {
      autoMemoryEnabled: preference?.autoMemoryEnabled ?? true,
    };
  }

  async updateSettings(input: {
    userId: string;
    workspaceId: string;
    autoMemoryEnabled: boolean;
  }) {
    const preference =
      await this.models.copilotContextMemory.putPreference(input);
    return {
      autoMemoryEnabled: preference.autoMemoryEnabled,
    };
  }

  async listPlannerStrategies(userId: string, workspaceId: string) {
    await this.ensureStrategyHistory();
    return await this.models.copilotContextMemory.listStrategyRevisions({
      userId,
      workspaceId,
    });
  }

  async resolveSessionScope(
    userId: string,
    workspaceId: string,
    sessionId: string
  ) {
    const session = await this.models.copilotSession.getMeta(sessionId);
    if (
      !session ||
      session.userId !== userId ||
      session.workspaceId !== workspaceId ||
      !this.contextScopeResolver
    ) {
      return null;
    }
    const scope = await this.contextScopeResolver.resolve({
      userId,
      workspaceId,
      sessionId,
      primaryDocId: session.docId,
      selectedProjectId: session.selectedContextProjectId,
    });
    const projects = await Promise.all(
      scope.candidateProjectIds.map(projectId => this.getProject(projectId))
    );
    return {
      ...scope,
      candidateProjects: projects.flatMap(project =>
        project ? [{ id: project.id, name: project.name }] : []
      ),
    };
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
    const projectIds =
      input.projectIds ??
      (input.workspaceId && input.docId
        ? await this.models.copilotContextMemory.listProjectIdsForDoc({
            userId: input.userId,
            workspaceId: input.workspaceId,
            docId: input.docId,
          })
        : []);
    return await this.models.copilotContextMemory.listVisible({
      ...input,
      projectIds,
    });
  }

  private lexicalMemoryScore(
    memory: Awaited<ReturnType<ContextMemoryService['listVisible']>>[number],
    query: string
  ) {
    const terms = new Set(
      query
        .toLocaleLowerCase()
        .split(/[^\p{L}\p{N}_-]+/u)
        .filter(term => term.length >= 2)
    );
    const content = memory.content.toLocaleLowerCase();
    let overlap = 0;
    for (const term of terms) {
      if (content.includes(term)) overlap += 1;
    }
    const scopeWeight =
      memory.scope === 'project'
        ? 0.16
        : memory.scope === 'document'
          ? 0.12
          : memory.scope === 'workspace'
            ? 0.08
            : 0.04;
    const kindWeight = memory.kind === 'project_summary' ? 0.12 : 0.08;
    const ageDays = Math.max(
      0,
      (Date.now() - memory.updatedAt.getTime()) / 86_400_000
    );
    const recency = Math.max(0, 0.12 - Math.log1p(ageDays) * 0.02);
    const usage = Math.min(0.08, Math.log1p(memory.useCount) * 0.015);
    return (
      overlap * 0.18 +
      scopeWeight +
      kindWeight +
      memory.confidence * 0.18 +
      memory.importance * 0.18 +
      recency +
      usage
    );
  }

  async retrieveVisible(input: {
    userId: string;
    workspaceId: string | null;
    sessionId?: string;
    docIds: string[];
    documentRefs?: CopilotContextDocumentRef[];
    projectIds: string[];
    query: string;
    limit?: number;
  }) {
    await this.models.copilotContextMemory.expireDueMemories();
    const authorized = (
      await this.listVisible({
        userId: input.userId,
        workspaceId: input.workspaceId,
        docIds: input.docIds,
        documentRefs: input.documentRefs,
        projectIds: input.projectIds,
      })
    ).filter(
      memory =>
        memory.kind !== 'rule' &&
        (!!input.workspaceId || memory.scope === 'project')
    );
    if (!authorized.length) return [];

    const vectorScores = new Map<string, number>();
    const client = this.embeddingClientService?.getClient();
    if (client && input.query.trim()) {
      try {
        const embedding = await client.getEmbedding(input.query, {
          userId: input.userId,
          workspaceId: input.workspaceId ?? undefined,
          sessionId: input.sessionId,
          featureKind: 'embedding',
          signal: AbortSignal.timeout(10_000),
        });
        if (embedding) {
          const matches =
            await this.models.copilotContextMemory.matchAuthorizedEmbeddings(
              authorized.map(memory => memory.id),
              embedding,
              128
            );
          for (const match of matches) {
            vectorScores.set(match.id, Math.max(0, 1 - match.distance));
          }
        }
      } catch (error) {
        this.logger.warn(
          'Context memory vector retrieval failed; using lexical retrieval',
          { workspaceId: input.workspaceId, error }
        );
      }
    }

    const ranked = authorized
      .map(memory => {
        const lexicalScore = this.lexicalMemoryScore(memory, input.query);
        const vectorScore = vectorScores.get(memory.id) ?? 0;
        return {
          memory,
          score: lexicalScore * 0.55 + vectorScore * 0.45,
          distance: vectorScores.has(memory.id) ? 1 - vectorScore : 1,
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.memory.updatedAt.getTime() - left.memory.updatedAt.getTime()
      )
      .slice(0, 64);

    let rerankOrder = new Map<string, number>();
    if (client && ranked.length > 1 && input.query.trim()) {
      try {
        const reranked = await client.reRank(
          input.query,
          ranked.map((candidate, chunk) => ({
            docId: candidate.memory.id,
            chunk,
            content: candidate.memory.content,
            distance: candidate.distance,
          })),
          Math.min(ranked.length, 32),
          {
            userId: input.userId,
            workspaceId: input.workspaceId ?? undefined,
            sessionId: input.sessionId,
            featureKind: 'rerank',
            signal: AbortSignal.timeout(10_000),
          }
        );
        rerankOrder = new Map(
          reranked.map((candidate, index) => [candidate.docId, index])
        );
      } catch (error) {
        this.logger.warn(
          'Context memory rerank failed; using hybrid retrieval scores',
          { workspaceId: input.workspaceId, error }
        );
      }
    }

    const limit = Math.min(Math.max(input.limit ?? 32, 1), 64);
    const ordered = ranked.sort((left, right) => {
      const leftRank = rerankOrder.get(left.memory.id);
      const rightRank = rerankOrder.get(right.memory.id);
      if (leftRank !== undefined || rightRank !== undefined) {
        return (
          (leftRank ?? Number.MAX_SAFE_INTEGER) -
          (rightRank ?? Number.MAX_SAFE_INTEGER)
        );
      }
      return right.score - left.score;
    });
    const maxScore = Math.max(...ordered.map(candidate => candidate.score), 1);
    const selected: typeof ordered = [];
    const seenFacts = new Set<string>();
    const remaining = ordered.map((candidate, rank) => ({ candidate, rank }));
    while (selected.length < limit && remaining.length) {
      let bestIndex = -1;
      let bestMmr = Number.NEGATIVE_INFINITY;
      for (const [index, entry] of remaining.entries()) {
        const diversityKey =
          entry.candidate.memory.factKey ??
          entry.candidate.memory.content.toLocaleLowerCase().slice(0, 160);
        if (seenFacts.has(diversityKey)) continue;
        const relevance =
          entry.candidate.score / maxScore +
          (rerankOrder.has(entry.candidate.memory.id)
            ? (ordered.length - entry.rank) / ordered.length / 4
            : 0);
        const redundancy = selected.length
          ? Math.max(
              ...selected.map(selectedCandidate =>
                contextMemorySimilarity(
                  entry.candidate.memory.content,
                  selectedCandidate.memory.content
                )
              )
            )
          : 0;
        const mmr = relevance * 0.78 + (1 - redundancy) * 0.22;
        if (mmr > bestMmr) {
          bestIndex = index;
          bestMmr = mmr;
        }
      }
      if (bestIndex < 0) break;
      const [{ candidate }] = remaining.splice(bestIndex, 1);
      selected.push(candidate);
      seenFacts.add(
        candidate.memory.factKey ??
          candidate.memory.content.toLocaleLowerCase().slice(0, 160)
      );
    }
    return selected.map(candidate => ({
      ...candidate.memory,
      retrievalScore: candidate.score,
    }));
  }

  async loadCheckpoint(sessionId: string) {
    await this.ensureStrategyHistory();
    const checkpoint = await this.models.copilotContextMemory.getCheckpoint(
      sessionId,
      CONTEXT_PLANNER_STRATEGY_VERSION
    );
    if (!checkpoint) return null;
    return {
      strategyVersion: checkpoint.strategyVersion,
      strategyFingerprint: checkpoint.strategyFingerprint,
      summary: checkpoint.summary,
      summarizedMessageCount: checkpoint.summarizedMessageCount,
      sourceFingerprint: checkpoint.sourceFingerprint,
      diagnostics: checkpoint.diagnostics as Record<string, unknown>,
    } satisfies ContextPlannerCheckpoint;
  }

  async listManageable(input: {
    userId: string;
    workspaceId?: string | null;
    projectIds?: string[];
    includeDisabled?: boolean;
  }) {
    return await this.models.copilotContextMemory.listManageable(input);
  }

  async saveCheckpoint(
    sessionId: string,
    checkpoint: ContextPlannerCheckpoint
  ) {
    await this.ensureStrategyHistory();
    await this.models.copilotContextMemory.putCheckpoint({
      sessionId,
      ...checkpoint,
    });
  }

  @Transactional()
  async savePlanTrace(input: CopilotContextPlanTraceInput) {
    await this.ensureStrategyHistory();
    const trace = await this.models.copilotContextMemory.createPlanTrace(input);
    await Promise.all([
      this.models.copilotContextMemory.markMemoriesUsed(
        input.selectedMemories.flatMap(memory =>
          memory.id && (!memory.sourceType || memory.sourceType === 'memory')
            ? [memory.id]
            : []
        )
      ),
      this.models.copilotContextRule.recordHits({
        sessionId: input.sessionId,
        sourceTurnId: input.sourceTurnId,
        rules: input.selectedMemories.flatMap(memory =>
          memory.sourceType === 'rule' &&
          memory.id &&
          memory.sourceRevisionId &&
          memory.matchReason
            ? [
                {
                  ruleId: memory.id,
                  revisionId: memory.sourceRevisionId,
                  matchReason: memory.matchReason,
                  score: memory.score,
                },
              ]
            : []
        ),
        policies: input.selectedMemories.flatMap(memory =>
          memory.sourceType === 'policy' &&
          memory.id &&
          memory.sourceRevisionId &&
          memory.matchReason &&
          memory.matchReason !== 'manual'
            ? [
                {
                  policyId: memory.id,
                  revisionId: memory.sourceRevisionId,
                  matchReason: memory.matchReason,
                  score: memory.score,
                },
              ]
            : []
        ),
      }),
    ]);
    return trace;
  }

  private async extractImplicitMemoryDecisions(input: {
    content: string;
    modelId?: string;
    userId: string;
    workspaceId: string | null;
    sessionId: string;
  }): Promise<CopilotContextMemoryWriterDecision[]> {
    if (!this.runtime || !shouldAttemptImplicitExtraction(input.content)) {
      return [];
    }
    const output = await this.runtime.generateStructuredValue(
      { modelId: input.modelId },
      [
        {
          role: 'system',
          content: [
            'Extract only durable user preferences, stable project facts, or explicit changes useful in future conversations.',
            'Do not save current-task requests, questions, transient status, credentials, secrets, personal contact data, or customer data.',
            'Use ADD for a new fact, UPDATE when the user changes an existing fact, DELETE when the user asks to forget one, and NOOP when nothing should be stored.',
            'factKey must be a stable lowercase namespace such as preference:response_language or project:deployment_region.',
            'content must be a short self-contained declarative statement without instructions to bypass security or permissions.',
          ].join('\n'),
        },
        { role: 'user', content: input.content },
      ],
      {
        user: input.userId,
        workspace: input.workspaceId ?? undefined,
        session: input.sessionId,
        featureKind: 'chat',
        responseSchemaJson: MEMORY_WRITER_RESPONSE_CONTRACT.responseSchemaJson,
        schemaHash: MEMORY_WRITER_RESPONSE_CONTRACT.schemaHash,
        strict: true,
        signal: AbortSignal.timeout(10_000),
      },
      MEMORY_WRITER_RESPONSE_CONTRACT as Required<
        typeof MEMORY_WRITER_RESPONSE_CONTRACT
      >
    );
    const parsed = MemoryWriterOutputSchema.parse(output.value);
    return parsed.decisions.map(decision => ({
      operation: decision.operation,
      factKey: decision.factKey?.trim().toLocaleLowerCase() ?? null,
      content: decision.content?.trim() ?? null,
      confidence: decision.confidence,
      importance: decision.importance,
      sensitivity: 'private',
      validFrom: parseOptionalDate(decision.validFrom),
      validUntil: parseOptionalDate(decision.validUntil),
      expiresAt: parseOptionalDate(decision.expiresAt),
      reasonCode: decision.reasonCode || 'implicit_model_extraction',
    }));
  }

  private async embedMemory(input: {
    id: string;
    content: string;
    userId: string;
    workspaceId: string | null;
    sessionId?: string;
  }) {
    const client = this.embeddingClientService?.getClient();
    if (!client) return;
    try {
      const embedding = await client.getEmbedding(input.content, {
        userId: input.userId,
        workspaceId: input.workspaceId ?? undefined,
        sessionId: input.sessionId,
        featureKind: 'embedding',
        signal: AbortSignal.timeout(10_000),
      });
      if (embedding) {
        await this.models.copilotContextMemory.putEmbedding(
          input.id,
          embedding
        );
      }
    } catch (error) {
      this.logger.warn(
        'Failed to embed context memory; lexical recall remains available',
        {
          memoryId: input.id,
          error,
        }
      );
    }
  }

  async captureDurableTurn(input: {
    userId: string;
    workspaceId: string | null;
    docId?: string | null;
    sessionId: string;
    turn?: Turn;
    scope?: ContextScopeResolution;
    modelId?: string;
  }) {
    if (!input.turn || input.turn.role !== 'user') return [];
    const workspaceId = input.workspaceId;
    try {
      const explicitDecisions = extractExplicitMemoryDecisions(
        input.turn.content
      );
      if (
        !explicitDecisions.length &&
        !shouldAttemptImplicitExtraction(input.turn.content)
      ) {
        return [];
      }
      if (!explicitDecisions.length && input.workspaceId) {
        const settings = await this.getSettings(
          input.userId,
          input.workspaceId
        );
        if (!settings.autoMemoryEnabled) return [];
      }
      const projectIds = input.docId ? [] : (input.scope?.projectIds ?? []);
      if (!workspaceId && projectIds.length !== 1) return [];
      // A rejected project scope must never become a broader memory target.
      if (
        input.scope &&
        (input.scope.projectResolution === 'invalid_selection' ||
          (input.scope.selectedProjectId &&
            (projectIds.length !== 1 ||
              projectIds[0] !== input.scope.selectedProjectId)))
      ) {
        return [];
      }
      const readableDocIds =
        input.scope?.readableDocIds ?? (input.docId ? [input.docId] : []);
      const targets =
        projectIds.length === 1
          ? [
              {
                scope: 'project' as const,
                docId: null,
                projectId: projectIds[0],
              },
            ]
          : readableDocIds.length === 1
            ? [
                {
                  scope: 'document' as const,
                  docId: readableDocIds[0],
                  projectId: null,
                },
              ]
            : readableDocIds.length === 0
              ? [
                  {
                    scope: 'workspace' as const,
                    docId: null,
                    projectId: null,
                  },
                ]
              : [];
      if (!targets.length) return [];

      const targetsWithSources = await Promise.all(
        targets.map(async target => ({
          ...target,
          sourceDocuments:
            target.projectId && workspaceId
              ? await this.projectMemorySourceDocuments({
                  userId: input.userId,
                  projectId: target.projectId,
                  readableDocumentRefs: input.scope?.readableDocumentRefs,
                })
              : undefined,
        }))
      );
      if (
        targetsWithSources.some(
          target =>
            workspaceId && target.projectId && !target.sourceDocuments?.length
        )
      ) {
        return [];
      }

      let decisions = explicitDecisions;
      if (!decisions.length) {
        try {
          decisions = await this.extractImplicitMemoryDecisions({
            content: input.turn.content,
            modelId: input.modelId,
            userId: input.userId,
            workspaceId: input.workspaceId,
            sessionId: input.sessionId,
          });
        } catch (error) {
          this.logger.warn(
            'Structured implicit memory extraction failed; the chat turn will continue',
            { sessionId: input.sessionId, error }
          );
          return [];
        }
      }

      const events = [];
      for (const [index, originalDecision] of decisions.entries()) {
        const decision = sanitizeContextMemoryWriterDecision(
          originalDecision,
          input.turn.content
        );
        for (const target of targetsWithSources) {
          const event =
            await this.models.copilotContextMemory.applyWriterDecision({
              ownerUserId: input.userId,
              workspaceId: input.workspaceId,
              docId: target.docId,
              projectId: target.projectId,
              sourceDocuments: target.sourceDocuments,
              sourceSessionId: input.sessionId,
              sourceTurnId: input.turn.id ?? null,
              scope: target.scope,
              explicit: explicitDecisions.length > 0,
              writerVersion: MEMORY_WRITER_VERSION,
              decisionFingerprint: memoryDecisionFingerprint({
                sessionId: input.sessionId,
                turnId: input.turn.id,
                index,
                decision,
              }),
              decision,
            });
          events.push(event);
          if (
            event.memoryId &&
            (event.operation === 'ADD' || event.operation === 'UPDATE')
          ) {
            const memory = await this.models.copilotContextMemory.get(
              event.memoryId
            );
            if (memory) {
              await this.embedMemory({
                id: memory.id,
                content: memory.content,
                userId: input.userId,
                workspaceId: input.workspaceId,
                sessionId: input.sessionId,
              });
            }
          }
        }
      }
      if (
        events.some(
          event =>
            event.memoryId &&
            (event.operation === 'ADD' || event.operation === 'UPDATE')
        )
      ) {
        try {
          await Promise.all(
            targetsWithSources.map(target =>
              this.models.copilotContextMemory.enforceAutoMemoryQuota({
                ownerUserId: input.userId,
                workspaceId,
                scope: target.scope,
                docId: target.docId,
                projectId: target.projectId,
              })
            )
          );
        } catch (error) {
          this.logger.warn(
            'Failed to enforce automatic memory quota; capture remains available',
            { sessionId: input.sessionId, error }
          );
        }
      }
      return events;
    } catch (error) {
      this.logger.warn('Failed to capture durable context memory', {
        sessionId: input.sessionId,
        error,
      });
      return [];
    }
  }

  async create(
    ownerUserId: string,
    input: {
      workspaceId?: string | null;
      docId?: string | null;
      projectId?: string | null;
      scope: CopilotContextMemoryScope;
      kind: Exclude<CopilotContextMemoryKind, 'auto_memory'>;
      content: string;
      sourceDocuments?: CopilotContextDocumentRef[];
    }
  ) {
    const memory = await this.models.copilotContextMemory.put({
      ownerUserId,
      ...input,
      visibility: 'private',
      status: 'active',
      sourceSessionId: null,
      captureMode: 'manual',
      writerVersion: MEMORY_WRITER_VERSION,
      sensitivity: 'private',
      metadata: { source: 'manual' },
      sourceDocuments: input.sourceDocuments,
    });
    if (memory.workspaceId) {
      await this.embedMemory({
        id: memory.id,
        content: memory.content,
        userId: ownerUserId,
        workspaceId: memory.workspaceId,
      });
    }
    return memory;
  }

  async get(id: string) {
    return await this.models.copilotContextMemory.get(id);
  }

  async update(
    id: string,
    input: { content?: string; status?: CopilotContextMemoryStatus },
    actorUserId?: string
  ) {
    const current = await this.models.copilotContextMemory.get(id);
    const operationUserId =
      current?.scope === 'project' ? actorUserId : current?.ownerUserId;
    if (!current || !operationUserId) return null;
    const sourceDocuments = current.projectId
      ? await this.projectMemorySourceDocuments({
          userId: operationUserId,
          projectId: current.projectId,
        })
      : undefined;
    if (
      current &&
      current.kind === 'auto_memory' &&
      current.status === 'disabled' &&
      input.status === 'active' &&
      current.workspaceId &&
      current.factKey
    ) {
      const content = normalize(input.content ?? current.content);
      const event = await this.models.copilotContextMemory.applyWriterDecision({
        ownerUserId: operationUserId,
        workspaceId: current.workspaceId,
        docId: current.docId,
        projectId: current.projectId,
        sourceDocuments,
        sourceSessionId: current.sourceSessionId,
        sourceTurnId: null,
        scope: current.scope as Exclude<CopilotContextMemoryScope, 'user'>,
        explicit: true,
        writerVersion: MEMORY_WRITER_VERSION,
        decisionFingerprint: createHash('sha256')
          .update(
            JSON.stringify({
              operation: 'user_reenabled',
              memoryId: current.id,
              previousFingerprint: current.fingerprint,
              content,
            })
          )
          .digest('hex'),
        decision: {
          operation: 'UPDATE',
          factKey: current.factKey,
          content,
          confidence: 1,
          importance: current.importance,
          sensitivity: current.sensitivity as
            | 'private'
            | 'personal'
            | 'restricted',
          validFrom: new Date(),
          validUntil: null,
          expiresAt: current.expiresAt,
          reasonCode: 'user_reenabled',
        },
      });
      const memory = event.memoryId
        ? await this.models.copilotContextMemory.get(event.memoryId)
        : null;
      await this.models.copilotContextMemory.retireDisabledVersion(current.id);
      if (
        memory &&
        (event.operation === 'ADD' || event.operation === 'UPDATE')
      ) {
        await this.embedMemory({
          id: memory.id,
          content: memory.content,
          userId: operationUserId,
          workspaceId: current.workspaceId,
        });
      }
      return memory;
    }
    if (
      current &&
      current.kind === 'auto_memory' &&
      current.status === 'active' &&
      current.workspaceId &&
      current.factKey &&
      input.content !== undefined
    ) {
      const content = normalize(input.content);
      const event = await this.models.copilotContextMemory.applyWriterDecision({
        ownerUserId: operationUserId,
        workspaceId: current.workspaceId,
        docId: current.docId,
        projectId: current.projectId,
        sourceDocuments,
        sourceSessionId: current.sourceSessionId,
        sourceTurnId: null,
        scope: current.scope as Exclude<CopilotContextMemoryScope, 'user'>,
        explicit: true,
        writerVersion: MEMORY_WRITER_VERSION,
        decisionFingerprint: createHash('sha256')
          .update(
            JSON.stringify({
              operation: 'user_correction',
              memoryId: current.id,
              previousFingerprint: current.fingerprint,
              content,
            })
          )
          .digest('hex'),
        decision: {
          operation: 'UPDATE',
          factKey: current.factKey,
          content,
          confidence: 1,
          importance: current.importance,
          sensitivity: current.sensitivity as
            | 'private'
            | 'personal'
            | 'restricted',
          validFrom: new Date(),
          validUntil: null,
          expiresAt: current.expiresAt,
          reasonCode: 'user_correction',
        },
      });
      const targetId = event.memoryId ?? current.id;
      let memory = await this.models.copilotContextMemory.get(targetId);
      if (memory && input.status !== undefined) {
        memory = await this.models.copilotContextMemory.update(targetId, {
          status: input.status,
        });
      }
      if (
        memory &&
        (event.operation === 'ADD' || event.operation === 'UPDATE')
      ) {
        await this.embedMemory({
          id: memory.id,
          content: memory.content,
          userId: operationUserId,
          workspaceId: current.workspaceId,
        });
      }
      return memory;
    }
    const memory = await this.models.copilotContextMemory.update(
      id,
      input,
      actorUserId
    );
    if (memory && input.content !== undefined && memory.workspaceId) {
      await this.models.copilotContextMemory.clearEmbedding(memory.id);
      await this.embedMemory({
        id: memory.id,
        content: memory.content,
        userId: operationUserId,
        workspaceId: memory.workspaceId,
      });
    }
    return memory;
  }

  async delete(id: string, actorUserId?: string) {
    return await this.models.copilotContextMemory.delete(id, actorUserId);
  }

  async listWriterEvents(userId: string, workspaceId: string, limit?: number) {
    return await this.models.copilotContextMemory.listWriterEvents({
      ownerUserId: userId,
      workspaceId,
      limit,
    });
  }

  async undoWriterEvent(userId: string, workspaceId: string, eventId: string) {
    return await this.models.copilotContextMemory.undoWriterEvent({
      ownerUserId: userId,
      workspaceId,
      eventId,
    });
  }

  async getProject(id: string) {
    return await this.models.copilotContextMemory.getProject(id);
  }

  async getDocumentMetas(documents: CopilotContextDocumentRef[]) {
    return await this.models.doc.findMetas(documents, {
      select: { title: true },
    });
  }

  async listProjects(userId: string, includeArchived = false) {
    return await this.models.copilotContextMemory.listProjects({
      userId,
      includeArchived,
    });
  }

  async createProject(input: {
    createdByUserId: string;
    name: string;
    description?: string;
    documents: CopilotContextProjectDocumentInput[];
  }) {
    return await this.models.copilotContextMemory.createProject(input);
  }

  async addProjectDocument(
    projectId: string,
    actorUserId: string,
    document: CopilotContextProjectDocumentInput
  ) {
    return await this.models.copilotContextMemory.addProjectDocument(
      projectId,
      actorUserId,
      document
    );
  }

  async removeProjectDocument(
    projectId: string,
    actorUserId: string,
    document: CopilotContextDocumentRef
  ) {
    return await this.models.copilotContextMemory.removeProjectDocument(
      projectId,
      actorUserId,
      document
    );
  }

  async updateProjectDocument(
    projectId: string,
    actorUserId: string,
    document: CopilotContextDocumentRef,
    input: { groupId?: string | null; sortOrder?: number }
  ) {
    return await this.models.copilotContextMemory.updateProjectDocument(
      projectId,
      actorUserId,
      document,
      input
    );
  }

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
    return await this.models.copilotContextMemory.updateProject(
      id,
      actorUserId,
      input
    );
  }

  async deleteProject(id: string, actorUserId: string) {
    return await this.models.copilotContextMemory.deleteProject(
      id,
      actorUserId
    );
  }
}

export type ContextMemoryCreateInput = Omit<
  CopilotContextMemoryInput,
  'ownerUserId' | 'sourceSessionId' | 'status' | 'metadata'
>;

import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma, PrismaClient } from '@prisma/client';

import { BadRequest, CopilotSessionNotFound } from '../base';
import { BaseModel } from './base';
import {
  clearEmbeddingContent,
  ContextBlob,
  ContextConfigSchema,
  ContextDoc,
  ContextEmbedStatus,
  ContextFile,
  CopilotContext,
  DocChunkSimilarity,
  Embedding,
  EMBEDDING_DIMENSIONS,
  embeddingSearchCandidateLimit,
  FileChunkSimilarity,
  MinimalContextConfigSchema,
  PendingEmbeddingBackfillChunk,
  toPgVector,
} from './common/copilot';
import {
  permissionDocumentLockKey,
  permissionWorkspaceLockKey,
} from './permission-write';

type UpdateCopilotContextInput = Pick<CopilotContext, 'config'>;

export type SharedWriteSourceSink = {
  type:
    | 'document_create'
    | 'document_copy'
    | 'document_update'
    | 'project_memory'
    | 'conditional_noop'
    | 'tool_write';
  id: string;
  workspaceId?: string;
  projectId?: string;
  documentId?: string;
  phase: 'prepare' | 'confirm' | 'execute' | 'retry' | 'noop';
};

export type CopilotInputSource = {
  workspaceId: string | null;
  kind:
    | 'workspace'
    | 'document'
    | 'project_resource'
    | 'project_blob'
    | 'private'
    | 'private_attachment'
    | 'unknown';
  sourceId: string;
};

/**
 * Copilot Job Model
 */
@Injectable()
export class CopilotContextModel extends BaseModel {
  @Inject(PrismaClient)
  private readonly sourceAuditDb!: PrismaClient;

  private async lockDocumentAudience(workspaceId: string, documentId: string) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionWorkspaceLockKey(workspaceId)}, 0))`;
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionDocumentLockKey(workspaceId, documentId)}, 0))`;
    const policies = await this.db.$queryRaw<
      Array<{ sharingEnabled: boolean }>
    >`
      SELECT sharing_enabled AS "sharingEnabled" FROM workspace_access_policies
      WHERE workspace_id = ${workspaceId} FOR SHARE
    `;
    const documents = await this.db.$queryRaw<Array<{ visibility: string }>>`
      SELECT visibility FROM doc_access_policies
      WHERE workspace_id = ${workspaceId} AND doc_id = ${documentId} FOR SHARE
    `;
    const projects = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT project.id FROM ai_context_projects project
      WHERE EXISTS (SELECT 1 FROM ai_context_project_grants grant_row
        WHERE grant_row.project_id = project.id AND grant_row.workspace_id = ${workspaceId}
          AND grant_row.doc_id = ${documentId} AND grant_row.status = 'active')
      ORDER BY project.id LIMIT 4097 FOR UPDATE
    `;
    // Include all potential readers, even where a directory or explicit deny
    // narrows access. Never assume the Project is the document's only audience.
    const users = await this.db.$queryRaw<Array<{ userId: string }>>`
      SELECT user_id AS "userId" FROM (
        SELECT user_id FROM workspace_members WHERE workspace_id = ${workspaceId} AND state = 'active'
        UNION
        SELECT principal_id FROM doc_grants WHERE workspace_id = ${workspaceId}
          AND doc_id = ${documentId} AND role <> 'none'
        UNION
        SELECT member.user_id FROM ai_context_project_members member
        JOIN ai_context_projects project ON project.id = member.project_id AND project.status = 'active'
        JOIN ai_context_project_grants grant_row ON grant_row.project_id = project.id
        WHERE grant_row.workspace_id = ${workspaceId} AND grant_row.doc_id = ${documentId} AND grant_row.status = 'active'
      ) audience ORDER BY user_id LIMIT 4097
    `;
    return {
      version: 'shared-write-audience/v1',
      workspaceId,
      documentId,
      known: policies.length === 1,
      public:
        policies[0]?.sharingEnabled === true &&
        documents[0]?.visibility === 'public',
      overBudget: users.length > 4096 || projects.length > 4096,
      userIds: users.map(user => user.userId),
    };
  }

  @Transactional()
  async withDocumentSourcesShared<T>(
    input: Parameters<CopilotContextModel['assertDocumentSourcesShared']>[0],
    execute: () => Promise<T>
  ) {
    await this.assertDocumentSourcesShared(input);
    return await execute();
  }

  @Transactional()
  async assertDocumentSourcesShared(input: {
    sessionId?: string | null;
    actorId: string;
    sink: SharedWriteSourceSink & { workspaceId: string; documentId: string };
  }) {
    const session = input.sessionId
      ? await this.models.copilotSession.getMeta(input.sessionId)
      : null;
    if (input.sessionId && (!session || session.userId !== input.actorId))
      throw new BadRequest('Shared write conversation is unavailable');
    if (session?.selectedContextProjectId)
      return await this.assertProjectSourcesShared({
        ...input,
        sessionId: session.id,
        projectId: session.selectedContextProjectId,
      });
    const audienceEvidence = await this.lockDocumentAudience(
      input.sink.workspaceId,
      input.sink.documentId
    );
    if (input.sessionId)
      await this.db
        .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'context-source:' + input.sessionId}, 0))`;
    const sources = session
      ? await this.db.aiSessionContextSource.findMany({
          where: { sessionId: session.id },
          select: {
            workspaceId: true,
            kind: true,
            sourceId: true,
            evidence: true,
          },
          orderBy: [
            { workspaceId: 'asc' },
            { kind: 'asc' },
            { sourceId: 'asc' },
          ],
          take: 4098,
        })
      : [
          {
            workspaceId: input.sink.workspaceId,
            kind: 'unknown',
            sourceId: 'missing-conversation-lineage',
            evidence: {},
          },
        ];
    const overBudget =
      sources.length > 4097 ||
      sources.some(source => source.sourceId === 'source-budget-exceeded');
    const privateAudience =
      audienceEvidence.known &&
      !audienceEvidence.public &&
      !audienceEvidence.overBudget &&
      audienceEvidence.userIds.every(id => id === input.actorId);
    // Personal input has no authority for additional readers. Until a source
    // carries a verified shared scope, a personal conversation stays private.
    const allowed = privateAudience && !overBudget;
    const evidence = sources.slice(0, 4097);
    await this.sourceAuditDb.aiSharedWriteSourceCheck.create({
      data: {
        sessionId: input.sessionId ?? 'unbound',
        actorId: input.actorId,
        sinkType: input.sink.type,
        sinkId: input.sink.id,
        sinkWorkspaceId: input.sink.workspaceId,
        phase: input.sink.phase,
        allowed,
        reasonCode: allowed
          ? 'authorized'
          : overBudget
            ? 'source_budget_exceeded'
            : 'unshared_source',
        sources: evidence,
        sourceFingerprint: createHash('sha256')
          .update(JSON.stringify(evidence))
          .digest('hex'),
        audienceEvidence,
      },
    });
    if (!allowed)
      throw new BadRequest(
        'This conversation has no verified source authority for the destination readers. Use an authorized Project conversation before writing shared content.'
      );
  }
  // ================ contexts ================

  async create(sessionId: string) {
    const session = await this.db.aiSession.findFirst({
      where: { id: sessionId },
      select: { workspaceId: true },
    });
    if (!session) {
      throw new CopilotSessionNotFound();
    }

    const row = await this.db.aiContext.create({
      data: {
        sessionId,
        config: {
          workspaceId: session.workspaceId,
          blobs: [],
          docs: [],
          files: [],
          categories: [],
        },
      },
    });
    return row;
  }

  async get(id: string) {
    const row = await this.db.aiContext.findFirst({
      where: { id },
    });
    return row;
  }

  async getAccessInfo(id: string, userId: string) {
    return await this.db.aiContext.findFirst({
      where: {
        id,
        session: {
          userId,
          deletedAt: null,
          OR: [
            { selectedContextProjectId: null },
            {
              docId: null,
              selectedContextProject: {
                status: 'active',
                members: { some: { userId } },
              },
            },
          ],
        },
      },
      select: {
        id: true,
        sessionId: true,
        session: {
          select: {
            userId: true,
            workspaceId: true,
            docId: true,
          },
        },
      },
    });
  }

  async getConfig(id: string) {
    const row = await this.get(id);
    if (row) {
      const config = ContextConfigSchema.safeParse(row.config);
      if (config.success) {
        return config.data;
      }
      const minimalConfig = MinimalContextConfigSchema.safeParse(row.config);
      if (minimalConfig.success) {
        // fulfill the missing fields
        return {
          blobs: [],
          docs: [],
          files: [],
          categories: [],
          ...minimalConfig.data,
        };
      }
    }
    return null;
  }

  async getBySessionId(sessionId: string) {
    const row = await this.db.aiContext.findFirst({
      where: { sessionId },
    });
    return row;
  }

  async getSessionSources(sessionId: string) {
    const evidence = await this.db.aiSessionContextSource.findMany({
      where: { sessionId },
      select: { workspaceId: true, kind: true, sourceId: true },
    });
    const session = await this.db.aiSession.findUnique({
      where: { id: sessionId },
      select: { workspaceId: true },
    });
    const documentRefs = evidence.flatMap(source =>
      source.kind === 'document' && source.workspaceId
        ? [{ workspaceId: source.workspaceId, docId: source.sourceId }]
        : []
    );
    const historicalDocs = documentRefs
      .filter(source => source.workspaceId === session?.workspaceId)
      .map(source => source.docId);
    const hasPrivateAttachments = evidence.some(
      source =>
        source.kind === 'private_attachment' || source.kind === 'private'
    );
    const valid = evidence.every(source => source.kind !== 'unknown');
    const row = await this.db.aiContext.findFirst({
      where: { sessionId },
      select: { config: true },
    });
    if (!row)
      return {
        docIds: historicalDocs,
        documentRefs,
        hasPrivateAttachments,
        valid,
      };

    const config = ContextConfigSchema.safeParse(row.config);
    if (!config.success)
      return {
        docIds: historicalDocs,
        documentRefs,
        hasPrivateAttachments,
        valid: false,
      };
    return {
      documentRefs,
      docIds: Array.from(
        new Set([
          ...historicalDocs,
          ...config.data.docs.map(doc => doc.id),
          ...config.data.categories.flatMap(category =>
            category.docs.map(doc => doc.id)
          ),
        ])
      ),
      hasPrivateAttachments:
        hasPrivateAttachments ||
        config.data.files.length > 0 ||
        config.data.blobs.length > 0,
      valid,
    };
  }

  @Transactional()
  async recordDocumentSources(input: {
    sessionId: string;
    actorId: string;
    projectId: string | null;
    documents: Array<{ workspaceId: string; docId: string }>;
  }) {
    if (
      input.documents.length > 4096 ||
      input.documents.some(
        doc =>
          !doc.workspaceId ||
          !doc.docId ||
          doc.workspaceId.length > 256 ||
          doc.docId.length > 256
      )
    )
      throw new BadRequest('Document source evidence is invalid or too large');
    await this.recordInputSources({
      ...input,
      sources: input.documents.map(document => ({
        workspaceId: document.workspaceId,
        kind: 'document' as const,
        sourceId: document.docId,
      })),
    });
  }

  @Transactional()
  async recordInputSources(input: {
    sessionId: string;
    actorId: string;
    projectId: string | null;
    sources: CopilotInputSource[];
  }) {
    if (input.projectId) {
      await this.lockProjectSourceSession({
        ...input,
        projectId: input.projectId,
      });
    } else {
      await this.db
        .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'context-source:' + input.sessionId}, 0))`;
      const sessions = await this.db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM ai_sessions_metadata WHERE id = ${input.sessionId}
          AND user_id = ${input.actorId} AND deleted_at IS NULL AND selected_context_project_id IS NULL FOR SHARE
      `;
      if (!sessions.length)
        throw new BadRequest('Input source conversation is unavailable');
    }
    if (
      input.sources.length > 4096 ||
      input.sources.some(
        source =>
          (!source.workspaceId && !input.projectId) ||
          (source.workspaceId?.length ?? 0) > 256 ||
          (source.kind === 'document' && !source.workspaceId) ||
          !source.sourceId ||
          source.sourceId.length > 256
      )
    )
      throw new BadRequest('Input source evidence is invalid or too large');
    await this.db.aiSessionContextSource.createMany({
      data: input.sources.map(source => ({
        ...source,
        sessionId: input.sessionId,
        projectId: source.workspaceId ? null : input.projectId,
        kind:
          !source.workspaceId && source.kind === 'workspace'
            ? 'project'
            : source.kind,
      })),
      skipDuplicates: true,
    });
  }

  @Transactional()
  async recordRecalledMemorySources(input: {
    sessionId: string;
    actorId: string;
    projectId: string | null;
    workspaceId: string | null;
    memories: Array<{ id: string; content: string }>;
  }) {
    if (input.memories.length > 64)
      throw new BadRequest('Recalled memory sources exceed their limit');
    const memories = await this.db.aiContextMemory.findMany({
      where: { id: { in: input.memories.map(memory => memory.id) } },
      include: {
        sources: true,
        projectSourceCheck: true,
        summaryRevisions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const byId = new Map(memories.map(memory => [memory.id, memory]));
    const sources: CopilotInputSource[] = [];
    for (const { id, content } of input.memories) {
      const memory = byId.get(id);
      const shared =
        memory?.scope === 'project' &&
        memory.projectId === input.projectId &&
        memory.status === 'active' &&
        memory.content === content &&
        !memory.quarantinedAt &&
        (memory.sources.length > 0 ||
          memory.projectSourceCheck?.allowed ||
          memory.summaryRevisions.some(
            revision =>
              revision.contentFingerprint ===
              createHash('sha256').update(content).digest('hex')
          ));
      sources.push({
        workspaceId: input.workspaceId,
        kind: shared ? 'workspace' : memory ? 'private' : 'unknown',
        sourceId: `recalled-memory:${id}:${createHash('sha256').update(content).digest('hex')}`,
      });
      if (shared)
        for (const source of memory.sources)
          sources.push({
            workspaceId: source.workspaceId,
            kind: 'document',
            sourceId: source.docId,
          });
    }
    await this.recordInputSources({ ...input, sources });
  }

  private async lockProjectSourceSession(input: {
    sessionId: string;
    actorId: string;
    projectId: string;
  }) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'context-source:' + input.sessionId}, 0))`;
    const sessions = await this.db.$queryRaw<
      Array<{ workspaceId: string | null }>
    >`
      SELECT session.workspace_id AS "workspaceId"
      FROM ai_sessions_metadata session
      JOIN ai_context_projects project ON project.id = session.selected_context_project_id
      JOIN ai_context_project_members member ON member.project_id = project.id AND member.user_id = ${input.actorId}
      WHERE session.id = ${input.sessionId} AND session.user_id = ${input.actorId}
        AND session.deleted_at IS NULL AND session.doc_id IS NULL
        AND project.id = ${input.projectId} AND project.status = 'active'
      FOR UPDATE OF project FOR SHARE OF session, member
    `;
    if (!sessions[0])
      throw new BadRequest(
        'Project source evidence requires an active owned project conversation'
      );
    return sessions[0];
  }

  @Transactional()
  async withProjectSourcesShared<T>(
    input: Parameters<CopilotContextModel['assertProjectSourcesShared']>[0],
    execute: () => Promise<T>
  ) {
    await this.assertProjectSourcesShared(input);
    return execute();
  }

  async assertProjectSourcesShared(
    input: Parameters<CopilotContextModel['checkProjectSourcesShared']>[0]
  ): Promise<void> {
    await this.checkProjectSourcesShared(input);
  }

  @Transactional()
  async checkProjectSourcesShared(input: {
    sessionId: string;
    actorId: string;
    projectId: string;
    sink?: SharedWriteSourceSink;
  }) {
    if (input.sink?.workspaceId && input.sink.phase !== 'noop') {
      await this.sourceAuditDb.aiSharedWriteSourceCheck.create({
        data: {
          sessionId: input.sessionId,
          actorId: input.actorId,
          projectId: input.projectId,
          sinkType: input.sink.type,
          sinkId: input.sink.id,
          sinkWorkspaceId: input.sink.workspaceId,
          phase: input.sink.phase,
          allowed: false,
          reasonCode: 'unshared_source',
          sources: [],
          sourceFingerprint: createHash('sha256').update('[]').digest('hex'),
          audienceEvidence: {
            policy: 'project_native_requires_explicit_publication',
          },
        },
      });
      throw new BadRequest(
        'Legacy Project writes to Workspace are suspended. Save a Project resource and use its explicit publication workflow.'
      );
    }
    if (
      input.sink?.projectId &&
      (input.sink.projectId !== input.projectId || input.sink.workspaceId)
    )
      throw new BadRequest('Project source sink has a conflicting owner');
    const internalSink = input.sink?.projectId === input.projectId;
    const documentSink =
      input.sink && input.sink.type !== 'project_memory' && !internalSink;
    const audienceEvidence =
      documentSink && input.sink?.workspaceId
        ? await this.lockDocumentAudience(
            input.sink.workspaceId,
            input.sink.documentId ?? input.sink.id
          )
        : null;
    const session = await this.lockProjectSourceSession(input);
    const members = audienceEvidence
      ? await this.db.aiContextProjectMember.findMany({
          where: {
            projectId: input.projectId,
            userId: { in: audienceEvidence.userIds },
          },
          select: { userId: true },
        })
      : [];
    const audienceAllowed =
      !documentSink ||
      (!!audienceEvidence &&
        audienceEvidence.known &&
        !audienceEvidence.public &&
        !audienceEvidence.overBudget &&
        members.length === audienceEvidence.userIds.length);
    const sources = await this.db.aiSessionContextSource.findMany({
      where: { sessionId: input.sessionId },
      select: {
        workspaceId: true,
        projectId: true,
        kind: true,
        sourceId: true,
        evidence: true,
      },
      orderBy: [{ workspaceId: 'asc' }, { kind: 'asc' }, { sourceId: 'asc' }],
      take: 4098,
    });
    const shared = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT grant_row.id FROM ai_session_context_sources source
      JOIN ai_context_project_grants grant_row
        ON grant_row.project_id = ${input.projectId}
        AND grant_row.workspace_id = source.workspace_id
        AND grant_row.doc_id = source.source_id AND grant_row.status = 'active'
        AND grant_row.id = source.evidence->>'projectGrantId'
      WHERE source.session_id = ${input.sessionId} AND source.kind = 'document'
      FOR SHARE OF grant_row
    `;
    const overBudget =
      sources.length > 4097 ||
      sources.some(source => source.sourceId === 'source-budget-exceeded');
    let projectInputs = 0;
    for (const source of sources) {
      if (
        source.projectId === input.projectId &&
        !source.workspaceId &&
        (source.kind === 'project_resource' || source.kind === 'project_blob')
      ) {
        projectInputs++;
        continue;
      }
      if (
        !(
          source.kind === 'workspace' ||
          (source.kind === 'project' && source.projectId === input.projectId)
        ) ||
        source.workspaceId !== session.workspaceId
      )
        continue;
      if (
        ['project-input:', 'system-prompt:', 'derived-tool:'].some(prefix =>
          source.sourceId.startsWith(prefix)
        )
      ) {
        projectInputs++;
      } else if (source.sourceId.startsWith('recalled-memory:')) {
        const [, id, fingerprint] = source.sourceId.split(':');
        const memories = await this.db.$queryRaw<Array<{ content: string }>>`
          SELECT content FROM ai_context_memories
          WHERE id = ${id} AND project_id = ${input.projectId} AND scope = 'project'
            AND status = 'active' AND quarantined_at IS NULL
            AND (expires_at IS NULL OR expires_at > now())
            AND (valid_until IS NULL OR valid_until > now())
          FOR SHARE
        `;
        if (
          memories[0] &&
          createHash('sha256').update(memories[0].content).digest('hex') ===
            fingerprint
        )
          projectInputs++;
      } else if (
        source.workspaceId &&
        source.sourceId.startsWith('workspace-policy:')
      ) {
        const policies = await this.db.$queryRaw<Array<{ id: string }>>`
          SELECT policy.id FROM ai_context_policies policy
          JOIN ai_context_policy_revisions revision ON revision.policy_id = policy.id
          WHERE revision.id = ${source.sourceId.slice('workspace-policy:'.length)}
            AND policy.workspace_id = ${source.workspaceId} AND policy.status = 'active'
            AND policy.active_revision = revision.revision
          FOR SHARE OF policy, revision
        `;
        await this.db.$queryRaw`
          SELECT workspace_member.id FROM workspace_members workspace_member
          JOIN ai_context_project_members project_member ON project_member.user_id = workspace_member.user_id
          WHERE project_member.project_id = ${input.projectId}
            AND workspace_member.workspace_id = ${source.workspaceId}
            AND workspace_member.state = 'active'
          FOR SHARE OF workspace_member
        `;
        const unrepresented = await this.db.aiContextProjectMember.count({
          where: {
            projectId: input.projectId,
            user: {
              workspaceMembers: {
                none: { workspaceId: source.workspaceId, state: 'active' },
              },
            },
          },
        });
        if (policies.length === 1 && !unrepresented) projectInputs++;
      }
    }
    const allowed =
      audienceAllowed &&
      !overBudget &&
      shared.length + projectInputs === sources.length;
    let sourceCheckId: string | undefined;
    if (input.sink) {
      const evidence = sources.slice(0, 4097);
      // A denial must remain auditable even when its caller rolls back the write.
      // No live-record foreign keys or permission locks are taken by this insert.
      const check = await this.sourceAuditDb.aiSharedWriteSourceCheck.create({
        data: {
          sessionId: input.sessionId,
          actorId: input.actorId,
          projectId: input.projectId,
          sinkType: input.sink.type,
          sinkId: input.sink.id,
          phase: input.sink.phase,
          sinkWorkspaceId: input.sink.workspaceId ?? null,
          allowed,
          reasonCode: allowed
            ? 'authorized'
            : overBudget
              ? 'source_budget_exceeded'
              : 'unshared_source',
          sources: evidence,
          audienceEvidence: audienceEvidence ?? {
            version: internalSink
              ? 'project-resource-audience/v1'
              : 'project-memory-audience/v1',
            projectId: input.projectId,
          },
          sourceFingerprint: createHash('sha256')
            .update(JSON.stringify(evidence))
            .digest('hex'),
        },
      });
      sourceCheckId = check.id;
    }
    if (!allowed)
      throw new BadRequest(
        'This conversation contains private or unverified sources that are not authorized for the entire Project. Start a new conversation after authorizing the source documents, without private or unverified sources, before writing shared content.'
      );
    return sourceCheckId;
  }

  async mergeBlobStatus(
    workspaceId: string,
    blobs: ContextBlob[]
  ): Promise<ContextBlob[]> {
    const canEmbedding = await this.checkEmbeddingAvailable();
    const blobIds = Array.from(new Set(blobs.map(blob => blob.id)));
    const [finishedBlobs, pendingBlobs] = canEmbedding
      ? await Promise.all([
          this.listWorkspaceBlobEmbedding(workspaceId, blobIds),
          this.listWorkspaceBlobPendingEmbedding(workspaceId, blobIds),
        ])
      : [[], []];
    const finishedBlobSet = new Set(finishedBlobs);
    const pendingBlobSet = new Set(pendingBlobs);

    for (const blob of blobs) {
      if (
        pendingBlobSet.has(blob.id) &&
        blob.status !== ContextEmbedStatus.failed
      ) {
        blob.status = ContextEmbedStatus.processing;
        continue;
      }
      const status = finishedBlobSet.has(blob.id)
        ? ContextEmbedStatus.finished
        : undefined;
      // NOTE: when the blob has not been synchronized to the server or is in the embedding queue
      // the status will be empty, fallback to processing if no status is provided
      blob.status = status || blob.status || ContextEmbedStatus.processing;
    }

    return blobs;
  }

  async mergeDocStatus(workspaceId: string, docs: ContextDoc[]) {
    const canEmbedding = await this.checkEmbeddingAvailable();
    const docIds = Array.from(new Set(docs.map(doc => doc.id)));
    const [finishedDoc, pendingDoc] = canEmbedding
      ? await Promise.all([
          this.listWorkspaceDocEmbedding(workspaceId, docIds),
          this.listWorkspaceDocPendingEmbedding(workspaceId, docIds),
        ])
      : [[], []];
    const finishedDocSet = new Set(finishedDoc);
    const pendingDocSet = new Set(pendingDoc);

    for (const doc of docs) {
      if (
        pendingDocSet.has(doc.id) &&
        doc.status !== ContextEmbedStatus.failed
      ) {
        doc.status = ContextEmbedStatus.processing;
        continue;
      }
      const status = finishedDocSet.has(doc.id)
        ? ContextEmbedStatus.finished
        : undefined;
      // NOTE: when the document has not been synchronized to the server or is in the embedding queue
      // the status will be empty, fallback to processing if no status is provided
      doc.status = status || doc.status || ContextEmbedStatus.processing;
    }

    return docs;
  }

  async mergeFileStatus(contextId: string, files: ContextFile[]) {
    if (!files.length) return files;

    const rows = await this.db.$queryRaw<
      Array<{ fileId: string; total: number; embedded: number }>
    >`
      SELECT
        "file_id" AS "fileId",
        COUNT(*)::int AS "total",
        COUNT("embedding")::int AS "embedded"
      FROM "ai_context_embeddings"
      WHERE "context_id" = ${contextId}
        AND "file_id" IN (${Prisma.join(files.map(file => file.id))})
      GROUP BY "file_id"
    `;
    const statusByFileId = new Map(rows.map(row => [row.fileId, row]));

    for (const file of files) {
      const row = statusByFileId.get(file.id);
      if (!row) continue;
      if (file.status === ContextEmbedStatus.failed) continue;
      file.status =
        row.total === row.embedded
          ? ContextEmbedStatus.finished
          : ContextEmbedStatus.processing;
      file.error = null;
    }

    return files;
  }

  async update(contextId: string, data: UpdateCopilotContextInput) {
    const ret = await this.db.aiContext.updateMany({
      where: {
        id: contextId,
      },
      data: {
        config: data.config || undefined,
      },
    });
    return ret.count > 0;
  }

  // ================ embeddings ================

  async checkEmbeddingAvailable(): Promise<boolean> {
    const [{ count }] = await this.db.$queryRaw<
      { count: number }[]
    >`SELECT count(1) FROM pg_tables WHERE tablename in ('ai_context_embeddings', 'ai_workspace_embeddings')`;
    return Number(count) === 2;
  }

  async listPendingEmbeddingBackfill(
    limit = 64
  ): Promise<PendingEmbeddingBackfillChunk[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), 128);
    return await this.db.$queryRaw<PendingEmbeddingBackfillChunk[]>`
      SELECT
        "kind",
        "workspaceId",
        "contextId",
        "userId",
        "entityId",
        "chunk",
        "content"
      FROM (
        SELECT
          pending.*,
          ROW_NUMBER() OVER (
            PARTITION BY
              "kind",
              "workspaceId",
              "contextId",
              "entityId"
            ORDER BY "chunk"
          ) AS "entityChunkOrdinal"
        FROM (
          SELECT
            'context_file'::text AS "kind",
            s."workspace_id" AS "workspaceId",
            e."context_id" AS "contextId",
            s."user_id" AS "userId",
            e."file_id" AS "entityId",
            e."chunk",
            e."content"
          FROM "ai_context_embeddings" e
          JOIN "ai_contexts" c ON c."id" = e."context_id"
          JOIN "ai_sessions_metadata" s ON s."id" = c."session_id"
          WHERE e."embedding" IS NULL

          UNION ALL

          SELECT
            'memory'::text AS "kind",
            m."workspace_id" AS "workspaceId",
            NULL::text AS "contextId",
            m."owner_user_id" AS "userId",
            m."id" AS "entityId",
            0 AS "chunk",
            m."content"
          FROM "ai_context_memories" m
          WHERE m."embedding" IS NULL
            AND m."workspace_id" IS NOT NULL
            AND m."status" IN ('active', 'disabled')

          UNION ALL

          SELECT
            'workspace_document'::text AS "kind",
            e."workspace_id" AS "workspaceId",
            NULL::text AS "contextId",
            NULL::text AS "userId",
            e."doc_id" AS "entityId",
            e."chunk",
            e."content"
          FROM "ai_workspace_embeddings" e
          JOIN "workspaces" w ON w."id" = e."workspace_id"
          WHERE e."embedding" IS NULL
            AND w."enable_doc_embedding" = TRUE

          UNION ALL

          SELECT
            'workspace_file'::text AS "kind",
            e."workspace_id" AS "workspaceId",
            NULL::text AS "contextId",
            NULL::text AS "userId",
            e."file_id" AS "entityId",
            e."chunk",
            e."content"
          FROM "ai_workspace_file_embeddings" e
          JOIN "workspaces" w ON w."id" = e."workspace_id"
          WHERE e."embedding" IS NULL
            AND w."enable_doc_embedding" = TRUE

          UNION ALL

          SELECT
            'workspace_blob'::text AS "kind",
            e."workspace_id" AS "workspaceId",
            NULL::text AS "contextId",
            NULL::text AS "userId",
            e."blob_id" AS "entityId",
            e."chunk",
            e."content"
          FROM "ai_workspace_blob_embeddings" e
          JOIN "workspaces" w ON w."id" = e."workspace_id"
          WHERE e."embedding" IS NULL
            AND w."enable_doc_embedding" = TRUE
        ) pending
      ) bounded
      WHERE "entityChunkOrdinal" <= 16
      ORDER BY "kind", "workspaceId", "entityId", "chunk"
      LIMIT ${boundedLimit}
    `;
  }

  async listWorkspaceBlobEmbedding(
    workspaceId: string,
    blobIds?: string[]
  ): Promise<string[]> {
    if (blobIds && !blobIds.length) return [];
    const rows = await this.db.$queryRaw<Array<{ blobId: string }>>`
      SELECT "blob_id" AS "blobId"
      FROM "ai_workspace_blob_embeddings"
      WHERE "workspace_id" = ${workspaceId}
        ${blobIds?.length ? Prisma.sql`AND "blob_id" IN (${Prisma.join(blobIds)})` : Prisma.empty}
      GROUP BY "blob_id"
      HAVING BOOL_AND("embedding" IS NOT NULL)
    `;
    return rows.map(row => row.blobId);
  }

  async listWorkspaceBlobPendingEmbedding(
    workspaceId: string,
    blobIds?: string[]
  ): Promise<string[]> {
    if (blobIds && !blobIds.length) return [];
    const rows = await this.db.$queryRaw<Array<{ blobId: string }>>`
      SELECT DISTINCT "blob_id" AS "blobId"
      FROM "ai_workspace_blob_embeddings"
      WHERE "workspace_id" = ${workspaceId}
        AND "embedding" IS NULL
        ${blobIds?.length ? Prisma.sql`AND "blob_id" IN (${Prisma.join(blobIds)})` : Prisma.empty}
    `;
    return rows.map(row => row.blobId);
  }

  async listWorkspaceDocEmbedding(workspaceId: string, docIds?: string[]) {
    if (docIds && !docIds.length) return [];
    const rows = await this.db.$queryRaw<Array<{ docId: string }>>`
      SELECT "doc_id" AS "docId"
      FROM "ai_workspace_embeddings"
      WHERE "workspace_id" = ${workspaceId}
        ${docIds?.length ? Prisma.sql`AND "doc_id" IN (${Prisma.join(docIds)})` : Prisma.empty}
      GROUP BY "doc_id"
      HAVING BOOL_AND("embedding" IS NOT NULL)
    `;
    return rows.map(row => row.docId);
  }

  async listWorkspaceDocPendingEmbedding(
    workspaceId: string,
    docIds?: string[]
  ) {
    if (docIds && !docIds.length) return [];
    const rows = await this.db.$queryRaw<Array<{ docId: string }>>`
      SELECT DISTINCT "doc_id" AS "docId"
      FROM "ai_workspace_embeddings"
      WHERE "workspace_id" = ${workspaceId}
        AND "embedding" IS NULL
        ${docIds?.length ? Prisma.sql`AND "doc_id" IN (${Prisma.join(docIds)})` : Prisma.empty}
    `;
    return rows.map(row => row.docId);
  }

  private processEmbeddings(
    contextOrWorkspaceId: string,
    fileOrDocId: string,
    embeddings: Embedding[],
    withId = true
  ) {
    const groups = embeddings.map(e =>
      [
        withId ? randomUUID() : undefined,
        contextOrWorkspaceId,
        fileOrDocId,
        e.index,
        e.content,
        Prisma.raw(`'${toPgVector(e.embedding)}'`),
        new Date(),
      ].filter(v => v !== undefined)
    );
    return Prisma.join(groups.map(row => Prisma.sql`(${Prisma.join(row)})`));
  }

  async getFileContent(
    contextId: string,
    fileId: string,
    chunk?: number
  ): Promise<string | undefined> {
    const file = await this.db.aiContextEmbedding.findMany({
      where: { contextId, fileId, chunk },
      select: { content: true },
      orderBy: { chunk: 'asc' },
    });
    return file?.map(f => clearEmbeddingContent(f.content)).join('\n');
  }

  async insertFileEmbedding(
    contextId: string,
    fileId: string,
    embeddings: Embedding[]
  ) {
    if (embeddings.length === 0) {
      this.logger.warn(
        `No embeddings provided for contextId: ${contextId}, fileId: ${fileId}. Skipping insertion.`
      );
      return;
    }

    const values = this.processEmbeddings(contextId, fileId, embeddings);

    await this.db.$executeRaw`
    INSERT INTO "ai_context_embeddings"
    ("id", "context_id", "file_id", "chunk", "content", "embedding", "updated_at") VALUES ${values}
    ON CONFLICT (context_id, file_id, chunk) DO UPDATE SET
    content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = excluded.updated_at;
  `;
  }

  async deleteFileEmbedding(contextId: string, fileId: string) {
    await this.db.aiContextEmbedding.deleteMany({
      where: { contextId, fileId },
    });
  }

  async matchFileEmbedding(
    embedding: number[],
    contextId: string,
    topK: number,
    threshold: number
  ): Promise<Omit<FileChunkSimilarity, 'blobId' | 'name' | 'mimeType'>[]> {
    const vector = toPgVector(embedding);
    const candidateLimit = embeddingSearchCandidateLimit(topK);
    const similarityChunks = await this.db.$queryRaw<
      Array<Omit<FileChunkSimilarity, 'blobId' | 'name' | 'mimeType'>>
    >`
      WITH "candidates" AS MATERIALIZED (
        SELECT "file_id", "chunk", "content", "embedding"
        FROM "ai_context_embeddings"
        WHERE context_id = ${contextId}
          AND "embedding" IS NOT NULL
        ORDER BY
          binary_quantize("embedding")::bit(4096) <~>
          binary_quantize(${vector}::vector)::bit(4096)
        LIMIT ${candidateLimit}
      )
      SELECT
        "file_id" as "fileId",
        "chunk",
        "content",
        "embedding" <=> ${vector}::vector as "distance"
      FROM "candidates"
      ORDER BY "distance" ASC
      LIMIT ${topK};
    `;
    return similarityChunks.filter(c => Number(c.distance) <= threshold);
  }

  async getWorkspaceContent(
    workspaceId: string,
    docId: string,
    chunk?: number
  ): Promise<string | undefined> {
    const file = await this.db.aiWorkspaceEmbedding.findMany({
      where: { workspaceId, docId, chunk },
      select: { content: true },
      orderBy: { chunk: 'asc' },
    });
    return file?.map(f => clearEmbeddingContent(f.content)).join('\n');
  }

  async insertWorkspaceEmbedding(
    workspaceId: string,
    docId: string,
    embeddings: Embedding[]
  ) {
    if (embeddings.length === 0) {
      this.logger.warn(
        `No embeddings provided for workspaceId: ${workspaceId}, docId: ${docId}. Skipping insertion.`
      );
      return;
    }

    const values = this.processEmbeddings(
      workspaceId,
      docId,
      embeddings,
      false
    );
    await this.db.$executeRaw`
      INSERT INTO "ai_workspace_embeddings"
        ("workspace_id", "doc_id", "chunk", "content", "embedding", "updated_at")
      VALUES ${values}
      ON CONFLICT (workspace_id, doc_id, chunk)
      DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        updated_at = excluded.updated_at;
    `;
  }

  async fulfillEmptyEmbedding(workspaceId: string, docId: string) {
    const emptyEmbedding = {
      index: 0,
      content: '',
      embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0),
    };
    await this.models.copilotContext.insertWorkspaceEmbedding(
      workspaceId,
      docId,
      [emptyEmbedding]
    );
  }

  async deleteWorkspaceEmbedding(workspaceId: string, docId: string) {
    await this.purgeWorkspaceEmbedding(workspaceId, docId);
    await this.fulfillEmptyEmbedding(workspaceId, docId);
  }

  async purgeWorkspaceEmbedding(workspaceId: string, docId: string) {
    await this.db.aiWorkspaceEmbedding.deleteMany({
      where: { workspaceId, docId },
    });
  }

  async matchWorkspaceEmbedding(
    embedding: number[],
    workspaceId: string,
    topK: number,
    threshold: number,
    readablePredicate: Prisma.Sql,
    matchDocIds?: string[],
    restrictDocIds?: string[]
  ): Promise<DocChunkSimilarity[]> {
    if (restrictDocIds?.length === 0) return [];
    const vector = toPgVector(embedding);
    const candidateLimit = embeddingSearchCandidateLimit(topK);
    const similarityChunks = await this.db.$queryRaw<Array<DocChunkSimilarity>>`
      WITH "candidates" AS MATERIALIZED (
        SELECT w."doc_id", w."chunk", w."content", w."embedding"
        FROM "ai_workspace_embeddings" w
        LEFT JOIN "ai_workspace_ignored_docs" i
          ON i."workspace_id" = w."workspace_id"
            AND i."doc_id" = w."doc_id"
            ${matchDocIds?.length ? Prisma.sql`AND w."doc_id" NOT IN (${Prisma.join(matchDocIds)})` : Prisma.empty}
        WHERE
          w."workspace_id" = ${workspaceId}
          ${restrictDocIds?.length ? Prisma.sql`AND w."doc_id" IN (${Prisma.join(restrictDocIds)})` : Prisma.empty}
          AND w."embedding" IS NOT NULL
          AND i."doc_id" IS NULL
          AND ${readablePredicate}
        ORDER BY
          binary_quantize(w."embedding")::bit(4096) <~>
          binary_quantize(${vector}::vector)::bit(4096)
        LIMIT ${candidateLimit}
      ),
      "ranked" AS (
        SELECT
          "doc_id" as "docId",
          "chunk",
          "content",
          "embedding" <=> ${vector}::vector as "distance"
        FROM "candidates"
      )
      SELECT "docId", "chunk", "content", "distance"
      FROM "ranked"
      WHERE "distance" <= ${threshold}
      ORDER BY "distance" ASC
      LIMIT ${topK};
    `;

    return similarityChunks;
  }
}

import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { CopilotDocumentOperation } from '@prisma/client';

import { BadRequest, NotFound } from '../base';
import { BaseModel } from './base';
import { copyAttachmentDocumentId } from './blob';
import {
  permissionDocumentLockKey,
  permissionWorkspaceLockKey,
} from './permission-write';

type OperationActor = { operationId: string; actorId: string };
type OperationLease = OperationActor & { leaseToken: string };

export type DocumentCopySourceInput = {
  workspaceId: string;
  documentId: string;
  snapshot: Uint8Array;
  assets: { key: string; data: Uint8Array; contentType: string }[];
};

function freezeCopySource(input: DocumentCopySourceInput) {
  const snapshot = Buffer.from(input.snapshot);
  if (
    !input.workspaceId.trim() ||
    input.workspaceId.length > 256 ||
    !input.documentId.trim() ||
    input.documentId.length > 256 ||
    !snapshot.length ||
    snapshot.length > 16 * 1024 * 1024 ||
    input.assets.length > 256
  )
    throw new BadRequest('Document copy source exceeds its bounds');
  let total = snapshot.length;
  const keys = new Set<string>();
  const assets = input.assets
    .map(asset => {
      const data = Buffer.from(asset.data);
      total += data.length;
      if (
        !asset.key ||
        asset.key.length > 256 ||
        keys.has(asset.key) ||
        !asset.contentType ||
        asset.contentType.length > 256 ||
        data.length > 16 * 1024 * 1024 ||
        total > 64 * 1024 * 1024
      )
        throw new BadRequest('Document copy attachments exceed their bounds');
      keys.add(asset.key);
      return {
        key: asset.key,
        data,
        contentType: asset.contentType,
        fingerprint: createHash('sha256').update(data).digest('hex'),
      };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        snapshot: createHash('sha256').update(snapshot).digest('hex'),
        assets: assets.map(asset => [
          asset.key,
          asset.contentType,
          asset.fingerprint,
        ]),
      })
    )
    .digest('hex');
  return {
    workspaceId: input.workspaceId,
    documentId: input.documentId,
    snapshot,
    assets,
    fingerprint,
  };
}

@Injectable()
export class CopilotDocumentOperationModel extends BaseModel {
  async expireLocations(now = new Date(), limit = 50) {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), 100);
    const expired = await this.db.$queryRaw<Array<{ id: string }>>`
      WITH candidates AS (
        SELECT id FROM copilot_document_operations
        WHERE location_expires_at <= ${now}
          AND status IN ('waiting_location', 'ready', 'running', 'failed', 'created')
          AND (lease_token IS NULL OR lease_expires_at <= ${now})
        ORDER BY location_expires_at, id
        LIMIT ${boundedLimit} FOR UPDATE SKIP LOCKED
      )
      UPDATE copilot_document_operations operation
      SET status = 'expired', failure_code = 'location_expired',
        lease_token = NULL, lease_expires_at = NULL, updated_at = ${now}
      FROM candidates WHERE operation.id = candidates.id
      RETURNING operation.id
    `;
    return { count: expired.length };
  }

  @Transactional()
  async withdraw(input: OperationActor & { expectedRevision: number }) {
    const operation = await this.get(input);
    if (operation.status === 'cancelled') return operation;
    const changed = await this.db.copilotDocumentOperation.updateMany({
      where: {
        id: operation.id,
        actorId: input.actorId,
        destinationRevision: input.expectedRevision,
        status: { notIn: ['complete', 'cancelled'] },
      },
      data: {
        status: 'cancelled',
        failureCode: 'withdrawn',
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    if (changed.count !== 1)
      throw new BadRequest('The document operation changed before withdrawal');
    return await this.get(input);
  }

  async list(sessionId: string, actorId: string, after?: string) {
    await this.assertSession(sessionId, actorId);
    if (after) {
      const cursor = await this.db.copilotDocumentOperation.findFirst({
        where: { id: after, sessionId, actorId },
        select: { id: true },
      });
      if (!cursor)
        throw new NotFound('Document operation cursor is unavailable');
    }
    const operations = await this.db.copilotDocumentOperation.findMany({
      where: { sessionId, actorId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      take: 20,
    });
    return await Promise.all(
      operations.map(operation => this.projectReceipt(operation))
    );
  }

  async receipt(input: OperationActor & { sessionId?: string }) {
    const operation = await this.get(input);
    if (
      input.sessionId !== undefined &&
      operation.sessionId !== input.sessionId
    )
      throw new NotFound(
        'Document operation is unavailable in this conversation'
      );
    return await this.projectReceipt(operation);
  }

  // Project authorization can change after creation; preserve the execution evidence.
  private async projectReceipt(operation: CopilotDocumentOperation) {
    const source =
      operation.kind === 'copy'
        ? await this.db.copilotDocumentCopySource.findUnique({
            where: { operationId: operation.id },
            select: { workspaceId: true, documentId: true },
          })
        : null;
    const receipt = {
      ...operation,
      sourceWorkspaceId: source?.workspaceId ?? null,
      sourceDocumentId: source?.documentId ?? null,
    };
    if (
      !operation.createdDocumentAt ||
      !operation.projectId ||
      !operation.destinationWorkspaceId ||
      operation.projectStatus === 'not_requested'
    )
      return receipt;
    const access =
      await this.models.intelligenceWorkbenchAuthorization.getProjectDocumentAccess(
        {
          projectId: operation.projectId,
          workspaceId: operation.destinationWorkspaceId,
          docId: operation.documentId,
          userId: operation.actorId,
        }
      );
    let projectStatus = operation.projectStatus;
    if (access?.grantStatus === 'active') projectStatus = 'granted';
    else if (access?.grantStatus === 'revoked' || projectStatus === 'granted')
      projectStatus = 'revoked';
    else if (operation.accessRequestId) {
      const request = await this.db.accessRequest.findFirst({
        where: {
          id: operation.accessRequestId,
          beneficiaryProjectId: operation.projectId,
          workspaceId: operation.destinationWorkspaceId,
          docId: operation.documentId,
        },
        select: { status: true, expiresAt: true },
      });
      projectStatus =
        request?.status === 'pending'
          ? request.expiresAt && request.expiresAt <= new Date()
            ? 'expired'
            : 'requested'
          : request?.status === 'rejected'
            ? 'rejected'
            : request?.status === 'withdrawn'
              ? 'withdrawn'
              : request?.status === 'expired'
                ? 'expired'
                : 'failed';
    }
    return { ...receipt, projectStatus };
  }

  async prepareForLatestTurn(input: {
    delegatedCallId?: string;
    sessionId: string;
    actorId: string;
    title: string;
    markdown: string;
    addToProject: boolean;
    copySource?: DocumentCopySourceInput;
  }) {
    await this.assertSession(input.sessionId, input.actorId);
    if (input.delegatedCallId) {
      const delegation =
        await this.models.copilotMcpDelegation.getRequestByExecutionSession(
          input.sessionId
        );
      if (
        !delegation ||
        delegation.actorId !== input.actorId ||
        delegation.status !== 'processing'
      )
        throw new BadRequest('Delegated document request is unavailable');
      return await this.prepare({
        ...input,
        requestKey: `delegated:${input.delegatedCallId}`,
      });
    }
    const message = await this.db.aiSessionMessage.findFirst({
      where: { sessionId: input.sessionId, role: 'user' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!message)
      throw new BadRequest(
        'Document creation requires a persisted user request'
      );
    const contentKey = createHash('sha256')
      .update(
        JSON.stringify([
          input.title,
          input.markdown,
          input.addToProject,
          input.copySource
            ? freezeCopySource(input.copySource).fingerprint
            : null,
        ])
      )
      .digest('hex');
    return await this.prepare({
      ...input,
      requestKey: `${message.id}:${contentKey}`,
    });
  }
  private async assertSession(
    sessionId: string,
    actorId: string,
    projectId?: string | null
  ) {
    const session = await this.db.aiSession.findFirst({
      where: { id: sessionId, userId: actorId, deletedAt: null },
      select: { id: true, selectedContextProjectId: true, docId: true },
    });
    if (
      !session ||
      (projectId !== undefined &&
        session.selectedContextProjectId !== projectId)
    ) {
      throw new NotFound('Document operation session is unavailable');
    }
    if (session.selectedContextProjectId) {
      const member = await this.db.aiContextProjectMember.findFirst({
        where: {
          projectId: session.selectedContextProjectId,
          userId: actorId,
          project: { status: 'active' },
        },
        select: { projectId: true },
      });
      if (!member || session.docId)
        throw new NotFound('Project conversation is unavailable');
    }
    return session;
  }

  async get(input: OperationActor) {
    const operation = await this.db.copilotDocumentOperation.findFirst({
      where: { id: input.operationId, actorId: input.actorId },
    });
    if (!operation) throw new NotFound('Document operation not found');
    await this.assertSession(
      operation.sessionId,
      input.actorId,
      operation.projectId
    );
    return operation;
  }

  async copySource(input: OperationActor) {
    const operation = await this.get(input);
    if (operation.kind !== 'copy') return null;
    const source = await this.db.copilotDocumentCopySource.findUnique({
      where: { operationId: operation.id },
      include: { assets: true },
    });
    if (!source || freezeCopySource(source).fingerprint !== source.fingerprint)
      throw new BadRequest('Frozen document copy evidence is unavailable');
    return source;
  }

  @Transactional()
  async prepare(input: {
    sessionId: string;
    actorId: string;
    requestKey: string;
    title: string;
    markdown: string;
    addToProject: boolean;
    copySource?: DocumentCopySourceInput;
  }) {
    const copySource = input.copySource
      ? freezeCopySource(input.copySource)
      : undefined;
    if (copySource && input.markdown)
      throw new BadRequest(
        'A document copy cannot replace its frozen snapshot with Markdown'
      );
    const title = input.title.trim();
    const requestKey = input.requestKey.trim();
    if (
      !title ||
      title.length > 512 ||
      !requestKey ||
      requestKey.length > 256 ||
      Buffer.byteLength(input.markdown) > 1024 * 1024
    ) {
      throw new BadRequest('Document operation input exceeds its bounds');
    }
    const session = await this.assertSession(input.sessionId, input.actorId);
    if (input.addToProject && !session.selectedContextProjectId)
      throw new BadRequest(
        'Select a project before requesting project addition'
      );
    const contentFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          title,
          markdown: input.markdown,
          addToProject: input.addToProject,
          ...(copySource ? { copyFingerprint: copySource.fingerprint } : {}),
        })
      )
      .digest('hex');
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`document-operation:${input.sessionId}:${requestKey}`}, 0))`;
    const existing = await this.db.copilotDocumentOperation.findUnique({
      where: {
        sessionId_requestKey: { sessionId: input.sessionId, requestKey },
      },
    });
    if (existing) {
      if (
        existing.actorId !== input.actorId ||
        existing.contentFingerprint !== contentFingerprint
      )
        throw new BadRequest(
          'Document request key already identifies different content'
        );
      return existing;
    }
    return await this.db.copilotDocumentOperation.create({
      data: {
        sessionId: input.sessionId,
        actorId: input.actorId,
        projectId: session.selectedContextProjectId,
        requestKey,
        title,
        markdown: input.markdown,
        contentFingerprint,
        projectStatus: input.addToProject ? 'pending' : 'not_requested',
        kind: copySource ? 'copy' : 'create',
        ...(copySource
          ? {
              copySource: {
                create: {
                  workspaceId: copySource.workspaceId,
                  documentId: copySource.documentId,
                  snapshot: copySource.snapshot,
                  fingerprint: copySource.fingerprint,
                  assets: { create: copySource.assets },
                },
              },
            }
          : {}),
      },
    });
  }

  // The calling execution service must authorize the selected location first.
  @Transactional()
  async confirmDestination(
    input: OperationActor & {
      workspaceId: string;
      folderId: string | null;
      expectedRevision: number;
      fingerprint: string;
      permissionEvidence: Record<string, string | boolean>;
    }
  ) {
    const operation = await this.get(input);
    if (
      input.permissionEvidence.actorId !== input.actorId ||
      input.permissionEvidence.workspaceId !== input.workspaceId ||
      ![
        'canCreateDoc',
        'canReadOrganization',
        'canSync',
        'canRead',
        'canWrite',
        'canOrganize',
      ].every(key => input.permissionEvidence[key] === true)
    )
      throw new BadRequest('Destination permission evidence is incomplete');
    if (!/^[a-f0-9]{64}$/.test(input.fingerprint))
      throw new BadRequest('Destination evidence is invalid');
    if (
      !input.workspaceId.trim() ||
      input.workspaceId.length > 256 ||
      (input.folderId !== null &&
        (!input.folderId.trim() || input.folderId.length > 256))
    )
      throw new BadRequest('Choose a workspace and an explicit root or folder');
    if (
      operation.executionStartedAt &&
      (input.workspaceId !== operation.destinationWorkspaceId ||
        input.folderId !== operation.destinationFolderId)
    )
      throw new BadRequest(
        'An attempted document operation cannot change destination'
      );
    const result = await this.db.copilotDocumentOperation.updateMany({
      where: {
        id: operation.id,
        destinationRevision: input.expectedRevision,
        status: {
          in: [
            'waiting_location',
            'ready',
            'failed',
            'running',
            'created',
            'expired',
          ],
        },
        OR: [{ leaseToken: null }, { leaseExpiresAt: { lte: new Date() } }],
      },
      data: {
        destinationWorkspaceId: input.workspaceId,
        destinationFolderId: input.folderId,
        destinationConfirmedAt: new Date(),
        destinationConfirmedBy: input.actorId,
        destinationEvidence: input.permissionEvidence,
        locationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        destinationFingerprint: input.fingerprint,
        destinationRevision: { increment: 1 },
        status: operation.createdDocumentAt ? 'created' : 'ready',
        leaseToken: null,
        leaseExpiresAt: null,
        failureCode: null,
      },
    });
    if (!result.count)
      throw new BadRequest(
        'Document destination changed; select the location again'
      );
    return await this.get(input);
  }

  @Transactional()
  async acquire(input: OperationActor & { expectedRevision: number }) {
    const operation = await this.get(input);
    const evidence = operation.destinationEvidence as Record<string, unknown>;
    if (
      evidence.actorId !== input.actorId ||
      evidence.workspaceId !== operation.destinationWorkspaceId ||
      ![
        'canCreateDoc',
        'canReadOrganization',
        'canSync',
        'canRead',
        'canWrite',
        'canOrganize',
      ].every(key => evidence[key] === true)
    )
      throw new BadRequest(
        'Confirm the document destination with current permission evidence'
      );
    if (
      !operation.destinationConfirmedAt ||
      !operation.destinationFingerprint ||
      operation.destinationRevision !== input.expectedRevision ||
      operation.locationExpiresAt <= new Date() ||
      operation.destinationConfirmedBy !== input.actorId
    )
      throw new BadRequest('Confirm the document destination before execution');
    const leaseToken = randomUUID();
    const result = await this.db.copilotDocumentOperation.updateMany({
      where: {
        id: operation.id,
        destinationRevision: input.expectedRevision,
        locationExpiresAt: { gt: new Date() },
        status: { in: ['ready', 'running', 'created', 'failed'] },
        OR: [{ leaseToken: null }, { leaseExpiresAt: { lte: new Date() } }],
      },
      data: {
        status: operation.createdDocumentAt ? 'created' : 'running',
        leaseToken,
        executionStartedAt: operation.executionStartedAt ?? new Date(),
        leaseExpiresAt: new Date(Date.now() + 60_000),
        failureCode: null,
      },
    });
    if (!result.count)
      throw new BadRequest(
        'Document operation is already executing or complete'
      );
    return await this.get(input);
  }

  private activeLease(input: OperationLease) {
    return {
      id: input.operationId,
      actorId: input.actorId,
      leaseToken: input.leaseToken,
      leaseExpiresAt: { gt: new Date() },
      status: { in: ['running', 'created'] },
    };
  }

  // Called by the storage transaction before acquiring the content lock. All
  // authorization locks remain held through the actual update insertion.
  @Transactional()
  async lockWriteAuthorization(input: OperationLease) {
    const operation = await this.get(input);
    const session = await this.models.copilotSession.getMeta(
      operation.sessionId
    );
    if (!session || !operation.destinationWorkspaceId)
      throw new BadRequest('Document execution context is unavailable');
    const source = await this.db.copilotDocumentCopySource.findUnique({
      where: { operationId: operation.id },
      select: { workspaceId: true, documentId: true },
    });
    const assets = source
      ? await this.db.copilotDocumentCopyAsset.findMany({
          where: { operationId: operation.id },
          select: { key: true },
        })
      : [];
    const sourceDocumentIds = source
      ? [
          ...new Set([
            source.documentId,
            ...assets.flatMap(asset => {
              const docId = copyAttachmentDocumentId(asset.key);
              return docId ? [docId] : [];
            }),
          ]),
        ].sort()
      : [];
    const workspaces = [
      ...new Set([
        session.workspaceId,
        operation.destinationWorkspaceId,
        ...(source ? [source.workspaceId] : []),
      ]),
    ].sort();
    for (const workspaceId of workspaces) {
      await this.db
        .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionWorkspaceLockKey(workspaceId)}, 0))`;
    }
    if (source) {
      for (const docId of sourceDocumentIds) {
        await this.db
          .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionDocumentLockKey(source.workspaceId, docId)}, 0))`;
      }
    }
    await this.models.workspaceDirectoryGrant.withMutationLock(
      operation.destinationWorkspaceId,
      async () => {}
    );
    if (operation.projectId) {
      await this.models.intelligenceWorkbenchAuthorization.lockProjectDocumentAccessForExecution(
        {
          projectId: operation.projectId,
          userId: operation.actorId,
          workspaceId: source?.workspaceId ?? operation.destinationWorkspaceId,
          docId: source?.documentId ?? operation.documentId,
        }
      );
    }
    if (source && operation.projectId) {
      for (const docId of sourceDocumentIds.filter(
        id => id !== source.documentId
      )) {
        await this.models.intelligenceWorkbenchAuthorization.lockProjectDocumentAccessForExecution(
          {
            projectId: operation.projectId,
            userId: operation.actorId,
            workspaceId: source.workspaceId,
            docId,
          }
        );
      }
    }
    await this.db.$queryRaw`
      SELECT id FROM ai_sessions_metadata
      WHERE id = ${operation.sessionId}
      FOR SHARE`;
  }

  @Transactional()
  async renew(input: OperationLease) {
    await this.get(input);
    const result = await this.db.copilotDocumentOperation.updateMany({
      where: this.activeLease(input),
      data: { leaseExpiresAt: new Date(Date.now() + 60_000) },
    });
    if (!result.count) throw new BadRequest('Document execution lease expired');
  }

  @Transactional()
  async recordCreated(input: OperationLease) {
    const operation = await this.get(input);
    if (
      !operation.destinationWorkspaceId ||
      !(await this.models.doc.exists(
        operation.destinationWorkspaceId,
        operation.documentId
      ))
    )
      throw new BadRequest(
        'Cannot record creation before the document body is stored'
      );
    const updated = await this.db.copilotDocumentOperation.updateMany({
      where: this.activeLease(input),
      data: {
        createdDocumentAt: operation.createdDocumentAt ?? new Date(),
        status: 'created',
      },
    });
    if (!updated.count)
      throw new BadRequest('Document execution lease expired');
    return await this.get(input);
  }

  async initializationCompleted(input: OperationActor) {
    await this.get(input);
    return !!(await this.db.copilotDocumentOperationEvent.findFirst({
      where: {
        operationId: input.operationId,
        eventType: 'initialization_completed',
      },
      select: { id: true },
    }));
  }

  @Transactional()
  async recordInitialized(input: OperationLease) {
    // The conditional renewal serializes the immutable completion event with
    // lease handoff and other attempts for this operation.
    await this.renew(input);
    const operation = await this.get(input);
    if (!operation.createdDocumentAt)
      throw new BadRequest(
        'Create the document before completing initialization'
      );
    if (await this.initializationCompleted(input)) return;
    await this.db.copilotDocumentOperationEvent.create({
      data: {
        operationId: operation.id,
        eventType: 'initialization_completed',
        detail: {
          actorId: operation.actorId,
          workspaceId: operation.destinationWorkspaceId,
          docId: operation.documentId,
        },
      },
    });
  }

  @Transactional()
  async recordPlaced(input: OperationLease) {
    const operation = await this.get(input);
    if (!operation.createdDocumentAt)
      throw new BadRequest(
        'Create the document before recording its placement'
      );
    const result = await this.db.copilotDocumentOperation.updateMany({
      where: this.activeLease(input),
      data: { placedDocumentAt: operation.placedDocumentAt ?? new Date() },
    });
    if (!result.count) throw new BadRequest('Document execution lease expired');
    return await this.get(input);
  }

  @Transactional()
  async finish(
    input: OperationLease & {
      projectStatus: 'not_requested' | 'granted' | 'requested' | 'failed';
      accessRequestId?: string;
    }
  ) {
    const operation = await this.get(input);
    if (
      !operation.createdDocumentAt ||
      !operation.placedDocumentAt ||
      (operation.projectStatus === 'not_requested') !==
        (input.projectStatus === 'not_requested') ||
      (input.projectStatus === 'requested' && !input.accessRequestId)
    )
      throw new BadRequest(
        'Document creation and project addition outcomes must be recorded separately'
      );
    const result = await this.db.copilotDocumentOperation.updateMany({
      where: this.activeLease(input),
      data: {
        status: input.projectStatus === 'failed' ? 'created' : 'complete',
        projectStatus: input.projectStatus,
        accessRequestId: input.accessRequestId ?? null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    if (!result.count) throw new BadRequest('Document execution lease expired');
    return await this.get(input);
  }

  @Transactional()
  async fail(
    input: OperationLease & {
      failureCode:
        | 'authorization_denied'
        | 'storage_unavailable'
        | 'location_changed';
    }
  ) {
    const operation: CopilotDocumentOperation = await this.get(input);
    const result = await this.db.copilotDocumentOperation.updateMany({
      where: this.activeLease(input),
      data: {
        status: operation.createdDocumentAt ? 'created' : 'failed',
        failureCode: input.failureCode,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    if (!result.count) throw new BadRequest('Document execution lease expired');
  }
}

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { CopilotDocumentOperation } from '@prisma/client';
import { generateKeyBetween } from 'fractional-indexing';

import { BadRequest, JobQueue } from '../../base';
import {
  DocumentDestinationService,
  DocWriter,
  WorkspaceOrganizationService,
} from '../../core/doc';
import { PermissionAccess } from '../../core/permission';
import { Models } from '../../models';
import { CopilotDocumentCopyService } from './document-copy-service';
import { MCP_DELEGATE_CAPABILITY } from './mcp/capabilities';
import { McpAiTaskControlService } from './mcp/task-control';

@Injectable()
export class CopilotDocumentOperationService {
  constructor(
    private readonly models: Models,
    private readonly ac: PermissionAccess,
    private readonly destinations: DocumentDestinationService,
    private readonly writer: DocWriter,
    private readonly organization: WorkspaceOrganizationService,
    private readonly copies: CopilotDocumentCopyService,
    private readonly jobs: JobQueue,
    private readonly taskControl: McpAiTaskControlService
  ) {}

  private async assertExecution(
    operation: CopilotDocumentOperation,
    phase: 'confirm' | 'execute' = 'execute'
  ) {
    if (operation.status === 'cancelled')
      throw new BadRequest('Document creation was withdrawn');
    if (
      phase !== 'confirm' &&
      operation.status !== 'complete' &&
      operation.locationExpiresAt <= new Date()
    )
      throw new BadRequest(
        'The document location confirmation expired; confirm the location again'
      );
    const delegated =
      await this.models.copilotMcpDelegation.getRequestByExecutionSession(
        operation.sessionId
      );
    if (delegated) {
      if (
        phase === 'confirm' &&
        (delegated.status !== 'waiting_for_location' ||
          delegated.locationOperationId !== operation.id)
      )
        throw new BadRequest(
          'The delegated task is not waiting for this location'
        );
      const credential =
        await this.models.mcpCredential.findUsableFamilyCredential(
          delegated.credentialFamilyId,
          delegated.actorId,
          delegated.workspaceId
        );
      if (
        !credential ||
        delegated.actorId !== operation.actorId ||
        !['processing', 'waiting_for_location'].includes(delegated.status) ||
        !delegated.capabilitySnapshot.includes(MCP_DELEGATE_CAPABILITY)
      )
        throw new BadRequest('The delegated task is no longer authorized');
      if (delegated.requestedAttachmentIds.length)
        await this.ac
          .user(operation.actorId)
          .workspace(delegated.workspaceId)
          .assert('Workspace.Blobs.Read');
    }
    if (operation.kind === 'copy') await this.copies.source(operation);
    const session = await this.models.copilotSession.getMeta(
      operation.sessionId
    );
    if (
      !session ||
      !session.workspaceId ||
      session.userId !== operation.actorId ||
      session.selectedContextProjectId !== operation.projectId
    )
      throw new BadRequest('Document operation conversation is unavailable');
    await this.ac
      .user(operation.actorId)
      .workspace(session.workspaceId)
      .assert('Workspace.Copilot');
    if (operation.destinationWorkspaceId) {
      await this.models.copilotContext.assertDocumentSourcesShared({
        sessionId: operation.sessionId,
        actorId: operation.actorId,
        sink: {
          type: operation.kind === 'copy' ? 'document_copy' : 'document_create',
          id: operation.id,
          workspaceId: operation.destinationWorkspaceId,
          documentId: operation.documentId,
          phase:
            phase === 'confirm'
              ? phase
              : operation.status === 'complete'
                ? 'noop'
                : operation.status === 'failed'
                  ? 'retry'
                  : phase,
        },
      });
    }
    if (operation.projectId) {
      if (operation.status !== 'complete')
        throw new BadRequest(
          'This legacy Project operation requires migration. Its draft is retained; use the Project resource publication workflow.'
        );
      const access =
        await this.models.intelligenceWorkbenchAuthorization.getProjectDocumentAccess(
          {
            projectId: operation.projectId,
            userId: operation.actorId,
            workspaceId:
              operation.destinationWorkspaceId ?? session.workspaceId,
            docId: operation.documentId,
          }
        );
      if (!access || access.aiPolicy !== 'read_write')
        throw new BadRequest(
          'The current Project does not permit AI document creation'
        );
    }
  }

  async confirmDestination(input: {
    operationId: string;
    actorId: string;
    workspaceId: string;
    folderId: string | null;
    expectedRevision: number;
  }) {
    const operation = await this.models.copilotDocumentOperation.get(input);
    await this.assertExecution(
      { ...operation, destinationWorkspaceId: input.workspaceId },
      'confirm'
    );
    if (operation.kind === 'copy') {
      const source = await this.copies.source(operation);
      if (source.workspaceId === input.workspaceId)
        throw new BadRequest('Choose a different workspace for this copy');
    }
    const destination = await this.destinations.authorize(input);
    return await this.models.copilotDocumentOperation.confirmDestination({
      ...input,
      fingerprint: destination.fingerprint,
      permissionEvidence: destination.permissionEvidence,
    });
  }

  async resumeDelegatedOperation(operationId: string, actorId: string) {
    const run = await this.models.copilotMcpDelegation.resumeAfterLocation(
      operationId,
      actorId
    );
    if (run)
      await this.jobs.add(
        'copilot.agentRuntime.run',
        { workspaceId: run.workspaceId, runId: run.id },
        {
          jobId: `copilot-agent-runtime-run-${run.id}-location-${run.workerAttempt}`,
        }
      );
  }

  @Transactional()
  async withdraw(input: {
    operationId: string;
    actorId: string;
    expectedRevision: number;
  }) {
    const operation =
      await this.models.copilotDocumentOperation.withdraw(input);
    const request =
      await this.models.copilotMcpDelegation.getRequestByExecutionSession(
        operation.sessionId
      );
    if (request?.agentRunId && request.status !== 'cancelled') {
      const run = await this.models.copilotAgentRuntime.controlRun({
        workspaceId: request.workspaceId,
        id: request.agentRunId,
        actorId: input.actorId,
        action: 'cancel',
        reason: 'Document location request withdrawn by its owner',
      });
      await this.taskControl.reconcileCancelledAgentRun(run);
    }
    return operation;
  }

  private async revalidate(operation: CopilotDocumentOperation) {
    await this.models.copilotDocumentOperation.get({
      operationId: operation.id,
      actorId: operation.actorId,
    });
    await this.assertExecution(operation);
    if (!operation.destinationWorkspaceId || !operation.destinationFingerprint)
      throw new BadRequest('Select the destination before creating a document');
    await this.destinations.authorize({
      actorId: operation.actorId,
      workspaceId: operation.destinationWorkspaceId,
      folderId: operation.destinationFolderId,
      expectedFingerprint: operation.destinationFingerprint,
    });
  }

  async execute(input: {
    operationId: string;
    actorId: string;
    expectedRevision: number;
  }) {
    const model = this.models.copilotDocumentOperation;
    const current = await model.get(input);
    await this.revalidate(current);
    if (current.status === 'complete') return current;
    let operation = await model.acquire(input);
    const workspaceId = operation.destinationWorkspaceId;
    const leaseToken = operation.leaseToken;
    if (!workspaceId || !leaseToken)
      throw new BadRequest('Document execution context is missing');
    const lease = {
      operationId: operation.id,
      actorId: input.actorId,
      leaseToken,
    };
    let leaseFailure: unknown;
    let renewal = Promise.resolve();
    let renewing = false;
    const heartbeat = setInterval(() => {
      if (renewing || leaseFailure) return;
      renewing = true;
      renewal = model
        .renew(lease)
        .catch(error => {
          leaseFailure = error;
        })
        .finally(() => {
          renewing = false;
        });
    }, 20_000);
    heartbeat.unref();
    const beforeWrite = async () => {
      if (leaseFailure) throw leaseFailure;
      await model.lockWriteAuthorization(lease);
      await this.revalidate(operation);
      await model.renew(lease);
      if (leaseFailure) throw leaseFailure;
    };
    const onCreated = async () => {
      operation = await model.recordCreated(lease);
    };
    try {
      await this.revalidate(operation);
      if (!(await model.initializationCompleted(lease))) {
        await model.renew(lease);
        if (operation.kind === 'copy') {
          const snapshot = await this.copies.transferAttachments(
            operation,
            beforeWrite
          );
          await this.revalidate(operation);
          await model.renew(lease);
          await this.writer.createDocFromSnapshot(
            workspaceId,
            operation.title,
            snapshot,
            input.actorId,
            operation.documentId,
            beforeWrite,
            onCreated
          );
        } else {
          await this.writer.createDoc(
            workspaceId,
            operation.title,
            operation.markdown,
            input.actorId,
            operation.documentId,
            beforeWrite,
            onCreated
          );
        }
        // The receipt commits with the body; an unguarded/custom writer must
        // still prove that a body exists before claiming creation.
        if (!operation.createdDocumentAt) await onCreated();
        await model.recordInitialized(lease);
      }
      if (!operation.placedDocumentAt) {
        await this.revalidate(operation);
        await model.renew(lease);
        const rows = await this.organization.readFolders(
          workspaceId,
          input.actorId
        );
        const key = `ai-document-${operation.documentId}`;
        const existing = rows.find(row => row.id === key);
        const otherPlacement = rows.find(
          row =>
            row.type === 'doc' &&
            row.data === operation.documentId &&
            row.id !== key
        );
        if (
          otherPlacement ||
          (existing &&
            (existing.type !== 'doc' ||
              existing.data !== operation.documentId ||
              existing.parentId !== operation.destinationFolderId))
        )
          throw new BadRequest(
            'The created document placement changed outside this operation'
          );
        if (operation.destinationFolderId && !existing) {
          const indices = rows
            .filter(row => row.parentId === operation.destinationFolderId)
            .map(row => row.index)
            .filter((index): index is string => typeof index === 'string')
            .sort();
          await this.revalidate(operation);
          await this.organization.applyDataOperations(
            workspaceId,
            input.actorId,
            input.actorId,
            'folders',
            [
              {
                op: 'upsert',
                key,
                values: {
                  type: 'doc',
                  data: operation.documentId,
                  parentId: operation.destinationFolderId,
                  index: generateKeyBetween(indices.at(-1) ?? null, null),
                },
              },
            ]
          );
        }
        operation = await model.recordPlaced(lease);
      }
      await this.revalidate(operation);
      if (operation.projectStatus === 'not_requested')
        return await model.finish({ ...lease, projectStatus: 'not_requested' });
      await model.renew(lease);
      try {
        if (!operation.projectId)
          throw new BadRequest('Project addition requires a project');
        const result =
          await this.models.intelligenceWorkbenchAuthorization.addProjectDocument(
            {
              projectId: operation.projectId,
              requesterUserId: operation.actorId,
              workspaceId,
              docId: operation.documentId,
              requestedLevel: 'write',
            }
          );
        return await model.finish({
          ...lease,
          projectStatus:
            result.kind === 'granted'
              ? 'granted'
              : result.request.status === 'pending'
                ? 'requested'
                : 'failed',
          accessRequestId:
            result.kind === 'requested' ? result.request.id : undefined,
        });
      } catch {
        return await model.finish({ ...lease, projectStatus: 'failed' });
      }
    } catch (error) {
      await model
        .fail({ ...lease, failureCode: 'storage_unavailable' })
        .catch(() => {});
      throw error;
    } finally {
      clearInterval(heartbeat);
      await renewal;
    }
  }
}

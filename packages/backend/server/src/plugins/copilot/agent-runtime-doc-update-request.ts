import { createHash } from 'node:crypto';

import { BadRequest } from '../../base';
import type { PermissionAccess } from '../../core/permission';
import type { Models } from '../../models';
import {
  AGENT_RUNTIME_DOC_UPDATE_REQUEST_VERSION,
  AGENT_RUNTIME_DOC_UPDATE_WORKFLOW,
} from './agent-runtime-doc-update-adapter';
import { evaluateIntelligenceWorkbenchOperationRequest } from './intelligence-workbench-permission';

const AGENT_RUNTIME_DOC_UPDATE_CONTENT_MAX_LENGTH = 6_000;
const AGENT_RUNTIME_DOC_UPDATE_STRING_MAX_LENGTH = 256;

export type AgentRuntimeDocUpdateRequestInput = {
  workspaceId: string;
  sessionId?: string | null;
  docId: string;
  content: string;
  contentFingerprint?: string | null;
  idempotencyKey?: string | null;
  title?: string | null;
  reason?: string | null;
};

type ProjectDocumentOperation = 'read' | 'write';

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => {
        const item = (value as Record<string, unknown>)[key];
        return item === undefined
          ? null
          : `${JSON.stringify(key)}:${stableStringify(item)}`;
      })
      .filter(Boolean)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function requireString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`Agent Runtime doc update ${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Agent Runtime doc update ${field} must not be blank`);
  }
  if (normalized.length > AGENT_RUNTIME_DOC_UPDATE_STRING_MAX_LENGTH) {
    throw new Error(`Agent Runtime doc update ${field} is too long`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  return requireString(value, field);
}

function requireContent(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('Agent Runtime doc update content must be a string');
  }
  if (!value.trim()) {
    throw new Error('Agent Runtime doc update content must not be blank');
  }
  if (value.length > AGENT_RUNTIME_DOC_UPDATE_CONTENT_MAX_LENGTH) {
    throw new Error('Agent Runtime doc update content is too long');
  }
  return value;
}

export async function resolveProjectDocumentOperation(input: {
  ac: PermissionAccess;
  models: Models;
  actorId: string;
  sessionId: string;
  sourceWorkspaceId: string;
  docId: string;
  operation: ProjectDocumentOperation;
  approvalGate: 'none' | 'request_only';
  expectedHostWorkspaceId?: string;
}) {
  const session = await input.models.copilotSession.getMeta(input.sessionId);
  if (
    !session ||
    session.userId !== input.actorId ||
    (input.expectedHostWorkspaceId !== undefined &&
      session.workspaceId !== input.expectedHostWorkspaceId)
  ) {
    throw new BadRequest(
      `Project document ${input.operation} session is not active for this user`
    );
  }
  const projectId = session.selectedContextProjectId;
  if (!projectId || session.docId) {
    throw new BadRequest(
      `Project document ${input.operation} requires a selected project`
    );
  }

  await input.ac
    .user(input.actorId)
    .workspace(session.workspaceId)
    .allowLocal()
    .assert('Workspace.Copilot');
  const project = await input.models.copilotContextMemory.getProject(projectId);
  if (
    !project ||
    project.status !== 'active' ||
    !project.members.some(member => member.userId === input.actorId)
  ) {
    throw new BadRequest('Project membership is no longer active');
  }
  if (input.operation === 'read') {
    await input.ac
      .user(input.actorId)
      .doc({ workspaceId: input.sourceWorkspaceId, docId: input.docId })
      .projectScope(projectId)
      .allowLocal()
      .assert('Doc.Read');
    return { hostWorkspaceId: session.workspaceId, projectId };
  }
  await input.models.copilotContext.assertProjectSourcesShared({
    actorId: input.actorId,
    sessionId: input.sessionId,
    projectId,
    sink: {
      type: 'document_update',
      id: input.docId,
      workspaceId: input.sourceWorkspaceId,
      phase: 'prepare',
    },
  });
  const access =
    await input.models.intelligenceWorkbenchAuthorization.getProjectDocumentAccess(
      {
        projectId,
        workspaceId: input.sourceWorkspaceId,
        docId: input.docId,
        userId: input.actorId,
      }
    );
  const decision = evaluateIntelligenceWorkbenchOperationRequest({
    grantLevel: access?.grantStatus === 'active' ? access.grantLevel : null,
    projectPolicy: access?.aiPolicy ?? 'read_only',
    operation: input.operation,
    approvalGate: input.approvalGate,
  });
  if (!decision.allowed) {
    throw new BadRequest(
      `Project document ${input.operation} is not allowed: ${decision.reason}`
    );
  }
  await input.ac
    .user(input.actorId)
    .doc({ workspaceId: input.sourceWorkspaceId, docId: input.docId })
    .projectScope(projectId)
    .allowLocal()
    .assert('Doc.Update');
  return {
    hostWorkspaceId: session.workspaceId,
    projectId,
  };
}

export async function createAgentRuntimeDocUpdateRequest(input: {
  ac: PermissionAccess;
  models: Models;
  actorId: string;
  request: AgentRuntimeDocUpdateRequestInput;
  expectedHostWorkspaceId?: string;
  requireProject?: boolean;
}) {
  const sourceWorkspaceId = requireString(
    input.request.workspaceId,
    'workspaceId'
  );
  const sessionId = optionalString(input.request.sessionId, 'sessionId');
  const docId = requireString(input.request.docId, 'docId');
  const content = requireContent(input.request.content);
  const contentFingerprint = fingerprint({
    version: 'agent-runtime-doc-update-content/v1',
    content,
  });
  const expectedContentFingerprint = optionalString(
    input.request.contentFingerprint,
    'contentFingerprint'
  );
  if (
    expectedContentFingerprint &&
    expectedContentFingerprint !== contentFingerprint
  ) {
    throw new Error(
      'Agent Runtime doc update contentFingerprint must match content'
    );
  }
  const idempotencyKey = optionalString(
    input.request.idempotencyKey,
    'idempotencyKey'
  );
  const reason = optionalString(input.request.reason, 'reason');

  let hostWorkspaceId = sourceWorkspaceId;
  let projectId: string | null = null;
  if (sessionId) {
    const session = await input.models.copilotSession.getMeta(sessionId);
    if (
      !session ||
      session.userId !== input.actorId ||
      (input.expectedHostWorkspaceId !== undefined &&
        session.workspaceId !== input.expectedHostWorkspaceId)
    ) {
      throw new BadRequest(
        'Agent Runtime doc update session is not active for this user'
      );
    }
    hostWorkspaceId = session.workspaceId;
    projectId = session.selectedContextProjectId;
  }

  await input.ac
    .user(input.actorId)
    .workspace(hostWorkspaceId)
    .allowLocal()
    .assert('Workspace.Copilot');

  if (projectId) {
    if (!sessionId) {
      throw new BadRequest(
        'Agent Runtime project doc update requires its session'
      );
    }
    await resolveProjectDocumentOperation({
      ac: input.ac,
      models: input.models,
      actorId: input.actorId,
      sessionId,
      sourceWorkspaceId,
      docId,
      operation: 'write',
      approvalGate: 'request_only',
      expectedHostWorkspaceId: input.expectedHostWorkspaceId,
    });
  } else {
    if (input.requireProject) {
      throw new BadRequest(
        'Agent Runtime doc update requires a selected project'
      );
    }
    if (sourceWorkspaceId !== hostWorkspaceId) {
      throw new BadRequest(
        'A direct document update must target its session host workspace'
      );
    }
    await input.ac
      .user(input.actorId)
      .doc({ workspaceId: sourceWorkspaceId, docId })
      .allowLocal()
      .assert('Doc.Update');
    await input.models.copilotContext.assertDocumentSourcesShared({
      actorId: input.actorId,
      sessionId,
      sink: {
        type: 'document_update',
        id: docId,
        documentId: docId,
        workspaceId: sourceWorkspaceId,
        phase: 'prepare',
      },
    });
  }

  const documentTimestamps = await input.models.doc.findTimestampsByDocIds(
    sourceWorkspaceId,
    [docId]
  );
  const documentTimestamp = documentTimestamps[docId];
  if (documentTimestamp === undefined) {
    throw new BadRequest('Agent Runtime doc update document does not exist');
  }
  const expectedDocumentVersion = new Date(documentTimestamp).toISOString();

  const requestFingerprint = fingerprint({
    version: 'agent-runtime-doc-update-request-fingerprint/v2',
    hostWorkspaceId,
    sessionId,
    projectId,
    sourceWorkspaceId,
    docId,
    expectedDocumentVersion,
    contentFingerprint,
    idempotencyKey,
  });
  const sourceId = `agent-runtime-doc-update-${requestFingerprint.slice(0, 48)}`;
  const docUpdateRequest = {
    version: AGENT_RUNTIME_DOC_UPDATE_REQUEST_VERSION,
    sourceWorkspaceId,
    projectId,
    docId,
    content,
    contentFingerprint,
    expectedDocumentVersion,
  };

  return await input.models.copilotAgentRuntime.createRun({
    workspaceId: hostWorkspaceId,
    actorId: input.actorId,
    sessionId: sessionId ?? undefined,
    workflow: AGENT_RUNTIME_DOC_UPDATE_WORKFLOW,
    sourceType: 'agent_runtime_office_task',
    sourceId,
    status: 'waiting_approval',
    title: input.request.title ?? `Update document ${docId}`,
    target: {
      version: 'agent-runtime-doc-update-target/v1',
      hostWorkspaceId,
      sessionId,
      projectId,
      sourceWorkspaceId,
      docId,
      expectedDocumentVersion,
      contentFingerprint,
    },
    evidence: {
      version: 'agent-runtime-doc-update-request-evidence/v1',
      requestFingerprint,
      hostWorkspaceId,
      sessionId,
      projectId,
      sourceWorkspaceId,
      docId,
      expectedDocumentVersion,
      idempotencyKey,
      reason,
    },
    steps: [
      {
        stepKey: 'approve_doc_update',
        stepType: 'approval',
        status: 'waiting_approval',
        title: 'Approve document update',
        order: 0,
        outputSummary: {
          approvalRequest: {
            version: 'agent-runtime-doc-update-approval/v1',
            hostWorkspaceId,
            sessionId,
            projectId,
            sourceWorkspaceId,
            docId,
            expectedDocumentVersion,
            contentFingerprint,
            reason,
          },
        },
      },
      {
        stepKey: 'update_doc',
        stepType: 'tool',
        status: 'waiting_approval',
        title: 'Update document',
        order: 1,
        outputSummary: { docUpdateRequest },
      },
    ],
  });
}

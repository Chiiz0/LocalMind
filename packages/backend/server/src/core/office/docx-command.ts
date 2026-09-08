import {
  OFFICE_PACKAGE_MIME_TYPE,
  parseOfficeCommand,
} from '@localmind/office';
import {
  applyDocxCommand,
  DEFAULT_DOCX_PACKAGE_LIMITS,
  DOCX_MODEL_VERSION,
  openDocxPackage,
} from '@localmind/office/docx';
import { Injectable } from '@nestjs/common';
import {
  OfficeArtifactKind,
  OfficeRevisionOrigin,
  type Prisma,
} from '@prisma/client';

import { readBufferWithLimit, ResourceConflict } from '../../base';
import { Models } from '../../models';
import { PermissionAccess } from '../permission';
import { WorkspaceBlobStorage } from '../storage';
import {
  OFFICE_DOCX_STATE_MAX_BYTES,
  OFFICE_DOCX_STATE_MIME_TYPE,
} from './docx-import';
import { officeFingerprint, officeJsonFingerprint } from './evidence';

const ORIGIN_BY_SOURCE = {
  user: OfficeRevisionOrigin.user,
  ai: OfficeRevisionOrigin.ai,
  system: OfficeRevisionOrigin.system,
} as const;
const MAX_EXECUTION_FIELD_LENGTH = 512;

export type ExecuteOfficeDocxCommandInput = {
  workspaceId: string;
  actorId: string;
  command: unknown;
};

function requireExecutionField(value: string, field: string) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > MAX_EXECUTION_FIELD_LENGTH) {
    throw new Error(
      `${field} must contain 1-${MAX_EXECUTION_FIELD_LENGTH} characters`
    );
  }
  return normalized;
}

@Injectable()
export class OfficeDocxCommandService {
  constructor(
    private readonly models: Models,
    private readonly storage: WorkspaceBlobStorage,
    private readonly ac: PermissionAccess
  ) {}

  async preview(input: ExecuteOfficeDocxCommandInput) {
    const prepared = await this.prepare(input);
    const packageBytes = Buffer.from(prepared.result.packageBytes);
    const stateBytes = Buffer.from(
      JSON.stringify(prepared.result.state),
      'utf8'
    );
    return {
      artifact: prepared.artifact,
      revision: prepared.parent,
      command: prepared.command,
      packageFingerprint: officeFingerprint(packageBytes),
      stateFingerprint: officeFingerprint(stateBytes),
      stats: prepared.result.state.stats,
      summary: prepared.result.summary,
    };
  }

  async execute(input: ExecuteOfficeDocxCommandInput) {
    const { workspaceId, actorId, command, artifact, parent, result } =
      await this.prepare(input);
    const packageBytes = Buffer.from(result.packageBytes);
    const packageFingerprint = officeFingerprint(packageBytes);
    const packageBlobKey = `office/package/docx/${packageFingerprint.slice('sha256:'.length)}.docx`;
    await this.storage.put(workspaceId, packageBlobKey, packageBytes, {
      contentType: OFFICE_PACKAGE_MIME_TYPE.document,
      contentLength: packageBytes.byteLength,
    });

    const stateBytes = Buffer.from(JSON.stringify(result.state), 'utf8');
    if (
      !stateBytes.byteLength ||
      stateBytes.byteLength > OFFICE_DOCX_STATE_MAX_BYTES
    ) {
      throw new Error('DOCX semantic state exceeds its byte limit');
    }
    const stateFingerprint = officeFingerprint(stateBytes);
    const stateBlobKey = `office/state/docx/${stateFingerprint.slice('sha256:'.length)}.json`;
    await this.storage.put(workspaceId, stateBlobKey, stateBytes, {
      contentType: OFFICE_DOCX_STATE_MIME_TYPE,
      contentLength: stateBytes.byteLength,
    });

    const idempotencyFingerprint = officeJsonFingerprint({
      version: 'localmind-office-docx-command-execution/v1',
      workspaceId,
      actorId,
      parentRevisionId: parent.id,
      parentPackageFingerprint: parent.packageFingerprint,
      command,
    });
    const operationSummary = {
      engine: 'localmind-native-docx',
      modelVersion: DOCX_MODEL_VERSION,
      commandId: command.commandId,
      source: command.source,
      target: command.target,
      ...(command.operation === 'office.document.text.format'
        ? { format: command.format }
        : { replacementTextLength: command.text.length }),
      ...result.summary,
    } satisfies Prisma.InputJsonObject;
    const appended = await this.models.officeArtifact.appendRevision({
      workspaceId,
      artifactId: artifact.id,
      actorId,
      origin: ORIGIN_BY_SOURCE[command.source],
      expectedParentRevisionId: parent.id,
      idempotencyKey: command.idempotencyKey,
      idempotencyFingerprint,
      package: {
        key: packageBlobKey,
        mimeType: OFFICE_PACKAGE_MIME_TYPE.document,
        byteSize: packageBytes.byteLength,
        fingerprint: packageFingerprint,
      },
      state: {
        key: stateBlobKey,
        byteSize: stateBytes.byteLength,
        fingerprint: stateFingerprint,
      },
      modelVersion: DOCX_MODEL_VERSION,
      operationSummary,
    });

    return {
      ...appended,
      packageBlobKey,
      packageFingerprint,
      stateBlobKey,
      stateFingerprint,
      stats: result.state.stats,
      summary: result.summary,
    };
  }

  private async prepare(input: ExecuteOfficeDocxCommandInput) {
    const workspaceId = requireExecutionField(
      input.workspaceId,
      'workspace id'
    );
    const actorId = requireExecutionField(input.actorId, 'actor id');
    const command = parseOfficeCommand(input.command);
    if (
      command.operation !== 'office.document.text.format' &&
      command.operation !== 'office.document.text.replace'
    ) {
      throw new Error(`Office DOCX command is invalid: ${command.operation}`);
    }
    await this.assertPermissions(workspaceId, actorId, command.source);

    const artifact = await this.models.officeArtifact.get(
      workspaceId,
      command.artifactId
    );
    if (!artifact || artifact.kind !== OfficeArtifactKind.document) {
      throw new Error(`Office DOCX artifact not found: ${command.artifactId}`);
    }
    const parent = await this.models.officeArtifact.getCurrentRevision(
      workspaceId,
      command.artifactId
    );
    if (!parent || parent.id !== command.expectedRevisionId) {
      throw new ResourceConflict('Office artifact revision conflict');
    }
    if (parent.packageMimeType !== OFFICE_PACKAGE_MIME_TYPE.document) {
      throw new Error(
        `Office DOCX revision has an invalid MIME type: ${parent.id}`
      );
    }

    const parentBytes = await this.readRevisionPackage(
      workspaceId,
      parent.packageBlobKey,
      parent.packageMimeType,
      parent.packageByteSize
    );
    if (officeFingerprint(parentBytes) !== parent.packageFingerprint) {
      throw new Error(
        `Office DOCX revision fingerprint does not match: ${parent.id}`
      );
    }
    const result = applyDocxCommand(openDocxPackage(parentBytes), command);
    return { workspaceId, actorId, command, artifact, parent, result };
  }

  private async assertPermissions(
    workspaceId: string,
    actorId: string,
    source: 'user' | 'ai' | 'system'
  ) {
    const checks = [
      this.ac
        .user(actorId)
        .workspace(workspaceId)
        .assert('Workspace.Blobs.Write'),
    ];
    if (source === 'ai') {
      checks.push(
        this.ac.user(actorId).workspace(workspaceId).assert('Workspace.Copilot')
      );
    }
    await Promise.all(checks);
  }

  private async readRevisionPackage(
    workspaceId: string,
    key: string,
    mimeType: string,
    byteSize: number
  ) {
    if (
      !Number.isSafeInteger(byteSize) ||
      byteSize <= 0 ||
      byteSize > DEFAULT_DOCX_PACKAGE_LIMITS.maxPackageBytes
    ) {
      throw new Error(`Office DOCX revision has an invalid byte size: ${key}`);
    }
    const stored = await this.storage.get(workspaceId, key);
    if (!stored.body) {
      throw new Error(`Office DOCX revision bytes are not available: ${key}`);
    }
    if (
      stored.metadata &&
      (stored.metadata.contentLength !== byteSize ||
        stored.metadata.contentType !== mimeType)
    ) {
      stored.body.destroy();
      throw new Error(
        `Office DOCX revision object metadata does not match: ${key}`
      );
    }
    let bytes: Buffer;
    try {
      bytes = await readBufferWithLimit(
        stored.body,
        DEFAULT_DOCX_PACKAGE_LIMITS.maxPackageBytes
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read Office DOCX revision: ${message}`);
    }
    if (bytes.byteLength !== byteSize) {
      throw new Error(`Office DOCX revision byte size does not match: ${key}`);
    }
    return bytes;
  }
}

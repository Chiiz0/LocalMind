import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { readBufferWithLimit } from '../../base';
import { Models } from '../../models';
import {
  officeOwnerFromInput,
  type OfficeOwnerInput,
  officeOwnerToInput,
} from '../../models/office-owner';
import { PermissionAccess } from '../permission';
import { officeFingerprint, officeJsonFingerprint } from './evidence';
import {
  officeCompatibilitySummary,
  officeFormatFromFileName,
  officePackageSearchText,
  officeStateStats,
  readNativeOfficeState,
} from './formats';
import { OfficeResourceStorage } from './resource-storage';

const MAX_IMPORT_FIELD_LENGTH = 1024;

export type ImportOfficeArtifactInput = OfficeOwnerInput & {
  actorId: string;
  sourceBlobKey: string;
  title: string;
  sourceFileName: string;
  importIdempotencyKey: string;
  parentId?: string | null;
  projectRequestKey?: string;
  projectRequestHash?: string;
  replaceProjectArtifact?: {
    artifactId: string;
    expectedParentRevisionId: string;
    requestFingerprint: string;
  };
};

function requireImportField(value: string, field: string, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must contain 1-${maxLength} characters`);
  }
  return normalized;
}

@Injectable()
export class OfficeImportService {
  constructor(
    private readonly models: Models,
    private readonly storage: OfficeResourceStorage,
    private readonly ac: PermissionAccess
  ) {}

  async import(input: ImportOfficeArtifactInput) {
    const owner = officeOwnerFromInput(input);
    if (input.replaceProjectArtifact && typeof owner === 'string')
      throw new Error('Source refresh requires a Project resource');
    const actorId = requireImportField(input.actorId, 'actor id', 512);
    const sourceBlobKey = requireImportField(
      input.sourceBlobKey,
      'source blob key',
      MAX_IMPORT_FIELD_LENGTH
    );
    const title = requireImportField(input.title, 'title', 512);
    const sourceFileName = requireImportField(
      input.sourceFileName,
      'source file name',
      512
    );
    const policy = officeFormatFromFileName(sourceFileName);
    const importIdempotencyKey = requireImportField(
      input.importIdempotencyKey,
      'import idempotency key',
      256
    );

    if (typeof owner === 'string')
      await Promise.all([
        this.ac.user(actorId).workspace(owner).assert('Workspace.CreateDoc'),
        this.ac.user(actorId).workspace(owner).assert('Workspace.Blobs.Write'),
      ]);
    else
      await this.models.projectResource.assertMember({
        projectId: owner.projectId,
        actorId,
      });

    const projectBlob =
      typeof owner !== 'string'
        ? await this.models.projectResource.getBlob({
            projectId: owner.projectId,
            actorId,
            key: sourceBlobKey,
          })
        : null;
    const sourceBlob =
      typeof owner === 'string'
        ? await this.models.blob.get(owner, sourceBlobKey)
        : projectBlob
          ? {
              mime: projectBlob.mimeType,
              size: projectBlob.byteSize,
              status: 'completed',
              deletedAt: null,
            }
          : null;
    if (
      !sourceBlob ||
      sourceBlob.deletedAt ||
      sourceBlob.status !== 'completed'
    ) {
      throw new Error(
        `${policy.format.toUpperCase()} source blob is not available: ${sourceBlobKey}`
      );
    }
    if (sourceBlob.mime !== policy.mimeType) {
      throw new Error(
        `${policy.format.toUpperCase()} source blob has an invalid MIME type: ${sourceBlobKey}`
      );
    }
    if (sourceBlob.size <= 0 || sourceBlob.size > policy.maxPackageBytes) {
      throw new Error(
        `${policy.format.toUpperCase()} source blob has an invalid byte size: ${sourceBlobKey}`
      );
    }

    const stored = await this.storage.get(owner, actorId, sourceBlobKey);
    if (!stored.body) {
      throw new Error(
        `${policy.format.toUpperCase()} source bytes are not available: ${sourceBlobKey}`
      );
    }
    if (
      stored.metadata &&
      (stored.metadata.contentLength !== sourceBlob.size ||
        stored.metadata.contentType !== sourceBlob.mime)
    ) {
      stored.body.destroy();
      throw new Error(
        `${policy.format.toUpperCase()} source object metadata does not match: ${sourceBlobKey}`
      );
    }
    let sourceBytes: Buffer;
    try {
      sourceBytes = await readBufferWithLimit(
        stored.body,
        policy.maxPackageBytes
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read ${policy.format.toUpperCase()} source blob: ${message}`
      );
    }
    if (sourceBytes.byteLength !== sourceBlob.size) {
      throw new Error(
        `${policy.format.toUpperCase()} source blob byte size does not match: ${sourceBlobKey}`
      );
    }

    const sourceFingerprint = officeFingerprint(sourceBytes);
    const semanticState = await readNativeOfficeState(policy, sourceBytes);
    const hash = sourceFingerprint.slice('sha256:'.length);
    const packageBlobKey = await this.storage.put(
      owner,
      actorId,
      `office/package/${policy.format}/${hash}${policy.extension}`,
      sourceBytes,
      {
        contentType: policy.mimeType,
        contentLength: sourceBytes.byteLength,
      }
    );
    const stateBytes = Buffer.from(JSON.stringify(semanticState), 'utf8');
    if (
      !stateBytes.byteLength ||
      stateBytes.byteLength > policy.maxStateBytes
    ) {
      throw new Error(
        `${policy.format.toUpperCase()} semantic state exceeds its byte limit`
      );
    }
    const stateFingerprint = officeFingerprint(stateBytes);
    const stateBlobKey = await this.storage.put(
      owner,
      actorId,
      `office/state/${policy.format}/${stateFingerprint.slice('sha256:'.length)}.json`,
      stateBytes,
      {
        contentType: policy.stateMimeType,
        contentLength: stateBytes.byteLength,
      }
    );

    const compatibility = officeCompatibilitySummary(
      policy,
      semanticState
    ) satisfies Prisma.InputJsonObject;
    const operationSummary = {
      type: 'import',
      engine: policy.engine,
      modelVersion: policy.modelVersion,
      stats: officeStateStats(semanticState),
    } satisfies Prisma.InputJsonObject;
    const trustedImportFingerprint = officeJsonFingerprint({
      version: 'localmind-office-import/v1',
      format: policy.format,
      ...officeOwnerToInput(owner),
      actorId,
      title,
      sourceFileName,
      importSourceBlobKey: sourceBlobKey,
      packageBlobKey,
      sourceMimeType: sourceBlob.mime,
      sourceByteSize: sourceBytes.byteLength,
      sourceFingerprint,
      stateFingerprint,
      modelVersion: policy.modelVersion,
      ...(typeof owner === 'string'
        ? {}
        : { parentId: input.parentId ?? null }),
    });
    const persist = () =>
      this.models.officeArtifact.createOrReuseImported({
        ...officeOwnerToInput(owner),
        actorId,
        kind: policy.kind,
        title,
        sourceFileName,
        source: {
          key: packageBlobKey,
          mimeType: policy.mimeType,
          byteSize: sourceBytes.byteLength,
          fingerprint: sourceFingerprint,
        },
        state: {
          key: stateBlobKey,
          byteSize: stateBytes.byteLength,
          fingerprint: stateFingerprint,
        },
        modelVersion: policy.modelVersion,
        importIdempotencyKey,
        importFingerprint: trustedImportFingerprint,
        compatibility,
        operationSummary,
      });
    const result =
      typeof owner === 'string'
        ? await persist()
        : await this.models.projectResource.withMember(
            { projectId: owner.projectId, actorId },
            async () => {
              if (input.replaceProjectArtifact) {
                const target = input.replaceProjectArtifact;
                const artifact = await this.models.officeArtifact.get(
                  owner,
                  target.artifactId
                );
                if (!artifact || artifact.kind !== policy.kind)
                  throw new Error('Source refresh type does not match');
                await this.models.projectResource.assertOfficeResource({
                  projectId: owner.projectId,
                  actorId,
                  artifactId: artifact.id,
                });
                const result = await this.models.officeArtifact.appendRevision({
                  projectId: owner.projectId,
                  artifactId: artifact.id,
                  actorId,
                  origin: 'user',
                  expectedParentRevisionId: target.expectedParentRevisionId,
                  idempotencyKey: importIdempotencyKey,
                  idempotencyFingerprint: target.requestFingerprint,
                  package: {
                    key: packageBlobKey,
                    mimeType: policy.mimeType,
                    byteSize: sourceBytes.byteLength,
                    fingerprint: sourceFingerprint,
                  },
                  state: {
                    key: stateBlobKey,
                    byteSize: stateBytes.byteLength,
                    fingerprint: stateFingerprint,
                  },
                  modelVersion: policy.modelVersion,
                  operationSummary: {
                    ...operationSummary,
                    type: 'source_refresh',
                  },
                });
                await this.models.projectResource.updateSearchText({
                  projectId: owner.projectId,
                  actorId,
                  resourceId: artifact.id,
                  sequence: result.revision.sequence,
                  text: await officePackageSearchText(
                    semanticState,
                    sourceBytes
                  ),
                });
                return { ...result, artifact };
              }
              const imported = await persist();
              await this.models.projectResource.create({
                projectId: owner.projectId,
                actorId,
                resourceId: imported.artifact.id,
                officeArtifactId: imported.artifact.id,
                parentId: input.parentId,
                title,
                kind: policy.kind,
                requestKey:
                  input.projectRequestKey ??
                  `office:${officeJsonFingerprint({ importIdempotencyKey })}`,
                requestHash: input.projectRequestHash,
                origin: 'import',
              });
              await this.models.projectResource.assertOfficeResource({
                projectId: owner.projectId,
                actorId,
                artifactId: imported.artifact.id,
              });
              await this.models.projectResource.updateSearchText({
                projectId: owner.projectId,
                actorId,
                resourceId: imported.artifact.id,
                sequence: imported.revision.sequence,
                text: await officePackageSearchText(semanticState, sourceBytes),
              });
              return imported;
            },
            true
          );
    return {
      ...result,
      format: policy.format,
      sourceFingerprint,
      packageBlobKey,
      stateBlobKey,
      stateFingerprint,
      stats: officeStateStats(semanticState),
    };
  }
}

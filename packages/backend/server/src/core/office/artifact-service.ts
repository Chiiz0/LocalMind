import {
  diffOfficeSemanticStates,
  type OfficeSemanticKind,
} from '@localmind/office';
import {
  exportDocxStateToPdf,
  openDocxPackage,
  readDocxSemanticState,
} from '@localmind/office/docx';
import { openPptxPackage } from '@localmind/office/pptx';
import { openXlsxPackage } from '@localmind/office/xlsx';
import { Injectable } from '@nestjs/common';
import {
  type OfficeArtifact,
  OfficeArtifactKind,
  type OfficeRevision,
} from '@prisma/client';

import { BadRequest, readBufferWithLimit } from '../../base';
import { Models } from '../../models';
import type { OfficeOwner } from '../../models/office-owner';
import { PermissionAccess } from '../permission';
import { officeFingerprint } from './evidence';
import { OfficeResourceStorage } from './resource-storage';

const MAX_OFFICE_PACKAGE_DOWNLOAD_BYTES = 512 * 1024 * 1024;
const MAX_OFFICE_STATE_DOWNLOAD_BYTES = 256 * 1024 * 1024;
const MAX_OFFICE_PART_DOWNLOAD_BYTES = 64 * 1024 * 1024;

export type OfficeRevisionAssetKind = 'package' | 'state';

@Injectable()
export class OfficeArtifactService {
  constructor(
    private readonly models: Models,
    private readonly storage: OfficeResourceStorage,
    private readonly ac: PermissionAccess
  ) {}

  async list(
    owner: OfficeOwner,
    actorId: string,
    limit?: number,
    kind?: OfficeArtifactKind
  ) {
    await this.assertRead(owner, actorId);
    const artifacts = await this.models.officeArtifact.list(owner, limit, kind);
    if (typeof owner !== 'string') {
      const visible = [];
      for (const artifact of artifacts) {
        try {
          visible.push(await this.get(owner, actorId, artifact.id));
        } catch (error) {
          if (!(error instanceof BadRequest)) throw error;
        }
      }
      return visible;
    }
    return await Promise.all(
      artifacts.map(async artifact => ({
        artifact,
        revision: await this.models.officeArtifact.getCurrentRevision(
          owner,
          artifact.id
        ),
      }))
    );
  }

  async get(owner: OfficeOwner, actorId: string, artifactId: string) {
    const artifact = await this.getArtifactForAsset(owner, actorId, artifactId);
    const revision = await this.models.officeArtifact.getCurrentRevision(
      owner,
      artifactId
    );
    if (!revision) {
      throw new Error(
        `Office artifact is missing its current revision: ${artifactId}`
      );
    }
    return { artifact, revision };
  }

  async getRevision(
    owner: OfficeOwner,
    actorId: string,
    artifactId: string,
    revisionId?: string
  ) {
    await this.getArtifactForAsset(owner, actorId, artifactId);
    const revision = revisionId
      ? await this.models.officeArtifact.getRevision(
          owner,
          artifactId,
          revisionId
        )
      : await this.models.officeArtifact.getCurrentRevision(owner, artifactId);
    if (!revision) {
      throw new Error(
        `Office revision not found: ${revisionId ?? `current:${artifactId}`}`
      );
    }
    return revision;
  }

  async listRevisions(
    owner: OfficeOwner,
    actorId: string,
    artifactId: string,
    limit?: number
  ) {
    await this.getArtifactForAsset(owner, actorId, artifactId);
    return await this.models.officeArtifact.listRevisions(
      owner,
      artifactId,
      limit
    );
  }

  async compareRevisions(
    owner: OfficeOwner,
    actorId: string,
    artifactId: string,
    beforeRevisionId: string,
    afterRevisionId: string
  ) {
    const [before, after] = await Promise.all([
      this.readRevisionAsset(
        owner,
        actorId,
        artifactId,
        beforeRevisionId,
        'state'
      ),
      this.readRevisionAsset(
        owner,
        actorId,
        artifactId,
        afterRevisionId,
        'state'
      ),
    ]);
    if (before.artifact.kind !== after.artifact.kind) {
      throw new Error('Office revisions belong to different resource kinds');
    }
    const parseState = (bytes: Buffer, revisionId: string) => {
      try {
        return JSON.parse(bytes.toString('utf8')) as unknown;
      } catch {
        throw new Error(
          `Office semantic state is not valid JSON: ${revisionId}`
        );
      }
    };
    const kind = this.semanticKind(before.artifact.kind);
    const diff = diffOfficeSemanticStates(
      kind,
      parseState(before.bytes, before.revision.id),
      parseState(after.bytes, after.revision.id)
    );
    return {
      artifact: before.artifact,
      beforeRevision: before.revision,
      afterRevision: after.revision,
      diff,
    };
  }

  async readRevisionAsset(
    owner: OfficeOwner,
    actorId: string,
    artifactId: string,
    revisionId: string,
    kind: OfficeRevisionAssetKind
  ) {
    const artifact = await this.getArtifactForAsset(owner, actorId, artifactId);
    const revision = await this.getRevision(
      owner,
      actorId,
      artifactId,
      revisionId
    );
    const evidence = this.assetEvidence(revision, kind);
    const stored = await this.storage.get(owner, actorId, evidence.key);
    if (!stored.body) {
      throw new Error(
        `Office ${kind} bytes are not available: ${evidence.key}`
      );
    }
    if (
      stored.metadata &&
      (stored.metadata.contentLength !== evidence.byteSize ||
        (evidence.mimeType &&
          stored.metadata.contentType !== evidence.mimeType))
    ) {
      stored.body.destroy();
      throw new Error(
        `Office ${kind} object metadata does not match: ${evidence.key}`
      );
    }
    let bytes: Buffer;
    try {
      bytes = await readBufferWithLimit(stored.body, evidence.maxBytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read Office ${kind}: ${message}`);
    }
    if (bytes.byteLength !== evidence.byteSize) {
      throw new Error(
        `Office ${kind} byte size does not match: ${evidence.key}`
      );
    }
    if (officeFingerprint(bytes) !== evidence.fingerprint) {
      throw new Error(
        `Office ${kind} fingerprint does not match: ${evidence.key}`
      );
    }
    await this.getArtifactForAsset(owner, actorId, artifactId);
    return { artifact, revision, bytes, mimeType: evidence.mimeType };
  }

  async readRevisionPackagePart(
    owner: OfficeOwner,
    actorId: string,
    artifactId: string,
    revisionId: string,
    partName: string
  ) {
    const asset = await this.readRevisionAsset(
      owner,
      actorId,
      artifactId,
      revisionId,
      'package'
    );
    const pkg =
      asset.artifact.kind === OfficeArtifactKind.document
        ? openDocxPackage(asset.bytes)
        : asset.artifact.kind === OfficeArtifactKind.workbook
          ? openXlsxPackage(asset.bytes)
          : asset.artifact.kind === OfficeArtifactKind.presentation
            ? openPptxPackage(asset.bytes)
            : null;
    if (!pkg) throw new Error('PDF revisions do not contain package parts');
    const bytes = pkg.readPart(partName);
    if (!bytes) throw new Error(`Office package part not found: ${partName}`);
    if (bytes.byteLength > MAX_OFFICE_PART_DOWNLOAD_BYTES) {
      throw new Error(
        `Office package part exceeds its byte limit: ${partName}`
      );
    }
    return {
      artifact: asset.artifact,
      revision: asset.revision,
      bytes: Buffer.from(bytes),
      mimeType: pkg.getContentType(partName) ?? 'application/octet-stream',
    };
  }

  async exportDocumentRevisionPdf(
    owner: OfficeOwner,
    actorId: string,
    artifactId: string,
    revisionId: string
  ) {
    const asset = await this.readRevisionAsset(
      owner,
      actorId,
      artifactId,
      revisionId,
      'package'
    );
    if (asset.artifact.kind !== OfficeArtifactKind.document) {
      throw new Error('PDF export is available only for LocalMind Docs');
    }
    const pkg = openDocxPackage(asset.bytes);
    const state = readDocxSemanticState(pkg);
    const bytes = Buffer.from(
      await exportDocxStateToPdf(state, {
        title: asset.artifact.title,
        author: asset.artifact.createdBy,
        readPart: partName => pkg.readPart(partName),
      })
    );
    return {
      artifact: asset.artifact,
      revision: asset.revision,
      bytes,
      fingerprint: officeFingerprint(bytes),
      mimeType: 'application/pdf',
    };
  }

  async assertRead(owner: OfficeOwner, actorId: string) {
    if (typeof owner !== 'string') {
      await this.models.projectResource.assertMember({
        projectId: owner.projectId,
        actorId,
      });
      return;
    }
    await this.ac.user(actorId).workspace(owner).assert('Workspace.Blobs.Read');
  }

  private async getArtifactForAsset(
    owner: OfficeOwner,
    actorId: string,
    artifactId: string
  ) {
    await this.assertRead(owner, actorId);
    const artifact = await this.requireArtifact(owner, artifactId);
    if (typeof owner !== 'string')
      await this.models.projectResource.assertOfficeResource({
        projectId: owner.projectId,
        actorId,
        artifactId,
      });
    return artifact;
  }

  private async requireArtifact(owner: OfficeOwner, artifactId: string) {
    const artifact = await this.models.officeArtifact.get(owner, artifactId);
    if (!artifact) {
      throw new Error(`Office artifact not found: ${artifactId}`);
    }
    return artifact;
  }

  private assetEvidence(
    revision: OfficeRevision,
    kind: OfficeRevisionAssetKind
  ) {
    if (kind === 'package') {
      return {
        key: revision.packageBlobKey,
        mimeType: revision.packageMimeType,
        byteSize: revision.packageByteSize,
        fingerprint: revision.packageFingerprint,
        maxBytes: MAX_OFFICE_PACKAGE_DOWNLOAD_BYTES,
      };
    }
    if (
      !revision.stateBlobKey ||
      !revision.stateByteSize ||
      !revision.stateFingerprint
    ) {
      throw new Error(`Office revision has no semantic state: ${revision.id}`);
    }
    return {
      key: revision.stateBlobKey,
      mimeType: undefined,
      byteSize: revision.stateByteSize,
      fingerprint: revision.stateFingerprint,
      maxBytes: MAX_OFFICE_STATE_DOWNLOAD_BYTES,
    };
  }

  private semanticKind(kind: OfficeArtifactKind): OfficeSemanticKind {
    switch (kind) {
      case OfficeArtifactKind.document:
        return 'document';
      case OfficeArtifactKind.workbook:
        return 'workbook';
      case OfficeArtifactKind.presentation:
        return 'presentation';
      case OfficeArtifactKind.pdf:
        return 'pdf';
    }
  }
}

export type OfficeArtifactRecord = OfficeArtifact;
export type OfficeRevisionRecord = OfficeRevision;

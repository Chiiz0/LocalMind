import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { ProjectResourceKind } from '@prisma/client';

import { BadRequest, readBufferWithLimit } from '../../base';
import { Models } from '../../models';
import {
  COPILOT_COPY_BLOB_PREFIX,
  copyAttachmentDocumentId,
} from '../../models/blob';
import {
  type ProjectActor,
  projectResourceHash,
} from '../../models/project-resource';
import type { ProjectEditLeaseProof } from '../../models/project-resource-edit-lease';
import { parseYDocFromBinary, parseYDocToMarkdown } from '../../native';
import { DocReader } from '../doc';
import {
  inspectDocumentCopySnapshot,
  readFileCopySnapshot,
  remapDocumentCopyBlobs,
  retitleDocumentCopySnapshot,
} from '../doc/copy-snapshot';
import { OfficeImportService } from '../office';
import { PermissionAccess } from '../permission';
import { ProjectBlobStorage } from '../project';
import { WorkspaceBlobStorage } from '../storage';
import { isolateImportedReferences } from './references';

export type ProjectImportInput = ProjectActor & {
  workspaceId: string;
  sourceResourceId: string;
  parentId?: string | null;
  requestKey: string;
  title?: string;
  kind: Exclude<ProjectResourceKind, 'folder'>;
  editLease?: ProjectEditLeaseProof;
  replace?: {
    resourceId: string;
    expectedContentVersion: number;
    expectedSourceVersion: string;
  };
};

function hash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

@Injectable()
export class ProjectImportService {
  constructor(
    private readonly models: Models,
    private readonly ac: PermissionAccess,
    private readonly reader: DocReader,
    private readonly sourceBlobs: WorkspaceBlobStorage,
    private readonly projectBlobs: ProjectBlobStorage,
    private readonly officeImports: OfficeImportService
  ) {}

  async authorizeSource(
    input: ProjectActor & { workspaceId: string; sourceResourceId: string },
    docId = input.sourceResourceId
  ) {
    if (docId === input.workspaceId)
      throw new BadRequest('Workspace root documents cannot be imported');
    const source = this.ac
      .user(input.actorId)
      .doc(input.workspaceId, docId)
      .projectScope(input.projectId);
    await source.assert('Doc.Read');
    await source.assert('Doc.Copy');
    await source.assert('Doc.Duplicate');
    return this.models.intelligenceWorkbenchAuthorization.projectCopyPermission(
      { ...input, docId }
    );
  }

  private authorize(input: ProjectImportInput, docId = input.sourceResourceId) {
    return this.authorizeSource(input, docId);
  }

  @Transactional<TransactionalAdapterPrisma>({ timeout: 60000 })
  async import(input: ProjectImportInput) {
    if (
      !input.workspaceId ||
      input.workspaceId.length > 512 ||
      !input.sourceResourceId ||
      input.sourceResourceId.length > 512 ||
      !input.requestKey?.trim() ||
      input.requestKey.length > 256
    )
      throw new BadRequest('Invalid import source');
    const requestKey = `workspace-import:${projectResourceHash(input.requestKey)}`;
    const requestHash = projectResourceHash({
      workspaceId: input.workspaceId,
      sourceResourceId: input.sourceResourceId,
      parentId: input.parentId ?? null,
      title: input.title ?? null,
      kind: input.kind,
      replace: input.replace ?? null,
    });
    await this.models.intelligenceWorkbenchAuthorization.lockProjectDocumentAuthorization(
      { ...input, docId: input.sourceResourceId }
    );
    await this.models.projectResource.assertMember(input, true);
    const replacement = input.replace
      ? await this.models.projectResource.get({
          ...input,
          resourceId: input.replace.resourceId,
        })
      : null;
    if (replacement) {
      if (
        await this.models.projectResource.findImportRequest({
          ...input,
          resourceId: replacement.id,
          requestKey,
          requestHash,
        })
      )
        return replacement;
    } else {
      const existing = await this.models.projectResource.findCreation({
        ...input,
        requestKey,
        requestHash,
      });
      if (existing) return existing;
    }
    const replacementRevision = replacement?.officeArtifactId
      ? await this.models.officeArtifact.getCurrentRevision(
          { projectId: input.projectId },
          replacement.id
        )
      : null;
    if (replacement)
      await this.models.projectResourceEditLease.assertHeld({
        ...input,
        resourceId: replacement.id,
      });
    if (
      replacement &&
      (replacement.kind !== input.kind ||
        (replacementRevision?.sequence ?? replacement.contentVersion) !==
          input.replace?.expectedContentVersion)
    )
      throw new BadRequest(
        'Project content changed; reload and compare before refreshing the source'
      );
    const authorization = await this.authorize(input);
    const native = await this.models.officeArtifact.get(
      input.workspaceId,
      input.sourceResourceId
    );
    if (native) {
      await this.models.officeArtifact.lockArtifactWriter(
        input.workspaceId,
        native.id
      );
      if (native.kind !== input.kind)
        throw new BadRequest('The source Office type does not match');
      const revision = await this.models.officeArtifact.getCurrentRevision(
        input.workspaceId,
        native.id
      );
      if (!revision)
        throw new BadRequest('Source Office revision is unavailable');
      if (input.replace && revision.id !== input.replace.expectedSourceVersion)
        throw new BadRequest(
          'Source changed; compare its latest version before refreshing'
        );
      const source = await this.sourceBlobs.get(
        input.workspaceId,
        revision.packageBlobKey
      );
      if (!source.body)
        throw new BadRequest('Source Office package is unavailable');
      const bytes = await readBufferWithLimit(source.body, 512 * 1024 * 1024);
      if (
        bytes.length !== revision.packageByteSize ||
        `sha256:${hash(bytes)}` !== revision.packageFingerprint ||
        source.metadata?.contentType !== revision.packageMimeType
      )
        throw new BadRequest('Source Office package evidence does not match');
      await this.authorize(input);
      const current = await this.models.officeArtifact.getCurrentRevision(
        input.workspaceId,
        native.id
      );
      if (current?.id !== revision.id)
        throw new BadRequest(
          'Source changed during import; retry with the current version'
        );
      const blob = await this.projectBlobs.put({
        ...input,
        bytes,
        mimeType: revision.packageMimeType,
      });
      const imported = await this.officeImports.import({
        projectId: input.projectId,
        actorId: input.actorId,
        parentId: input.parentId,
        sourceBlobKey: blob.key,
        sourceFileName: native.sourceFileName,
        title: input.title ?? native.title,
        importIdempotencyKey: requestKey,
        projectRequestKey: requestKey,
        projectRequestHash: requestHash,
        editLease: input.editLease,
        replaceProjectArtifact:
          replacement && replacementRevision
            ? {
                artifactId: replacement.id,
                expectedParentRevisionId: replacementRevision.id,
                requestFingerprint: requestHash,
              }
            : undefined,
      });
      await this.models.projectResource.recordImport({
        ...input,
        resourceId: imported.artifact.id,
        sourceWorkspaceId: input.workspaceId,
        sourceVersion: revision.id,
        sourceFingerprint: hash(bytes),
        authorization,
        attachmentCount: 0,
        requestKey,
        requestHash,
      });
      return this.models.projectResource.get({
        ...input,
        resourceId: imported.artifact.id,
      });
    }
    if (
      input.kind !== 'page' &&
      input.kind !== 'edgeless' &&
      input.kind !== 'file'
    )
      throw new BadRequest('Source native Office resource is unavailable');
    const currentSource = await this.reader.getDoc(
      input.workspaceId,
      input.sourceResourceId
    );
    if (!currentSource) throw new BadRequest('Source document is unavailable');
    const source = currentSource;
    if (
      input.replace &&
      hash(source.bin) !== input.replace.expectedSourceVersion
    )
      throw new BadRequest(
        'Source changed; compare its latest version before refreshing'
      );
    const file =
      input.kind === 'file' ? readFileCopySnapshot(source.bin) : null;
    if (input.kind === 'file' && !file)
      throw new BadRequest('The source is not a standalone file attachment');
    const inspected = inspectDocumentCopySnapshot(source.bin);
    const parsed = parseYDocFromBinary(
      inspected.binary,
      input.sourceResourceId
    );
    const references = new Set(
      parsed.blocks.flatMap(block => block.refDocId ?? [])
    );
    for (const key of inspected.blobIds) {
      if (!key.startsWith(COPILOT_COPY_BLOB_PREFIX)) continue;
      const owner = copyAttachmentDocumentId(key);
      if (!owner)
        throw new BadRequest('Source attachment ownership is invalid');
      references.add(owner);
    }
    references.delete(input.sourceResourceId);
    if (references.size > 256)
      throw new BadRequest('Too many import source references');
    for (const docId of [...references].sort())
      await this.authorize(input, docId);
    const attachments: { key: string; bytes: Buffer; mimeType: string }[] = [];
    let byteSize = inspected.binary.length;
    for (const key of inspected.blobIds) {
      const blob = await this.sourceBlobs.get(input.workspaceId, key);
      if (!blob.body)
        throw new BadRequest('A source attachment is unavailable');
      const bytes = await readBufferWithLimit(blob.body, 16 * 1024 * 1024);
      byteSize += bytes.length;
      if (byteSize > 64 * 1024 * 1024)
        throw new BadRequest('Document import exceeds its total byte limit');
      attachments.push({
        key,
        bytes,
        mimeType: blob.metadata?.contentType ?? 'application/octet-stream',
      });
    }
    await this.authorize(input);
    for (const docId of [...references].sort())
      await this.authorize(input, docId);
    await this.models.doc.lockContentWrite(
      input.workspaceId,
      input.sourceResourceId
    );
    const latest = await this.reader.getDoc(
      input.workspaceId,
      input.sourceResourceId
    );
    if (!latest || hash(latest.bin) !== hash(currentSource.bin))
      throw new BadRequest(
        'Source changed during import; retry with the current version'
      );
    const mappings = new Map<string, string>();
    for (const attachment of attachments) {
      const blob = await this.projectBlobs.put({
        ...input,
        bytes: attachment.bytes,
        mimeType: attachment.mimeType,
      });
      mappings.set(attachment.key, blob.key);
    }
    const resourceId = replacement?.id ?? randomUUID();
    const title =
      replacement?.title ?? input.title ?? (parsed.title || 'Untitled');
    let bytes = remapDocumentCopyBlobs(inspected.binary, mappings);
    bytes = isolateImportedReferences(bytes, {
      workspaceId: input.workspaceId,
      sourceResourceId: input.sourceResourceId,
      resourceId,
    });
    bytes = retitleDocumentCopySnapshot(bytes, title, resourceId);
    const fileBlobKey = file ? mappings.get(file.key) : undefined;
    if (file && !fileBlobKey)
      throw new BadRequest('The source file content is unavailable');
    const blob = fileBlobKey
      ? await this.models.projectResource.getBlob({
          ...input,
          key: fileBlobKey,
        })
      : await this.projectBlobs.put({
          ...input,
          bytes,
          mimeType: 'application/vnd.localmind.yjs',
        });
    const searchText = file
      ? ''
      : parseYDocToMarkdown(bytes, resourceId, true).markdown.slice(0, 250000);
    if (replacement && input.replace) {
      await this.models.projectResource.appendRevision({
        ...input,
        resourceId,
        expectedContentVersion: input.replace.expectedContentVersion,
        requestKey,
        requestHash,
        blobKey: blob.key,
        attachmentKeys: file ? [] : [...mappings.values()],
        searchText,
        origin: 'import',
      });
    }
    const resource = replacement
      ? await this.models.projectResource.get({ ...input, resourceId })
      : await this.models.projectResource.create({
          ...input,
          resourceId,
          title,
          requestKey,
          requestHash,
          blobKey: blob.key,
          attachmentKeys: file ? [] : [...mappings.values()],
          searchText,
          origin: 'import',
        });
    await this.models.projectResource.recordImport({
      ...input,
      resourceId,
      sourceWorkspaceId: input.workspaceId,
      sourceVersion: hash(source.bin),
      sourceFingerprint: hash(source.bin),
      authorization,
      attachmentCount: attachments.length,
      requestKey,
      requestHash,
    });
    return resource;
  }
}

import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import type { CopilotDocumentOperation } from '@prisma/client';

import {
  BadRequest,
  BlobQuotaExceeded,
  StorageQuotaExceeded,
} from '../../base';
import { DocReader } from '../../core/doc';
import {
  inspectDocumentCopySnapshot,
  remapDocumentCopyBlobs,
} from '../../core/doc/copy-snapshot';
import { PermissionAccess } from '../../core/permission';
import { QuotaService } from '../../core/quota';
import { WorkspaceBlobStorage } from '../../core/storage';
import { Models } from '../../models';
import {
  COPILOT_COPY_BLOB_PREFIX,
  copyAttachmentDocumentId,
} from '../../models/blob';
import type { DocumentCopySourceInput } from '../../models/copilot-document-operation';

async function readBoundedBlob(body: Readable) {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > 16 * 1024 * 1024)
      throw new BadRequest('Copy attachment exceeds its size limit');
    parts.push(part);
  }
  return Buffer.concat(parts);
}

@Injectable()
export class CopilotDocumentCopyService {
  constructor(
    private readonly models: Models,
    private readonly ac: PermissionAccess,
    private readonly reader: DocReader,
    private readonly blobs: WorkspaceBlobStorage,
    private readonly quota: QuotaService
  ) {}

  async assertSource(input: {
    actorId: string;
    sessionId: string;
    workspaceId: string;
    documentId: string;
  }) {
    const session = await this.models.copilotSession.getMeta(input.sessionId);
    if (
      !session ||
      session.userId !== input.actorId ||
      input.workspaceId === input.documentId
    )
      throw new BadRequest('Document copy source conversation is unavailable');
    await this.ac
      .user(input.actorId)
      .workspace(session.workspaceId)
      .assert('Workspace.Copilot');
    const projectId = session.selectedContextProjectId ?? null;
    if (projectId) {
      const project =
        await this.models.intelligenceWorkbenchAuthorization.getProjectDocumentAccess(
          {
            projectId,
            userId: input.actorId,
            workspaceId: input.workspaceId,
            docId: input.documentId,
          }
        );
      if (!project || project.aiPolicy !== 'read_write' || session.docId)
        throw new BadRequest(
          'The current project does not allow document copying'
        );
      await this.models.copilotContext.recordDocumentSources({
        actorId: input.actorId,
        sessionId: input.sessionId,
        projectId,
        documents: [
          { workspaceId: input.workspaceId, docId: input.documentId },
        ],
      });
    }
    const access = this.ac
      .user(input.actorId)
      .doc(input.workspaceId, input.documentId)
      .projectScope(projectId);
    await access.assert('Doc.Read');
    await access.assert('Doc.Copy');
    await access.assert('Doc.Duplicate');
    // An independent destination can expose content under different grants.
    await this.ac
      .user(input.actorId)
      .doc(input.workspaceId, input.documentId)
      .projectScope(null)
      .assert('Doc.Users.Manage');
    if (!(await this.models.workspace.allowSharing(input.workspaceId)))
      throw new BadRequest(
        'The source workspace does not allow sharing document copies'
      );
    if (!(await this.reader.getDoc(input.workspaceId, input.documentId)))
      throw new BadRequest('Document copy source is unavailable');
  }

  private async assertReferencedCopySources(
    input: {
      actorId: string;
      sessionId: string;
      workspaceId: string;
      documentId: string;
    },
    keys: string[]
  ) {
    const documents = new Set<string>();
    for (const key of keys) {
      if (!key.startsWith(COPILOT_COPY_BLOB_PREFIX)) continue;
      const docId = copyAttachmentDocumentId(key);
      if (!docId) throw new BadRequest('Copy attachment owner is invalid');
      if (docId !== input.documentId) documents.add(docId);
    }
    for (const documentId of [...documents].sort())
      await this.assertSource({ ...input, documentId });
  }

  async prepare(input: {
    actorId: string;
    sessionId: string;
    workspaceId: string;
    documentId: string;
    title: string;
    addToProject: boolean;
  }) {
    await this.assertSource(input);
    const document = await this.reader.getDoc(
      input.workspaceId,
      input.documentId
    );
    if (!document) throw new BadRequest('Document copy source is unavailable');
    const inspected = inspectDocumentCopySnapshot(document.bin);
    const assets: DocumentCopySourceInput['assets'] = [];
    let bytes = inspected.binary.length;
    for (const key of inspected.blobIds) {
      await this.assertSource(input);
      await this.assertReferencedCopySources(input, [key]);
      const blob = await this.blobs.get(input.workspaceId, key);
      if (!blob.body)
        throw new BadRequest('A source attachment is unavailable');
      const data = await readBoundedBlob(blob.body);
      bytes += data.length;
      if (bytes > 64 * 1024 * 1024)
        throw new BadRequest('Document copy exceeds its total size limit');
      assets.push({
        key,
        data,
        contentType: blob.metadata?.contentType ?? 'application/octet-stream',
      });
    }
    await this.assertSource(input);
    return await this.models.copilotDocumentOperation.prepareForLatestTurn({
      sessionId: input.sessionId,
      actorId: input.actorId,
      title: input.title,
      markdown: '',
      addToProject: input.addToProject,
      copySource: {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        snapshot: inspected.binary,
        assets,
      },
    });
  }

  async source(operation: CopilotDocumentOperation) {
    const source = await this.models.copilotDocumentOperation.copySource({
      actorId: operation.actorId,
      operationId: operation.id,
    });
    if (!source) throw new BadRequest('Frozen copy source is unavailable');
    await this.assertSource({
      actorId: operation.actorId,
      sessionId: operation.sessionId,
      workspaceId: source.workspaceId,
      documentId: source.documentId,
    });
    await this.assertReferencedCopySources(
      {
        actorId: operation.actorId,
        sessionId: operation.sessionId,
        workspaceId: source.workspaceId,
        documentId: source.documentId,
      },
      source.assets.map(asset => asset.key)
    );
    const inspected = inspectDocumentCopySnapshot(source.snapshot);
    const keys = source.assets.map(asset => asset.key).sort();
    if (JSON.stringify(keys) !== JSON.stringify(inspected.blobIds))
      throw new BadRequest('Frozen copy attachments do not match the document');
    return source;
  }

  async transferAttachments(
    operation: CopilotDocumentOperation,
    revalidate: () => Promise<void>
  ) {
    const source = await this.source(operation);
    const workspaceId = operation.destinationWorkspaceId;
    if (!workspaceId || workspaceId === source.workspaceId)
      throw new BadRequest('Choose a different workspace for this copy');
    const replacements = new Map(
      source.assets.map(asset => [
        asset.key,
        `${COPILOT_COPY_BLOB_PREFIX}${operation.documentId}-${createHash('sha256').update(asset.data).digest('base64url')}`,
      ])
    );
    for (const asset of source.assets) {
      const targetKey = replacements.get(asset.key);
      if (!targetKey)
        throw new BadRequest('Copy attachment mapping is unavailable');
      await revalidate();
      await this.ac
        .user(operation.actorId)
        .workspace(workspaceId)
        .assert('Workspace.Blobs.Write');
      const existing = await this.blobs.get(workspaceId, targetKey);
      if (existing.body) {
        const data = await readBoundedBlob(existing.body);
        if (
          createHash('sha256').update(data).digest('hex') !==
            asset.fingerprint ||
          (existing.metadata?.contentType &&
            existing.metadata.contentType !== asset.contentType)
        )
          throw new BadRequest(
            'The destination contains a conflicting attachment'
          );
        continue;
      }
      const checkQuota =
        await this.quota.getWorkspaceQuotaCalculator(workspaceId);
      const exceeded = checkQuota(asset.data.byteLength);
      if (exceeded?.blobQuotaExceeded) throw new BlobQuotaExceeded();
      if (exceeded?.storageQuotaExceeded) throw new StorageQuotaExceeded();
      await revalidate();
      await this.blobs.putCopyAttachment(
        workspaceId,
        targetKey,
        Buffer.from(asset.data),
        {
          uploadId: operation.id,
          contentType: asset.contentType,
        },
        async () => {
          await revalidate();
          await this.ac
            .user(operation.actorId)
            .workspace(workspaceId)
            .assert('Workspace.Blobs.Write');
        }
      );
    }
    return remapDocumentCopyBlobs(source.snapshot, replacements);
  }
}

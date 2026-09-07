import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { BadRequest, EventBus, readBufferWithLimit } from '../../base';
import { Models } from '../../models';
import {
  PROJECT_BLOB_MAX_BYTES,
  type ProjectActor,
  projectResourceHash,
} from '../../models/project-resource';
import {
  createDocWithMarkdown,
  parseYDocFromBinary,
  parseYDocToMarkdown,
  updateDocWithMarkdown,
} from '../../native';
import {
  inspectDocumentCopySnapshot,
  retitleDocumentCopySnapshot,
} from '../doc/copy-snapshot';
import { StorageRuntimeProvider } from '../storage-runtime';

declare global {
  interface Events {
    'project.resource.changed': { projectId: string; resourceId: string };
  }
}

@Injectable()
export class ProjectBlobStorage {
  constructor(
    private readonly models: Models,
    private readonly runtime: StorageRuntimeProvider
  ) {}

  async put(input: ProjectActor & { bytes: Buffer; mimeType: string }) {
    await this.models.projectResource.assertMember(input);
    if (
      input.bytes.length > PROJECT_BLOB_MAX_BYTES ||
      !input.mimeType ||
      input.mimeType.length > 256
    )
      throw new BadRequest('Project Blob exceeds its bounds');
    const fingerprint = createHash('sha256').update(input.bytes).digest('hex');
    const key = `sha256-${fingerprint}`;
    return this.models.projectResource.storeBlob(
      {
        ...input,
        key,
        fingerprint,
        byteSize: input.bytes.length,
      },
      async () => {
        const metadata = await this.runtime.putObject(
          'blob',
          this.objectKey(input.projectId, key),
          input.bytes,
          {
            contentType: input.mimeType,
            contentLength: input.bytes.length,
          }
        );
        if (
          metadata.contentLength !== input.bytes.length ||
          metadata.contentType !== input.mimeType
        )
          throw new BadRequest(
            'Project Blob storage did not preserve its evidence'
          );
      }
    );
  }

  async read(input: ProjectActor & { key: string }) {
    const blob = await this.models.projectResource.getBlob(input);
    const stored = await this.runtime.getObject(
      'blob',
      this.objectKey(input.projectId, blob.key)
    );
    if (!stored.body)
      throw new BadRequest('Project Blob bytes are unavailable');
    if (
      stored.metadata?.contentLength !== blob.byteSize ||
      stored.metadata.contentType !== blob.mimeType
    ) {
      stored.body.destroy();
      throw new BadRequest('Project Blob metadata does not match');
    }
    const bytes = await readBufferWithLimit(
      stored.body,
      PROJECT_BLOB_MAX_BYTES
    );
    if (
      bytes.length !== blob.byteSize ||
      createHash('sha256').update(bytes).digest('hex') !== blob.fingerprint
    )
      throw new BadRequest('Project Blob content does not match');
    await this.models.projectResource.assertMember(input);
    return { blob, bytes };
  }

  private objectKey(projectId: string, key: string) {
    // An explicit namespace prevents collisions with Workspace Blob paths.
    return `projects/${encodeURIComponent(projectId)}/${key}`;
  }
}

@Injectable()
export class ProjectResourceService {
  constructor(
    private readonly models: Models,
    private readonly blobs: ProjectBlobStorage,
    private readonly events: EventBus
  ) {}

  async createDocument(
    input: ProjectActor & {
      title: string;
      markdown: string;
      parentId?: string | null;
      requestKey: string;
      kind?: 'page' | 'edgeless';
      origin?: 'user' | 'ai';
      sourceSessionId?: string;
    }
  ) {
    await this.models.projectResource.assertMember(input);
    if (Buffer.byteLength(input.markdown) > 1024 * 1024)
      throw new BadRequest('Project document content exceeds its bounds');
    const kind = input.kind ?? 'page';
    const requestHash = projectResourceHash({
      kind,
      title: input.title,
      markdown: input.markdown,
      parentId: input.parentId ?? null,
      origin: input.origin ?? 'user',
    });
    const previous = await this.withWriteSources(input, () =>
      this.models.projectResource.findCreation({
        ...input,
        requestHash,
      })
    );
    if (previous) return previous;
    const resourceId = randomUUID();
    const bytes = Buffer.from(
      createDocWithMarkdown(input.title, input.markdown, resourceId)
    );
    const resource = await this.withWriteSources(input, async () => {
      const blob = await this.blobs.put({
        ...input,
        bytes,
        mimeType: 'application/vnd.localmind.yjs',
      });
      return this.models.projectResource.create({
        ...input,
        kind,
        resourceId,
        blobKey: blob.key,
        searchText: parseYDocToMarkdown(bytes, resourceId, true).markdown.slice(
          0,
          250000
        ),
        requestHash,
      });
    });
    this.changed(resource.projectId, resource.id);
    return resource;
  }

  async readDocument(
    input: ProjectActor & { resourceId: string; sequence?: number }
  ) {
    const resource = await this.models.projectResource.get(input);
    if (resource.kind !== 'page' && resource.kind !== 'edgeless')
      throw new BadRequest('This Project resource requires its native editor');
    const revision = await this.models.projectResource.revision(input);
    const { bytes } = await this.blobs.read({
      ...input,
      key: revision.blobKey,
    });
    await this.models.projectResource.get(input);
    return { resource, revision, bytes };
  }

  async createFile(
    input: ProjectActor & {
      title: string;
      blobKey: string;
      parentId?: string | null;
      requestKey: string;
    }
  ) {
    return this.models.projectResource.withMember(
      input,
      async () => {
        await this.models.projectResource.getBlob({
          ...input,
          key: input.blobKey,
        });
        const file = await this.models.projectResource.create({
          ...input,
          kind: 'file',
        });
        this.changed(file.projectId, file.id);
        return file;
      },
      true
    );
  }

  async readFile(input: ProjectActor & { resourceId: string }) {
    const resource = await this.models.projectResource.get(input);
    if (resource.kind !== 'file') throw new BadRequest('Choose a Project file');
    const revision = await this.models.projectResource.revision(input);
    const stored = await this.blobs.read({ ...input, key: revision.blobKey });
    await this.models.projectResource.get(input);
    return { ...stored, resource, revision };
  }

  async saveDocument(
    input: ProjectActor & {
      resourceId: string;
      bytes: Buffer;
      expectedContentVersion: number;
      requestKey: string;
      origin?: 'user' | 'ai';
      sourceSessionId?: string;
      requestHash?: string;
    }
  ) {
    return this.withWriteSources(input, async () => {
      const resource = await this.models.projectResource.get(input);
      if (resource.kind !== 'page' && resource.kind !== 'edgeless')
        throw new BadRequest(
          'This Project resource requires its native editor'
        );
      const inspected = inspectDocumentCopySnapshot(input.bytes);
      const requestHash =
        input.requestHash ??
        projectResourceHash({
          snapshot: createHash('sha256').update(inspected.binary).digest('hex'),
          expectedContentVersion: input.expectedContentVersion,
          origin: input.origin ?? 'user',
        });
      const previous = await this.models.projectResource.findRevisionRequest({
        ...input,
        requestHash,
      });
      if (previous) return previous;
      const parsed = parseYDocFromBinary(inspected.binary, resource.id);
      for (const id of new Set(
        parsed.blocks.flatMap(block => block.refDocId ?? [])
      )) {
        await this.models.projectResource.get({ ...input, resourceId: id });
      }
      for (const key of inspected.blobIds)
        await this.models.projectResource.getBlob({ ...input, key });
      const blob = await this.blobs.put({
        ...input,
        bytes: inspected.binary,
        mimeType: 'application/vnd.localmind.yjs',
      });
      const revision = await this.models.projectResource.appendRevision({
        ...input,
        blobKey: blob.key,
        origin: input.origin ?? 'user',
        requestHash,
        attachmentKeys: inspected.blobIds,
        searchText: parseYDocToMarkdown(
          inspected.binary,
          resource.id,
          true
        ).markdown.slice(0, 250000),
      });
      if (parsed.title && parsed.title !== resource.title)
        await this.models.projectResource.change({
          ...input,
          expectedVersion: resource.version,
          title: parsed.title,
        });
      this.changed(input.projectId, input.resourceId);
      return revision;
    });
  }

  async updateMarkdown(
    input: ProjectActor & {
      resourceId: string;
      markdown: string;
      expectedContentVersion: number;
      requestKey: string;
      origin: 'user' | 'ai';
      sourceSessionId?: string;
      readContentVersion?: number;
    }
  ) {
    if (Buffer.byteLength(input.markdown) > 1024 * 1024)
      throw new BadRequest('Project document content exceeds its bounds');
    const requestHash = projectResourceHash({
      markdown: input.markdown,
      expectedContentVersion: input.expectedContentVersion,
      origin: input.origin,
    });
    const previous = await this.withWriteSources(input, () =>
      this.models.projectResource.findRevisionRequest({ ...input, requestHash })
    );
    if (previous) return previous;
    if (
      input.origin === 'ai' &&
      input.readContentVersion !== input.expectedContentVersion
    )
      throw new BadRequest('Read the current Project document before editing.');
    const current = await this.readDocument(input);
    if (current.revision.sequence !== input.expectedContentVersion)
      throw new BadRequest(
        'Project content changed; reload and compare before saving'
      );
    const delta = updateDocWithMarkdown(
      current.bytes,
      input.markdown,
      input.resourceId
    );
    const doc = new Doc();
    try {
      applyUpdate(doc, current.bytes);
      applyUpdate(doc, delta);
      return await this.saveDocument({
        ...input,
        bytes: Buffer.from(encodeStateAsUpdate(doc)),
        requestHash,
      });
    } finally {
      doc.destroy();
    }
  }

  @Transactional()
  async createFolder(
    input: ProjectActor & {
      parentId?: string | null;
      title: string;
      requestKey: string;
      origin?: 'user' | 'ai';
      sourceSessionId?: string;
    }
  ) {
    const folder = await this.withWriteSources(input, () =>
      this.models.projectResource.create({ ...input, kind: 'folder' })
    );
    this.changed(folder.projectId, folder.id);
    return folder;
  }

  async change(
    input: Parameters<Models['projectResource']['change']>[0] & {
      origin?: 'user' | 'ai';
      sourceSessionId?: string;
    }
  ) {
    return this.withWriteSources(input, async () => {
      const previous =
        await this.models.projectResource.findChangeRequest(input);
      if (previous) return previous;
      const node = await this.models.projectResource.get({
        ...input,
        includeTrash: input.trash === false,
      });
      if (
        input.title &&
        input.title !== node.title &&
        (node.kind === 'page' || node.kind === 'edgeless')
      ) {
        const current = await this.readDocument(input);
        const bytes = retitleDocumentCopySnapshot(
          current.bytes,
          input.title,
          node.id
        );
        const blob = await this.blobs.put({
          ...input,
          bytes,
          mimeType: 'application/vnd.localmind.yjs',
        });
        await this.models.projectResource.appendRevision({
          ...input,
          blobKey: blob.key,
          expectedContentVersion: current.revision.sequence,
          requestKey: `rename:${projectResourceHash(input.requestKey ?? randomUUID())}`,
          origin: input.origin ?? 'user',
          attachmentKeys: inspectDocumentCopySnapshot(bytes).blobIds,
          searchText: parseYDocToMarkdown(bytes, node.id, true).markdown.slice(
            0,
            250000
          ),
        });
      }
      const changed = await this.models.projectResource.change(input);
      this.changed(changed.projectId, changed.id);
      return changed;
    });
  }

  private async withWriteSources<T>(
    input: ProjectActor & { origin?: 'user' | 'ai'; sourceSessionId?: string },
    execute: () => Promise<T>
  ) {
    if (input.origin === 'ai') {
      if (!input.sourceSessionId)
        throw new BadRequest(
          'Project AI writes require their source conversation'
        );
      return this.models.copilotContext.withProjectSourcesShared(
        {
          ...input,
          sessionId: input.sourceSessionId,
          sink: {
            type: 'tool_write',
            projectId: input.projectId,
            id: input.projectId,
            phase: 'execute',
          },
        },
        execute
      );
    }
    return this.models.projectResource.withMember(input, execute, true);
  }

  private changed(projectId: string, resourceId: string) {
    this.events.emitDetached('project.resource.changed', {
      projectId,
      resourceId,
    });
  }
}

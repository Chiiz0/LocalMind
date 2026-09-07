import { Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';

import type { PutObjectMetadata } from '../../base';
import type { OfficeOwner } from '../../models/office-owner';
import { ProjectBlobStorage } from '../project';
import { WorkspaceBlobStorage } from '../storage';

@Injectable()
export class OfficeResourceStorage {
  constructor(
    private readonly workspaces: WorkspaceBlobStorage,
    private readonly projects: ProjectBlobStorage
  ) {}

  async get(owner: OfficeOwner, actorId: string, key: string) {
    if (typeof owner === 'string') return this.workspaces.get(owner, key);
    const { bytes, blob } = await this.projects.read({
      projectId: owner.projectId,
      actorId,
      key,
    });
    return {
      body: Readable.from(bytes),
      metadata: {
        contentType: blob.mimeType,
        contentLength: blob.byteSize,
        lastModified: blob.createdAt,
      },
    };
  }

  async put(
    owner: OfficeOwner,
    actorId: string,
    key: string,
    bytes: Buffer,
    metadata: PutObjectMetadata
  ) {
    if (typeof owner === 'string') {
      await this.workspaces.put(owner, key, bytes, metadata);
      return key;
    }
    const blob = await this.projects.put({
      projectId: owner.projectId,
      actorId,
      bytes,
      mimeType: metadata.contentType ?? 'application/octet-stream',
    });
    return blob.key;
  }
}

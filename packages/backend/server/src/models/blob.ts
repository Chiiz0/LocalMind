import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';

import { BlobInvalid } from '../base';
import { BaseModel } from './base';

export const COPILOT_COPY_BLOB_PREFIX = 'ai-copy-';

export function copyAttachmentDocumentId(key: string) {
  if (key.length > 256) return null;
  return (
    /^ai-copy-([A-Za-z0-9_-]{1,128})-[A-Za-z0-9_-]{43}$/.exec(key)?.[1] ?? null
  );
}

export type CreateBlobInput = Prisma.BlobUncheckedCreateInput;

/**
 * Blob Model
 */
@Injectable()
export class BlobModel extends BaseModel {
  assertMutableUploadKey(key: string) {
    if (key.startsWith(COPILOT_COPY_BLOB_PREFIX))
      throw new BlobInvalid(
        'Copy attachments can only be published by their document operation'
      );
  }

  @Transactional()
  async reserveCopyUpload(input: {
    workspaceId: string;
    key: string;
    uploadId: string;
    size: number;
    mime: string;
  }) {
    if (
      !input.key.startsWith(COPILOT_COPY_BLOB_PREFIX) ||
      input.key.length > 256 ||
      !input.uploadId ||
      input.uploadId.length > 128
    )
      throw new BlobInvalid('Invalid copy attachment reservation');
    await this.db.blob.createMany({
      data: [{ ...input, status: 'pending' }],
      skipDuplicates: true,
    });
    const existing = await this.get(input.workspaceId, input.key);
    if (
      !existing ||
      existing.deletedAt ||
      existing.size !== input.size ||
      existing.mime !== input.mime ||
      (existing.status !== 'completed' &&
        (existing.status !== 'pending' || existing.uploadId !== input.uploadId))
    )
      throw new BlobInvalid(
        'Copy attachment reservation conflicts with stored data'
      );
    return existing.status !== 'completed';
  }

  @Transactional()
  async publishCopyUpload(
    input: {
      workspaceId: string;
      key: string;
      uploadId: string;
      size: number;
      mime: string;
    },
    authorize: () => Promise<void>,
    invalidateQuota = true
  ) {
    await authorize();
    const updated = await this.db.blob.updateMany({
      where: {
        workspaceId: input.workspaceId,
        key: input.key,
        uploadId: input.uploadId,
        size: input.size,
        mime: input.mime,
        deletedAt: null,
        status: 'pending',
      },
      data: { status: 'completed', uploadId: null },
    });
    if (!updated.count) {
      const existing = await this.get(input.workspaceId, input.key);
      if (
        !existing ||
        existing.status !== 'completed' ||
        existing.deletedAt ||
        existing.size !== input.size ||
        existing.mime !== input.mime
      )
        throw new BlobInvalid(
          'Copy attachment reservation is no longer active'
        );
    }
    if (invalidateQuota) await this.markQuotaStateStale(input.workspaceId);
  }

  async upsert(blob: CreateBlobInput) {
    this.assertMutableUploadKey(blob.key);
    const result = await this.db.blob.upsert({
      where: {
        workspaceId_key: {
          workspaceId: blob.workspaceId,
          key: blob.key,
        },
      },
      update: {
        mime: blob.mime,
        size: blob.size,
        status: blob.status,
        uploadId: blob.uploadId,
      },
      create: {
        workspaceId: blob.workspaceId,
        key: blob.key,
        mime: blob.mime,
        size: blob.size,
        status: blob.status,
        uploadId: blob.uploadId,
      },
    });
    await this.markQuotaStateStale(blob.workspaceId);
    return result;
  }

  @Transactional()
  async delete(workspaceId: string, key: string, permanently = false) {
    await this.lockForDelete(workspaceId, key);
    if (permanently) {
      await this.db.blob.deleteMany({
        where: {
          workspaceId,
          key,
        },
      });
      await this.markQuotaStateStale(workspaceId);
      this.logger.log(`deleted blob ${workspaceId}/${key} permanently`);
      return;
    }

    await this.db.blob.update({
      where: {
        workspaceId_key: {
          workspaceId,
          key,
        },
      },
      data: {
        deletedAt: new Date(),
      },
    });
    await this.markQuotaStateStale(workspaceId);
  }

  async lockForDelete(workspaceId: string, key: string) {
    await this.db.$queryRaw<Array<{ key: string }>>`
      SELECT "key"
      FROM "blobs"
      WHERE "workspace_id" = ${workspaceId}
        AND "key" = ${key}
      FOR UPDATE
    `;
    const [reference] = await this.db.$queryRaw<Array<{ referenced: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "office_artifacts"
        WHERE "workspace_id" = ${workspaceId}
          AND "source_blob_key" = ${key}
        UNION ALL
        SELECT 1
        FROM "office_revisions"
        WHERE "workspace_id" = ${workspaceId}
          AND (
            "package_blob_key" = ${key} OR
            "state_blob_key" = ${key}
          )
        UNION ALL
        SELECT 1
        FROM "office_command_requests"
        WHERE "workspace_id" = ${workspaceId}
          AND "command_blob_key" = ${key}
      ) AS "referenced"
    `;
    if (reference?.referenced) {
      throw new Error(`Office blob is still referenced: ${workspaceId}/${key}`);
    }
  }

  async get(workspaceId: string, key: string) {
    return await this.db.blob.findUnique({
      where: {
        workspaceId_key: {
          workspaceId,
          key,
        },
      },
    });
  }

  async restore(workspaceId: string, key: string) {
    const restored = await this.db.blob.updateMany({
      where: { workspaceId, key, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (restored.count) {
      await this.markQuotaStateStale(workspaceId);
    }
    return restored.count > 0;
  }

  async list(
    workspaceId: string,
    options?: { where: Prisma.BlobWhereInput; select?: Prisma.BlobSelect }
  ) {
    return await this.db.blob.findMany({
      where: {
        ...options?.where,
        workspaceId,
        deletedAt: null,
        status: 'completed',
      },
      select: options?.select,
    });
  }

  async hasAny(workspaceId: string) {
    const count = await this.db.blob.count({
      where: {
        workspaceId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async totalSize(workspaceId: string) {
    const sum = await this.db.blob.aggregate({
      where: {
        workspaceId,
        deletedAt: null,
      },
      _sum: {
        size: true,
      },
    });

    return sum._sum.size ?? 0;
  }

  async markQuotaStateStale(workspaceId: string) {
    await this.db.effectiveWorkspaceQuotaState.updateMany({
      where: { workspaceId },
      data: { stale: true },
    });
  }
}

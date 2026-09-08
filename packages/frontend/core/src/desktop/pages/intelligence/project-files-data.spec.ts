/** @vitest-environment happy-dom */
import type { GraphQLService } from '@affine/core/modules/cloud';
import { NATIVE_OFFICE_FORMATS } from '@affine/core/modules/office/client';
import {
  importProjectOfficeMutation,
  uploadProjectBlobMutation,
} from '@affine/graphql';
import { expect, test, vi } from 'vitest';

vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@affine/core/modules/project-resources/realtime', () => ({
  useProjectRefresh: vi.fn(),
}));

import { uploadProjectFile } from './project-files-data';

test.each(Object.entries(NATIVE_OFFICE_FORMATS))(
  'Office %s uploads normalize missing or generic browser MIME before storing bytes',
  async (format, policy) => {
    for (const type of ['', 'application/octet-stream']) {
      const file = new File(['original bytes'], `sample.${format}`, {
        type,
        lastModified: 1234,
      });
      const gql = vi.fn(async ({ query }) =>
        query === uploadProjectBlobMutation
          ? { uploadProjectBlob: 'blob' }
          : { importProjectOffice: { artifact: { id: 'office' } } }
      );
      const uploadBlob = vi.fn(async (uploaded: File) => {
        expect(uploaded.name).toBe(file.name);
        expect(uploaded.type).toBe(policy.mimeType);
        expect(uploaded.lastModified).toBe(1234);
        expect(await uploaded.text()).toBe('original bytes');
        return 'blob';
      });
      const input = {
        projectId: 'project',
        parentId: 'folder',
        file,
        requestKey: 'upload',
      };
      await expect(
        uploadProjectFile({ gql } as unknown as GraphQLService, {
          ...input,
          uploadBlob,
        })
      ).resolves.toBe('office');
      expect(uploadBlob).toHaveBeenCalledOnce();
      expect(gql).toHaveBeenCalledWith(
        expect.objectContaining({
          query: importProjectOfficeMutation,
          variables: {
            input: {
              projectId: 'project',
              parentId: 'folder',
              sourceBlobKey: 'blob',
              sourceFileName: file.name,
              title: 'sample',
              idempotencyKey: 'upload',
            },
          },
        })
      );
      await uploadProjectFile({ gql } as unknown as GraphQLService, input);
      expect(gql).toHaveBeenCalledWith(
        expect.objectContaining({
          query: uploadProjectBlobMutation,
          variables: {
            projectId: 'project',
            file: expect.objectContaining({ type: policy.mimeType }),
          },
        })
      );
    }
  }
);

import { GraphQLService } from '@affine/core/modules/cloud';
import { officeFormatForFileName } from '@affine/core/modules/office/client';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import {
  createProjectFileMutation,
  importProjectOfficeMutation,
  type ProjectResourceFieldsFragment,
  projectResourcesQuery,
  uploadProjectBlobMutation,
} from '@affine/graphql';
import { useService } from '@toeverything/infra';
import useSWRInfinite from 'swr/infinite';

export type ProjectFile = ProjectResourceFieldsFragment;

export function useProjectFolder(input: {
  projectId: string;
  parentId: string | null;
  trash?: boolean;
  search?: string;
}) {
  const graphql = useService(GraphQLService);
  const query = useSWRInfinite(
    (index, previous: { nextCursor: string | null } | null) =>
      index && !previous?.nextCursor
        ? null
        : ([
            projectResourcesQuery.id,
            input.projectId,
            input.parentId,
            !!input.trash,
            input.search ?? '',
            previous?.nextCursor ?? null,
          ] as const),
    async ([, projectId, parentId, trash, search, cursor]) => {
      const response = await graphql.gql({
        query: projectResourcesQuery,
        variables: { projectId, parentId, trash, search, cursor, limit: 50 },
      });
      return response.projectResources;
    },
    { suspense: false, shouldRetryOnError: false }
  );
  const { mutate } = query;
  useProjectRefresh(input.projectId, 'resource', mutate);
  return {
    ...query,
    // SWR retains the error for the inline state; retries must not reject into
    // the click handler when the server is still unavailable.
    retry: () => mutate().catch(() => undefined),
    items: query.error ? [] : (query.data?.flatMap(page => page.items) ?? []),
    hasMore: !!query.data?.at(-1)?.nextCursor,
    loadingMore:
      query.isLoading || !!(query.data && !query.data[query.size - 1]),
    loadMore: () => query.setSize(size => size + 1),
  };
}

export async function uploadProjectFile(
  graphql: GraphQLService,
  input: {
    projectId: string;
    parentId: string | null;
    file: File;
    requestKey: string;
    uploadBlob?: (file: File) => Promise<string>;
    onUploaded?: () => void;
    signal?: AbortSignal;
  }
) {
  const office = /\.(docx|xlsx|pptx|pdf)$/i.test(input.file.name)
    ? officeFormatForFileName(input.file.name)
    : null;
  const file =
    office && input.file.type !== office.mimeType
      ? new File([input.file], input.file.name, {
          type: office.mimeType,
          lastModified: input.file.lastModified,
        })
      : input.file;
  const blobKey = input.uploadBlob
    ? await input.uploadBlob(file)
    : (
        await graphql.gql({
          query: uploadProjectBlobMutation,
          variables: { projectId: input.projectId, file },
          signal: input.signal,
        })
      ).uploadProjectBlob;
  input.signal?.throwIfAborted();
  input.onUploaded?.();
  if (office) {
    const imported = await graphql.gql({
      query: importProjectOfficeMutation,
      signal: input.signal,
      variables: {
        input: {
          projectId: input.projectId,
          parentId: input.parentId,
          sourceBlobKey: blobKey,
          sourceFileName: input.file.name,
          title: input.file.name.replace(/\.[^.]+$/, ''),
          idempotencyKey: input.requestKey,
        },
      },
    });
    return imported.importProjectOffice.artifact.id;
  }
  const result = await graphql.gql({
    query: createProjectFileMutation,
    signal: input.signal,
    variables: {
      input: {
        projectId: input.projectId,
        parentId: input.parentId,
        blobKey,
        title: input.file.name,
        requestKey: input.requestKey,
      },
    },
  });
  return result.createProjectFile.id;
}

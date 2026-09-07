import { GraphQLService } from '@affine/core/modules/cloud';
import {
  createProjectFileMutation,
  importProjectOfficeMutation,
  type ProjectResourceFieldsFragment,
  projectResourcesQuery,
  uploadProjectBlobMutation,
} from '@affine/graphql';
import { useService } from '@toeverything/infra';
import { useEffect } from 'react';
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
    { suspense: false, shouldRetryOnError: false, refreshInterval: 15000 }
  );
  const { mutate } = query;
  useEffect(() => {
    const listener = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === input.projectId)
        mutate().catch(console.error);
    };
    window.addEventListener('localmind:project-files-changed', listener);
    return () =>
      window.removeEventListener('localmind:project-files-changed', listener);
  }, [input.projectId, mutate]);
  return {
    ...query,
    items: query.error ? [] : (query.data?.flatMap(page => page.items) ?? []),
    hasMore: !!query.data?.at(-1)?.nextCursor,
    loadingMore:
      query.isLoading || !!(query.data && !query.data[query.size - 1]),
    loadMore: () => query.setSize(size => size + 1),
  };
}

export function projectFilesChanged(projectId: string) {
  window.dispatchEvent(
    new CustomEvent('localmind:project-files-changed', { detail: projectId })
  );
}

export async function uploadProjectFile(
  graphql: GraphQLService,
  input: {
    projectId: string;
    parentId: string | null;
    file: File;
    requestKey: string;
  }
) {
  const uploaded = await graphql.gql({
    query: uploadProjectBlobMutation,
    variables: { projectId: input.projectId, file: input.file },
  });
  if (/\.(docx|xlsx|pptx|pdf)$/i.test(input.file.name)) {
    const imported = await graphql.gql({
      query: importProjectOfficeMutation,
      variables: {
        input: {
          projectId: input.projectId,
          parentId: input.parentId,
          sourceBlobKey: uploaded.uploadProjectBlob,
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
    variables: {
      input: {
        projectId: input.projectId,
        parentId: input.parentId,
        blobKey: uploaded.uploadProjectBlob,
        title: input.file.name,
        requestKey: input.requestKey,
      },
    },
  });
  return result.createProjectFile.id;
}

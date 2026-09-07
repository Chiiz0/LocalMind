/**
 * @vitest-environment happy-dom
 */
import { projectAiModelQuery } from '@affine/graphql';
import { Framework } from '@toeverything/infra';
import { afterEach, expect, test, vi } from 'vitest';

import { GraphQLService } from '../../cloud';
import { ProjectAIModel } from './project-model';

const entities: ProjectAIModel[] = [];
const create = (
  gql = vi.fn().mockResolvedValue({
    projectAiModel: {
      configured: true,
      modelId: 'global-model',
      provider: 'openai',
    },
  }),
  projectId: string | null = 'project-a'
) => {
  const framework = new Framework();
  framework
    .service(GraphQLService, { gql } as unknown as GraphQLService)
    .entity(ProjectAIModel, [GraphQLService]);
  const entity = framework
    .provider()
    .createEntity(ProjectAIModel, { projectId });
  entities.push(entity);
  return { entity, gql };
};
afterEach(() => {
  entities.splice(0).forEach(entity => entity.dispose());
  vi.useRealTimers();
});

test('project model selection has no workspace or saved user preference', async () => {
  const { entity, gql } = create();
  await vi.waitFor(() => expect(entity.modelId.value).toBe('global-model'));
  entity.setWorkspaceId('different-workspace');
  entity.setModel('user-preferred-model');
  expect(entity.modelId.value).toBe('global-model');
  expect(gql).toHaveBeenCalledWith({
    query: projectAiModelQuery,
    variables: { projectId: 'project-a' },
  });
  expect(entity.models.value.map(model => model.id)).toEqual(['global-model']);
});

test('refresh clears disabled global configuration and respects disposal', async () => {
  vi.useFakeTimers();
  const { entity, gql } = create();
  await vi.advanceTimersByTimeAsync(0);
  expect(entity.modelId.value).toBe('global-model');
  gql.mockResolvedValue({
    projectAiModel: { configured: false, modelId: null, provider: null },
  });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(entity.models.value).toEqual([]);
  expect(entity.modelId.value).toBeUndefined();
  entity.dispose();
  gql.mockClear();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(gql).not.toHaveBeenCalled();
});

test('no active project or lost membership leaves no selectable model', async () => {
  const empty = create(vi.fn(), null);
  expect(empty.gql).not.toHaveBeenCalled();
  const denied = create(
    vi.fn().mockRejectedValue(new Error('membership revoked'))
  );
  await vi.waitFor(() => expect(denied.gql).toHaveBeenCalled());
  expect(denied.entity.models.value).toEqual([]);
  expect(denied.entity.modelId.value).toBeUndefined();
});

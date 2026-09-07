/**
 * @vitest-environment happy-dom
 */
import { searchProjectResourcesQuery } from '@affine/graphql';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  gql: vi.fn(),
  service: { enabled: false, setEnabled: vi.fn() },
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@affine/core/modules/ai-button/services/reasoning', () => ({
  AIReasoningService: class {},
}));
vi.mock('@toeverything/infra', () => ({
  useService: () => Object.assign(state.service, { gql: state.gql }),
}));
vi.mock('@affine/i18n', () => ({ I18n: { t: (key: string) => key } }));
vi.mock('@blocksuite/icons/lit', () => ({
  ArrowLeftSmallIcon: () => '',
  ArrowRightSmallIcon: () => '',
  PageIcon: () => '',
}));

import { useProjectChatConfig } from './project-chat-config';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

test('resource search remains available after StrictMode effect replay', async () => {
  state.gql.mockResolvedValue({
    searchProjectResources: { items: [], nextCursor: null },
  });
  const { result } = renderHook(() => useProjectChatConfig('project-a'), {
    wrapper: StrictMode,
  });
  const group = result.current.searchMenuConfig.getDocMenuGroup(
    'report',
    vi.fn(),
    new AbortController().signal
  );
  await waitFor(() => expect(state.gql).toHaveBeenCalledOnce());
  const request = state.gql.mock.calls[0][0];
  expect(request.query).toBe(searchProjectResourcesQuery);
  expect(request.variables.projectId).toBe('project-a');
  expect(request.signal.aborted).toBe(false);
  await waitFor(() => expect(group.loading).toHaveProperty('value', false));
});

test('switching projects aborts pending search and ignores its late response', async () => {
  let resolve!: (value: unknown) => void;
  state.gql.mockImplementationOnce(
    () =>
      new Promise(value => {
        resolve = value;
      })
  );
  const { result, rerender } = renderHook(
    ({ projectId }) => useProjectChatConfig(projectId),
    { initialProps: { projectId: 'project-a' }, wrapper: StrictMode }
  );
  const stale = result.current.searchMenuConfig.getDocMenuGroup(
    '',
    vi.fn(),
    new AbortController().signal
  );
  const request = state.gql.mock.calls[0][0];
  rerender({ projectId: 'project-b' });
  expect(request.signal.aborted).toBe(true);
  resolve({
    searchProjectResources: {
      items: [
        { id: 'private-a', title: 'Private A', contentVersion: 1, path: [] },
      ],
      nextCursor: null,
    },
  });
  await waitFor(() => expect(stale.loading).toHaveProperty('value', false));
  expect(stale.items).toHaveProperty('value', []);
  state.gql.mockResolvedValueOnce({
    searchProjectResources: { items: [], nextCursor: null },
  });
  result.current.searchMenuConfig.getDocMenuGroup(
    '',
    vi.fn(),
    new AbortController().signal
  );
  expect(state.gql.mock.calls[1][0].variables.projectId).toBe('project-b');
  expect(state.gql.mock.calls[1][0].signal.aborted).toBe(false);
});

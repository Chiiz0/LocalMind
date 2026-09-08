/**
 * @vitest-environment happy-dom
 */
import { projectResourceQuery } from '@affine/graphql';
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

test('document choice opens the tree without a query or mutation', () => {
  const open = vi.fn();
  const { result } = renderHook(() => useProjectChatConfig('project-a', open), {
    wrapper: StrictMode,
  });
  result.current.searchMenuConfig.selectDocuments.open();
  expect(open).toHaveBeenCalledOnce();
  expect(state.gql).not.toHaveBeenCalled();
});

test('resource titles remain available after StrictMode effect replay', async () => {
  state.gql.mockResolvedValue({
    projectResource: { id: 'report', title: 'Report' },
  });
  const { result } = renderHook(
    () => useProjectChatConfig('project-a', vi.fn()),
    {
      wrapper: StrictMode,
    }
  );
  const title = result.current.docDisplayConfig.getTitleSignal('report');
  await waitFor(() => expect(state.gql).toHaveBeenCalledOnce());
  const request = state.gql.mock.calls[0][0];
  expect(request.query).toBe(projectResourceQuery);
  expect(request.variables.projectId).toBe('project-a');
  expect(request.signal.aborted).toBe(false);
  await waitFor(() => expect(title.signal.value).toBe('Report'));
});

test('switching projects aborts pending title reads and ignores late responses', async () => {
  let resolve!: (value: unknown) => void;
  state.gql.mockImplementationOnce(
    () =>
      new Promise(value => {
        resolve = value;
      })
  );
  const { result, rerender } = renderHook(
    ({ projectId }) => useProjectChatConfig(projectId, vi.fn()),
    { initialProps: { projectId: 'project-a' }, wrapper: StrictMode }
  );
  const stale = result.current.docDisplayConfig.getTitleSignal('private-a');
  const request = state.gql.mock.calls[0][0];
  rerender({ projectId: 'project-b' });
  expect(request.signal.aborted).toBe(true);
  resolve({
    projectResource: { id: 'private-a', title: 'Private A' },
  });
  await Promise.resolve();
  expect(stale.signal.value).toBe('');
  state.gql.mockResolvedValueOnce({
    projectResource: { id: 'public-b', title: 'Report B' },
  });
  result.current.docDisplayConfig.getTitleSignal('public-b');
  expect(state.gql.mock.calls[1][0].variables.projectId).toBe('project-b');
  expect(state.gql.mock.calls[1][0].signal.aborted).toBe(false);
});

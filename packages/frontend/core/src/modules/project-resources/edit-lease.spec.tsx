/** @vitest-environment happy-dom */
import {
  acquireProjectResourceEditLeaseMutation,
  projectResourceEditLeaseQuery,
} from '@affine/graphql';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  service: { gql: vi.fn() },
  success: vi.fn(),
  error: vi.fn(),
  refresh: undefined as undefined | (() => Promise<void>),
}));
vi.mock('../cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({ useService: () => state.service }));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/component', () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  notify: { success: state.success, error: state.error },
}));
vi.mock('./realtime', () => ({
  useProjectRefresh: (
    _project: string,
    _topic: string,
    callback: () => Promise<void>
  ) => {
    if (_topic === 'lease') state.refresh = callback;
  },
}));

import {
  ProjectResourceEditLeaseProvider,
  useProjectEditLease,
} from './edit-lease';

function Editor() {
  return <input aria-label="Editor" readOnly={!useProjectEditLease()?.proof} />;
}
const held = (kind = 'user') => ({
  resourceId: 'document',
  projectId: 'project',
  kind,
  holderName: 'Other editor',
  owned: false,
  leaseId: null,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
});
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

test('subscribed readers receive one release notification without silently entering edit mode', async () => {
  let lease: ReturnType<typeof held> | null = held();
  state.service.gql.mockImplementation(async ({ query }) =>
    query === acquireProjectResourceEditLeaseMutation
      ? { acquireProjectResourceEditLease: { acquired: false, lease } }
      : { projectResourceEditLease: lease }
  );
  render(
    <ProjectResourceEditLeaseProvider
      projectId="project"
      resourceId="reader-document"
    >
      <Editor />
    </ProjectResourceEditLeaseProvider>
  );
  const watch = await screen.findByRole('checkbox');
  fireEvent.click(watch);
  lease = null;
  await act(async () => {
    await state.refresh?.();
  });
  await waitFor(() => expect(state.success).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Editor')).toHaveProperty('readOnly', true);
  await act(async () => {
    await state.refresh?.();
  });
  expect(state.success).toHaveBeenCalledOnce();
  expect(
    state.service.gql.mock.calls.filter(
      ([request]) => request.query === acquireProjectResourceEditLeaseMutation
    )
  ).toHaveLength(1);
});

test('AI release reacquires authority through the server before restoring editing', async () => {
  let finished = false;
  state.service.gql.mockImplementation(async ({ query }) => {
    if (query === projectResourceEditLeaseQuery)
      return { projectResourceEditLease: null };
    if (query === acquireProjectResourceEditLeaseMutation)
      return {
        acquireProjectResourceEditLease: {
          acquired: finished,
          lease: finished
            ? { ...held(), owned: true, leaseId: 'new-authority' }
            : held('ai_task'),
        },
      };
    return { releaseProjectResourceEditLease: true };
  });
  render(
    <ProjectResourceEditLeaseProvider
      projectId="project"
      resourceId="ai-document"
    >
      <Editor />
    </ProjectResourceEditLeaseProvider>
  );
  await screen.findByRole('checkbox');
  expect(screen.getByLabelText('Editor')).toHaveProperty('readOnly', true);
  finished = true;
  await act(async () => {
    await state.refresh?.();
  });
  await waitFor(() =>
    expect(screen.getByLabelText('Editor')).toHaveProperty('readOnly', false)
  );
  expect(
    state.service.gql.mock.calls.filter(
      ([request]) => request.query === acquireProjectResourceEditLeaseMutation
    )
  ).toHaveLength(2);
});

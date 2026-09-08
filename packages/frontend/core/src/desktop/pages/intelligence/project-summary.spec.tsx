/** @vitest-environment happy-dom */
import { copilotContextMemoryCreateMutation } from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  gql: vi.fn(),
  mutate: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({ gql: state.gql }),
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/core/modules/project-resources/realtime', () => ({
  useProjectRefresh: vi.fn(),
}));
vi.mock('@affine/component', () => ({
  Button: ({
    loading: _loading,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button {...props} />
  ),
  IconButton: ({
    icon: _icon,
    size: _size,
    tooltip: _tooltip,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactNode;
    size?: string;
    tooltip?: string;
  }) => <button {...props} />,
  Modal: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  Loading: () => <span>loading</span>,
  notify: { success: state.success },
}));
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: () => ({
    mutate: state.mutate,
    data: {
      currentUser: {
        copilot: {
          contextMemories: [
            {
              id: 'a',
              projectId: 'current',
              kind: 'project_summary',
              content: 'Current summary',
            },
            {
              id: 'b',
              projectId: 'other',
              kind: 'project_summary',
              content: 'Other summary',
            },
          ],
        },
      },
    },
  }),
}));

import { ProjectSummary } from './project-summary';
beforeEach(() => {
  vi.clearAllMocks();
  state.gql.mockResolvedValue({});
  state.mutate.mockResolvedValue(undefined);
});
afterEach(cleanup);

test('opening Summary performs no write and creation stays in the current Project with duplicate protection', async () => {
  render(<ProjectSummary projectId="current" projectName="Current project" />);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'com.affine.localmind.aiContext.projectSummary',
    })
  );
  expect(screen.getByText('Current summary')).toBeTruthy();
  expect(screen.queryByText('Other summary')).toBeNull();
  expect(state.gql).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '  Shared project summary  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(state.success).toHaveBeenCalledOnce());
  expect(state.gql).toHaveBeenCalledExactlyOnceWith({
    query: copilotContextMemoryCreateMutation,
    variables: {
      input: {
        projectId: 'current',
        scope: 'project',
        kind: 'project_summary',
        content: 'Shared project summary',
      },
    },
  });
  expect(screen.getByRole('textbox')).toHaveProperty('value', '');
});

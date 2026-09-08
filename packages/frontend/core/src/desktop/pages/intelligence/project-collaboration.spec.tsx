/**
 * @vitest-environment happy-dom
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
} from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ confirm: vi.fn() }));

vi.mock('@affine/component', () => ({
  Avatar: () => <span data-testid="avatar" />,
  Button: ({
    children,
    loading: _loading,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
  >) => <button {...props}>{children}</button>,
  Input: ({
    onChange,
    onEnter: _onEnter,
    ...props
  }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    onChange?: (value: string) => void;
    onEnter?: () => void;
  }) => (
    <input
      {...props}
      onChange={event => onChange?.(event.currentTarget.value)}
    />
  ),
  Modal: ({ children, open }: PropsWithChildren<{ open: boolean }>) =>
    open ? <div>{children}</div> : null,
  RadioGroup: () => <div data-testid="policy" />,
  useConfirmModal: () => ({ openConfirmModal: state.confirm }),
}));

vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_target, key) => () => String(key) }),
}));

import { ProjectCollaboration } from './project-collaboration';
import type { WorkbenchProject } from './types';

const project: WorkbenchProject = {
  id: 'project-1',
  createdByUserId: 'owner-1',
  name: 'Project',
  description: '',
  status: 'active',
  aiPolicy: 'read_only',
  role: 'owner',
  members: [
    {
      userId: 'owner-1',
      name: 'Owner',
      email: 'owner@example.com',
      avatarUrl: null,
      role: 'owner',
      createdAt: '2026-09-04T00:00:00.000Z',
    },
    {
      userId: 'member-1',
      name: 'Member',
      email: 'member@example.com',
      avatarUrl: null,
      role: 'member',
      createdAt: '2026-09-04T00:00:00.000Z',
    },
  ],
  canManage: true,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
};

const renderModal = (
  overrides: Partial<Parameters<typeof ProjectCollaboration>[0]> = {}
) => {
  const props: Parameters<typeof ProjectCollaboration>[0] = {
    open: true,
    project,
    pendingKey: null,
    onOpenChange: vi.fn(),
    onInvite: vi.fn().mockResolvedValue(true),
    onPolicyChange: vi.fn().mockResolvedValue(true),
    onRemoveMember: vi.fn().mockResolvedValue(true),
    onTransferOwnership: vi.fn().mockResolvedValue(true),
    onLeave: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  render(<ProjectCollaboration {...props} />);
  return props;
};

describe('ProjectCollaboration', () => {
  beforeEach(() => state.confirm.mockReset());
  afterEach(cleanup);

  test('requires confirmation before transferring ownership', async () => {
    const props = renderModal();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.project.transferOwnership',
      })
    );

    expect(props.onTransferOwnership).not.toHaveBeenCalled();
    const confirmation = state.confirm.mock.calls[0][0];
    await confirmation.onConfirm();
    expect(props.onTransferOwnership).toHaveBeenCalledWith(project.members[1]);
  });

  test('requires confirmation before removing a member and permits retry', async () => {
    const onRemoveMember = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    renderModal({ onRemoveMember });
    const remove = screen.getByRole('button', {
      name: 'com.affine.localmind.workbench.project.removeMember',
    });

    fireEvent.click(remove);
    expect(onRemoveMember).not.toHaveBeenCalled();
    await state.confirm.mock.calls[0][0].onConfirm();
    await waitFor(() =>
      expect(onRemoveMember).toHaveBeenCalledWith(project.members[1])
    );

    fireEvent.click(remove);
    expect(onRemoveMember).toHaveBeenCalledTimes(1);
    await state.confirm.mock.calls[1][0].onConfirm();
    await waitFor(() => expect(onRemoveMember).toHaveBeenCalledTimes(2));
  });

  test('keeps a failed invite value available for retry', async () => {
    const onInvite = vi.fn().mockResolvedValue(false);
    renderModal({ onInvite });
    const input = screen.getByPlaceholderText(
      'com.affine.localmind.workbench.project.invitePlaceholder'
    );
    fireEvent.change(input, { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith('person@example.com')
    );
    expect((input as HTMLInputElement).value).toBe('person@example.com');
  });

  test('renders collaboration as read-only for a non-owner', () => {
    renderModal({ project: { ...project, role: 'member', canManage: false } });
    expect(screen.getByText('Member')).not.toBeNull();
    expect(
      screen.queryByPlaceholderText(
        'com.affine.localmind.workbench.project.invitePlaceholder'
      )
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'com.affine.localmind.workbench.project.transferOwnership',
      })
    ).toBeNull();
  });
});

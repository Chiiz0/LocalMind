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
  ReactElement,
} from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@affine/core/modules/project-resources/realtime', () => ({
  useProjectRefresh: vi.fn(),
}));
vi.mock('@affine/component', () => ({
  Button: ({
    children,
    loading: _loading,
    variant: _variant,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
      variant?: string;
    }
  >) => <button {...props}>{children}</button>,
  IconButton: ({
    icon,
    size: _size,
    tooltip: _tooltip,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactElement;
    size?: string;
    tooltip?: string;
  }) => <button {...props}>{icon}</button>,
  Input: ({
    autoSelect: _autoSelect,
    onChange,
    onEnter: _onEnter,
    ...props
  }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    autoSelect?: boolean;
    onChange?: (value: string) => void;
    onEnter?: () => void;
  }) => (
    <input
      {...props}
      onChange={event => onChange?.(event.currentTarget.value)}
    />
  ),
  Loading: () => <div data-testid="loading" />,
  Menu: ({ children, items }: PropsWithChildren<{ items: ReactElement }>) => (
    <>
      {children}
      {items}
    </>
  ),
  MenuItem: ({
    children,
    prefixIcon: _prefixIcon,
    type: _type,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      prefixIcon?: ReactElement;
      type?: string;
    }
  >) => <button {...props}>{children}</button>,
}));

vi.mock('@affine/i18n', () => ({
  useI18n: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => () => String(key),
      }
    ),
}));

vi.mock('@blocksuite/icons/rc', () => ({
  DeleteTemporarilyIcon: () => <svg />,
  EditIcon: () => <svg />,
  FolderIcon: () => <svg />,
  MoreHorizontalIcon: () => <svg />,
  PageIcon: () => <svg />,
  PlusIcon: () => <svg />,
}));

import { ProjectTree } from './project-tree';
import type { WorkbenchProject } from './types';

afterEach(cleanup);

const project: WorkbenchProject = {
  id: 'project-1',
  createdByUserId: 'user-1',
  name: 'Project one',
  description: '',
  status: 'active',
  aiPolicy: 'read_only',
  role: 'owner',
  members: [],
  canManage: true,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
};

const renderTree = (
  overrides: Partial<Parameters<typeof ProjectTree>[0]> = {}
) =>
  render(
    <ProjectTree
      projects={[project]}
      selectedProjectId="project-1"
      loading={false}
      mutationsPending={false}
      onRefresh={vi.fn()}
      onSelectProject={vi.fn()}
      onCreate={vi.fn()}
      onRename={vi.fn()}
      onArchive={vi.fn()}
      onManageCollaboration={vi.fn()}
      {...overrides}
    />
  );

describe('ProjectTree', () => {
  test('selects the Project independently of any Workspace document', () => {
    const onSelectProject = vi.fn();
    renderTree({ onSelectProject });
    fireEvent.click(screen.getByRole('button', { name: 'Project one' }));
    expect(onSelectProject).toHaveBeenCalledWith('project-1');
  });

  test('trims and submits a new project name', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderTree({ onCreate });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.project.create',
      })
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        'com.affine.localmind.workbench.project.namePlaceholder'
      ),
      { target: { value: '  New project  ' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('New project');
    });
  });
});

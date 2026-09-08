/**
 * @vitest-environment happy-dom
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  PropsWithChildren,
  ReactElement,
} from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { WorkbenchTask, WorkbenchTaskPanelData } from './types';

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    prefix,
    loading: _loading,
    variant: _variant,
    size: _size,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
      prefix?: ReactElement;
      size?: string;
      variant?: string;
    }
  >) => (
    <button {...props}>
      {prefix}
      {children}
    </button>
  ),
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
  Loading: () => <div data-testid="loading" />,
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
  ArrowDownSmallIcon: (props: Record<string, unknown>) => <svg {...props} />,
  CheckBoxCheckLinearIcon: () => <svg />,
  CloseIcon: () => <svg />,
  PlusIcon: () => <svg />,
  ResetIcon: () => <svg />,
  UploadIcon: () => <svg />,
  WarningIcon: () => <svg />,
}));

import { isWaitingOnOthers, needsMyAction, TaskPanel } from './task-panel';

afterEach(cleanup);

const task = (
  id: string,
  status: string,
  availableActions: string[] = [],
  abandoned = false,
  attention: WorkbenchTask['attention'] = null
): WorkbenchTask => ({
  projectName: 'Project',
  documentTitle: 'Document',
  relatedUserName: null,
  relatedUserEmail: null,
  id,
  entityId: id,
  kind: 'run',
  segment:
    status === 'running'
      ? 'in_progress'
      : status === 'failed'
        ? 'todo'
        : 'done',
  attention,
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  title: `${id} title`,
  status,
  requestedLevel: null,
  documentId: null,
  redacted: false,
  relatedUserId: null,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
  completedAt: null,
  availableActions,
  blocker: null,
  projectTask: null,
  run: {
    sessionId: null,
    id,
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    title: `${id} title`,
    workflow: 'test',
    status,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    failureCode: status === 'failed' ? 'TEST_FAILURE' : null,
    failureMessage: status === 'failed' ? 'Retry this task' : null,
    resultSummary: null,
    approvalSummary: null,
    approvalFingerprint: null,
    resultEvidence: null,
    availableActions,
    abandoned,
    approval: null,
    artifacts: [],
    steps: [],
  },
});

const blockerTask = (
  id: string,
  status: 'waiting' | 'resolved' | 'abandoned',
  overdue: boolean,
  availableActions: string[] = []
): WorkbenchTask => ({
  ...task(id, status, availableActions, false, 'waiting_on_others'),
  kind: 'blocker',
  segment: status === 'waiting' ? 'todo' : 'done',
  completedAt: status === 'waiting' ? null : '2026-09-04T02:00:00.000Z',
  run: null,
  blocker: {
    creatorUserId: 'user-1',
    type: 'wait_reply',
    waitingOn: '王小明与一个很长的跨语言联系人名称'.repeat(8),
    dueAt: '2026-09-03T00:00:00.000Z',
    overdue,
    origin: 'user_created',
    resolutionActorUserId: status === 'waiting' ? null : 'user-1',
  },
});

const panel: WorkbenchTaskPanelData = {
  todo: {
    capped: true,
    items: [
      task('failed', 'failed', ['resume'], false, 'needs_my_action'),
      task('waiting', 'queued', ['resume'], false, 'waiting_on_others'),
    ],
  },
  inProgress: { capped: false, items: [task('running', 'running')] },
  done: { capped: true, items: [task('completed', 'cancelled', [], true)] },
};

const renderPanel = (
  overrides: Partial<Parameters<typeof TaskPanel>[0]> = {}
) =>
  render(
    <TaskPanel
      panel={panel}
      loading={false}
      pendingAction={null}
      onRefresh={vi.fn()}
      onOpenTask={vi.fn()}
      onViewAll={vi.fn()}
      onAction={vi.fn()}
      selectedProjectId={null}
      onCreateBlocker={vi.fn().mockResolvedValue(true)}
      {...overrides}
    />
  );

describe('TaskPanel', () => {
  const emptyPanel: WorkbenchTaskPanelData = {
    todo: { capped: false, items: [] },
    inProgress: { capped: false, items: [] },
    done: { capped: false, items: [] },
  };

  test('shows one compact empty state instead of three empty columns', () => {
    const { container } = renderPanel({ panel: emptyPanel });
    expect(screen.getByRole('status').textContent).toBe(
      'com.affine.localmind.tasks.empty.all'
    );
    expect(container.querySelector('[data-segment]')).toBeNull();
  });

  test('keeps waiting tasks visible even when no task needs my action', () => {
    const { container } = renderPanel({
      panel: {
        ...emptyPanel,
        todo: { capped: false, items: [panel.todo.items[1]] },
      },
    });
    expect(screen.getByText('waiting title')).not.toBeNull();
    expect(container.querySelector('[data-segment="todo"]')).not.toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('does not label loading or failed requests as empty and keeps errors visible when collapsed', () => {
    const loading = renderPanel({ panel: emptyPanel, loading: true });
    expect(screen.getByTestId('loading')).not.toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    loading.unmount();

    const refresh = vi.fn();
    renderPanel({
      panel: emptyPanel,
      error: 'Task request failed',
      onRefresh: refresh,
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.tasks',
      })
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'Task request failed'
    );
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.retry',
      })
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  test('allows adding a blocker from an empty project', () => {
    renderPanel({ panel: emptyPanel, selectedProjectId: 'project-1' });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.blocker.add',
      })
    );
    expect(screen.getByRole('form')).not.toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', {
        name: 'com.affine.localmind.workbench.blocker.title',
      })
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.getByRole('status')).not.toBeNull();
  });

  test('keeps failed runs in To do and renders capped-segment affordances', () => {
    const viewAll = vi.fn();
    const { container } = renderPanel({ onViewAll: viewAll });
    const todo = container.querySelector('[data-segment="todo"]');
    const done = container.querySelector('[data-segment="done"]');

    expect(todo).not.toBeNull();
    expect(done).not.toBeNull();
    expect(
      within(todo as HTMLElement).getByText('failed title')
    ).not.toBeNull();
    expect(within(done as HTMLElement).queryByText('failed title')).toBeNull();
    expect(
      within(done as HTMLElement).getByText(
        'com.affine.localmind.tasks.status.abandoned'
      )
    ).not.toBeNull();
    expect(
      screen.getAllByRole('button', {
        name: 'com.affine.localmind.workbench.tasks.viewAll',
      })
    ).toHaveLength(2);

    fireEvent.click(
      within(todo as HTMLElement).getByRole('button', {
        name: 'com.affine.localmind.workbench.tasks.viewAll',
      })
    );
    expect(viewAll).toHaveBeenCalledWith('todo');
    expect(
      within(todo as HTMLElement).getByText('failed title')
    ).not.toBeNull();
  });

  test('exposes an operable mobile navigation control', () => {
    const openNavigation = vi.fn();
    renderPanel({
      navigationToggle: {
        expanded: false,
        controls: 'intelligence-project-navigation',
        icon: <svg data-testid="navigation-icon" />,
        label: 'Open project navigation',
        onClick: openNavigation,
      },
    });

    const toggle = screen.getByRole('button', {
      name: 'Open project navigation',
    });
    expect(toggle.getAttribute('aria-controls')).toBe(
      'intelligence-project-navigation'
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(openNavigation).toHaveBeenCalledTimes(1);
  });

  test('groups To do strictly by server attention instead of available actions', () => {
    const actionableButWaiting = task(
      'waiting',
      'pending',
      ['approve_access_request'],
      false,
      'waiting_on_others'
    );
    const noActionButMine = task(
      'mine',
      'pending',
      [],
      false,
      'needs_my_action'
    );

    expect(needsMyAction(actionableButWaiting)).toBe(false);
    expect(isWaitingOnOthers(actionableButWaiting)).toBe(true);
    expect(needsMyAction(noActionButMine)).toBe(true);
    expect(isWaitingOnOthers(noActionButMine)).toBe(false);
  });

  test('shows the manual blocker form only for a selected project and submits normalized fields once', async () => {
    const onCreateBlocker = vi.fn().mockResolvedValue(true);
    const { rerender } = renderPanel({ onCreateBlocker });

    expect(
      screen.queryByRole('button', {
        name: 'com.affine.localmind.workbench.blocker.add',
      })
    ).toBeNull();

    rerender(
      <TaskPanel
        panel={panel}
        loading={false}
        pendingAction={null}
        onRefresh={vi.fn()}
        onOpenTask={vi.fn()}
        onViewAll={vi.fn()}
        onAction={vi.fn()}
        selectedProjectId="project-1"
        onCreateBlocker={onCreateBlocker}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.blocker.add',
      })
    );
    const title = screen.getByRole('textbox', {
      name: 'com.affine.localmind.workbench.blocker.title',
    });
    const waitingOn = screen.getByRole('textbox', {
      name: 'com.affine.localmind.workbench.blocker.waitingOnLabel',
    });
    expect(document.activeElement).toBe(title);

    fireEvent.change(title, { target: { value: '  Vendor reply  ' } });
    fireEvent.change(waitingOn, { target: { value: '  王小明  ' } });
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'com.affine.localmind.workbench.blocker.type',
      }),
      { target: { value: 'wait_decision' } }
    );
    const create = screen.getByRole('button', {
      name: 'com.affine.localmind.workbench.blocker.create',
    });
    fireEvent.click(create);
    fireEvent.click(create);

    expect(onCreateBlocker).toHaveBeenCalledTimes(1);
    expect(onCreateBlocker).toHaveBeenCalledWith('project-1', {
      title: 'Vendor reply',
      type: 'wait_decision',
      waitingOn: '王小明',
      dueAt: null,
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('form', {
          name: 'com.affine.localmind.workbench.blocker.create',
        })
      ).toBeNull();
    });
    expect(
      screen.queryByText('com.affine.localmind.workbench.blocker.empty')
    ).toBeNull();
  });

  test('keeps blocker draft content after a denied create', async () => {
    const onCreateBlocker = vi.fn().mockResolvedValue(false);
    renderPanel({ selectedProjectId: 'project-1', onCreateBlocker });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.blocker.add',
      })
    );
    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'com.affine.localmind.workbench.blocker.title',
      }),
      { target: { value: '等待供应商确认最终交付日期' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'com.affine.localmind.workbench.blocker.waitingOnLabel',
      }),
      { target: { value: '供应商客户成功团队' } }
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.blocker.create',
      })
    );

    expect(
      await screen.findByText(
        'com.affine.localmind.workbench.blocker.createFailedInline'
      )
    ).not.toBeNull();
    expect(
      screen.getByRole<HTMLInputElement>('textbox', {
        name: 'com.affine.localmind.workbench.blocker.title',
      }).value
    ).toBe('等待供应商确认最终交付日期');
  });

  test('highlights overdue waiting blockers with text and exposes only terminal actions', () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const blockerPanel: WorkbenchTaskPanelData = {
      todo: {
        capped: false,
        items: [
          blockerTask('overdue-blocker', 'waiting', true, [
            'resolve_blocker',
            'abandon_blocker',
          ]),
        ],
      },
      inProgress: { capped: false, items: [] },
      done: {
        capped: false,
        items: [blockerTask('resolved-blocker', 'resolved', false)],
      },
    };
    const { container } = renderPanel({
      panel: blockerPanel,
      selectedProjectId: 'project-1',
      onAction,
    });

    expect(container.querySelector('[data-segment="todo"]')).toBeNull();
    fireEvent.click(
      container.querySelector('button[aria-expanded="false"]') as HTMLElement
    );

    const todo = container.querySelector('[data-segment="todo"]');
    const done = container.querySelector('[data-segment="done"]');
    expect(todo).not.toBeNull();
    expect(done).not.toBeNull();
    const needsMyActionHeading = within(todo as HTMLElement).getByText(
      'com.affine.localmind.workbench.tasks.needsMyAction'
    );
    const blockerGroupHeading = within(todo as HTMLElement).getByText(
      'com.affine.localmind.workbench.blocker.group'
    );
    expect(
      needsMyActionHeading.compareDocumentPosition(blockerGroupHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    const overdueCard = within(todo as HTMLElement)
      .getByText('overdue-blocker title')
      .closest('article');
    expect(overdueCard?.dataset.overdue).toBe('true');
    expect(
      within(overdueCard as HTMLElement).getByText(
        'com.affine.localmind.workbench.blocker.overdue'
      )
    ).not.toBeNull();
    expect(
      within(todo as HTMLElement).getAllByText(
        'com.affine.localmind.workbench.blocker.waitingOn'
      )[0]
    ).not.toBeNull();
    expect(
      within(done as HTMLElement).getByText('resolved-blocker title')
    ).not.toBeNull();

    fireEvent.click(
      within(overdueCard as HTMLElement).getByRole('button', {
        name: 'com.affine.localmind.workbench.blocker.resolve',
      })
    );
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'overdue-blocker' }),
      'resolve_blocker'
    );
    expect(
      within(overdueCard as HTMLElement).getAllByRole('button')
    ).toHaveLength(3);
  });
});

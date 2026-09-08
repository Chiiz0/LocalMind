/** @vitest-environment happy-dom */
import {
  decideProjectAgentTaskMutation,
  type ProjectAgentTaskFieldsFragment,
  projectOfficeArtifactQuery,
} from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, type Mock, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  gql: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  report: vi.fn(),
  editor: undefined as
    | undefined
    | {
        hasUnsavedChanges: Mock<() => boolean>;
        save: Mock<() => Promise<boolean>>;
        store: {
          handoff: Mock<
            (taskId: string, isClean?: () => boolean) => Promise<boolean>
          >;
          trackHandoff: Mock<
            (taskId: string, uncertain?: boolean) => Promise<void>
          >;
          report: Mock<(error: unknown) => void>;
        };
      },
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({ gql: state.gql }),
}));
vi.mock('@affine/component', () => ({
  notify: { success: state.success, error: state.error },
  useConfirmModal: () => ({ openConfirmModal: state.confirm }),
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/core/modules/project-resources/error', () => ({
  reportProjectError: state.report,
}));
vi.mock('@affine/core/modules/project-resources/task-handoff', () => ({
  projectTaskEditor: () => state.editor,
}));
import { useProjectTaskDecision } from './use-project-task-decision';

const task = {
  id: 'task',
  projectId: 'project',
  workflow: 'agent_runtime_project_office_command',
  status: 'waiting_approval',
  title: 'Delete PDF pages',
  targetFingerprint: 'preview',
  updatedAt: '2026-09-08',
  preview: { artifactId: 'pdf', expectedRevisionId: 'revision-1' },
} as ProjectAgentTaskFieldsFragment;
function Actions() {
  const decide = useProjectTaskDecision();
  return <button onClick={() => void decide(task, 'approve')}>Approve</button>;
}
function ownEditor(dirty = false) {
  state.editor = {
    hasUnsavedChanges: vi.fn(() => dirty),
    save: vi.fn(async () => dirty),
    store: {
      handoff: vi.fn(async () => true),
      trackHandoff: vi.fn(async () => {}),
      report: vi.fn(),
    },
  };
  return state.editor;
}
const approvals = () =>
  state.gql.mock.calls.filter(
    ([r]) => r.query === decideProjectAgentTaskMutation
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.editor = undefined;
  state.confirm.mockImplementation(({ onConfirm }) => onConfirm());
  state.gql.mockImplementation(async ({ query }) => {
    if (query === projectOfficeArtifactQuery)
      return {
        projectOfficeArtifact: { currentRevision: { id: 'revision-1' } },
      };
    return {
      decideProjectAgentTask: { applied: true, processedByName: 'Editor' },
    };
  });
});
afterEach(cleanup);

test('approval releases the current clean editor before submitting, then tracks completion', async () => {
  const editor = ownEditor();
  const order: string[] = [];
  editor.store.handoff.mockImplementation(async () => {
    order.push('release');
    return true;
  });
  state.gql.mockImplementation(async ({ query }) => {
    if (query === projectOfficeArtifactQuery)
      return {
        projectOfficeArtifact: { currentRevision: { id: 'revision-1' } },
      };
    order.push('approve');
    return {
      decideProjectAgentTask: { applied: true, processedByName: 'Editor' },
    };
  });
  render(<Actions />);
  fireEvent.click(screen.getByText('Approve'));
  fireEvent.click(screen.getByText('Approve'));
  await waitFor(() =>
    expect(editor.store.trackHandoff).toHaveBeenCalledWith('task', false)
  );
  expect(order).toEqual(['release', 'approve']);
  expect(approvals()).toHaveLength(1);
});

test('cancel keeps the document editable and never saves, releases or approves', async () => {
  const editor = ownEditor();
  state.confirm.mockImplementation(({ onCancel }) => onCancel());
  render(<Actions />);
  fireEvent.click(screen.getByText('Approve'));
  await waitFor(() => expect(state.confirm).toHaveBeenCalledOnce());
  expect(editor.save).not.toHaveBeenCalled();
  expect(editor.store.handoff).not.toHaveBeenCalled();
  expect(approvals()).toHaveLength(0);
});

test('saved local edits require a new preview and never release or approve the old request', async () => {
  const editor = ownEditor(true);
  render(<Actions />);
  fireEvent.click(screen.getByText('Approve'));
  await waitFor(() =>
    expect(state.success).toHaveBeenCalledWith({
      title: 'com.affine.localmind.project-tasks.savedNeedsPreview',
    })
  );
  expect(editor.save).toHaveBeenCalledOnce();
  expect(editor.store.handoff).not.toHaveBeenCalled();
  expect(approvals()).toHaveLength(0);
});

test('save failure preserves the lease and never approves', async () => {
  const editor = ownEditor(true);
  editor.save.mockRejectedValue(new Error('save failed'));
  render(<Actions />);
  fireEvent.click(screen.getByText('Approve'));
  await waitFor(() => expect(state.report).toHaveBeenCalledOnce());
  expect(editor.store.handoff).not.toHaveBeenCalled();
  expect(approvals()).toHaveLength(0);
});

test('changed server revision blocks approval even when the local editor is clean', async () => {
  const editor = ownEditor();
  state.gql.mockResolvedValue({
    projectOfficeArtifact: { currentRevision: { id: 'revision-2' } },
  });
  render(<Actions />);
  fireEvent.click(screen.getByText('Approve'));
  await waitFor(() =>
    expect(state.error).toHaveBeenCalledWith({
      title: 'com.affine.localmind.project-tasks.previewOutdated',
    })
  );
  expect(editor.store.handoff).not.toHaveBeenCalled();
  expect(approvals()).toHaveLength(0);
});

test('lost approval response still monitors the task instead of immediately resuming editing', async () => {
  const editor = ownEditor();
  state.gql.mockImplementation(async ({ query }) => {
    if (query === projectOfficeArtifactQuery)
      return {
        projectOfficeArtifact: { currentRevision: { id: 'revision-1' } },
      };
    throw new Error('response lost');
  });
  render(<Actions />);
  fireEvent.click(screen.getByText('Approve'));
  await waitFor(() => expect(state.report).toHaveBeenCalledOnce());
  expect(editor.store.trackHandoff).toHaveBeenCalledWith('task', true);
});

test('approval without an owned editor never attempts to release another tab', async () => {
  render(<Actions />);
  fireEvent.click(screen.getByText('Approve'));
  await waitFor(() => expect(approvals()).toHaveLength(1));
  expect(state.success).toHaveBeenCalledWith({
    title: 'com.affine.localmind.project-tasks.approvedQueued',
  });
});

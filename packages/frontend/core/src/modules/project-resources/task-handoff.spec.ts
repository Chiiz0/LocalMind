import type { ProjectAgentTaskFieldsFragment } from '@affine/graphql';
import { expect, test, vi } from 'vitest';

import type { ProjectEditLeaseStore } from './edit-lease-store';
import { projectTaskEditor, registerProjectTaskEditor } from './task-handoff';

test('handoff registration matches the server, project, artifact and this tab ownership', () => {
  const server = {};
  let owned = true;
  const editor = {
    projectId: 'project',
    resourceId: 'resource',
    artifactId: 'artifact',
    store: {
      snapshot: () => ({
        proof: owned ? { leaseId: 'own', tabId: 'tab' } : null,
      }),
    } as ProjectEditLeaseStore,
    hasUnsavedChanges: () => false,
    save: vi.fn(),
  };
  const unregister = registerProjectTaskEditor(server, editor);
  const task = {
    projectId: 'project',
    workflow: 'agent_runtime_project_office_command',
    preview: { artifactId: 'artifact' },
  } as ProjectAgentTaskFieldsFragment;
  expect(projectTaskEditor(server, task)).toBe(editor);
  expect(projectTaskEditor({}, task)).toBeUndefined();
  expect(
    projectTaskEditor(server, { ...task, projectId: 'other' })
  ).toBeUndefined();
  expect(
    projectTaskEditor(server, { ...task, preview: { artifactId: 'other' } })
  ).toBeUndefined();
  owned = false;
  expect(projectTaskEditor(server, task)).toBeUndefined();
  owned = true;
  unregister();
  expect(projectTaskEditor(server, task)).toBeUndefined();
});

import type { ProjectAgentTaskFieldsFragment } from '@affine/graphql';

import type { ProjectEditLeaseStore } from './edit-lease-store';

type TaskEditor = {
  projectId: string;
  resourceId: string;
  artifactId: string;
  store: ProjectEditLeaseStore;
  hasUnsavedChanges: () => boolean;
  save: () => Promise<boolean>;
};

// Only mounted editors in this browser tab and server scope can offer a handoff.
const editors = new WeakMap<object, Set<TaskEditor>>();

export function registerProjectTaskEditor(scope: object, editor: TaskEditor) {
  let entries = editors.get(scope);
  if (!entries) editors.set(scope, (entries = new Set()));
  entries.add(editor);
  return () => {
    entries.delete(editor);
  };
}

export function projectTaskEditor(
  scope: object,
  task: ProjectAgentTaskFieldsFragment
) {
  if (task.workflow !== 'agent_runtime_project_office_command') return;
  const preview = task.preview as Record<string, unknown> | null;
  if (typeof preview?.artifactId !== 'string') return;
  return [...(editors.get(scope) ?? [])].find(
    editor =>
      editor.projectId === task.projectId &&
      editor.artifactId === preview.artifactId &&
      !!editor.store.snapshot().proof
  );
}

import test from 'ava';

import type { PermissionAccess } from '../../core/permission';
import type { Models } from '../../models';
import { createProjectDocAddTool } from '../../plugins/copilot/tools/project-doc';

function fixture(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown>[] = [];
  const tool = createProjectDocAddTool({
    options: { user: 'actor', workspace: 'host', session: 'session' },
    ac: {
      user: () => ({ workspace: () => ({ assert: async () => {} }) }),
    } as unknown as PermissionAccess,
    models: {
      copilotSession: {
        getMeta: async () => ({
          userId: 'actor',
          workspaceId: 'host',
          docId: null,
          selectedContextProjectId: 'project',
          ...overrides,
        }),
      },
      intelligenceWorkbenchAuthorization: {
        addProjectDocument: async (input: Record<string, unknown>) => {
          calls.push(input);
          return {
            kind: 'requested',
            request: { id: 'request', status: 'pending' },
          };
        },
      },
    } as unknown as Models,
  });
  const execute = (content: string) =>
    tool.execute!(
      {
        source_workspace_id: 'source',
        doc_id: 'document',
        requested_level: 'read',
      },
      { messages: [{ role: 'user', content }] }
    );
  return { calls, execute };
}

test('project addition rejects absent and negative user intent without side effects', async t => {
  const { calls, execute } = fixture();
  for (const message of [
    'Summarize this document.',
    'Do not add this document to the project.',
    "Don't share this with the project.",
    '不要把文档加入项目',
    '取消加入项目的申请',
  ]) {
    t.like(await execute(message), { type: 'error' });
  }
  t.is(calls.length, 0);
});

test('project addition rejects stale session identity and document-side sessions', async t => {
  for (const overrides of [
    { userId: 'other' },
    { workspaceId: 'other' },
    { docId: 'document' },
    { selectedContextProjectId: null },
  ]) {
    const { calls, execute } = fixture(overrides);
    t.like(await execute('Add this document to the project.'), {
      type: 'error',
    });
    t.is(calls.length, 0);
  }
});

test('project addition uses session identity and reports pending separately from a grant', async t => {
  const { calls, execute } = fixture();
  t.like(await execute('Add this document to the project.'), {
    success: true,
    status: 'pending',
    accessRequestId: 'request',
    grantedLevel: null,
    sourceWorkspaceId: 'source',
    projectId: 'project',
  });
  t.deepEqual(calls, [
    {
      projectId: 'project',
      workspaceId: 'source',
      docId: 'document',
      requesterUserId: 'actor',
      requestedLevel: 'read',
    },
  ]);
});

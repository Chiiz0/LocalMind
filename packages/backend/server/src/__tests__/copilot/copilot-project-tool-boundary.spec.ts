import test from 'ava';

import type { CopilotContextMemoryResolver } from '../../plugins/copilot/context-memory-resolver';
import { createContextMcpTools } from '../../plugins/copilot/mcp/context-tools';

test('Workspace MCP keeps Project administration human-only', t => {
  const tools = createContextMcpTools(
    {} as CopilotContextMemoryResolver,
    'user-one',
    'workspace-one'
  );
  const names = new Set(
    [...tools.readTools, ...tools.writeTools].map(tool => tool.name)
  );

  t.true(names.has('list_ai_context_projects'));
  t.false(names.has('create_ai_context_project'));
  t.false(names.has('update_ai_context_project'));
  t.false(names.has('delete_ai_context_project'));
});

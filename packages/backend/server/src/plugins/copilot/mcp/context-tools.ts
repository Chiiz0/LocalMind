import { z } from 'zod';

import type { CurrentUser } from '../../../core/auth';
import type { CopilotContextMemoryResolver } from '../context-memory-resolver';
import {
  defineTool,
  DESTRUCTIVE_WRITE_TOOL,
  READ_ONLY_TOOL,
  RESULT_OUTPUT_SCHEMA,
  toolError,
  toolResult,
  type WorkspaceMcpToolDefinition,
  type WorkspaceMcpToolResult,
  WRITE_TOOL,
} from './types';

const conditionsSchema = z
  .object({
    keywords: z.array(z.string()).optional(),
    docIds: z.array(z.string()).optional(),
    documentRefs: z
      .array(
        z
          .object({
            workspaceId: z.string().min(1),
            docId: z.string().min(1),
          })
          .strict()
      )
      .max(100)
      .optional(),
    projectIds: z.array(z.string()).optional(),
    match: z.enum(['any', 'all']).optional(),
  })
  .strict();

const directiveFields = {
  name: z.string().optional(),
  description: z.string().optional(),
  applicationMode: z.enum(['always', 'relevant', 'manual']).optional(),
  priority: z.number().int().optional(),
  conditions: conditionsSchema.optional(),
  status: z.enum(['active', 'disabled']).optional(),
  content: z.string().optional(),
};

export function createContextMcpTools(
  resolver: CopilotContextMemoryResolver,
  userId: string,
  workspaceId: string
): {
  readTools: WorkspaceMcpToolDefinition[];
  writeTools: WorkspaceMcpToolDefinition[];
} {
  const user = { id: userId } as CurrentUser;
  const copilot = { workspaceId };

  const ensureVisible = async (
    kind: 'memory' | 'rule' | 'policy',
    id: string
  ): Promise<WorkspaceMcpToolResult | undefined> => {
    const rows =
      kind === 'memory'
        ? await resolver.contextMemories(copilot, user, undefined, true)
        : kind === 'rule'
          ? await resolver.contextRules(copilot, user, true)
          : await resolver.contextPolicies(copilot, user, true);
    if (!rows.some(row => row.id === id)) {
      return toolError(`AI context ${kind} not found.`);
    }
    return;
  };

  const readTools: WorkspaceMcpToolDefinition[] = [
    defineTool({
      name: 'get_ai_context_settings',
      title: 'Get AI Context Settings',
      description: 'Get Automatic Memory settings for the credential owner.',
      parser: z.object({}).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async () =>
        toolResult(await resolver.contextSettings(copilot, user)),
    }),
    defineTool({
      name: 'list_ai_context_planner_strategies',
      title: 'List AI Context Planner Strategies',
      description:
        'List immutable context planner versions and checkpoint activity.',
      parser: z.object({}).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async () =>
        toolResult(await resolver.contextPlannerStrategies(copilot, user)),
    }),
    defineTool({
      name: 'list_ai_context_projects',
      title: 'List AI Context Projects',
      description: 'List context projects whose documents are readable.',
      parser: z
        .object({ includeArchived: z.boolean().default(false) })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ includeArchived }) =>
        toolResult(
          await resolver.contextProjects(copilot, user, includeArchived)
        ),
    }),
    defineTool({
      name: 'get_ai_context_session_scope',
      title: 'Get AI Context Session Scope',
      description:
        'Resolve readable documents and candidate context projects for a chat session.',
      parser: z.object({ sessionId: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ sessionId }) =>
        toolResult(
          await resolver.contextSessionScope(copilot, user, sessionId)
        ),
    }),
    defineTool({
      name: 'list_ai_context_memory_events',
      title: 'List AI Context Memory Events',
      description: 'List Automatic Memory writer and undo events.',
      parser: z
        .object({ limit: z.number().int().min(1).max(200).default(50) })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ limit }) =>
        toolResult(await resolver.contextMemoryEvents(copilot, user, limit)),
    }),
    defineTool({
      name: 'list_ai_context_rules',
      title: 'List AI Context Rules',
      description: 'List user rules and their revision history.',
      parser: z
        .object({ includeDisabled: z.boolean().default(false) })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ includeDisabled }) =>
        toolResult(await resolver.contextRules(copilot, user, includeDisabled)),
    }),
    defineTool({
      name: 'list_ai_context_policies',
      title: 'List AI Context Policies',
      description: 'List workspace-enforced AI context policies.',
      parser: z
        .object({ includeDisabled: z.boolean().default(false) })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ includeDisabled }) =>
        toolResult(
          await resolver.contextPolicies(copilot, user, includeDisabled)
        ),
    }),
    defineTool({
      name: 'list_ai_context_memories',
      title: 'List AI Context Memories',
      description:
        'List authorized rules, automatic memories, and project summaries.',
      parser: z
        .object({
          docId: z.string().optional(),
          includeDisabled: z.boolean().default(false),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ docId, includeDisabled }) =>
        toolResult(
          await resolver.contextMemories(copilot, user, docId, includeDisabled)
        ),
    }),
  ];

  const writeTools: WorkspaceMcpToolDefinition[] = [
    defineTool({
      name: 'create_ai_context_memory',
      title: 'Create AI Context Memory',
      description:
        'Create a user, workspace, document, or project scoped manual memory. DLP checks are enforced.',
      parser: z
        .object({
          scope: z.enum(['user', 'workspace', 'document', 'project']),
          kind: z.enum(['rule', 'project_summary']),
          content: z.string().min(1),
          docId: z.string().optional(),
          projectId: z.string().optional(),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: WRITE_TOOL,
      execute: async input =>
        toolResult(
          await resolver.createCopilotContextMemory(user, {
            ...input,
            workspaceId: input.scope === 'user' ? undefined : workspaceId,
          })
        ),
    }),
    defineTool({
      name: 'update_ai_context_memory',
      title: 'Update AI Context Memory',
      description: 'Update the content or active status of a visible memory.',
      parser: z
        .object({
          id: z.string().min(1),
          content: z.string().optional(),
          status: z.enum(['active', 'disabled']).optional(),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: { ...WRITE_TOOL, idempotentHint: true },
      execute: async input => {
        const error = await ensureVisible('memory', input.id);
        if (error) return error;
        return toolResult(
          await resolver.updateCopilotContextMemory(user, input)
        );
      },
    }),
    defineTool({
      name: 'delete_ai_context_memory',
      title: 'Delete AI Context Memory',
      description: 'Delete a visible user-owned context memory.',
      parser: z.object({ id: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ id }) => {
        const error = await ensureVisible('memory', id);
        if (error) return error;
        return toolResult(await resolver.deleteCopilotContextMemory(user, id));
      },
    }),
    defineTool({
      name: 'undo_ai_context_memory_event',
      title: 'Undo AI Context Memory Event',
      description: 'Undo the latest eligible Automatic Memory event.',
      parser: z.object({ eventId: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ eventId }) =>
        toolResult(
          await resolver.undoCopilotContextMemoryEvent(
            user,
            workspaceId,
            eventId
          )
        ),
    }),
    defineTool({
      name: 'create_ai_context_rule',
      title: 'Create AI Context Rule',
      description: 'Create a scoped AI context rule with DLP validation.',
      parser: z
        .object({
          scope: z.enum(['user', 'workspace', 'project']),
          projectId: z.string().optional(),
          name: z.string().min(1),
          description: z.string().optional(),
          applicationMode: z.enum(['always', 'relevant', 'manual']),
          priority: z.number().int(),
          conditions: conditionsSchema.optional(),
          content: z.string().min(1),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: WRITE_TOOL,
      execute: async input =>
        toolResult(
          await resolver.createCopilotContextRule(user, {
            ...input,
            workspaceId: input.scope === 'user' ? undefined : workspaceId,
          })
        ),
    }),
    defineTool({
      name: 'update_ai_context_rule',
      title: 'Update AI Context Rule',
      description: 'Update a visible user-owned AI context rule.',
      parser: z.object({ id: z.string().min(1), ...directiveFields }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: { ...WRITE_TOOL, idempotentHint: true },
      execute: async input => {
        const error = await ensureVisible('rule', input.id);
        if (error) return error;
        return toolResult(await resolver.updateCopilotContextRule(user, input));
      },
    }),
    defineTool({
      name: 'rollback_ai_context_rule',
      title: 'Rollback AI Context Rule',
      description: 'Restore a rule from one of its persisted revisions.',
      parser: z
        .object({
          id: z.string().min(1),
          revision: z.number().int().min(1),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ id, revision }) => {
        const error = await ensureVisible('rule', id);
        if (error) return error;
        return toolResult(
          await resolver.rollbackCopilotContextRule(user, id, revision)
        );
      },
    }),
    defineTool({
      name: 'delete_ai_context_rule',
      title: 'Delete AI Context Rule',
      description: 'Delete a visible user-owned context rule.',
      parser: z.object({ id: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ id }) => {
        const error = await ensureVisible('rule', id);
        if (error) return error;
        return toolResult(await resolver.deleteCopilotContextRule(user, id));
      },
    }),
    defineTool({
      name: 'create_ai_context_policy',
      title: 'Create AI Context Policy',
      description:
        'Create a workspace-enforced context policy. Workspace settings permission is required.',
      parser: z
        .object({
          name: z.string().min(1),
          description: z.string().optional(),
          applicationMode: z.enum(['always', 'relevant']),
          priority: z.number().int(),
          conditions: conditionsSchema.optional(),
          content: z.string().min(1),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: WRITE_TOOL,
      execute: async input =>
        toolResult(
          await resolver.createCopilotContextPolicy(user, {
            ...input,
            workspaceId,
          })
        ),
    }),
    defineTool({
      name: 'update_ai_context_policy',
      title: 'Update AI Context Policy',
      description: 'Update a workspace context policy.',
      parser: z
        .object({
          id: z.string().min(1),
          ...directiveFields,
          applicationMode: z.enum(['always', 'relevant']).optional(),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: { ...WRITE_TOOL, idempotentHint: true },
      execute: async input => {
        const error = await ensureVisible('policy', input.id);
        if (error) return error;
        return toolResult(
          await resolver.updateCopilotContextPolicy(user, {
            ...input,
            workspaceId,
          })
        );
      },
    }),
    defineTool({
      name: 'rollback_ai_context_policy',
      title: 'Rollback AI Context Policy',
      description: 'Restore a workspace policy from a persisted revision.',
      parser: z
        .object({
          id: z.string().min(1),
          revision: z.number().int().min(1),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ id, revision }) => {
        const error = await ensureVisible('policy', id);
        if (error) return error;
        return toolResult(
          await resolver.rollbackCopilotContextPolicy(
            user,
            id,
            workspaceId,
            revision
          )
        );
      },
    }),
    defineTool({
      name: 'delete_ai_context_policy',
      title: 'Delete AI Context Policy',
      description: 'Delete a workspace context policy.',
      parser: z.object({ id: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: DESTRUCTIVE_WRITE_TOOL,
      execute: async ({ id }) => {
        const error = await ensureVisible('policy', id);
        if (error) return error;
        return toolResult(
          await resolver.deleteCopilotContextPolicy(user, id, workspaceId)
        );
      },
    }),
    defineTool({
      name: 'update_ai_context_settings',
      title: 'Update AI Context Settings',
      description: 'Enable or disable Automatic Memory for this workspace.',
      parser: z.object({ autoMemoryEnabled: z.boolean() }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: { ...WRITE_TOOL, idempotentHint: true },
      execute: async ({ autoMemoryEnabled }) =>
        toolResult(
          await resolver.updateCopilotContextSettings(user, {
            workspaceId,
            autoMemoryEnabled,
          })
        ),
    }),
  ];

  return { readTools, writeTools };
}

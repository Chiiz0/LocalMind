import { mcpDelegationFingerprint } from '../../../models/copilot-mcp-delegation';
import type { CopilotTool, CopilotToolSet } from '../tools';

export const TOOL_CAPABILITY_SNAPSHOT_VERSION =
  'localmind-tool-capability-snapshot/v1';

export type ToolSideEffectType =
  | 'read'
  | 'workspace_write'
  | 'project_write'
  | 'external_dynamic';

export type ToolCapabilitySnapshot = {
  name: string;
  schemaFingerprint: string;
  sideEffectType: ToolSideEffectType;
};

const WORKSPACE_WRITE_TOOLS = new Set([
  'doc_create',
  'doc_copy',
  'doc_update',
  'doc_update_meta',
  'project_doc_update_request',
  'project_doc_add',
  'workspace_folder_create',
  'workspace_folder_rename',
  'workspace_folder_move',
  'workspace_folder_delete',
  'workspace_folder_trash',
  'workspace_folder_restore',
  'workspace_folder_delete_permanently',
  'workspace_folder_add_document',
  'workspace_folder_move_document',
  'doc_trash',
  'doc_restore',
  'doc_delete_permanently',
]);

const EXTERNAL_DYNAMIC_TOOLS = new Set([
  'enterprise_cli_execute',
  'sparkclaw_mcp_execute',
]);

export function toolSchemaFingerprint(
  schema: Record<string, unknown> | undefined
) {
  return mcpDelegationFingerprint({
    version: 'localmind-tool-input-schema/v1',
    schema: schema ?? {},
  });
}

export function toolSideEffectType(name: string): ToolSideEffectType {
  if (WORKSPACE_WRITE_TOOLS.has(name)) return 'workspace_write';
  if (EXTERNAL_DYNAMIC_TOOLS.has(name)) return 'external_dynamic';
  return 'read';
}

export function buildToolCapabilitySnapshot(
  tools: CopilotToolSet
): ToolCapabilitySnapshot[] {
  return Object.entries(tools)
    .map(([name, tool]) => toolCapability(name, tool))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function toolCapability(name: string, tool: CopilotTool) {
  return {
    name,
    schemaFingerprint: toolSchemaFingerprint(tool.jsonSchema),
    sideEffectType: tool.sideEffectType ?? toolSideEffectType(name),
  } satisfies ToolCapabilitySnapshot;
}

export function toolCapabilitySnapshotFingerprint(
  tools: readonly ToolCapabilitySnapshot[]
) {
  return mcpDelegationFingerprint({
    version: TOOL_CAPABILITY_SNAPSHOT_VERSION,
    tools,
  });
}

export function matchesToolCapability(
  name: string,
  tool: CopilotTool,
  expected: ToolCapabilitySnapshot
) {
  const current = toolCapability(name, tool);
  return (
    current.name === expected.name &&
    current.schemaFingerprint === expected.schemaFingerprint &&
    current.sideEffectType === expected.sideEffectType
  );
}

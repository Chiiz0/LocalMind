export const AI_ACTION_RUN_AGENT_RUNTIME_PROJECTION_SOURCE =
  'ai_action_run_agent_runtime_projection/v1';

export const AI_ACTION_RUN_AGENT_RUNTIME_SCHEMA_READINESS =
  'projection_contract_only';

export const AGENT_RUNTIME_TARGET_SCHEMA_COMPONENTS = [
  'db_agent_run_table',
  'db_agent_step_table',
  'graphql_run_status_enum',
  'graphql_step_status_enum',
  'graphql_step_type_enum',
  'schema_migration',
  'registry_source_of_truth',
] as const;

export type AgentRuntimeSchemaComponent =
  (typeof AGENT_RUNTIME_TARGET_SCHEMA_COMPONENTS)[number];

export const AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_SCHEMA_COMPONENTS = [
  'typescript_projection_contract',
  'graphql_string_diagnostics_fields',
  'graphql_structured_timeline_items',
] as const;

export const AGENT_RUNTIME_TARGET_TIMELINE_EVENT_TYPES = [
  'run_status',
  'model_step',
  'tool_step',
  'approval_step',
  'handoff_step',
  'codex_step',
  'mcp_step',
  'step_output',
  'step_error',
  'retry_attempt',
  'rollback_state',
  'run_cancellation',
] as const;

export type AgentRuntimeTimelineEventType =
  (typeof AGENT_RUNTIME_TARGET_TIMELINE_EVENT_TYPES)[number];

export const AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_TIMELINE_EVENT_TYPES = [
  'run_status',
  'model_step',
] as const satisfies readonly AgentRuntimeTimelineEventType[];

export const AGENT_RUNTIME_TARGET_RUN_STATUSES = [
  'queued',
  'running',
  'waiting_approval',
  'waiting_for_location',
  'completed',
  'failed',
  'cancelled',
  'retrying',
  'rollback_running',
  'archived',
] as const;

export type AgentRuntimeRunStatus =
  (typeof AGENT_RUNTIME_TARGET_RUN_STATUSES)[number];

export const AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly AgentRuntimeRunStatus[];

export const AGENT_RUNTIME_TARGET_STEP_STATUSES = [
  'pending',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'skipped',
  'retrying',
  'rollback_running',
  'blocked',
] as const;

export type AgentRuntimeStepStatus =
  (typeof AGENT_RUNTIME_TARGET_STEP_STATUSES)[number];

export const AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_STEP_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
] as const satisfies readonly AgentRuntimeStepStatus[];

export const AGENT_RUNTIME_TARGET_STEP_TYPES = [
  'model',
  'tool',
  'approval',
  'handoff',
  'codex',
  'mcp',
] as const;

export type AgentRuntimeStepType =
  (typeof AGENT_RUNTIME_TARGET_STEP_TYPES)[number];

export const AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_STEP_TYPES = [
  'model',
] as const satisfies readonly AgentRuntimeStepType[];

export function mapActionRunStatusToAgentRuntimeStatus(status: string) {
  switch (status) {
    case 'created':
      return 'queued';
    case 'running':
      return 'running';
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'aborted':
      return 'cancelled';
    default:
      return 'failed';
  }
}

export function mapActionRunStatusToAgentRuntimeStepStatus(status: string) {
  switch (status) {
    case 'created':
      return 'pending';
    case 'running':
      return 'running';
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'aborted':
      return 'skipped';
    default:
      return 'failed';
  }
}

export function getActionRunAgentRuntimeProjectedStepTypes() {
  return [...AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_STEP_TYPES];
}

export function getActionRunAgentRuntimeProjectedTimelineEventTypes() {
  return [...AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_TIMELINE_EVENT_TYPES];
}

export function getActionRunAgentRuntimeProjectedSchemaComponents() {
  return [...AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_SCHEMA_COMPONENTS];
}

export function getActionRunAgentRuntimeProjectedStepStatuses() {
  return [...AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_STEP_STATUSES];
}

export function getActionRunAgentRuntimeProjectedRunStatuses() {
  return [...AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_RUN_STATUSES];
}

export function getAgentRuntimeTargetStepTypes() {
  return [...AGENT_RUNTIME_TARGET_STEP_TYPES];
}

export function getAgentRuntimeTargetTimelineEventTypes() {
  return [...AGENT_RUNTIME_TARGET_TIMELINE_EVENT_TYPES];
}

export function getAgentRuntimeTargetSchemaComponents() {
  return [...AGENT_RUNTIME_TARGET_SCHEMA_COMPONENTS];
}

export function getAgentRuntimeTargetStepStatuses() {
  return [...AGENT_RUNTIME_TARGET_STEP_STATUSES];
}

export function getAgentRuntimeTargetRunStatuses() {
  return [...AGENT_RUNTIME_TARGET_RUN_STATUSES];
}

export function getActionRunAgentRuntimeUnsupportedRunStatuses() {
  const projectedRunStatuses = new Set<AgentRuntimeRunStatus>(
    AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_RUN_STATUSES
  );

  return AGENT_RUNTIME_TARGET_RUN_STATUSES.filter(
    status => !projectedRunStatuses.has(status)
  );
}

export function getActionRunAgentRuntimeUnsupportedStepStatuses() {
  const projectedStepStatuses = new Set<AgentRuntimeStepStatus>(
    AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_STEP_STATUSES
  );

  return AGENT_RUNTIME_TARGET_STEP_STATUSES.filter(
    status => !projectedStepStatuses.has(status)
  );
}

export function getActionRunAgentRuntimeUnsupportedStepTypes() {
  const projectedStepTypes = new Set<AgentRuntimeStepType>(
    AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_STEP_TYPES
  );

  return AGENT_RUNTIME_TARGET_STEP_TYPES.filter(
    stepType => !projectedStepTypes.has(stepType)
  );
}

export function getActionRunAgentRuntimeUnsupportedTimelineEventTypes() {
  const projectedTimelineEventTypes = new Set<AgentRuntimeTimelineEventType>(
    AI_ACTION_RUN_AGENT_RUNTIME_PROJECTED_TIMELINE_EVENT_TYPES
  );

  return AGENT_RUNTIME_TARGET_TIMELINE_EVENT_TYPES.filter(
    eventType => !projectedTimelineEventTypes.has(eventType)
  );
}

export function getActionRunAgentRuntimeStepStatusGaps() {
  return getActionRunAgentRuntimeUnsupportedStepStatuses().map(
    status => `${status} -> not_projected`
  );
}

export function getActionRunAgentRuntimeTimelineGaps(input: {
  hasPreparedRouteTrace: boolean;
}) {
  return [
    ...(input.hasPreparedRouteTrace
      ? []
      : ['model_step -> no_prepared_route_trace']),
    ...getActionRunAgentRuntimeUnsupportedTimelineEventTypes().map(
      eventType => `${eventType} -> not_projected`
    ),
  ];
}

export function getActionRunAgentRuntimeSchemaReadinessGaps() {
  return [
    'db_agent_run_table -> not_persisted',
    'db_agent_step_table -> not_persisted',
    'graphql_run_status_enum -> string_field',
    'graphql_step_status_enum -> string_field',
    'graphql_step_type_enum -> string_field',
    'schema_migration -> not_created',
    'registry_source_of_truth -> not_created',
  ];
}

export function getActionRunAgentRuntimeRunStatusGaps() {
  return getActionRunAgentRuntimeUnsupportedRunStatuses().map(
    status => `${status} -> not_projected`
  );
}

export function getActionRunAgentRuntimeProjectionGaps(input: {
  hasPreparedRouteTrace: boolean;
}) {
  return [
    ...(input.hasPreparedRouteTrace
      ? []
      : ['model -> no_prepared_route_trace']),
    ...getActionRunAgentRuntimeUnsupportedStepTypes().map(
      stepType => `${stepType} -> not_projected`
    ),
  ];
}

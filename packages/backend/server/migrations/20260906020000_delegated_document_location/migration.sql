ALTER TABLE ai_agent_runs DROP CONSTRAINT ai_agent_runs_status_check;
ALTER TABLE ai_agent_runs ADD CONSTRAINT ai_agent_runs_status_check CHECK (
  status IN ('queued', 'running', 'waiting_approval', 'waiting_for_location', 'completed', 'failed', 'cancelled')
);
ALTER TABLE ai_agent_runs ADD CONSTRAINT ai_agent_runs_location_wait_check CHECK (
  status <> 'waiting_for_location' OR (
    source_type = 'mcp_ai_delegation' AND workflow = 'agent_runtime_localmind_tool_agent'
    AND session_id IS NOT NULL AND queued_at IS NULL AND completed_at IS NULL
    AND worker_lease_id IS NULL AND worker_lease_expires_at IS NULL
  )
);
ALTER TABLE ai_agent_timeline_events DROP CONSTRAINT ai_agent_timeline_events_status_check;
ALTER TABLE ai_agent_timeline_events ADD CONSTRAINT ai_agent_timeline_events_status_check CHECK (
  status IN ('queued', 'running', 'waiting_approval', 'waiting_for_location', 'completed', 'failed', 'cancelled', 'pending', 'skipped')
);

ALTER TABLE copilot_document_operations
  ADD COLUMN destination_confirmed_by VARCHAR,
  ADD COLUMN destination_evidence JSONB NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(destination_evidence) = 'object' AND octet_length(destination_evidence::text) <= 4096),
  ADD COLUMN location_expires_at TIMESTAMPTZ(3) NOT NULL DEFAULT (now() + interval '24 hours');
ALTER TABLE copilot_document_operations DROP CONSTRAINT copilot_document_operations_status_check;
ALTER TABLE copilot_document_operations ADD CONSTRAINT copilot_document_operations_status_check CHECK (
  status IN ('waiting_location', 'ready', 'running', 'created', 'complete', 'failed', 'expired', 'cancelled')
);
UPDATE copilot_document_operations SET destination_confirmed_by = actor_id
  WHERE destination_confirmed_at IS NOT NULL;
ALTER TABLE copilot_document_operations ADD CONSTRAINT copilot_document_operations_confirmation_actor_check CHECK (
  (destination_confirmed_at IS NULL AND destination_confirmed_by IS NULL)
  OR (destination_confirmed_at IS NOT NULL AND destination_confirmed_by IS NOT NULL AND destination_confirmed_by = actor_id)
);

ALTER TABLE ai_mcp_delegation_requests
  ADD COLUMN execution_session_id VARCHAR UNIQUE REFERENCES ai_sessions_metadata(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN location_operation_id VARCHAR UNIQUE REFERENCES copilot_document_operations(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE ai_mcp_delegation_requests DROP CONSTRAINT ai_mcp_delegation_requests_shape_check;
ALTER TABLE ai_mcp_delegation_requests ADD CONSTRAINT ai_mcp_delegation_requests_shape_check CHECK (
  length(btrim(credential_family_id)) BETWEEN 1 AND 512 AND credential_generation >= 0
  AND cardinality(capability_snapshot) > 0
  AND length(btrim(capability_fingerprint)) BETWEEN 8 AND 128
  AND length(btrim(idempotency_key)) BETWEEN 1 AND 256
  AND length(btrim(request_text)) BETWEEN 1 AND 12000
  AND cardinality(requested_document_ids) <= 20 AND cardinality(requested_attachment_ids) <= 8
  AND length(btrim(request_fingerprint)) BETWEEN 8 AND 128
  AND (context_fingerprint IS NULL OR length(btrim(context_fingerprint)) BETWEEN 8 AND 128)
  AND status IN ('processing', 'completed', 'waiting_approval', 'waiting_for_location', 'unsupported_task',
    'credential_scope_denied', 'permission_denied', 'resource_not_accessible', 'failed', 'rejected', 'cancelled')
  AND jsonb_typeof(result) = 'object'
  AND ((approval_id IS NULL AND approval_preview_hash IS NULL AND approval_expires_at IS NULL)
    OR (approval_id IS NOT NULL AND approval_preview_hash IS NOT NULL AND approval_expires_at IS NOT NULL))
  AND ((approval_decision IS NULL AND approval_decision_fingerprint IS NULL AND approval_idempotency_key IS NULL AND approval_resolved_at IS NULL)
    OR (approval_decision IN ('approved', 'rejected') AND length(btrim(approval_decision_fingerprint)) BETWEEN 8 AND 128
      AND length(btrim(approval_idempotency_key)) BETWEEN 1 AND 300 AND approval_resolved_at IS NOT NULL))
  AND ((target_document_id IS NULL AND target_document_version IS NULL)
    OR (target_document_id IS NOT NULL AND target_document_version IS NOT NULL))
  AND (status <> 'cancelled' OR (agent_run_id IS NOT NULL AND COALESCE(result->>'code', '') = 'task_cancelled'
    AND COALESCE(result->>'agentRunId', '') = agent_run_id))
  AND (status <> 'waiting_for_location' OR (execution_session_id IS NOT NULL AND location_operation_id IS NOT NULL AND agent_run_id IS NOT NULL))
);

CREATE FUNCTION protect_mcp_delegation_execution_binding() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.execution_session_id IS NOT NULL
    AND NEW.execution_session_id IS DISTINCT FROM OLD.execution_session_id THEN
    RAISE EXCEPTION 'Delegated execution session is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.execution_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ai_sessions_metadata session WHERE session.id = NEW.execution_session_id
      AND session.user_id = NEW.actor_id AND session.workspace_id = NEW.workspace_id
      AND session.selected_context_project_id IS NULL AND session.doc_id IS NULL
      AND session.parent_session_id IS NULL
  ) THEN RAISE EXCEPTION 'Delegated execution session scope mismatch' USING ERRCODE = '23514'; END IF;
  IF NEW.location_operation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM copilot_document_operations operation WHERE operation.id = NEW.location_operation_id
      AND operation.session_id = NEW.execution_session_id AND operation.actor_id = NEW.actor_id
      AND operation.project_id IS NULL
  ) THEN RAISE EXCEPTION 'Delegated location operation scope mismatch' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER mcp_delegation_execution_binding BEFORE INSERT OR UPDATE ON ai_mcp_delegation_requests
FOR EACH ROW EXECUTE FUNCTION protect_mcp_delegation_execution_binding();

CREATE FUNCTION protect_document_location_confirmation() RETURNS trigger AS $$
BEGIN
  IF (NEW.destination_confirmed_by, NEW.destination_evidence, NEW.location_expires_at)
      IS DISTINCT FROM (OLD.destination_confirmed_by, OLD.destination_evidence, OLD.location_expires_at)
    AND NEW.destination_revision <> OLD.destination_revision + 1 THEN
    RAISE EXCEPTION 'Location evidence requires a new confirmation revision' USING ERRCODE = '23514';
  END IF;
  IF NEW.destination_revision IS DISTINCT FROM OLD.destination_revision THEN
    INSERT INTO copilot_document_operation_events(operation_id, event_type, detail)
    VALUES (NEW.id, 'location_permission_confirmed', jsonb_build_object(
      'actorId', NEW.destination_confirmed_by, 'revision', NEW.destination_revision,
      'permissionEvidence', NEW.destination_evidence, 'expiresAt', NEW.location_expires_at
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER document_location_confirmation BEFORE UPDATE ON copilot_document_operations
FOR EACH ROW EXECUTE FUNCTION protect_document_location_confirmation();

CREATE TABLE ai_mcp_delegation_tool_calls (
  id VARCHAR PRIMARY KEY,
  request_id VARCHAR NOT NULL REFERENCES ai_mcp_delegation_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
  call_id VARCHAR NOT NULL CHECK (length(call_id) BETWEEN 1 AND 256),
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 19),
  tool_name VARCHAR NOT NULL CHECK (length(tool_name) BETWEEN 1 AND 256),
  args JSONB NOT NULL CHECK (jsonb_typeof(args) = 'object' AND octet_length(args::text) <= 2097152),
  result JSONB CHECK (octet_length(result::text) <= 2097152),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ(3),
  CHECK ((result IS NULL) = (completed_at IS NULL)),
  UNIQUE(request_id, call_id),
  UNIQUE(request_id, ordinal)
);
CREATE FUNCTION protect_delegated_tool_checkpoint() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.request_id, NEW.call_id, NEW.ordinal, NEW.tool_name, NEW.args, NEW.created_at)
    IS DISTINCT FROM (OLD.id, OLD.request_id, OLD.call_id, OLD.ordinal, OLD.tool_name, OLD.args, OLD.created_at)
    OR (OLD.completed_at IS NOT NULL AND
      (NEW.result, NEW.completed_at) IS DISTINCT FROM (OLD.result, OLD.completed_at)) THEN
    RAISE EXCEPTION 'Delegated tool checkpoint is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER delegated_tool_checkpoint BEFORE UPDATE ON ai_mcp_delegation_tool_calls
FOR EACH ROW EXECUTE FUNCTION protect_delegated_tool_checkpoint();

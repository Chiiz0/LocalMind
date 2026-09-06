CREATE OR REPLACE FUNCTION ai_agent_runtime_manual_control_payload_valid(
  value jsonb, payload_scope text, expected_action text, expected_status text
) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    payload_scope IN ('step_summary', 'timeline')
    AND (expected_action IN ('cancel', 'cancel_requested', 'resume')
      OR (payload_scope = 'timeline' AND expected_action = 'abandon'))
    AND (expected_status IS NULL OR expected_status IN ('queued', 'running', 'cancelled', 'pending', 'skipped', 'completed'))
    AND jsonb_typeof(value) = 'object'
    AND jsonb_typeof(value->'version') = 'string'
    AND btrim(value->>'version') = 'agent-runtime-manual-control/v1'
    AND jsonb_typeof(value->'action') = 'string' AND btrim(value->>'action') = expected_action
    AND jsonb_typeof(value->'actorId') = 'string' AND length(btrim(value->>'actorId')) BETWEEN 1 AND 512
    AND (NOT (value ? 'reason') OR value->'reason' = 'null'::jsonb
      OR (jsonb_typeof(value->'reason') = 'string' AND length(btrim(value->>'reason')) BETWEEN 1 AND 1024))
    AND (payload_scope <> 'timeline' OR (
      expected_status IS NOT NULL
      AND jsonb_typeof(value->'previousStatus') = 'string'
      AND btrim(value->>'previousStatus') IN ('queued', 'running', 'waiting_approval', 'waiting_for_location', 'completed', 'failed', 'cancelled', 'pending', 'skipped')
      AND (btrim(value->>'previousStatus') <> 'waiting_for_location' OR expected_action = 'cancel')
      AND jsonb_typeof(value->'workflow') = 'string' AND length(btrim(value->>'workflow')) BETWEEN 1 AND 512
      AND jsonb_typeof(value->'sourceType') = 'string' AND length(btrim(value->>'sourceType')) BETWEEN 1 AND 512
      AND jsonb_typeof(value->'sourceId') = 'string' AND length(btrim(value->>'sourceId')) BETWEEN 1 AND 512
      AND jsonb_typeof(value->'controlledAt') = 'string' AND length(btrim(value->>'controlledAt')) BETWEEN 1 AND 128
      AND (
        (expected_action = 'cancel' AND expected_status IN ('cancelled', 'skipped'))
        OR (expected_action = 'cancel_requested' AND expected_status = 'running'
          AND btrim(value->>'previousStatus') = 'running'
          AND jsonb_typeof(value->'workerAttempt') = 'number'
          AND (value->>'workerAttempt') ~ '^[0-9]+$'
          AND (value->>'workerAttempt')::numeric > 0 AND (value->>'workerAttempt')::numeric <= 1000000
          AND jsonb_typeof(value->'workerLeaseId') = 'string' AND length(btrim(value->>'workerLeaseId')) BETWEEN 1 AND 512
          AND jsonb_typeof(value->'workerLeaseExpiresAt') = 'string' AND length(btrim(value->>'workerLeaseExpiresAt')) BETWEEN 1 AND 128)
        OR (expected_action = 'resume' AND expected_status IN ('queued', 'pending', 'completed'))
        OR (expected_action = 'abandon' AND expected_status = 'cancelled' AND btrim(value->>'previousStatus') = 'failed')
      )
    )), false
  );
$$;

CREATE FUNCTION require_document_location_permission_evidence() RETURNS trigger AS $$
BEGIN
  IF NEW.destination_revision IS DISTINCT FROM OLD.destination_revision AND NOT COALESCE(
    NEW.destination_evidence @> '{"canCreateDoc":true,"canReadOrganization":true,"canSync":true,"canRead":true,"canWrite":true,"canOrganize":true}'::jsonb
    AND NEW.destination_evidence->>'actorId' = NEW.actor_id
    AND NEW.destination_evidence->>'workspaceId' = NEW.destination_workspace_id
    AND NEW.destination_confirmed_by = NEW.actor_id
    AND NEW.destination_confirmed_at IS NOT NULL,
    false
  ) THEN RAISE EXCEPTION 'Document location permission evidence is incomplete' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER document_location_permission_evidence BEFORE UPDATE ON copilot_document_operations
FOR EACH ROW EXECUTE FUNCTION require_document_location_permission_evidence();

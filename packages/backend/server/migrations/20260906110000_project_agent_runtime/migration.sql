ALTER TABLE ai_agent_runs
  ALTER COLUMN workspace_id DROP NOT NULL,
  ADD COLUMN project_id varchar REFERENCES ai_context_projects(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT ai_agent_runs_owner_check CHECK (num_nonnulls(workspace_id, project_id) = 1),
  ADD CONSTRAINT ai_agent_runs_project_snapshot_key UNIQUE (id, project_id, actor_id),
  ADD CONSTRAINT ai_agent_runs_project_source_snapshot_key UNIQUE (id, project_id, actor_id, workflow, source_type, source_id);

CREATE UNIQUE INDEX ai_agent_runs_project_id_source_type_source_id_key ON ai_agent_runs(project_id, source_type, source_id);
CREATE INDEX ai_agent_runs_project_id_status_updated_at_idx ON ai_agent_runs(project_id, status, updated_at);

ALTER TABLE ai_agent_steps
  ALTER COLUMN workspace_id DROP NOT NULL,
  ADD COLUMN input jsonb,
  ADD COLUMN project_id varchar,
  ADD CONSTRAINT ai_agent_steps_owner_check CHECK (num_nonnulls(workspace_id, project_id) = 1),
  ADD CONSTRAINT ai_agent_steps_project_snapshot_fkey FOREIGN KEY (run_id, project_id, actor_id) REFERENCES ai_agent_runs(id, project_id, actor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT ai_agent_steps_project_timeline_snapshot_key UNIQUE (id, run_id, project_id, actor_id);

ALTER TABLE ai_agent_timeline_events
  ALTER COLUMN workspace_id DROP NOT NULL,
  ADD COLUMN project_id varchar,
  ADD CONSTRAINT ai_agent_timeline_events_owner_check CHECK (num_nonnulls(workspace_id, project_id) = 1),
  ADD CONSTRAINT ai_agent_timeline_events_project_snapshot_fkey FOREIGN KEY (run_id, project_id, actor_id) REFERENCES ai_agent_runs(id, project_id, actor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT ai_agent_timeline_project_step_fkey FOREIGN KEY (step_id, run_id, project_id, actor_id) REFERENCES ai_agent_steps(id, run_id, project_id, actor_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE ai_agent_runtime_execution_results
  ALTER COLUMN workspace_id DROP NOT NULL,
  ADD COLUMN project_id varchar,
  ADD CONSTRAINT ai_agent_results_owner_check CHECK (num_nonnulls(workspace_id, project_id) = 1),
  ADD CONSTRAINT ai_agent_results_project_snapshot_fkey FOREIGN KEY (run_id, project_id, actor_id) REFERENCES ai_agent_runs(id, project_id, actor_id) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT ai_agent_results_project_source_fkey FOREIGN KEY (run_id, project_id, actor_id, workflow, source_type, source_id) REFERENCES ai_agent_runs(id, project_id, actor_id, workflow, source_type, source_id) ON DELETE CASCADE ON UPDATE RESTRICT;
CREATE UNIQUE INDEX ai_agent_runtime_execution_results_project_id_result_fingerprint_key ON ai_agent_runtime_execution_results(project_id, result_fingerprint);

ALTER TABLE ai_agent_runs DROP CONSTRAINT ai_agent_runs_location_wait_check;
ALTER TABLE ai_agent_runs ADD CONSTRAINT ai_agent_runs_location_wait_check CHECK (
  status <> 'waiting_for_location' OR (
    ((source_type = 'mcp_ai_delegation' AND workflow = 'agent_runtime_localmind_tool_agent' AND session_id IS NOT NULL)
      OR (project_id IS NOT NULL AND source_type = 'project_publication'))
    AND queued_at IS NULL AND completed_at IS NULL AND worker_lease_id IS NULL AND worker_lease_expires_at IS NULL
  )
);

CREATE FUNCTION ai_agent_project_owner_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.project_id IS DISTINCT FROM NEW.project_id OR OLD.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Agent Runtime owner is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_agent_run_owner_guard BEFORE UPDATE ON ai_agent_runs FOR EACH ROW EXECUTE FUNCTION ai_agent_project_owner_immutable();
CREATE TRIGGER ai_agent_step_owner_guard BEFORE UPDATE ON ai_agent_steps FOR EACH ROW EXECUTE FUNCTION ai_agent_project_owner_immutable();
CREATE TRIGGER ai_agent_timeline_owner_guard BEFORE UPDATE ON ai_agent_timeline_events FOR EACH ROW EXECUTE FUNCTION ai_agent_project_owner_immutable();
CREATE TRIGGER ai_agent_result_owner_guard BEFORE UPDATE ON ai_agent_runtime_execution_results FOR EACH ROW EXECUTE FUNCTION ai_agent_project_owner_immutable();

CREATE FUNCTION ai_agent_step_input_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.input IS DISTINCT FROM NEW.input THEN
    RAISE EXCEPTION 'Agent Runtime input is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_agent_step_input_guard BEFORE UPDATE ON ai_agent_steps FOR EACH ROW EXECUTE FUNCTION ai_agent_step_input_immutable();
ALTER TABLE ai_agent_steps ADD CONSTRAINT ai_agent_step_input_check CHECK (
  input IS NULL OR (project_id IS NOT NULL AND jsonb_typeof(input) = 'object' AND octet_length(input::text) <= 2097152)
);

CREATE OR REPLACE FUNCTION ai_agent_run_assert_session_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ai_sessions_metadata session
    WHERE session.id = NEW.session_id AND session.user_id = NEW.actor_id
      AND session.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      AND (NEW.project_id IS NULL OR session.selected_context_project_id = NEW.project_id)
  ) THEN
    RAISE EXCEPTION 'Agent run session must match its actor and resource owner' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE ai_agent_runtime_execution_results DROP CONSTRAINT ai_agent_runtime_execution_results_side_effect_mode_check;
ALTER TABLE ai_agent_runtime_execution_results ADD CONSTRAINT ai_agent_runtime_execution_results_side_effect_mode_check
  CHECK (side_effect_mode IN ('none', 'workspace_write', 'project_write', 'external_tool') AND (side_effect_mode <> 'project_write' OR project_id IS NOT NULL));

-- Extend the existing immutable evidence contract to explicit Project owners.
CREATE OR REPLACE FUNCTION public.ai_agent_run_state_timeline_required()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."status" IS NOT DISTINCT FROM NEW."status"
     AND OLD."timeline_fingerprint" IS NOT DISTINCT FROM
       NEW."timeline_fingerprint"
     AND OLD."completed_at" IS NOT DISTINCT FROM NEW."completed_at"
     AND OLD."failure_code" IS NOT DISTINCT FROM NEW."failure_code"
     AND OLD."failure_message" IS NOT DISTINCT FROM NEW."failure_message"
     AND OLD."queued_at" IS NOT DISTINCT FROM NEW."queued_at"
     AND OLD."worker_lease_id" IS NOT DISTINCT FROM NEW."worker_lease_id"
     AND OLD."worker_lease_expires_at" IS NOT DISTINCT FROM
       NEW."worker_lease_expires_at"
     AND OLD."worker_attempt" IS NOT DISTINCT FROM NEW."worker_attempt"
     AND OLD."worker_max_attempts" IS NOT DISTINCT FROM
       NEW."worker_max_attempts"
     AND OLD."last_attempt_at" IS NOT DISTINCT FROM NEW."last_attempt_at" THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ai_agent_timeline_events" event
    WHERE event."run_id" = NEW."id"
      AND event."step_id" IS NULL
      AND event."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
      AND event."project_id" IS NOT DISTINCT FROM NEW."project_id"
      AND event."actor_id" IS NOT DISTINCT FROM NEW."actor_id"
      AND event."event_type" IN ('run_status', 'run_cancellation')
      AND event."status" IS NOT DISTINCT FROM NEW."status"
      AND event."created_at" IS NOT DISTINCT FROM NEW."updated_at"
      AND event."payload"->>'workflow' IS NOT DISTINCT FROM NEW."workflow"
      AND event."payload"->>'sourceType' IS NOT DISTINCT FROM
        NEW."source_type"
      AND event."payload"->>'sourceId' IS NOT DISTINCT FROM NEW."source_id"
      AND (
        TG_OP = 'INSERT'
        OR (
          event."created_at" >= OLD."updated_at"
          AND (
            OLD."status" IS DISTINCT FROM NEW."status"
            OR
            event."created_at" > OLD."updated_at"
            OR event."payload"->>'previousStatus' IS NOT DISTINCT FROM
              OLD."status"
            OR (
              jsonb_typeof(event."payload"->'workerAttempt') = 'number'
              AND (event."payload"->>'workerAttempt') ~ '^[0-9]+$'
              AND (event."payload"->>'workerAttempt')::numeric =
                NEW."worker_attempt"
            )
          )
        )
      )
      AND (
        NOT (event."payload" ? 'workerLeaseId')
        OR NEW."worker_lease_id" IS NULL
        OR event."payload"->>'workerLeaseId' IS NOT DISTINCT FROM
          NEW."worker_lease_id"
      )
      AND (
        NOT (event."payload" ? 'failureCode')
        OR event."payload"->>'failureCode' IS NOT DISTINCT FROM
          NEW."failure_code"
      )
      AND (
        NOT (event."payload" ? 'failureMessage')
        OR event."payload"->>'failureMessage' IS NOT DISTINCT FROM
          NEW."failure_message"
      )
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'ai_agent_runs_state_timeline_required_check'
    USING ERRCODE = '23514',
      CONSTRAINT = 'ai_agent_runs_state_timeline_required_check';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.ai_agent_runtime_adapter_resolution_snapshot_valid(value jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT COALESCE(
    jsonb_typeof(value) = 'object'
    AND jsonb_typeof(value->'workflow') = 'string'
    AND length(btrim(value->>'workflow')) BETWEEN 1 AND 512
    AND ai_agent_runtime_adapter_resolution_step_types_valid(
      value->'supportedStepTypes'
    )
    AND jsonb_typeof(value->'sideEffectMode') = 'string'
    AND btrim(value->>'sideEffectMode') IN (
      'none',
      'workspace_write', 'project_write',
      'external_tool'
    ),
    false
  );
$function$
;
CREATE OR REPLACE FUNCTION public.ai_agent_runtime_execution_result_terminal_snapshot_valid()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  BEGIN
    IF (NEW."result_payload"->>'completedAt')::timestamptz IS DISTINCT FROM
       NEW."completed_at" THEN
      RAISE EXCEPTION
        'ai_agent_runtime_execution_results_completed_at_payload_check'
        USING ERRCODE = '23514',
          CONSTRAINT = 'ai_agent_runtime_execution_results_completed_at_payload_check';
    END IF;
  EXCEPTION WHEN invalid_datetime_format THEN
    RAISE EXCEPTION
      'ai_agent_runtime_execution_results_completed_at_payload_check'
      USING ERRCODE = '23514',
        CONSTRAINT = 'ai_agent_runtime_execution_results_completed_at_payload_check';
  END;

  IF TG_OP = 'UPDATE'
     AND OLD."run_id" IS NOT DISTINCT FROM NEW."run_id"
     AND OLD."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
     AND OLD."result_status" IS NOT DISTINCT FROM NEW."result_status"
     AND OLD."failure_code" IS NOT DISTINCT FROM NEW."failure_code"
     AND OLD."failure_message" IS NOT DISTINCT FROM NEW."failure_message"
     AND OLD."worker_attempt" IS NOT DISTINCT FROM NEW."worker_attempt"
     AND OLD."completed_at" IS NOT DISTINCT FROM NEW."completed_at" THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ai_agent_runs" run
    WHERE run."id" = NEW."run_id"
      AND run."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
      AND run."project_id" IS NOT DISTINCT FROM NEW."project_id"
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ai_agent_runs" run
    WHERE run."id" = NEW."run_id"
      AND run."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
      AND run."project_id" IS NOT DISTINCT FROM NEW."project_id"
      AND run."actor_id" = NEW."actor_id"
      AND run."workflow" = NEW."workflow"
      AND run."source_type" = NEW."source_type"
      AND run."source_id" = NEW."source_id"
      AND run."source_type" <> 'repair_execution_request'
      AND run."status" IN ('completed', 'failed')
      AND run."status" = NEW."result_status"
      AND run."worker_attempt" = NEW."worker_attempt"
      AND run."completed_at" = NEW."completed_at"
      AND (
        (
          NEW."result_status" = 'completed'
          AND run."failure_code" IS NULL
          AND run."failure_message" IS NULL
          AND NEW."failure_code" IS NULL
          AND NEW."failure_message" IS NULL
        )
        OR (
          NEW."result_status" = 'failed'
          AND run."failure_code" = NEW."failure_code"
          AND run."failure_message" = NEW."failure_message"
        )
      )
  ) THEN
    RAISE EXCEPTION
      'ai_agent_runtime_execution_results_terminal_snapshot_check'
      USING ERRCODE = '23514',
        CONSTRAINT = 'ai_agent_runtime_execution_results_terminal_snapshot_check';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.ai_agent_runtime_run_execution_result_terminal_valid()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF OLD."status" = 'failed'
     AND OLD."source_type" <> 'repair_execution_request'
     AND NEW."status" = 'cancelled'
     AND NEW."completed_at" IS NOT NULL
     AND NEW."failure_code" IS NOT DISTINCT FROM OLD."failure_code"
     AND NEW."failure_message" IS NOT DISTINCT FROM OLD."failure_message"
     AND NEW."queued_at" IS NULL
     AND NEW."worker_lease_id" IS NULL
     AND NEW."worker_lease_expires_at" IS NULL
     AND NEW."worker_attempt" = OLD."worker_attempt"
     AND NEW."worker_max_attempts" = OLD."worker_max_attempts"
     AND NEW."last_attempt_at" IS NOT DISTINCT FROM OLD."last_attempt_at"
     AND EXISTS (
       SELECT 1
       FROM "ai_agent_runtime_execution_results" result
       WHERE result."run_id" = OLD."id"
         AND result."workspace_id" IS NOT DISTINCT FROM OLD."workspace_id"
      AND result."project_id" IS NOT DISTINCT FROM OLD."project_id"
         AND result."actor_id" = OLD."actor_id"
         AND result."workflow" = OLD."workflow"
         AND result."source_type" = OLD."source_type"
         AND result."source_id" = OLD."source_id"
         AND result."source_type" <> 'repair_execution_request'
         AND result."worker_attempt" = OLD."worker_attempt"
         AND result."result_status" = 'failed'
         AND result."completed_at" = OLD."completed_at"
         AND result."failure_code" IS NOT DISTINCT FROM OLD."failure_code"
         AND result."failure_message" IS NOT DISTINCT FROM
           OLD."failure_message"
     ) THEN
    RETURN NEW;
  END IF;

  IF NEW."status" = 'queued'
     AND OLD."status" IN ('failed', 'cancelled')
     AND NEW."worker_attempt" = OLD."worker_attempt"
     AND NEW."completed_at" IS NULL
     AND NEW."failure_code" IS NULL
     AND NEW."failure_message" IS NULL
     AND NEW."worker_lease_id" IS NULL
     AND NEW."worker_lease_expires_at" IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD."status" IN ('completed', 'failed')
     AND EXISTS (
       SELECT 1
       FROM "ai_agent_runtime_execution_results" result
       WHERE result."run_id" = OLD."id"
         AND result."workspace_id" IS NOT DISTINCT FROM OLD."workspace_id"
      AND result."project_id" IS NOT DISTINCT FROM OLD."project_id"
         AND result."worker_attempt" = OLD."worker_attempt"
     )
     AND NOT EXISTS (
       SELECT 1
       FROM "ai_agent_runtime_execution_results" result
       WHERE result."run_id" = NEW."id"
         AND result."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
      AND result."project_id" IS NOT DISTINCT FROM NEW."project_id"
         AND result."actor_id" = NEW."actor_id"
         AND result."workflow" = NEW."workflow"
         AND result."source_type" = NEW."source_type"
         AND result."source_id" = NEW."source_id"
         AND result."source_type" <> 'repair_execution_request'
         AND result."worker_attempt" = NEW."worker_attempt"
         AND result."result_status" = NEW."status"
         AND result."completed_at" = NEW."completed_at"
         AND (
           (
             result."result_status" = 'completed'
             AND NEW."failure_code" IS NULL
             AND NEW."failure_message" IS NULL
             AND result."failure_code" IS NULL
             AND result."failure_message" IS NULL
           )
           OR (
             result."result_status" = 'failed'
             AND NEW."failure_code" = result."failure_code"
             AND NEW."failure_message" = result."failure_message"
           )
         )
     ) THEN
    RAISE EXCEPTION
      'ai_agent_runs_execution_result_terminal_snapshot_check'
      USING ERRCODE = '23514',
        CONSTRAINT = 'ai_agent_runs_execution_result_terminal_snapshot_check';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ai_agent_runtime_execution_results" result
    WHERE result."run_id" = NEW."id"
      AND result."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
      AND result."project_id" IS NOT DISTINCT FROM NEW."project_id"
      AND result."worker_attempt" = NEW."worker_attempt"
  )
     AND NOT EXISTS (
       SELECT 1
       FROM "ai_agent_runtime_execution_results" result
       WHERE result."run_id" = NEW."id"
         AND result."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
      AND result."project_id" IS NOT DISTINCT FROM NEW."project_id"
         AND result."actor_id" = NEW."actor_id"
         AND result."workflow" = NEW."workflow"
         AND result."source_type" = NEW."source_type"
         AND result."source_id" = NEW."source_id"
         AND result."source_type" <> 'repair_execution_request'
         AND result."worker_attempt" = NEW."worker_attempt"
         AND result."result_status" = NEW."status"
         AND result."completed_at" = NEW."completed_at"
         AND (
           (
             result."result_status" = 'completed'
             AND NEW."failure_code" IS NULL
             AND NEW."failure_message" IS NULL
             AND result."failure_code" IS NULL
             AND result."failure_message" IS NULL
           )
           OR (
             result."result_status" = 'failed'
             AND NEW."failure_code" = result."failure_code"
             AND NEW."failure_message" = result."failure_message"
           )
         )
     ) THEN
    RAISE EXCEPTION
      'ai_agent_runs_execution_result_terminal_snapshot_check'
      USING ERRCODE = '23514',
        CONSTRAINT = 'ai_agent_runs_execution_result_terminal_snapshot_check';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.ai_agent_runtime_worker_completion_payload_valid(value jsonb, payload_scope text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT COALESCE(
    payload_scope IN ('step_summary', 'step_timeline', 'run_timeline')
    AND jsonb_typeof(value) = 'object'
    AND jsonb_typeof(value->'version') = 'string'
    AND btrim(value->>'version') = 'agent-runtime-worker-completion/v1'
    AND jsonb_typeof(value->'executor') = 'string'
    AND btrim(value->>'executor') = 'agent_runtime_worker'
    AND jsonb_typeof(value->'adapterWorkflow') = 'string'
    AND length(btrim(value->>'adapterWorkflow')) BETWEEN 1 AND 512
    AND jsonb_typeof(value->'sideEffectMode') = 'string'
    AND btrim(value->>'sideEffectMode') IN (
      'none',
      'workspace_write', 'project_write',
      'external_tool'
    )
    AND jsonb_typeof(value->'sideEffectsApplied') = 'boolean'
    AND (
      (
        (value->>'sideEffectsApplied')::boolean = false
        AND NOT (value ? 'sideEffectSummary')
      )
      OR (
        (value->>'sideEffectsApplied')::boolean = true
        AND btrim(value->>'sideEffectMode') IN (
          'workspace_write', 'project_write',
          'external_tool'
        )
        AND jsonb_typeof(value->'sideEffectSummary') = 'object'
      )
    )
    AND jsonb_typeof(value->'summary') = 'string'
    AND length(btrim(value->>'summary')) BETWEEN 1 AND 1024
    AND jsonb_typeof(value->'workerAttempt') = 'number'
    AND (value->>'workerAttempt') ~ '^[0-9]+$'
    AND (value->>'workerAttempt')::numeric > 0
    AND (value->>'workerAttempt')::numeric <= 1000000
    AND jsonb_typeof(value->'workerLeaseId') = 'string'
    AND length(btrim(value->>'workerLeaseId')) BETWEEN 1 AND 512
    AND ai_agent_runtime_adapter_resolution_valid(
      value->'adapterResolution'
    )
    AND btrim(value->'adapterResolution'->>'status') = 'completed'
    AND btrim(value->'adapterResolution'->>'workflow') =
      btrim(value->>'adapterWorkflow')
    AND btrim(value->'adapterResolution'->'adapter'->>'workflow') =
      btrim(value->>'adapterWorkflow')
    AND btrim(value->'adapterResolution'->'adapter'->>'sideEffectMode') =
      btrim(value->>'sideEffectMode')
    AND (
      payload_scope <> 'run_timeline'
      OR (
        jsonb_typeof(value->'workerMaxAttempts') = 'number'
        AND (value->>'workerMaxAttempts') ~ '^[0-9]+$'
        AND (value->>'workerMaxAttempts')::numeric > 0
        AND (value->>'workerMaxAttempts')::numeric <= 1000000
        AND jsonb_typeof(value->'workflow') = 'string'
        AND length(btrim(value->>'workflow')) BETWEEN 1 AND 512
        AND btrim(value->>'workflow') = btrim(value->>'adapterWorkflow')
        AND jsonb_typeof(value->'sourceType') = 'string'
        AND length(btrim(value->>'sourceType')) BETWEEN 1 AND 512
        AND jsonb_typeof(value->'sourceId') = 'string'
        AND length(btrim(value->>'sourceId')) BETWEEN 1 AND 512
      )
    )
    AND (
      payload_scope <> 'step_timeline'
      OR (
        jsonb_typeof(value->'stepKey') = 'string'
        AND length(btrim(value->>'stepKey')) BETWEEN 1 AND 512
        AND jsonb_typeof(value->'stepType') = 'string'
        AND btrim(value->>'stepType') IN (
          'approval',
          'codex',
          'handoff',
          'mcp',
          'model',
          'tool'
        )
      )
    ),
    false
  );
$function$
;
CREATE OR REPLACE FUNCTION public.ai_agent_step_state_timeline_required()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  step_event_type text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."status" IS NOT DISTINCT FROM NEW."status"
     AND OLD."started_at" IS NOT DISTINCT FROM NEW."started_at"
     AND OLD."completed_at" IS NOT DISTINCT FROM NEW."completed_at" THEN
    RETURN NEW;
  END IF;

  step_event_type := CASE NEW."step_type"
    WHEN 'approval' THEN 'approval_step'
    WHEN 'codex' THEN 'codex_step'
    WHEN 'handoff' THEN 'handoff_step'
    WHEN 'mcp' THEN 'mcp_step'
    WHEN 'tool' THEN 'tool_step'
    ELSE 'model_step'
  END;

  IF EXISTS (
    SELECT 1
    FROM "ai_agent_timeline_events" event
    WHERE event."run_id" = NEW."run_id"
      AND event."step_id" = NEW."id"
      AND event."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"
      AND event."project_id" IS NOT DISTINCT FROM NEW."project_id"
      AND event."actor_id" IS NOT DISTINCT FROM NEW."actor_id"
      AND event."event_type" IN (step_event_type, 'step_output', 'step_error')
      AND event."status" IS NOT DISTINCT FROM NEW."status"
      AND event."created_at" IS NOT DISTINCT FROM NEW."updated_at"
      AND (
        NOT (event."payload" ? 'stepKey')
        OR event."payload"->>'stepKey' IS NOT DISTINCT FROM NEW."step_key"
      )
      AND (
        NOT (event."payload" ? 'stepType')
        OR event."payload"->>'stepType' IS NOT DISTINCT FROM NEW."step_type"
      )
      AND (
        TG_OP = 'INSERT'
        OR event."created_at" >= OLD."updated_at"
      )
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'ai_agent_steps_state_timeline_required_check'
    USING ERRCODE = '23514',
      CONSTRAINT = 'ai_agent_steps_state_timeline_required_check';
END;
$function$
;

ALTER TABLE ai_agent_runtime_execution_results DROP CONSTRAINT ai_agent_runtime_execution_results_status_payload_check;
ALTER TABLE ai_agent_runtime_execution_results ADD CONSTRAINT ai_agent_runtime_execution_results_status_payload_check
CHECK (((((result_status)::text = 'completed'::text) AND ((executor)::text = 'agent_runtime_record_only_adapter'::text) AND ((adapter_workflow)::text = 'agent_runtime_record_only'::text) AND ((side_effect_mode)::text = 'none'::text) AND (side_effects_applied = false) AND (failure_code IS NULL) AND (failure_message IS NULL) AND (NOT (result_payload ? 'failureCode'::text)) AND (NOT (result_payload ? 'failureMessage'::text))) OR (((result_status)::text = 'completed'::text) AND ((executor)::text = 'agent_runtime_worker'::text) AND ((adapter_workflow)::text = (workflow)::text) AND (failure_code IS NULL) AND (failure_message IS NULL) AND (NOT (result_payload ? 'failureCode'::text)) AND (NOT (result_payload ? 'failureMessage'::text)) AND (jsonb_typeof((result_payload -> 'sideEffectsApplied'::text)) = 'boolean'::text) AND (((result_payload ->> 'sideEffectsApplied'::text))::boolean = side_effects_applied) AND (((side_effects_applied = false) AND (NOT (result_payload ? 'sideEffectSummary'::text))) OR ((side_effects_applied = true) AND ((side_effect_mode)::text = ANY ((ARRAY['workspace_write'::character varying, 'project_write'::character varying, 'external_tool'::character varying])::text[])) AND (jsonb_typeof((result_payload -> 'sideEffectSummary'::text)) = 'object'::text))) AND ai_agent_runtime_adapter_resolution_valid((result_payload -> 'adapterResolution'::text)) AND (btrim(((result_payload -> 'adapterResolution'::text) ->> 'status'::text)) = 'completed'::text) AND (btrim(((result_payload -> 'adapterResolution'::text) ->> 'workflow'::text)) = (workflow)::text) AND (btrim((((result_payload -> 'adapterResolution'::text) -> 'adapter'::text) ->> 'workflow'::text)) = (adapter_workflow)::text) AND (btrim((((result_payload -> 'adapterResolution'::text) -> 'adapter'::text) ->> 'sideEffectMode'::text)) = (side_effect_mode)::text)) OR (((result_status)::text = 'failed'::text) AND ((executor)::text = ANY ((ARRAY['agent_runtime_stale_recovery_worker'::character varying, 'agent_runtime_worker'::character varying])::text[])) AND (((executor)::text <> 'agent_runtime_stale_recovery_worker'::text) OR (((adapter_workflow)::text = (workflow)::text) AND ((side_effect_mode)::text = 'none'::text) AND ((failure_code)::text = 'stale_worker_lease'::text))) AND (side_effects_applied = false) AND (failure_code IS NOT NULL) AND (failure_message IS NOT NULL) AND (jsonb_typeof((result_payload -> 'failureCode'::text)) = 'string'::text) AND (btrim((result_payload ->> 'failureCode'::text)) = (failure_code)::text) AND (jsonb_typeof((result_payload -> 'failureMessage'::text)) = 'string'::text) AND (btrim((result_payload ->> 'failureMessage'::text)) = btrim(failure_message)) AND ((NOT (result_payload ? 'adapterResolution'::text)) OR (ai_agent_runtime_adapter_resolution_valid((result_payload -> 'adapterResolution'::text)) AND (btrim(((result_payload -> 'adapterResolution'::text) ->> 'status'::text)) = ANY (ARRAY['unsupported_workflow'::text, 'unsupported_contract'::text, 'execution_failed'::text, 'invalid_executor_result'::text, 'incomplete_execution'::text])))))));

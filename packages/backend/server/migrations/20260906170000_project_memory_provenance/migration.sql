ALTER TABLE ai_context_memories ADD COLUMN project_source_check_id VARCHAR;
ALTER TABLE ai_context_memories ADD CONSTRAINT ai_context_memories_project_source_check_id_fkey
  FOREIGN KEY (project_source_check_id) REFERENCES ai_shared_write_source_checks(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX ai_context_memories_project_source_check_id_idx ON ai_context_memories(project_source_check_id);

CREATE FUNCTION ai_context_native_memory_provenance_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_source_check_id IS DISTINCT FROM OLD.project_source_check_id THEN
    RAISE EXCEPTION 'Project memory source evidence is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.project_source_check_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ai_shared_write_source_checks evidence
    JOIN ai_sessions_metadata session ON session.id = evidence.session_id
    WHERE evidence.id = NEW.project_source_check_id AND evidence.allowed
      AND evidence.project_id = NEW.project_id AND evidence.actor_id = NEW.owner_user_id
      AND evidence.session_id = NEW.source_session_id AND evidence.sink_type = 'project_memory'
      AND evidence.sink_workspace_id IS NULL AND evidence.phase = 'execute'
      AND session.workspace_id IS NULL AND session.selected_context_project_id = NEW.project_id
      AND session.user_id = NEW.owner_user_id AND session.deleted_at IS NULL
      AND NEW.scope = 'project' AND NEW.workspace_id IS NULL AND NEW.doc_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Native memory requires authorized Project conversation evidence' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_context_native_memory_provenance_check BEFORE INSERT OR UPDATE
ON ai_context_memories FOR EACH ROW EXECUTE FUNCTION ai_context_native_memory_provenance_guard();

CREATE OR REPLACE FUNCTION ai_context_assert_active_memory_sources(target_memory_id VARCHAR)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ai_context_memories memory
    WHERE memory.id = target_memory_id AND memory.scope = 'project' AND memory.status = 'active'
      AND (
        (NOT EXISTS (SELECT 1 FROM ai_context_memory_sources source WHERE source.memory_id = memory.id)
          AND NOT EXISTS (
            SELECT 1 FROM ai_shared_write_source_checks evidence
            JOIN ai_context_memory_events event ON event.decision_fingerprint = evidence.sink_id
              AND event.memory_id = memory.id AND event.operation IN ('ADD', 'UPDATE')
            WHERE evidence.id = memory.project_source_check_id AND evidence.allowed
              AND evidence.project_id = memory.project_id AND evidence.sink_type = 'project_memory'
              AND evidence.sink_workspace_id IS NULL
          ))
        OR EXISTS (
          SELECT 1 FROM ai_context_memory_sources source
          JOIN ai_context_project_grants grant_row ON grant_row.id = source.project_grant_id
          WHERE source.memory_id = memory.id AND grant_row.status <> 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Active project memory requires authorized source provenance'
      USING ERRCODE = '23514', CONSTRAINT = 'ai_context_memories_active_source_required_check';
  END IF;
END;
$$;

-- Preserve the existing actor deletion and event immutability rules while allowing a native session owner.
DO $$
DECLARE
  definition TEXT := pg_get_functiondef('public.ai_context_assert_memory_event_snapshot()'::regprocedure);
  old_comparison TEXT := 'session."workspace_id" = NEW."workspace_id"';
BEGIN
  IF position(old_comparison IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected memory event validator definition';
  END IF;
  EXECUTE replace(definition, old_comparison, 'session."workspace_id" IS NOT DISTINCT FROM NEW."workspace_id"');
END;
$$;
ALTER FUNCTION ai_context_assert_memory_event_snapshot() SET search_path = pg_catalog, public;
ALTER FUNCTION ai_context_memory_source_guard() SET search_path = pg_catalog, public;

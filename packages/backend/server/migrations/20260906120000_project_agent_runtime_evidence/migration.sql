CREATE FUNCTION ai_agent_project_terminal_receipt_required() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NEW.status IN ('completed', 'failed') AND NOT EXISTS (
    SELECT 1 FROM ai_agent_runtime_execution_results result
    WHERE result.run_id = NEW.id AND result.project_id = NEW.project_id
      AND result.workspace_id IS NULL AND result.actor_id = NEW.actor_id
      AND result.worker_attempt = NEW.worker_attempt AND result.result_status = NEW.status
      AND result.completed_at = NEW.completed_at
      AND result.failure_code IS NOT DISTINCT FROM NEW.failure_code
      AND result.failure_message IS NOT DISTINCT FROM NEW.failure_message
  ) THEN
    RAISE EXCEPTION 'Project task terminal state requires an immutable execution receipt' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER ai_agent_project_terminal_receipt_guard
  AFTER INSERT OR UPDATE ON ai_agent_runs DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ai_agent_project_terminal_receipt_required();

CREATE FUNCTION ai_agent_project_session_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.project_id IS NOT NULL AND NEW.session_id IS NOT NULL AND OLD.session_id IS DISTINCT FROM NEW.session_id THEN
    RAISE EXCEPTION 'Project task conversation binding is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_agent_project_session_guard BEFORE UPDATE ON ai_agent_runs
  FOR EACH ROW EXECUTE FUNCTION ai_agent_project_session_immutable();

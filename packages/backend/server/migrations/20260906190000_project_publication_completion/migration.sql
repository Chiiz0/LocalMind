CREATE FUNCTION project_publication_transition_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT (
    (OLD.status = 'waiting_for_location' AND NEW.status IN ('waiting_for_confirmation', 'cancelled', 'expired'))
    OR (OLD.status = 'waiting_for_confirmation' AND NEW.status IN ('submitted', 'cancelled', 'expired', 'waiting_for_location'))
    OR (OLD.status = 'submitted' AND NEW.status IN ('submitted', 'cancelled', 'waiting_for_location'))
    OR (OLD.status IN ('cancelled', 'expired') AND NEW.status = 'waiting_for_location')
  ) THEN RAISE EXCEPTION 'Invalid publication transition' USING ERRCODE = '23514'; END IF;
  IF OLD.status = 'submitted' AND (NEW.status <> 'submitted' OR NEW.run_id IS DISTINCT FROM OLD.run_id)
    AND EXISTS (SELECT 1 FROM ai_agent_runs WHERE id = OLD.run_id AND status IN ('running', 'completed'))
  THEN RAISE EXCEPTION 'Running or completed publication cannot be replaced' USING ERRCODE = '23514'; END IF;
  IF (NEW.target IS DISTINCT FROM OLD.target OR NEW.preview IS DISTINCT FROM OLD.preview
      OR NEW.source_sequence IS DISTINCT FROM OLD.source_sequence
      OR NEW.source_resource_version IS DISTINCT FROM OLD.source_resource_version
      OR NEW.run_id IS DISTINCT FROM OLD.run_id)
    AND NOT (NEW.status = 'waiting_for_location' OR (OLD.status = 'waiting_for_location' AND NEW.status = 'waiting_for_confirmation'))
  THEN RAISE EXCEPTION 'Confirmed publication input is immutable' USING ERRCODE = '23514'; END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at AND NEW.status <> 'waiting_for_location'
  THEN RAISE EXCEPTION 'Publication expiry changes require a new location selection' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_publication_transition_check BEFORE UPDATE ON project_publications
FOR EACH ROW EXECUTE FUNCTION project_publication_transition_guard();

CREATE FUNCTION project_publication_completion_required() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE publication project_publications%ROWTYPE;
DECLARE receipt jsonb;
BEGIN
  IF NEW.snapshot->>'action' <> 'completed' THEN RETURN NEW; END IF;
  SELECT * INTO publication FROM project_publications WHERE id = NEW.publication_id;
  receipt := NEW.snapshot->'receipt';
  IF receipt IS NULL OR NOT EXISTS (
    SELECT 1 FROM ai_agent_runtime_execution_results result
    WHERE result.run_id = publication.run_id AND result.project_id = publication.project_id
      AND result.actor_id = publication.actor_id AND result.result_status = 'completed'
      AND result.side_effects_applied AND result.side_effect_mode = 'workspace_write'
      AND result.result_payload->'sideEffectSummary' = receipt
      AND receipt->>'publicationId' = publication.id
      AND receipt->>'targetResourceId' = publication.target->>'resourceId'
      AND receipt->>'workspaceId' = publication.target->>'workspaceId'
  ) THEN RAISE EXCEPTION 'Publication completion requires matching immutable worker evidence' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM office_revisions WHERE id = receipt->>'targetVersion'
      AND workspace_id = receipt->>'workspaceId' AND artifact_id = receipt->>'targetResourceId'
  ) AND NOT EXISTS (
    SELECT 1 FROM snapshots WHERE workspace_id = receipt->>'workspaceId' AND guid = receipt->>'targetResourceId'
  ) AND NOT EXISTS (
    SELECT 1 FROM updates WHERE workspace_id = receipt->>'workspaceId' AND guid = receipt->>'targetResourceId'
  ) THEN RAISE EXCEPTION 'Publication completion requires a persisted external resource' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER project_publication_completion_guard AFTER INSERT ON project_publication_events
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION project_publication_completion_required();

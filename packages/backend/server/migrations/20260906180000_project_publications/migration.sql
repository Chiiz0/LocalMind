CREATE TABLE project_publications (
  id VARCHAR PRIMARY KEY,
  project_id VARCHAR NOT NULL,
  resource_id VARCHAR NOT NULL,
  actor_id VARCHAR NOT NULL,
  session_id VARCHAR,
  kind VARCHAR NOT NULL CHECK (kind IN ('publish', 'update')),
  request_key VARCHAR(256) NOT NULL CHECK (length(request_key) > 0),
  request_fingerprint VARCHAR(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  status VARCHAR NOT NULL DEFAULT 'waiting_for_location' CHECK (status IN ('waiting_for_location', 'waiting_for_confirmation', 'submitted', 'cancelled', 'expired')),
  source_sequence INTEGER NOT NULL CHECK (source_sequence > 0),
  source_resource_version INTEGER NOT NULL CHECK (source_resource_version > 0),
  target JSONB CHECK (target IS NULL OR (jsonb_typeof(target) = 'object' AND pg_column_size(target) <= 16384)),
  preview JSONB CHECK (preview IS NULL OR (jsonb_typeof(preview) = 'object' AND pg_column_size(preview) <= 65536)),
  run_id VARCHAR UNIQUE,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  FOREIGN KEY (resource_id, project_id) REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (run_id, project_id, actor_id) REFERENCES ai_agent_runs(id, project_id, actor_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  UNIQUE(project_id, actor_id, request_key),
  UNIQUE(id, project_id, resource_id),
  CHECK (expires_at > created_at),
  CHECK ((status = 'waiting_for_location' AND target IS NULL AND preview IS NULL AND run_id IS NULL)
    OR (status IN ('waiting_for_confirmation', 'submitted') AND target IS NOT NULL AND preview IS NOT NULL AND run_id IS NOT NULL)
    OR status IN ('cancelled', 'expired'))
);
CREATE INDEX project_publications_project_id_actor_id_created_at_id_idx ON project_publications(project_id, actor_id, created_at, id);
CREATE INDEX project_publications_project_id_resource_id_created_at_idx ON project_publications(project_id, resource_id, created_at);
CREATE INDEX project_publications_status_expires_at_idx ON project_publications(status, expires_at);

CREATE TABLE project_publication_events (
  id VARCHAR PRIMARY KEY,
  publication_id VARCHAR NOT NULL REFERENCES project_publications(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status VARCHAR NOT NULL,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND pg_column_size(snapshot) <= 131072),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  UNIQUE(publication_id, revision)
);

CREATE TABLE project_publication_targets (
  project_id VARCHAR NOT NULL,
  resource_id VARCHAR NOT NULL,
  workspace_id VARCHAR NOT NULL,
  target_resource_id VARCHAR NOT NULL,
  source_sequence INTEGER NOT NULL CHECK (source_sequence > 0),
  target_version VARCHAR NOT NULL CHECK (length(target_version) BETWEEN 1 AND 512),
  publication_id VARCHAR NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, resource_id, workspace_id, target_resource_id),
  FOREIGN KEY(resource_id, project_id) REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY(publication_id, project_id, resource_id) REFERENCES project_publications(id, project_id, resource_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE FUNCTION project_publication_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.resource_id IS DISTINCT FROM OLD.resource_id OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
    OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.request_key IS DISTINCT FROM OLD.request_key OR NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.revision <> OLD.revision + 1
  ) THEN RAISE EXCEPTION 'Publication identity is immutable and transitions require the next revision' USING ERRCODE = '23514'; END IF;
  IF NEW.run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ai_agent_runs run WHERE run.id = NEW.run_id AND run.project_id = NEW.project_id
      AND run.actor_id = NEW.actor_id AND run.workspace_id IS NULL AND run.source_type = 'project_publication'
      AND run.session_id IS NOT DISTINCT FROM NEW.session_id
  ) THEN RAISE EXCEPTION 'Publication execution must belong to its Project and actor' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_publication_write_guard BEFORE INSERT OR UPDATE ON project_publications
FOR EACH ROW EXECUTE FUNCTION project_publication_guard();

CREATE FUNCTION project_publication_audit_required() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM project_publication_events event WHERE event.publication_id = NEW.id AND event.revision = NEW.revision
    AND event.status = NEW.status AND event.snapshot->>'actorId' = NEW.actor_id
    AND event.snapshot->>'projectId' = NEW.project_id AND event.snapshot->>'resourceId' = NEW.resource_id
    AND event.snapshot->>'runId' IS NOT DISTINCT FROM NEW.run_id
    AND (event.snapshot->>'sourceSequence')::integer = NEW.source_sequence
    AND (event.snapshot->>'sourceResourceVersion')::integer = NEW.source_resource_version
    AND event.snapshot->>'kind' = NEW.kind
    AND (event.snapshot->>'expiresAt')::timestamptz = NEW.expires_at
    AND (event.snapshot->'target') IS NOT DISTINCT FROM COALESCE(NEW.target, 'null'::jsonb)
    AND (event.snapshot->'preview') IS NOT DISTINCT FROM COALESCE(NEW.preview, 'null'::jsonb))
  THEN RAISE EXCEPTION 'Publication transition requires immutable audit evidence' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER project_publication_audit_guard AFTER INSERT OR UPDATE ON project_publications
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION project_publication_audit_required();

CREATE FUNCTION project_publication_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Publication history is immutable' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER project_publication_event_guard BEFORE UPDATE OR DELETE ON project_publication_events
FOR EACH ROW EXECUTE FUNCTION project_publication_event_immutable();

CREATE FUNCTION project_publication_target_receipt_required() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM project_publications publication
      JOIN ai_agent_runtime_execution_results result ON result.run_id = publication.run_id
    WHERE publication.id = NEW.publication_id AND publication.project_id = NEW.project_id
      AND publication.resource_id = NEW.resource_id AND publication.status = 'submitted'
      AND publication.source_sequence = NEW.source_sequence
      AND publication.target->>'workspaceId' = NEW.workspace_id
      AND publication.target->>'resourceId' = NEW.target_resource_id
      AND result.result_status = 'completed' AND result.side_effects_applied
      AND result.side_effect_mode = 'workspace_write' AND result.project_id = NEW.project_id
      AND result.result_payload->'sideEffectSummary'->>'publicationId' = NEW.publication_id
      AND result.result_payload->'sideEffectSummary'->>'targetVersion' = NEW.target_version
      AND result.result_payload->'sideEffectSummary'->>'targetResourceId' = NEW.target_resource_id
      AND result.result_payload->'sideEffectSummary'->>'workspaceId' = NEW.workspace_id
  ) THEN RAISE EXCEPTION 'Publication target requires a completed execution receipt' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER project_publication_target_receipt_guard AFTER INSERT OR UPDATE ON project_publication_targets
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION project_publication_target_receipt_required();

ALTER TABLE ai_context_project_docs ADD COLUMN internal_resource_id VARCHAR;
ALTER TABLE ai_context_project_docs ADD CONSTRAINT project_migrated_reference_fkey
  FOREIGN KEY (internal_resource_id, project_id) REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE project_resource_migrations (
  id VARCHAR PRIMARY KEY,
  project_id VARCHAR NOT NULL,
  source_workspace_id VARCHAR NOT NULL,
  source_resource_id VARCHAR NOT NULL,
  original_actor_id VARCHAR,
  actor_id VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'pending',
  revision INTEGER NOT NULL DEFAULT 1,
  attempt INTEGER NOT NULL DEFAULT 0,
  lease_id VARCHAR,
  lease_expires_at TIMESTAMPTZ(3),
  resource_id VARCHAR,
  failure_code VARCHAR,
  evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT project_resource_migrations_source_key UNIQUE(project_id, source_workspace_id, source_resource_id),
  CONSTRAINT project_resource_migrations_reference_fkey FOREIGN KEY (project_id, source_workspace_id, source_resource_id)
    REFERENCES ai_context_project_docs(project_id, workspace_id, doc_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT project_resource_migrations_result_fkey FOREIGN KEY (resource_id, project_id)
    REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT project_resource_migrations_state_check CHECK (
    status IN ('pending', 'running', 'waiting_for_authorization', 'failed', 'complete', 'cancelled')
    AND revision > 0 AND attempt >= 0 AND jsonb_typeof(evidence) = 'object'
    AND ((status = 'running') = (lease_id IS NOT NULL AND lease_expires_at IS NOT NULL))
    AND (status = 'running' OR (lease_id IS NULL AND lease_expires_at IS NULL))
    AND ((status = 'complete') = (resource_id IS NOT NULL))
  )
);
CREATE INDEX project_resource_migrations_status_lease_expires_at_id_idx ON project_resource_migrations(status, lease_expires_at, id);
CREATE INDEX project_resource_migrations_project_id_id_idx ON project_resource_migrations(project_id, id);
CREATE TABLE project_resource_migration_events (
  id VARCHAR PRIMARY KEY,
  migration_id VARCHAR NOT NULL REFERENCES project_resource_migrations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status VARCHAR NOT NULL,
  actor_id VARCHAR,
  evidence JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  UNIQUE (migration_id, revision)
);
CREATE FUNCTION project_resource_migration_transition() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status = 'complete' OR
    (NEW.id, NEW.project_id, NEW.source_workspace_id, NEW.source_resource_id, NEW.original_actor_id, NEW.created_at)
      IS DISTINCT FROM
    (OLD.id, OLD.project_id, OLD.source_workspace_id, OLD.source_resource_id, OLD.original_actor_id, OLD.created_at)
    OR NEW.revision <> OLD.revision + 1
    OR NOT (
      (OLD.status = 'pending' AND NEW.status IN ('running', 'cancelled')) OR
      (OLD.status = 'running' AND NEW.status IN ('running', 'waiting_for_authorization', 'failed', 'complete')) OR
      (OLD.status IN ('waiting_for_authorization', 'failed', 'cancelled') AND NEW.status IN ('pending', 'cancelled'))
    ) THEN
    RAISE EXCEPTION 'Invalid Project resource migration transition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_resource_migration_transition BEFORE UPDATE OR DELETE ON project_resource_migrations
  FOR EACH ROW EXECUTE FUNCTION project_resource_migration_transition();
CREATE FUNCTION project_resource_migration_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Project resource migration evidence is immutable'; END $$;
CREATE TRIGGER project_resource_migration_event_immutable BEFORE UPDATE OR DELETE ON project_resource_migration_events
  FOR EACH ROW EXECUTE FUNCTION project_resource_migration_event_immutable();

CREATE FUNCTION project_resource_migration_evidence_check() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_row project_resource_migrations;
BEGIN
  SELECT * INTO current_row FROM project_resource_migrations WHERE id = NEW.id;
  IF NOT EXISTS (SELECT 1 FROM project_resource_migration_events event WHERE event.migration_id = current_row.id
    AND event.revision = current_row.revision AND event.status = current_row.status AND event.actor_id IS NOT DISTINCT FROM current_row.actor_id) THEN
    RAISE EXCEPTION 'Project migration requires durable transition evidence';
  END IF;
  IF current_row.status = 'complete' AND (
    NOT EXISTS (SELECT 1 FROM ai_context_project_docs reference WHERE reference.project_id = current_row.project_id
      AND reference.workspace_id = current_row.source_workspace_id AND reference.doc_id = current_row.source_resource_id
      AND reference.internal_resource_id = current_row.resource_id) OR
    NOT EXISTS (SELECT 1 FROM project_resource_audit_events event WHERE event.id = current_row.evidence->>'importEventId'
      AND event.project_id = current_row.project_id AND event.resource_id = current_row.resource_id AND event.action = 'imported'
      AND event.evidence->>'sourceWorkspaceId' = current_row.source_workspace_id AND event.evidence->>'sourceResourceId' = current_row.source_resource_id)
  ) THEN RAISE EXCEPTION 'Project migration completion requires an independently imported resource'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER project_resource_migration_evidence_check AFTER INSERT OR UPDATE ON project_resource_migrations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION project_resource_migration_evidence_check();
CREATE FUNCTION project_migrated_reference_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.internal_resource_id IS NOT NULL AND OLD.internal_resource_id IS DISTINCT FROM NEW.internal_resource_id THEN
    RAISE EXCEPTION 'Completed Project migration identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_migrated_reference_immutable BEFORE UPDATE ON ai_context_project_docs
  FOR EACH ROW EXECUTE FUNCTION project_migrated_reference_immutable();

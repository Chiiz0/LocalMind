ALTER TABLE copilot_document_operations
  ADD COLUMN project_migration_status VARCHAR,
  ADD COLUMN project_migration_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN project_migration_resource_id VARCHAR;
ALTER TABLE copilot_document_operations ADD CONSTRAINT project_operation_migration_result_fkey
  FOREIGN KEY (project_migration_resource_id, project_id) REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE copilot_document_operations ADD CONSTRAINT project_operation_migration_state_check CHECK (
  (project_migration_status IS NULL AND project_migration_revision = 0 AND project_migration_resource_id IS NULL)
  OR (project_id IS NOT NULL AND project_migration_revision > 0
    AND project_migration_status IN ('pending', 'blocked', 'complete', 'cancelled', 'external_result')
    AND ((project_migration_status = 'complete') = (project_migration_resource_id IS NOT NULL)))
);

UPDATE copilot_document_operations SET project_migration_status = CASE
    WHEN created_document_at IS NOT NULL THEN 'external_result'
    WHEN status = 'cancelled' THEN 'cancelled' ELSE 'pending' END,
  project_migration_revision = 1
  WHERE project_id IS NOT NULL;
INSERT INTO copilot_document_operation_events (id, operation_id, event_type, detail, created_at)
  SELECT gen_random_uuid()::text, id, 'project_migration', jsonb_build_object(
    'revision', project_migration_revision, 'status', project_migration_status,
    'originalStatus', status, 'contentFingerprint', content_fingerprint), now()
  FROM copilot_document_operations WHERE project_migration_status IS NOT NULL;

CREATE INDEX project_legacy_operation_actor_idx ON copilot_document_operations(project_id, actor_id, id)
  WHERE project_id IS NOT NULL;
CREATE FUNCTION project_legacy_operation_migration_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.project_migration_status, NEW.project_migration_revision, NEW.project_migration_resource_id)
    IS DISTINCT FROM (OLD.project_migration_status, OLD.project_migration_revision, OLD.project_migration_resource_id) THEN
    IF OLD.project_migration_status IN ('complete', 'external_result')
      OR NEW.project_migration_revision <> OLD.project_migration_revision + 1
      OR NOT (OLD.project_migration_status IS NULL AND NEW.project_migration_status IN ('pending', 'cancelled', 'external_result')
        OR OLD.project_migration_status IN ('pending', 'blocked', 'cancelled') AND NEW.project_migration_status IN ('blocked', 'complete', 'cancelled')) THEN
      RAISE EXCEPTION 'Invalid legacy Project operation migration transition';
    END IF;
  END IF;
  IF OLD.project_id IS NOT NULL AND NEW.created_document_at IS DISTINCT FROM OLD.created_document_at THEN
    RAISE EXCEPTION 'Legacy Project operations cannot create Workspace documents';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_legacy_operation_migration_guard BEFORE UPDATE ON copilot_document_operations
  FOR EACH ROW EXECUTE FUNCTION project_legacy_operation_migration_guard();

CREATE FUNCTION project_legacy_operation_migration_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_row copilot_document_operations;
BEGIN
  SELECT * INTO current_row FROM copilot_document_operations WHERE id = NEW.id;
  IF current_row.project_migration_status IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM copilot_document_operation_events event WHERE event.operation_id = current_row.id
      AND event.event_type = 'project_migration'
      AND event.detail->>'revision' = current_row.project_migration_revision::text
      AND event.detail->>'status' = current_row.project_migration_status
      AND event.detail->>'resourceId' IS NOT DISTINCT FROM current_row.project_migration_resource_id
  ) THEN RAISE EXCEPTION 'Legacy Project recovery requires immutable evidence'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER project_legacy_operation_migration_evidence AFTER INSERT OR UPDATE ON copilot_document_operations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION project_legacy_operation_migration_evidence();

-- Previously applied migrations remain immutable. Native resources and source
-- authorization evidence survive retirement of the reference-only model.
DROP TRIGGER ai_context_project_grants_document_consistency_check ON ai_context_project_grants;
DROP TABLE project_resource_migration_events;
DROP TABLE project_resource_migrations;
DROP TABLE ai_context_project_docs;
DROP FUNCTION project_resource_migration_transition();
DROP FUNCTION project_resource_migration_event_immutable();
DROP FUNCTION project_resource_migration_evidence_check();
DROP FUNCTION project_migrated_reference_immutable();
DROP FUNCTION ai_context_project_document_grant_consistency_guard();
DROP FUNCTION ai_context_assert_project_document_grant_consistency(VARCHAR, VARCHAR, VARCHAR);

DROP TRIGGER project_legacy_operation_migration_guard ON copilot_document_operations;
DROP TRIGGER project_legacy_operation_migration_evidence ON copilot_document_operations;
DROP FUNCTION project_legacy_operation_migration_guard();
DROP FUNCTION project_legacy_operation_migration_evidence();
DROP INDEX project_legacy_operation_actor_idx;
ALTER TABLE copilot_document_operations
  DROP CONSTRAINT project_operation_migration_state_check,
  DROP CONSTRAINT project_operation_migration_result_fkey,
  DROP COLUMN project_migration_status,
  DROP COLUMN project_migration_revision,
  DROP COLUMN project_migration_resource_id;
-- Old requests remain audit history and must never resume Workspace writes.
CREATE FUNCTION project_reference_operation_readonly() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.project_id IS NOT NULL AND NEW.created_document_at IS DISTINCT FROM OLD.created_document_at THEN
    RAISE EXCEPTION 'Retired Project operations cannot create Workspace documents';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_reference_operation_readonly BEFORE UPDATE ON copilot_document_operations
  FOR EACH ROW EXECUTE FUNCTION project_reference_operation_readonly();

ALTER TABLE access_requests ALTER COLUMN purpose SET DEFAULT 'project_copy';
-- Keep original requests and immutable audit evidence as history; new requests
-- can only authorize copying a source into a Project.
CREATE FUNCTION project_copy_request_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.purpose <> 'project_copy' OR NEW.beneficiary_type <> 'project' THEN
    RAISE EXCEPTION 'Only Project copy requests are supported' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_copy_request_only BEFORE INSERT ON access_requests
  FOR EACH ROW EXECUTE FUNCTION project_copy_request_only();

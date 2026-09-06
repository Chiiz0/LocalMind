CREATE TABLE copilot_document_operation_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  operation_id VARCHAR NOT NULL REFERENCES copilot_document_operations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  event_type VARCHAR NOT NULL,
  detail JSONB NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX copilot_document_operation_events_operation_id_created_at_idx
  ON copilot_document_operation_events(operation_id, created_at);

CREATE OR REPLACE FUNCTION protect_copilot_document_placement() RETURNS trigger AS $$
BEGIN
  IF OLD.placed_document_at IS NOT NULL AND NEW.placed_document_at IS DISTINCT FROM OLD.placed_document_at THEN
    RAISE EXCEPTION 'Document placement outcome is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.destination_fingerprint IS DISTINCT FROM OLD.destination_fingerprint
    AND NEW.destination_revision <> OLD.destination_revision + 1 THEN
    RAISE EXCEPTION 'Destination evidence requires a new confirmation revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION audit_copilot_document_operation() RETURNS trigger AS $$
DECLARE kind VARCHAR;
BEGIN
  IF TG_OP = 'INSERT' THEN
    kind := 'prepared';
  ELSIF NEW.destination_revision IS DISTINCT FROM OLD.destination_revision THEN
    kind := 'destination_confirmed';
  ELSIF (NEW.status, NEW.created_document_at, NEW.placed_document_at,
    NEW.project_status, NEW.access_request_id, NEW.failure_code, NEW.lease_token)
    IS DISTINCT FROM (OLD.status, OLD.created_document_at, OLD.placed_document_at,
    OLD.project_status, OLD.access_request_id, OLD.failure_code, OLD.lease_token) THEN
    kind := 'execution_changed';
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO copilot_document_operation_events(operation_id, event_type, detail)
  VALUES (NEW.id, kind, jsonb_build_object(
    'actorId', NEW.actor_id, 'status', NEW.status,
    'workspaceId', NEW.destination_workspace_id, 'folderId', NEW.destination_folder_id,
    'destinationRevision', NEW.destination_revision, 'destinationFingerprint', NEW.destination_fingerprint,
    'createdDocumentAt', NEW.created_document_at, 'placedDocumentAt', NEW.placed_document_at,
    'projectStatus', NEW.project_status, 'accessRequestId', NEW.access_request_id,
    'failureCode', NEW.failure_code, 'leaseActive', NEW.lease_token IS NOT NULL
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER copilot_document_operation_audit
AFTER INSERT OR UPDATE ON copilot_document_operations
FOR EACH ROW EXECUTE FUNCTION audit_copilot_document_operation();

CREATE FUNCTION protect_copilot_document_operation_event() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Document operation audit events are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER copilot_document_operation_event_immutable
BEFORE UPDATE ON copilot_document_operation_events
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_operation_event();

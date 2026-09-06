CREATE FUNCTION protect_copilot_document_copy_delete() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM copilot_document_operations WHERE id = OLD.operation_id) THEN
    RAISE EXCEPTION 'Document copy evidence belongs to its operation' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER copilot_document_copy_source_delete BEFORE DELETE ON copilot_document_copy_sources
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_copy_delete();
CREATE TRIGGER copilot_document_copy_asset_delete BEFORE DELETE ON copilot_document_copy_assets
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_copy_delete();

CREATE FUNCTION audit_copilot_document_copy_source() RETURNS trigger AS $$
BEGIN
  INSERT INTO copilot_document_operation_events(operation_id, event_type, detail)
  VALUES (NEW.operation_id, 'copy_source_frozen', jsonb_build_object(
    'workspaceId', NEW.workspace_id, 'documentId', NEW.document_id,
    'fingerprint', NEW.fingerprint,
    'assetCount', (SELECT count(*) FROM copilot_document_copy_assets WHERE operation_id = NEW.operation_id)
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER copilot_document_copy_source_audit AFTER INSERT ON copilot_document_copy_sources
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION audit_copilot_document_copy_source();

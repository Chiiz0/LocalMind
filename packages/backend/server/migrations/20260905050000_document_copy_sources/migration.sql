ALTER TABLE copilot_document_operations ADD COLUMN kind VARCHAR NOT NULL DEFAULT 'create';
ALTER TABLE copilot_document_operations ADD CONSTRAINT copilot_document_operation_kind_check CHECK (kind IN ('create', 'copy'));

CREATE TABLE copilot_document_copy_sources (
  operation_id VARCHAR PRIMARY KEY REFERENCES copilot_document_operations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  workspace_id VARCHAR NOT NULL,
  document_id VARCHAR NOT NULL,
  snapshot BYTEA NOT NULL,
  fingerprint VARCHAR NOT NULL,
  CHECK (octet_length(snapshot) BETWEEN 1 AND 16777216),
  CHECK (length(workspace_id) BETWEEN 1 AND 256 AND length(document_id) BETWEEN 1 AND 256),
  CHECK (fingerprint ~ '^[a-f0-9]{64}$')
);
CREATE TABLE copilot_document_copy_assets (
  operation_id VARCHAR NOT NULL REFERENCES copilot_document_copy_sources(operation_id) ON DELETE CASCADE ON UPDATE CASCADE,
  key VARCHAR NOT NULL,
  data BYTEA NOT NULL,
  content_type VARCHAR NOT NULL,
  fingerprint VARCHAR NOT NULL,
  PRIMARY KEY (operation_id, key),
  CHECK (length(key) BETWEEN 1 AND 256 AND length(content_type) BETWEEN 1 AND 256),
  CHECK (octet_length(data) <= 16777216),
  CHECK (fingerprint ~ '^[a-f0-9]{64}$')
);

CREATE FUNCTION protect_copilot_document_copy_identity() RETURNS trigger AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'Document operation kind is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER copilot_document_copy_kind_immutable BEFORE UPDATE ON copilot_document_operations
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_copy_identity();

CREATE FUNCTION protect_copilot_document_copy_evidence() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Document copy source evidence is immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER copilot_document_copy_source_immutable BEFORE UPDATE ON copilot_document_copy_sources
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_copy_evidence();
CREATE TRIGGER copilot_document_copy_asset_immutable BEFORE UPDATE ON copilot_document_copy_assets
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_copy_evidence();

CREATE FUNCTION check_copilot_document_copy_source() RETURNS trigger AS $$
DECLARE operation_kind VARCHAR;
DECLARE source_exists BOOLEAN;
DECLARE target_id VARCHAR;
DECLARE selected_operation_id VARCHAR;
BEGIN
  IF TG_TABLE_NAME = 'copilot_document_operations' THEN selected_operation_id := NEW.id;
  ELSE selected_operation_id := NEW.operation_id; END IF;
  SELECT kind, document_id INTO operation_kind, target_id FROM copilot_document_operations WHERE id = selected_operation_id;
  SELECT EXISTS (SELECT 1 FROM copilot_document_copy_sources source WHERE source.operation_id = selected_operation_id AND source.document_id <> target_id) INTO source_exists;
  IF (operation_kind = 'copy') IS DISTINCT FROM source_exists THEN
    RAISE EXCEPTION 'Copy operations require an independent frozen source' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER copilot_document_operation_copy_source AFTER INSERT ON copilot_document_operations
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_copilot_document_copy_source();
CREATE CONSTRAINT TRIGGER copilot_document_source_operation AFTER INSERT ON copilot_document_copy_sources
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_copilot_document_copy_source();

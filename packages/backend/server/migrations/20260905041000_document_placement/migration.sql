ALTER TABLE copilot_document_operations
  ADD COLUMN destination_fingerprint VARCHAR,
  ADD COLUMN placed_document_at TIMESTAMPTZ(3);
ALTER TABLE copilot_document_operations
  ADD CONSTRAINT copilot_document_operations_placement_check
  CHECK (placed_document_at IS NULL OR created_document_at IS NOT NULL);

CREATE FUNCTION protect_copilot_document_placement() RETURNS trigger AS $$
BEGIN
  IF OLD.placed_document_at IS NOT NULL AND NEW.placed_document_at IS DISTINCT FROM OLD.placed_document_at THEN
    RAISE EXCEPTION 'Document placement outcome is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.execution_started_at IS NOT NULL AND NEW.destination_fingerprint IS DISTINCT FROM OLD.destination_fingerprint THEN
    RAISE EXCEPTION 'Executing document destination evidence is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER copilot_document_placement_immutable
BEFORE UPDATE ON copilot_document_operations
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_placement();

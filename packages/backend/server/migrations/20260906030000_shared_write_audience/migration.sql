ALTER TABLE ai_shared_write_source_checks ADD COLUMN audience_evidence JSONB NOT NULL DEFAULT '{}'
  CHECK (jsonb_typeof(audience_evidence) = 'object' AND octet_length(audience_evidence::text) <= 1048576);

CREATE INDEX copilot_document_operations_location_expiration_idx
  ON copilot_document_operations(location_expires_at, id)
  WHERE status IN ('waiting_location', 'ready', 'running', 'failed', 'created');

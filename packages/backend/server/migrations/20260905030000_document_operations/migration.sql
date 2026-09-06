CREATE TABLE copilot_document_operations (
  id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL REFERENCES ai_sessions_metadata(id) ON DELETE CASCADE ON UPDATE CASCADE,
  actor_id VARCHAR NOT NULL,
  project_id VARCHAR,
  request_key VARCHAR NOT NULL,
  content_fingerprint VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  markdown TEXT NOT NULL,
  document_id VARCHAR NOT NULL UNIQUE,
  destination_workspace_id VARCHAR,
  destination_folder_id VARCHAR,
  destination_revision INTEGER NOT NULL DEFAULT 0,
  destination_confirmed_at TIMESTAMPTZ(3),
  status VARCHAR NOT NULL DEFAULT 'waiting_location',
  created_document_at TIMESTAMPTZ(3),
  execution_started_at TIMESTAMPTZ(3),
  project_status VARCHAR NOT NULL DEFAULT 'not_requested',
  access_request_id VARCHAR,
  lease_token VARCHAR,
  lease_expires_at TIMESTAMPTZ(3),
  failure_code VARCHAR,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT copilot_document_operations_status_check CHECK (
    status IN ('waiting_location', 'ready', 'running', 'created', 'complete', 'failed')
  ),
  CONSTRAINT copilot_document_operations_project_status_check CHECK (
    project_status IN ('not_requested', 'pending', 'granted', 'requested', 'failed')
  ),
  CONSTRAINT copilot_document_operations_destination_check CHECK (
    (destination_workspace_id IS NULL AND destination_folder_id IS NULL AND destination_confirmed_at IS NULL)
    OR (destination_workspace_id IS NOT NULL AND destination_confirmed_at IS NOT NULL)
  ),
  CONSTRAINT copilot_document_operations_ready_check CHECK (
    status NOT IN ('ready', 'running', 'created', 'complete') OR destination_confirmed_at IS NOT NULL
  ),
  CONSTRAINT copilot_document_operations_created_check CHECK (
    status NOT IN ('created', 'complete') OR created_document_at IS NOT NULL
  ),
  CONSTRAINT copilot_document_operations_lease_check CHECK (
    (lease_token IS NULL) = (lease_expires_at IS NULL)
  ),
  CONSTRAINT copilot_document_operations_bounds_check CHECK (
    octet_length(markdown) <= 1048576 AND length(title) BETWEEN 1 AND 512
    AND length(request_key) BETWEEN 1 AND 256 AND destination_revision >= 0
  )
);
CREATE UNIQUE INDEX copilot_document_operations_session_id_request_key_key
  ON copilot_document_operations(session_id, request_key);
CREATE INDEX copilot_document_operations_status_lease_expires_at_idx
  ON copilot_document_operations(status, lease_expires_at);

CREATE FUNCTION protect_copilot_document_operation() RETURNS trigger AS $$
BEGIN
  IF (NEW.session_id, NEW.actor_id, NEW.project_id, NEW.request_key,
      NEW.content_fingerprint, NEW.title, NEW.markdown, NEW.document_id)
    IS DISTINCT FROM
     (OLD.session_id, OLD.actor_id, OLD.project_id, OLD.request_key,
      OLD.content_fingerprint, OLD.title, OLD.markdown, OLD.document_id) THEN
    RAISE EXCEPTION 'Document operation content and identity are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.created_document_at IS NOT NULL AND
    (NEW.created_document_at, NEW.destination_workspace_id, NEW.destination_folder_id)
    IS DISTINCT FROM
    (OLD.created_document_at, OLD.destination_workspace_id, OLD.destination_folder_id) THEN
    RAISE EXCEPTION 'Created document outcome and destination are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.execution_started_at IS NOT NULL AND
    (NEW.execution_started_at, NEW.destination_workspace_id, NEW.destination_folder_id)
    IS DISTINCT FROM
    (OLD.execution_started_at, OLD.destination_workspace_id, OLD.destination_folder_id) THEN
    RAISE EXCEPTION 'An attempted document operation cannot change destination' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER copilot_document_operation_immutable
BEFORE UPDATE ON copilot_document_operations
FOR EACH ROW EXECUTE FUNCTION protect_copilot_document_operation();

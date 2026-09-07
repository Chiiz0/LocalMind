ALTER TYPE "NotificationType" ADD VALUE 'ProjectFileRequest';

-- Actor and relationship IDs are immutable snapshots; live authority is rechecked on every operation.
CREATE TABLE project_file_requests (
  id VARCHAR PRIMARY KEY,
  project_id VARCHAR NOT NULL REFERENCES ai_context_projects(id) ON DELETE RESTRICT,
  requester_id VARCHAR NOT NULL,
  recipient_id VARCHAR NOT NULL,
  recipient_workspace_id VARCHAR,
  source_session_id VARCHAR,
  title VARCHAR(256) NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  version INTEGER NOT NULL DEFAULT 1,
  request_key VARCHAR(256) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  resource_id VARCHAR,
  file_name VARCHAR(512),
  delivery_fingerprint VARCHAR(64),
  completed_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resource_id, project_id) REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CHECK (requester_id <> recipient_id AND version > 0),
  CHECK (status IN ('pending', 'in_progress', 'completed', 'declined', 'cancelled')),
  CHECK ((status IN ('completed', 'declined', 'cancelled')) = (completed_at IS NOT NULL)),
  CHECK ((status = 'completed') = (resource_id IS NOT NULL AND file_name IS NOT NULL AND delivery_fingerprint IS NOT NULL))
);
CREATE UNIQUE INDEX project_file_requests_project_id_requester_id_request_key_key ON project_file_requests(project_id, requester_id, request_key);
CREATE INDEX project_file_requests_requester_id_status_updated_at_id_idx ON project_file_requests(requester_id, status, updated_at, id);
CREATE INDEX project_file_requests_recipient_id_status_updated_at_id_idx ON project_file_requests(recipient_id, status, updated_at, id);
CREATE INDEX project_file_requests_project_id_status_updated_at_id_idx ON project_file_requests(project_id, status, updated_at, id);
CREATE TABLE project_file_request_events (
  id VARCHAR PRIMARY KEY,
  request_id VARCHAR NOT NULL REFERENCES project_file_requests(id) ON DELETE RESTRICT,
  actor_id VARCHAR NOT NULL,
  action VARCHAR NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX project_file_request_events_request_id_version_key ON project_file_request_events(request_id, version);
CREATE FUNCTION project_file_request_immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'File request events are immutable'; END;
$$;
CREATE TRIGGER project_file_request_event_immutable BEFORE UPDATE OR DELETE ON project_file_request_events
FOR EACH ROW EXECUTE FUNCTION project_file_request_immutable_event();
CREATE FUNCTION project_file_request_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.project_id, NEW.requester_id, NEW.recipient_id, NEW.recipient_workspace_id, NEW.source_session_id, NEW.title, NEW.request_key, NEW.fingerprint)
      IS DISTINCT FROM ROW(OLD.project_id, OLD.requester_id, OLD.recipient_id, OLD.recipient_workspace_id, OLD.source_session_id, OLD.title, OLD.request_key, OLD.fingerprint)
    OR OLD.status IN ('completed', 'declined', 'cancelled')
    OR NEW.version <> OLD.version + 1
    OR NEW.status NOT IN ('in_progress', 'completed', 'declined', 'cancelled')
    OR NEW.status = OLD.status
  THEN RAISE EXCEPTION 'Invalid file request transition'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_file_request_transition BEFORE UPDATE ON project_file_requests
FOR EACH ROW EXECUTE FUNCTION project_file_request_transition();

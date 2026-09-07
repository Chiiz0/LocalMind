ALTER TABLE project_resource_audit_events
  ADD COLUMN request_key VARCHAR(256),
  ADD COLUMN request_hash VARCHAR(64),
  ADD CONSTRAINT project_tree_request_evidence CHECK (
    (request_key IS NULL AND request_hash IS NULL) OR
    (request_key IS NOT NULL AND request_hash IS NOT NULL AND length(request_key) BETWEEN 1 AND 256 AND request_hash ~ '^[a-f0-9]{64}$')
  );
CREATE UNIQUE INDEX project_resource_audit_events_project_id_actor_id_request_key_key
  ON project_resource_audit_events(project_id, actor_id, request_key);

ALTER TABLE project_blobs DROP CONSTRAINT project_blob_shape;
ALTER TABLE project_blobs ADD CONSTRAINT project_blob_shape CHECK (
  byte_size BETWEEN 0 AND 536870912 AND length(mime_type) > 0
  AND fingerprint ~ '^[a-f0-9]{64}$' AND key = 'sha256-' || fingerprint
);

CREATE TABLE project_resource_attachments (
  revision_id VARCHAR NOT NULL,
  resource_id VARCHAR NOT NULL,
  project_id VARCHAR NOT NULL,
  key VARCHAR(256) NOT NULL,
  PRIMARY KEY (revision_id, key),
  FOREIGN KEY (revision_id, resource_id, project_id) REFERENCES project_resource_revisions(id, resource_id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (project_id, key) REFERENCES project_blobs(project_id, key) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX project_resource_attachments_project_id_key_idx ON project_resource_attachments(project_id, key);
CREATE TRIGGER project_resource_attachment_immutable BEFORE UPDATE OR DELETE ON project_resource_attachments
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_immutable();

ALTER TABLE access_requests ADD COLUMN purpose VARCHAR(32) NOT NULL DEFAULT 'access';
ALTER TABLE access_requests ADD CONSTRAINT access_request_purpose_shape CHECK (
  purpose = 'access' OR (purpose = 'project_copy' AND beneficiary_type = 'project')
);
DROP INDEX access_requests_pending_project_beneficiary_key;
CREATE UNIQUE INDEX access_requests_pending_project_beneficiary_key
  ON access_requests(workspace_id, doc_id, beneficiary_project_id, purpose)
  WHERE status = 'pending' AND beneficiary_type = 'project';

CREATE TABLE ai_context_project_copy_authorizations (
  request_id VARCHAR PRIMARY KEY REFERENCES access_requests(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  grant_id VARCHAR NOT NULL,
  project_id VARCHAR NOT NULL,
  workspace_id VARCHAR NOT NULL,
  doc_id VARCHAR NOT NULL,
  approved_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grant_id, project_id, workspace_id, doc_id) REFERENCES ai_context_project_grants(id, project_id, workspace_id, doc_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX ai_context_project_copy_authorizations_project_id_workspace_id_doc_id_idx
  ON ai_context_project_copy_authorizations(project_id, workspace_id, doc_id);
CREATE TRIGGER project_copy_authorization_immutable BEFORE UPDATE OR DELETE ON ai_context_project_copy_authorizations
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_immutable();

CREATE FUNCTION guard_project_copy_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM access_requests request WHERE request.id = NEW.request_id
      AND request.purpose = 'project_copy' AND request.status = 'approved'
      AND request.beneficiary_project_id = NEW.project_id AND request.workspace_id = NEW.workspace_id
      AND request.doc_id = NEW.doc_id AND request.resolver_user_id_snapshot = NEW.approved_by
  ) THEN RAISE EXCEPTION 'Project copy authorization requires its explicit approved source request'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER project_copy_authorization_commit AFTER INSERT ON ai_context_project_copy_authorizations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_project_copy_authorization();

CREATE FUNCTION guard_access_request_purpose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.purpose IS DISTINCT FROM OLD.purpose THEN RAISE EXCEPTION 'Access request purpose is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER access_request_purpose_immutable BEFORE UPDATE ON access_requests
  FOR EACH ROW EXECUTE FUNCTION guard_access_request_purpose();

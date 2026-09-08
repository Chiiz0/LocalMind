-- Irreversible product deletion preserves immutable revision and publication evidence.
CREATE TABLE project_resource_deletions (
  resource_id VARCHAR PRIMARY KEY,
  project_id VARCHAR NOT NULL,
  actor_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  root_resource_id VARCHAR NOT NULL,
  request_key VARCHAR(256) NOT NULL CHECK (length(btrim(request_key)) > 0),
  expected_version INTEGER NOT NULL CHECK (expected_version > 0),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  FOREIGN KEY(resource_id, project_id) REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY(root_resource_id, project_id) REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX project_resource_deletions_project_id_root_resource_id_idx ON project_resource_deletions(project_id, root_resource_id);
CREATE FUNCTION project_resource_deletion_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Project resource deletion is irreversible'; END IF;
  IF NOT EXISTS(SELECT 1 FROM project_resources WHERE id = NEW.root_resource_id AND project_id = NEW.project_id AND trashed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Only resources in Trash can be permanently deleted';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_resource_deletion_guard BEFORE INSERT OR UPDATE OR DELETE ON project_resource_deletions
  FOR EACH ROW EXECUTE FUNCTION project_resource_deletion_guard();
CREATE FUNCTION project_deleted_resource_write_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM project_resource_deletions WHERE resource_id = NEW.id) THEN
    RAISE EXCEPTION 'A permanently deleted Project resource cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_deleted_resource_write_guard BEFORE UPDATE ON project_resources
  FOR EACH ROW EXECUTE FUNCTION project_deleted_resource_write_guard();

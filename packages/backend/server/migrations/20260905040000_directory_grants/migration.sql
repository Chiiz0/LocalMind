CREATE TABLE workspace_directory_grants (
  workspace_id VARCHAR NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE ON UPDATE CASCADE,
  directory_id VARCHAR NOT NULL,
  principal_id VARCHAR NOT NULL,
  can_read BOOLEAN NOT NULL,
  can_write BOOLEAN NOT NULL,
  can_organize BOOLEAN NOT NULL,
  can_create_folder BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, directory_id, principal_id),
  CONSTRAINT workspace_directory_grants_bounds CHECK (
    length(directory_id) BETWEEN 1 AND 256 AND length(principal_id) BETWEEN 1 AND 256
  )
);

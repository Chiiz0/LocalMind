CREATE TABLE workspace_directory_policy_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id VARCHAR NOT NULL,
  actor_id VARCHAR NOT NULL,
  directory_id VARCHAR NOT NULL,
  principal_id VARCHAR NOT NULL,
  action VARCHAR NOT NULL CHECK (action IN ('set', 'clear')),
  before_policy JSONB,
  after_policy JSONB,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(workspace_id) BETWEEN 1 AND 256 AND length(actor_id) BETWEEN 1 AND 256
    AND length(directory_id) BETWEEN 1 AND 256 AND length(principal_id) BETWEEN 1 AND 256),
  CHECK (before_policy IS NULL OR (jsonb_typeof(before_policy) = 'object' AND octet_length(before_policy::text) <= 512)),
  CHECK (after_policy IS NULL OR (jsonb_typeof(after_policy) = 'object' AND octet_length(after_policy::text) <= 512))
);
COMMENT ON TABLE workspace_directory_policy_events IS
  'Immutable directory policy evidence; identifiers intentionally remain after live workspace or user deletion.';
CREATE INDEX workspace_directory_policy_events_workspace_id_created_at_id_idx
  ON workspace_directory_policy_events(workspace_id, created_at, id);
CREATE FUNCTION protect_workspace_directory_policy_event() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Directory policy audit events are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER workspace_directory_policy_event_immutable
  BEFORE UPDATE OR DELETE ON workspace_directory_policy_events
  FOR EACH ROW EXECUTE FUNCTION protect_workspace_directory_policy_event();

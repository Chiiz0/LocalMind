CREATE TABLE project_chat_contexts (
  session_id VARCHAR PRIMARY KEY REFERENCES ai_sessions_metadata(id) ON DELETE CASCADE,
  project_id VARCHAR NOT NULL REFERENCES ai_context_projects(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_chat_context_bounds CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 16 AND octet_length(items::text) <= 32768)
);
CREATE INDEX project_chat_contexts_project_id_idx ON project_chat_contexts(project_id);
CREATE FUNCTION validate_project_chat_context() RETURNS trigger
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ai_sessions_metadata WHERE id = NEW.session_id
    AND selected_context_project_id = NEW.project_id AND workspace_id IS NULL AND doc_id IS NULL) THEN
    RAISE EXCEPTION 'Project context owner does not match its conversation' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.version <> OLD.version + 1) THEN
    RAISE EXCEPTION 'Project context identity or version changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER validate_project_chat_context BEFORE INSERT OR UPDATE ON project_chat_contexts
  FOR EACH ROW EXECUTE FUNCTION validate_project_chat_context();

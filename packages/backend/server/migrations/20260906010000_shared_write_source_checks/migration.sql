ALTER TABLE ai_session_context_sources DROP CONSTRAINT ai_session_context_sources_kind_check;
ALTER TABLE ai_session_context_sources ADD CONSTRAINT ai_session_context_sources_kind_check
  CHECK (kind IN ('workspace', 'document', 'private', 'private_attachment', 'unknown'));
ALTER TABLE ai_session_context_sources ADD COLUMN evidence JSONB NOT NULL DEFAULT '{}'
  CHECK (jsonb_typeof(evidence) = 'object' AND octet_length(evidence::text) <= 2048);

CREATE OR REPLACE FUNCTION bound_ai_session_context_sources() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('context-source:' || NEW.session_id, 0));
  IF EXISTS (
    SELECT 1 FROM ai_session_context_sources WHERE session_id = NEW.session_id
      AND workspace_id = NEW.workspace_id AND kind = NEW.kind AND source_id = NEW.source_id
  ) THEN RETURN NULL; END IF;
  IF NEW.source_id <> 'source-budget-exceeded' AND (SELECT count(*) FROM ai_session_context_sources
      WHERE session_id = NEW.session_id AND source_id <> 'source-budget-exceeded') >= 4096 THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
    VALUES (NEW.session_id, NEW.workspace_id, 'unknown', 'source-budget-exceeded') ON CONFLICT DO NOTHING;
    RETURN NULL;
  END IF;
  IF NEW.kind = 'document' AND NEW.evidence = '{}'::jsonb THEN
    NEW.evidence := jsonb_build_object('projectGrantId', (
      SELECT grant_row.id FROM ai_context_project_grants grant_row
      JOIN ai_sessions_metadata session ON session.selected_context_project_id = grant_row.project_id
      WHERE session.id = NEW.session_id AND grant_row.workspace_id = NEW.workspace_id
        AND grant_row.doc_id = NEW.source_id AND grant_row.status = 'active'
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION inherit_ai_session_context_sources() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_session_id IS NOT NULL THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id, evidence)
    SELECT NEW.id, workspace_id, kind, source_id, evidence FROM ai_session_context_sources
    WHERE session_id = NEW.parent_session_id ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The preceding attachment ledger did not prove prompt, memory or tool lineage.
INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
SELECT session.id, session.workspace_id, 'unknown', 'legacy-input-lineage'
FROM ai_sessions_metadata session
ON CONFLICT DO NOTHING;

CREATE FUNCTION capture_ai_message_sources() RETURNS trigger AS $$
DECLARE session_row ai_sessions_metadata;
DECLARE source_kind VARCHAR;
BEGIN
  SELECT * INTO session_row FROM ai_sessions_metadata WHERE id = NEW.session_id;
  IF TG_OP = 'UPDATE' AND (OLD.session_id, OLD.role, OLD.content, OLD.params::jsonb, OLD.attachments::jsonb, OLD."streamObjects"::jsonb)
    IS DISTINCT FROM (NEW.session_id, NEW.role, NEW.content, NEW.params::jsonb, NEW.attachments::jsonb, NEW."streamObjects"::jsonb) THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
    VALUES (NEW.session_id, session_row.workspace_id, 'unknown', 'rewritten-message:' || NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.role = 'user' THEN
    source_kind := CASE WHEN session_row.selected_context_project_id IS NOT NULL AND session_row.doc_id IS NULL
      THEN 'workspace' ELSE 'private' END;
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
    VALUES (NEW.session_id, session_row.workspace_id, source_kind, 'project-input:' || NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.attachments IS NOT NULL AND NEW.attachments::jsonb NOT IN ('null'::jsonb, '[]'::jsonb) THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
    VALUES (NEW.session_id, session_row.workspace_id, 'private_attachment', 'message-attachment:' || NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ai_messages_capture_sources AFTER INSERT OR UPDATE ON ai_sessions_messages
FOR EACH ROW EXECUTE FUNCTION capture_ai_message_sources();

CREATE TABLE ai_shared_write_source_checks (
  id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL CHECK (length(session_id) BETWEEN 1 AND 256),
  actor_id VARCHAR NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 256),
  project_id VARCHAR CHECK (project_id IS NULL OR length(project_id) BETWEEN 1 AND 256),
  sink_type VARCHAR NOT NULL CHECK (sink_type IN (
    'document_create', 'document_copy', 'document_update', 'project_memory', 'conditional_noop', 'tool_write'
  )),
  sink_id VARCHAR NOT NULL CHECK (length(sink_id) BETWEEN 1 AND 256),
  sink_workspace_id VARCHAR CHECK (sink_workspace_id IS NULL OR length(sink_workspace_id) BETWEEN 1 AND 256),
  phase VARCHAR NOT NULL CHECK (phase IN ('prepare', 'confirm', 'execute', 'retry', 'noop')),
  allowed BOOLEAN NOT NULL,
  reason_code VARCHAR NOT NULL CHECK (reason_code IN ('authorized', 'unshared_source', 'source_budget_exceeded')),
  source_fingerprint VARCHAR NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
  sources JSONB NOT NULL CHECK (jsonb_typeof(sources) = 'array'
    AND jsonb_array_length(sources) <= 4097 AND octet_length(sources::text) <= 4194304),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CHECK (allowed = (reason_code = 'authorized'))
);
CREATE INDEX ai_shared_write_source_checks_session_id_created_at_idx ON ai_shared_write_source_checks(session_id, created_at);
CREATE INDEX ai_shared_write_source_checks_sink_type_sink_id_created_at_idx ON ai_shared_write_source_checks(sink_type, sink_id, created_at);
CREATE FUNCTION protect_ai_shared_write_source_checks() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Shared write source checks are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ai_shared_write_source_checks_immutable BEFORE UPDATE OR DELETE ON ai_shared_write_source_checks
FOR EACH ROW EXECUTE FUNCTION protect_ai_shared_write_source_checks();

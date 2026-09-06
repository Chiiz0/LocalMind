CREATE TABLE ai_session_context_sources (
  session_id VARCHAR NOT NULL REFERENCES ai_sessions_metadata(id) ON DELETE CASCADE,
  workspace_id VARCHAR NOT NULL,
  kind VARCHAR NOT NULL CHECK (kind IN ('document', 'private_attachment', 'unknown')),
  source_id VARCHAR NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, workspace_id, kind, source_id),
  CHECK (length(workspace_id) BETWEEN 1 AND 256 AND length(source_id) BETWEEN 1 AND 256)
);

CREATE FUNCTION protect_ai_session_context_sources() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM ai_sessions_metadata WHERE id = OLD.session_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Session context source evidence is immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ai_session_context_sources_immutable BEFORE UPDATE OR DELETE ON ai_session_context_sources
FOR EACH ROW EXECUTE FUNCTION protect_ai_session_context_sources();

CREATE FUNCTION bound_ai_session_context_sources() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('context-source:' || NEW.session_id, 0));
  IF NEW.kind <> 'unknown' AND (SELECT count(*) FROM ai_session_context_sources WHERE session_id = NEW.session_id AND kind <> 'unknown') >= 4096 THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
    VALUES (NEW.session_id, NEW.workspace_id, 'unknown', 'source-budget-exceeded') ON CONFLICT DO NOTHING;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ai_session_context_sources_bounded BEFORE INSERT ON ai_session_context_sources
FOR EACH ROW EXECUTE FUNCTION bound_ai_session_context_sources();

CREATE FUNCTION record_ai_context_sources(target_session VARCHAR, configuration JSONB) RETURNS void AS $$
DECLARE storage_workspace VARCHAR;
DECLARE source JSONB;
DECLARE category JSONB;
DECLARE documents JSONB;
DECLARE invalid BOOLEAN := FALSE;
BEGIN
  SELECT workspace_id INTO storage_workspace FROM ai_sessions_metadata WHERE id = target_session;
  IF storage_workspace IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(configuration) IS DISTINCT FROM 'object'
    OR configuration->>'workspaceId' IS DISTINCT FROM storage_workspace
    OR jsonb_typeof(configuration->'docs') IS DISTINCT FROM 'array'
    OR jsonb_typeof(configuration->'categories') IS DISTINCT FROM 'array'
    OR jsonb_typeof(configuration->'files') IS DISTINCT FROM 'array'
    OR jsonb_typeof(configuration->'blobs') IS DISTINCT FROM 'array' THEN
    invalid := TRUE;
  ELSE
    IF jsonb_array_length(configuration->'files') > 0 OR jsonb_array_length(configuration->'blobs') > 0 THEN
      INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
      VALUES (target_session, storage_workspace, 'private_attachment', 'context-attachment') ON CONFLICT DO NOTHING;
    END IF;
    documents := configuration->'docs';
    FOR category IN SELECT value FROM jsonb_array_elements(configuration->'categories') LOOP
      IF jsonb_typeof(category->'docs') IS DISTINCT FROM 'array' THEN invalid := TRUE;
      ELSE documents := documents || (category->'docs'); END IF;
    END LOOP;
    IF jsonb_array_length(documents) > 4096 THEN invalid := TRUE; END IF;
    FOR source IN SELECT value FROM jsonb_array_elements(documents) LIMIT 4096 LOOP
      IF jsonb_typeof(source->'id') IS DISTINCT FROM 'string' OR length(source->>'id') NOT BETWEEN 1 AND 256 THEN
        invalid := TRUE;
      ELSE
        INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
        VALUES (target_session, storage_workspace, 'document', source->>'id') ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  IF invalid THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
    VALUES (target_session, storage_workspace, 'unknown', 'invalid-context-config') ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION capture_ai_context_sources() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM record_ai_context_sources(OLD.session_id, OLD.config::jsonb); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM record_ai_context_sources(NEW.session_id, NEW.config::jsonb); END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ai_context_capture_sources AFTER INSERT OR UPDATE OR DELETE ON ai_contexts
FOR EACH ROW EXECUTE FUNCTION capture_ai_context_sources();

CREATE FUNCTION inherit_ai_session_context_sources() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_session_id IS NOT NULL THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
    SELECT NEW.id, workspace_id, kind, source_id FROM ai_session_context_sources WHERE session_id = NEW.parent_session_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ai_session_inherit_context_sources AFTER INSERT ON ai_sessions_metadata
FOR EACH ROW EXECUTE FUNCTION inherit_ai_session_context_sources();

-- Existing messages cannot prove that removed attachments were never consumed.
INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
SELECT session.id, session.workspace_id, 'unknown', 'legacy-history'
FROM ai_sessions_metadata session WHERE EXISTS (SELECT 1 FROM ai_sessions_messages message WHERE message.session_id = session.id)
ON CONFLICT DO NOTHING;
SELECT record_ai_context_sources(session_id, config::jsonb) FROM ai_contexts;

ALTER TABLE ai_sessions_metadata ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE ai_sessions_metadata ADD CONSTRAINT ai_session_native_owner
  CHECK (workspace_id IS NOT NULL OR (selected_context_project_id IS NOT NULL AND doc_id IS NULL));
ALTER TABLE ai_sessions_metadata DROP CONSTRAINT ai_sessions_metadata_selected_context_project_id_fkey;
ALTER TABLE ai_sessions_metadata ADD CONSTRAINT ai_sessions_metadata_selected_context_project_id_fkey
  FOREIGN KEY (selected_context_project_id) REFERENCES ai_context_projects(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX ai_native_project_session_pinned
  ON ai_sessions_metadata(user_id, selected_context_project_id)
  WHERE workspace_id IS NULL AND pinned = true AND deleted_at IS NULL;

ALTER TABLE ai_session_context_sources ADD COLUMN id VARCHAR NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE ai_session_context_sources ADD COLUMN project_id VARCHAR;
ALTER TABLE ai_session_context_sources DROP CONSTRAINT ai_session_context_sources_pkey;
ALTER TABLE ai_session_context_sources ADD PRIMARY KEY (id);
ALTER TABLE ai_session_context_sources ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE ai_session_context_sources ADD CONSTRAINT ai_session_source_owner
  CHECK ((workspace_id IS NULL) <> (project_id IS NULL));
ALTER TABLE ai_session_context_sources ADD CONSTRAINT ai_session_source_project_length
  CHECK (project_id IS NULL OR length(project_id) BETWEEN 1 AND 256);
ALTER TABLE ai_session_context_sources DROP CONSTRAINT ai_session_context_sources_kind_check;
ALTER TABLE ai_session_context_sources ADD CONSTRAINT ai_session_context_sources_kind_check
  CHECK (kind IN ('workspace', 'document', 'project', 'project_resource', 'project_blob', 'private', 'private_attachment', 'unknown'));
CREATE UNIQUE INDEX ai_session_context_sources_session_id_workspace_id_kind_source_id_key
  ON ai_session_context_sources(session_id, workspace_id, kind, source_id);
CREATE UNIQUE INDEX ai_session_context_sources_session_id_project_id_kind_source_id_key
  ON ai_session_context_sources(session_id, project_id, kind, source_id);

CREATE OR REPLACE FUNCTION bound_ai_session_context_sources() RETURNS trigger AS $$
DECLARE session_project VARCHAR;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('context-source:' || NEW.session_id, 0));
  IF NEW.project_id IS NOT NULL THEN
    SELECT selected_context_project_id INTO session_project FROM ai_sessions_metadata WHERE id = NEW.session_id;
    IF session_project IS DISTINCT FROM NEW.project_id OR NEW.workspace_id IS NOT NULL THEN
      RAISE EXCEPTION 'Project source does not belong to this conversation' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF (NEW.kind IN ('project', 'project_resource', 'project_blob')) AND NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'Project source requires a Project owner' USING ERRCODE = '23514';
  END IF;
  IF (NEW.kind IN ('workspace', 'document')) AND NEW.workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace source requires a Workspace owner' USING ERRCODE = '23514';
  END IF;
  IF NEW.kind = 'project_resource' AND NOT EXISTS (
    SELECT 1 FROM project_resource_revisions revision
    WHERE revision.project_id = NEW.project_id
      AND revision.resource_id = split_part(NEW.source_id, '@', 1)
      AND revision.sequence::text = split_part(NEW.source_id, '@', 2)
  ) THEN
    RAISE EXCEPTION 'Project source revision is unavailable' USING ERRCODE = '23514';
  END IF;
  IF NEW.kind = 'project_blob' AND NOT EXISTS (
    SELECT 1 FROM project_blobs blob WHERE blob.project_id = NEW.project_id AND blob.key = NEW.source_id
  ) THEN
    RAISE EXCEPTION 'Project source Blob is unavailable' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM ai_session_context_sources WHERE session_id = NEW.session_id
      AND workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      AND project_id IS NOT DISTINCT FROM NEW.project_id
      AND kind = NEW.kind AND source_id = NEW.source_id
  ) THEN RETURN NULL; END IF;
  IF NEW.source_id <> 'source-budget-exceeded' AND (SELECT count(*) FROM ai_session_context_sources
      WHERE session_id = NEW.session_id AND source_id <> 'source-budget-exceeded') >= 4096 THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, project_id, kind, source_id)
    VALUES (NEW.session_id, NEW.workspace_id, NEW.project_id, 'unknown', 'source-budget-exceeded') ON CONFLICT DO NOTHING;
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
    INSERT INTO ai_session_context_sources(session_id, workspace_id, project_id, kind, source_id, evidence)
    SELECT NEW.id, workspace_id, project_id, kind, source_id, evidence FROM ai_session_context_sources
    WHERE session_id = NEW.parent_session_id ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION capture_ai_message_sources() RETURNS trigger AS $$
DECLARE session_row ai_sessions_metadata;
DECLARE source_kind VARCHAR;
DECLARE native_project VARCHAR;
DECLARE attachment JSONB;
DECLARE blob_key VARCHAR;
BEGIN
  SELECT * INTO session_row FROM ai_sessions_metadata WHERE id = NEW.session_id;
  native_project := CASE WHEN session_row.workspace_id IS NULL THEN session_row.selected_context_project_id ELSE NULL END;
  IF TG_OP = 'UPDATE' AND (OLD.session_id, OLD.role, OLD.content, OLD.params::jsonb, OLD.attachments::jsonb, OLD."streamObjects"::jsonb)
    IS DISTINCT FROM (NEW.session_id, NEW.role, NEW.content, NEW.params::jsonb, NEW.attachments::jsonb, NEW."streamObjects"::jsonb) THEN
    INSERT INTO ai_session_context_sources(session_id, workspace_id, project_id, kind, source_id)
    VALUES (NEW.session_id, session_row.workspace_id, native_project, 'unknown', 'rewritten-message:' || NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.role = 'user' THEN
    source_kind := CASE WHEN native_project IS NOT NULL THEN 'project'
      WHEN session_row.selected_context_project_id IS NOT NULL AND session_row.doc_id IS NULL THEN 'workspace' ELSE 'private' END;
    INSERT INTO ai_session_context_sources(session_id, workspace_id, project_id, kind, source_id)
    VALUES (NEW.session_id, session_row.workspace_id, native_project, source_kind, 'project-input:' || NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.attachments IS NOT NULL AND NEW.attachments::jsonb NOT IN ('null'::jsonb, '[]'::jsonb) THEN
    FOR attachment IN SELECT value FROM jsonb_array_elements(NEW.attachments::jsonb) LOOP
      blob_key := NULL;
      IF native_project IS NOT NULL AND attachment->>'kind' = 'data' AND attachment->>'encoding' = 'base64'
        AND octet_length(attachment->>'data') <= 33554432 THEN
        BEGIN
          blob_key := 'sha256-' || encode(sha256(decode(attachment->>'data', 'base64')), 'hex');
          IF NOT EXISTS (SELECT 1 FROM project_blobs WHERE project_id = native_project AND key = blob_key
            AND mime_type = attachment->>'mimeType') THEN blob_key := NULL; END IF;
        EXCEPTION WHEN OTHERS THEN blob_key := NULL;
        END;
      END IF;
      INSERT INTO ai_session_context_sources(session_id, workspace_id, project_id, kind, source_id)
      VALUES (NEW.session_id, session_row.workspace_id, native_project,
        CASE WHEN blob_key IS NOT NULL THEN 'project_blob' ELSE 'private_attachment' END,
        COALESCE(blob_key, 'message-attachment:' || NEW.id)) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Native resource context uses the same immutable ledger. Legacy context config
-- must never become an unrecorded input merely because workspace_id is NULL.
ALTER FUNCTION record_ai_context_sources(VARCHAR, JSONB) RENAME TO record_workspace_ai_context_sources;
CREATE FUNCTION record_ai_context_sources(target_session VARCHAR, configuration JSONB) RETURNS void AS $$
DECLARE session_project VARCHAR;
DECLARE storage_workspace VARCHAR;
BEGIN
  SELECT workspace_id, selected_context_project_id INTO storage_workspace, session_project
    FROM ai_sessions_metadata WHERE id = target_session;
  IF storage_workspace IS NOT NULL THEN
    PERFORM record_workspace_ai_context_sources(target_session, configuration);
  ELSIF session_project IS NOT NULL THEN
    INSERT INTO ai_session_context_sources(session_id, project_id, kind, source_id)
    VALUES (target_session, session_project, 'unknown', 'legacy-context-config') ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

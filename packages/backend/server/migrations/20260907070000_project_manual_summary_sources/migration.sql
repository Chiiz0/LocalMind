CREATE TABLE project_summary_revisions (
  id VARCHAR PRIMARY KEY,
  memory_id VARCHAR NOT NULL,
  project_id VARCHAR NOT NULL,
  actor_id_snapshot VARCHAR NOT NULL,
  content_fingerprint VARCHAR NOT NULL CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT project_summary_revisions_memory_id_project_id_fkey
    FOREIGN KEY (memory_id, project_id) REFERENCES ai_context_memories(id, project_id)
    ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE INDEX project_summary_revisions_memory_id_created_at_idx
  ON project_summary_revisions(memory_id, created_at);

CREATE FUNCTION project_summary_revision_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM ai_context_memories WHERE id = OLD.memory_id) THEN
    RETURN OLD;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Project summary source evidence is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ai_context_memories memory
    JOIN ai_context_projects project ON project.id = memory.project_id
    JOIN ai_context_project_members member ON member.project_id = project.id
    WHERE memory.id = NEW.memory_id AND memory.project_id = NEW.project_id
      AND memory.scope = 'project' AND memory.kind = 'project_summary'
      AND memory.workspace_id IS NULL AND memory.doc_id IS NULL
      AND memory.source_session_id IS NULL AND memory.capture_mode = 'manual'
      AND memory.project_source_check_id IS NULL
      AND project.status = 'active' AND member.role = 'owner'
      AND member.user_id = NEW.actor_id_snapshot
      AND encode(digest(memory.content, 'sha256'), 'hex') = NEW.content_fingerprint
  ) THEN
    RAISE EXCEPTION 'Project summary requires its current owner and exact content evidence' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_summary_revision_immutable BEFORE INSERT OR UPDATE OR DELETE
  ON project_summary_revisions FOR EACH ROW EXECUTE FUNCTION project_summary_revision_guard();

CREATE OR REPLACE FUNCTION ai_context_assert_active_memory_sources(target_memory_id VARCHAR)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ai_context_memories memory
    WHERE memory.id = target_memory_id AND memory.scope = 'project' AND memory.status = 'active'
      AND (
        (NOT EXISTS (SELECT 1 FROM ai_context_memory_sources source WHERE source.memory_id = memory.id)
          AND NOT EXISTS (
            SELECT 1 FROM ai_shared_write_source_checks evidence
            JOIN ai_context_memory_events event ON event.decision_fingerprint = evidence.sink_id
              AND event.memory_id = memory.id AND event.operation IN ('ADD', 'UPDATE')
            WHERE evidence.id = memory.project_source_check_id AND evidence.allowed
              AND evidence.project_id = memory.project_id AND evidence.sink_type = 'project_memory'
              AND evidence.sink_workspace_id IS NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM project_summary_revisions revision
            WHERE revision.memory_id = memory.id AND revision.project_id = memory.project_id
              AND memory.kind = 'project_summary' AND memory.capture_mode = 'manual'
              AND memory.source_session_id IS NULL AND memory.project_source_check_id IS NULL
              AND revision.content_fingerprint = encode(digest(memory.content, 'sha256'), 'hex')
          ))
        OR EXISTS (
          SELECT 1 FROM ai_context_memory_sources source
          JOIN ai_context_project_grants grant_row ON grant_row.id = source.project_grant_id
          WHERE source.memory_id = memory.id AND grant_row.status <> 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Active project memory requires authorized source provenance'
      USING ERRCODE = '23514', CONSTRAINT = 'ai_context_memories_active_source_required_check';
  END IF;
END;
$$;

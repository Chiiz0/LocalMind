CREATE TABLE project_realtime_outbox (
  id BIGSERIAL PRIMARY KEY,
  topic VARCHAR(64) NOT NULL,
  scope_id VARCHAR NOT NULL,
  resource_id VARCHAR,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT project_realtime_topic CHECK (topic IN (
    'project.list.changed', 'project.task.changed',
    'project.lease.changed', 'project.resource.changed'
  ))
);

-- Invalidations commit with their source transaction and contain no document or user content.
CREATE FUNCTION project_enqueue_user_changes(project_id_arg TEXT, topic_arg TEXT, users_arg TEXT[])
RETURNS VOID LANGUAGE SQL AS $$
  INSERT INTO project_realtime_outbox (topic, scope_id)
  SELECT topic_arg, user_id FROM (
    SELECT user_id FROM ai_context_project_members WHERE project_id = project_id_arg
    UNION SELECT unnest(users_arg)
  ) recipients WHERE user_id IS NOT NULL;
$$;

CREATE FUNCTION project_enqueue_realtime_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  item JSONB;
  project_id_value TEXT;
  recipients TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN item := to_jsonb(OLD); ELSE item := to_jsonb(NEW); END IF;
  project_id_value := COALESCE(item->>'project_id', item->>'beneficiary_project_id');
  IF TG_TABLE_NAME = 'ai_context_projects' THEN project_id_value := item->>'id'; END IF;
  recipients := ARRAY[
    item->>'user_id', item->>'created_by_user_id', item->>'actor_id',
    item->>'requester_user_id', item->>'resolved_by_user_id',
    item->>'requester_id', item->>'recipient_id', item->>'invitee_user_id', item->>'inviter_user_id'
  ];
  IF TG_ARGV[0] = 'resource' THEN
    INSERT INTO project_realtime_outbox (topic, scope_id, resource_id)
      VALUES ('project.resource.changed', project_id_value, item->>'id');
  ELSE
    IF TG_ARGV[0] = 'list' THEN
      PERFORM project_enqueue_user_changes(project_id_value, 'project.list.changed', recipients);
    END IF;
    PERFORM project_enqueue_user_changes(project_id_value, 'project.task.changed', recipients);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER project_list_realtime AFTER INSERT OR DELETE OR UPDATE OF name, description, status, ai_policy
  ON ai_context_projects FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('list');
CREATE TRIGGER project_member_realtime AFTER INSERT OR UPDATE OR DELETE
  ON ai_context_project_members FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('list');
CREATE TRIGGER project_invitation_realtime AFTER INSERT OR DELETE OR UPDATE OF status
  ON ai_context_project_invitations FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('list');
CREATE TRIGGER project_task_realtime AFTER INSERT OR DELETE OR UPDATE OF status, title
  ON ai_agent_runs FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('task');
CREATE TRIGGER project_blocker_realtime AFTER INSERT OR DELETE OR UPDATE OF status, title, waiting_on, due_at
  ON ai_context_project_blockers FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('task');
-- Existing installations already have this later-dated table; empty databases
-- install its trigger after the file-request migration.
DO $$ BEGIN
  IF to_regclass('public.project_file_requests') IS NOT NULL THEN
    CREATE TRIGGER project_file_request_realtime AFTER INSERT OR DELETE OR UPDATE OF status, version
      ON project_file_requests FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('task');
  END IF;
END $$;
CREATE TRIGGER project_publication_realtime AFTER INSERT OR DELETE OR UPDATE OF status
  ON project_publications FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('task');
CREATE TRIGGER project_access_request_realtime AFTER INSERT OR DELETE OR UPDATE OF status
  ON access_requests FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('task');
CREATE TRIGGER project_resource_realtime AFTER INSERT OR DELETE OR UPDATE OF title, parent_id, sort_key, trashed_at, content_version
  ON project_resources FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('resource');

-- Source approvers can be outside the Project. The existing ACL-filtered notification
-- recipient outbox also invalidates their task panel without publishing resource identity.
CREATE FUNCTION project_enqueue_notification_task_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO project_realtime_outbox (topic, scope_id) VALUES ('project.task.changed', NEW.user_id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER project_notification_task_realtime AFTER INSERT OR UPDATE ON notification_refresh
  FOR EACH ROW EXECUTE FUNCTION project_enqueue_notification_task_change();

CREATE FUNCTION project_enqueue_office_resource_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    INSERT INTO project_realtime_outbox (topic, scope_id, resource_id)
      SELECT 'project.resource.changed', project_id, id FROM project_resources
      WHERE project_id = NEW.project_id AND office_artifact_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER project_office_resource_realtime AFTER UPDATE OF revision_counter, title
  ON office_artifacts FOR EACH ROW EXECUTE FUNCTION project_enqueue_office_resource_change();

CREATE TABLE project_resource_edit_leases (
  resource_id VARCHAR PRIMARY KEY,
  project_id VARCHAR NOT NULL,
  lease_id VARCHAR NOT NULL UNIQUE,
  holder_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  tab_id VARCHAR(128) NOT NULL CHECK (length(btrim(tab_id)) BETWEEN 1 AND 128),
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('user', 'ai_task')),
  task_id VARCHAR,
  acquired_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT project_edit_lease_resource_fkey FOREIGN KEY (resource_id, project_id)
    REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT project_edit_lease_task_fkey FOREIGN KEY (task_id, project_id, holder_id)
    REFERENCES ai_agent_runs(id, project_id, actor_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT project_edit_lease_kind_check CHECK ((kind = 'ai_task') = (task_id IS NOT NULL)),
  CONSTRAINT project_edit_lease_time_check CHECK (expires_at > acquired_at)
);
CREATE UNIQUE INDEX project_resource_edit_leases_resource_id_project_id_key ON project_resource_edit_leases(resource_id, project_id);
CREATE INDEX project_resource_edit_leases_project_id_expires_at_idx ON project_resource_edit_leases(project_id, expires_at);
CREATE INDEX project_resource_edit_leases_task_id_idx ON project_resource_edit_leases(task_id);

ALTER TABLE ai_agent_runs
  ADD COLUMN waiting_lease_resource_id VARCHAR,
  ADD COLUMN waiting_lease_id VARCHAR,
  ADD COLUMN lease_retry_count INTEGER NOT NULL DEFAULT 0 CHECK (lease_retry_count BETWEEN 0 AND 1),
  ADD CONSTRAINT project_agent_waiting_lease_resource_fkey FOREIGN KEY (waiting_lease_resource_id, project_id)
    REFERENCES project_resources(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT project_agent_lease_wait_check CHECK (status <> 'waiting_lease' OR (
    project_id IS NOT NULL AND workspace_id IS NULL AND waiting_lease_resource_id IS NOT NULL
    AND waiting_lease_id IS NOT NULL AND queued_at IS NULL AND completed_at IS NULL
    AND worker_lease_id IS NULL AND worker_lease_expires_at IS NULL
  ));
ALTER TABLE ai_agent_runs DROP CONSTRAINT ai_agent_runs_status_check;
ALTER TABLE ai_agent_runs ADD CONSTRAINT ai_agent_runs_status_check CHECK (
  status IN ('queued', 'running', 'waiting_approval', 'waiting_for_location', 'waiting_lease', 'completed', 'failed', 'cancelled')
);
ALTER TABLE ai_agent_timeline_events DROP CONSTRAINT ai_agent_timeline_events_status_check;
ALTER TABLE ai_agent_timeline_events ADD CONSTRAINT ai_agent_timeline_events_status_check CHECK (
  status IN ('queued', 'running', 'waiting_approval', 'waiting_for_location', 'waiting_lease', 'completed', 'failed', 'cancelled', 'pending', 'skipped')
);

-- Renewals are quiet; acquisition/release/expiry and denied renewals invalidate snapshots.
CREATE FUNCTION project_edit_lease_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  row_value project_resource_edit_leases;
  action_value TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.lease_id = NEW.lease_id THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' THEN
    row_value := OLD;
    action_value := CASE WHEN OLD.expires_at <= clock_timestamp() THEN 'edit_lease_expired' ELSE 'edit_lease_released' END;
    INSERT INTO project_resource_audit_events(id, project_id, resource_id, actor_id, action, evidence)
    VALUES(gen_random_uuid()::text, OLD.project_id, OLD.resource_id, OLD.holder_id, action_value,
      jsonb_build_object('leaseId', OLD.lease_id, 'kind', OLD.kind, 'tabId', OLD.tab_id, 'taskId', OLD.task_id,
        'acquiredAt', OLD.acquired_at, 'expiresAt', OLD.expires_at));
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_value := NEW;
    INSERT INTO project_resource_audit_events(id, project_id, resource_id, actor_id, action, evidence)
    VALUES(gen_random_uuid()::text, NEW.project_id, NEW.resource_id, NEW.holder_id, 'edit_lease_acquired',
      jsonb_build_object('leaseId', NEW.lease_id, 'kind', NEW.kind, 'tabId', NEW.tab_id, 'taskId', NEW.task_id,
        'acquiredAt', NEW.acquired_at, 'expiresAt', NEW.expires_at));
  END IF;
  INSERT INTO project_realtime_outbox(topic, scope_id, resource_id)
    VALUES ('project.lease.changed', row_value.project_id, row_value.resource_id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER project_edit_lease_realtime AFTER INSERT OR UPDATE OR DELETE ON project_resource_edit_leases
  FOR EACH ROW EXECUTE FUNCTION project_edit_lease_changed();

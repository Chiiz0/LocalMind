DROP TRIGGER IF EXISTS project_file_request_realtime ON project_file_requests;
CREATE TRIGGER project_file_request_realtime AFTER INSERT OR DELETE OR UPDATE OF status, version
  ON project_file_requests FOR EACH ROW EXECUTE FUNCTION project_enqueue_realtime_change('task');

ALTER TYPE "NotificationType" ADD VALUE 'AccessRequest';
ALTER TYPE "NotificationType" ADD VALUE 'AccessRequestResolved';

-- Serialize the first message with project binding, including direct DB writes.
CREATE FUNCTION lock_ai_session_project_for_message() RETURNS trigger AS $$
BEGIN
  PERFORM id FROM ai_sessions_metadata WHERE id = NEW.session_id FOR UPDATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_session_message_project_lock
BEFORE INSERT ON ai_sessions_messages
FOR EACH ROW EXECUTE FUNCTION lock_ai_session_project_for_message();

CREATE FUNCTION protect_ai_session_project_binding() RETURNS trigger AS $$
BEGIN
  IF NEW.selected_context_project_id IS DISTINCT FROM OLD.selected_context_project_id
     AND (OLD.selected_context_project_id IS NOT NULL OR EXISTS (
       SELECT 1 FROM ai_sessions_messages WHERE session_id = OLD.id
     )) THEN
    RAISE EXCEPTION 'Conversation project binding is immutable; start a new conversation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_session_project_binding_immutable
BEFORE UPDATE OF selected_context_project_id ON ai_sessions_metadata
FOR EACH ROW EXECUTE FUNCTION protect_ai_session_project_binding();

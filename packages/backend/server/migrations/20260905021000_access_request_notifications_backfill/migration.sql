WITH recipients AS (
  SELECT request.id AS request_id, request.workspace_id,
    request.requester_user_id_snapshot, member.user_id
  FROM access_requests request
  JOIN workspace_members member ON member.workspace_id = request.workspace_id
    AND member.state = 'active' AND member.role IN ('owner', 'admin')
  WHERE request.status = 'pending'
    AND (request.expires_at IS NULL OR request.expires_at > CURRENT_TIMESTAMP)
  UNION
  SELECT request.id, request.workspace_id,
    request.requester_user_id_snapshot, grant_row.principal_id
  FROM access_requests request
  JOIN doc_grants grant_row ON grant_row.workspace_id = request.workspace_id
    AND grant_row.doc_id = request.doc_id
    AND grant_row.principal_type = 'user' AND grant_row.role = 'owner'
  JOIN users recipient ON recipient.id = grant_row.principal_id
  WHERE request.status = 'pending'
    AND (request.expires_at IS NULL OR request.expires_at > CURRENT_TIMESTAMP)
), inserted AS (
  INSERT INTO notifications (id, user_id, level, type, body)
  SELECT 'access:' || request_id || ':' || user_id, user_id,
    'Default'::"NotificationLevel", 'AccessRequest'::"NotificationType",
    jsonb_build_object('workspaceId', workspace_id,
      'createdByUserId', requester_user_id_snapshot, 'requestId', request_id)
  FROM recipients
  ON CONFLICT (id) DO NOTHING
  RETURNING user_id
)
INSERT INTO notification_refresh (user_id, revision)
SELECT user_id, gen_random_uuid()::text FROM (SELECT DISTINCT user_id FROM inserted) recipients
ON CONFLICT (user_id) DO UPDATE SET revision = EXCLUDED.revision, updated_at = CURRENT_TIMESTAMP;

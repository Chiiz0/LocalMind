ALTER TABLE project_resources DROP CONSTRAINT project_resource_search_version_check;
ALTER TABLE project_resources ADD CONSTRAINT project_resource_search_version_check
  CHECK (search_version >= 0 AND (office_artifact_id IS NOT NULL OR search_version <= content_version));

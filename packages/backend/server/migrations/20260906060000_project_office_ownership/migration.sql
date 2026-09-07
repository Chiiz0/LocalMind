-- Retain the existing composite Workspace foreign keys as ownership guards.

-- AlterTable
ALTER TABLE "project_resources" ADD COLUMN     "office_artifact_id" VARCHAR;

-- AlterTable
ALTER TABLE "office_artifacts" ADD COLUMN     "project_id" VARCHAR,
ALTER COLUMN "workspace_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "office_revisions" ADD COLUMN     "project_id" VARCHAR,
ALTER COLUMN "workspace_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "office_command_requests" ADD COLUMN     "project_id" VARCHAR,
ALTER COLUMN "workspace_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "project_resources_office_artifact_id_key" ON "project_resources"("office_artifact_id");

-- CreateIndex
CREATE INDEX "office_artifacts_project_id_kind_updated_at_idx" ON "office_artifacts"("project_id", "kind", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "office_artifacts_id_project_id_key" ON "office_artifacts"("id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "office_artifacts_project_id_import_idempotency_key_key" ON "office_artifacts"("project_id", "import_idempotency_key");

-- CreateIndex
CREATE INDEX "office_revisions_project_id_artifact_id_created_at_idx" ON "office_revisions"("project_id", "artifact_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "office_revisions_id_artifact_id_project_id_key" ON "office_revisions"("id", "artifact_id", "project_id");

-- CreateIndex
CREATE INDEX "office_command_requests_project_id_artifact_id_created_at_idx" ON "office_command_requests"("project_id", "artifact_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "office_command_requests_id_project_id_key" ON "office_command_requests"("id", "project_id");

-- AddForeignKey
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_office_artifact_id_project_id_fkey" FOREIGN KEY ("office_artifact_id", "project_id") REFERENCES "office_artifacts"("id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "office_artifacts" ADD CONSTRAINT "office_artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_context_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_artifacts" ADD CONSTRAINT "office_artifacts_project_id_source_blob_key_fkey" FOREIGN KEY ("project_id", "source_blob_key") REFERENCES "project_blobs"("project_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "office_revisions" ADD CONSTRAINT "office_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_context_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_revisions" ADD CONSTRAINT "office_revisions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "office_artifacts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "office_revisions" ADD CONSTRAINT "office_revisions_project_id_package_blob_key_fkey" FOREIGN KEY ("project_id", "package_blob_key") REFERENCES "project_blobs"("project_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "office_revisions" ADD CONSTRAINT "office_revisions_project_id_state_blob_key_fkey" FOREIGN KEY ("project_id", "state_blob_key") REFERENCES "project_blobs"("project_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "office_command_requests" ADD CONSTRAINT "office_command_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_context_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_command_requests" ADD CONSTRAINT "office_command_requests_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "office_artifacts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "office_command_requests" ADD CONSTRAINT "office_command_requests_expected_revision_id_fkey" FOREIGN KEY ("expected_revision_id") REFERENCES "office_revisions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "office_command_requests" ADD CONSTRAINT "office_command_requests_project_id_command_blob_key_fkey" FOREIGN KEY ("project_id", "command_blob_key") REFERENCES "project_blobs"("project_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE office_artifacts ADD CONSTRAINT office_artifact_owner CHECK ((workspace_id IS NULL) <> (project_id IS NULL));
ALTER TABLE office_revisions ADD CONSTRAINT office_revision_owner CHECK ((workspace_id IS NULL) <> (project_id IS NULL));
ALTER TABLE office_command_requests ADD CONSTRAINT office_command_owner CHECK ((workspace_id IS NULL) <> (project_id IS NULL));
ALTER TABLE office_revisions ADD CONSTRAINT office_revision_project_artifact
  FOREIGN KEY (artifact_id, project_id) REFERENCES office_artifacts(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE office_command_requests ADD CONSTRAINT office_command_project_artifact
  FOREIGN KEY (artifact_id, project_id) REFERENCES office_artifacts(id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE office_command_requests ADD CONSTRAINT office_command_project_revision
  FOREIGN KEY (expected_revision_id, artifact_id, project_id) REFERENCES office_revisions(id, artifact_id, project_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_resources ADD CONSTRAINT project_resource_office_kind CHECK (
  (kind IN ('document', 'workbook', 'presentation', 'pdf')) = (office_artifact_id IS NOT NULL)
);

-- Workspace guards remain intact; Project rows have equivalent native-owner guards.
DROP TRIGGER office_artifact_source_evidence_restrict_check ON office_artifacts;
CREATE TRIGGER office_artifact_source_evidence_restrict_check BEFORE UPDATE ON office_artifacts
  FOR EACH ROW WHEN (NEW.project_id IS NULL) EXECUTE FUNCTION office_artifact_source_evidence_restrict();
DROP TRIGGER office_artifact_source_blob_guard_check ON office_artifacts;
CREATE TRIGGER office_artifact_source_blob_guard_check BEFORE INSERT ON office_artifacts
  FOR EACH ROW WHEN (NEW.project_id IS NULL) EXECUTE FUNCTION office_artifact_blob_guard();
DROP TRIGGER office_revision_parent_guard_check ON office_revisions;
CREATE TRIGGER office_revision_parent_guard_check BEFORE INSERT ON office_revisions
  FOR EACH ROW WHEN (NEW.project_id IS NULL) EXECUTE FUNCTION office_revision_parent_guard();
DROP TRIGGER office_revision_counter_commit_guard_check ON office_revisions;
CREATE CONSTRAINT TRIGGER office_revision_counter_commit_guard_check AFTER INSERT ON office_revisions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.project_id IS NULL) EXECUTE FUNCTION office_revision_counter_commit_guard();
DROP TRIGGER office_artifact_initial_revision_commit_guard_check ON office_artifacts;
CREATE CONSTRAINT TRIGGER office_artifact_initial_revision_commit_guard_check AFTER INSERT ON office_artifacts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.project_id IS NULL) EXECUTE FUNCTION office_artifact_initial_revision_commit_guard();
DROP TRIGGER office_command_request_blob_guard_check ON office_command_requests;
CREATE TRIGGER office_command_request_blob_guard_check BEFORE INSERT ON office_command_requests
  FOR EACH ROW WHEN (NEW.project_id IS NULL) EXECUTE FUNCTION office_command_request_blob_guard();

CREATE FUNCTION guard_project_office_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source project_blobs;
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW.project_id, NEW.workspace_id) IS DISTINCT FROM ROW(OLD.project_id, OLD.workspace_id) THEN
    RAISE EXCEPTION 'Office ownership is immutable';
  END IF;
  IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW.kind, NEW.source_file_name, NEW.source_mime_type, NEW.source_blob_key,
           NEW.source_byte_size, NEW.source_fingerprint, NEW.import_idempotency_key,
           NEW.import_fingerprint, NEW.created_by, NEW.created_at)
       IS DISTINCT FROM ROW(OLD.id, OLD.kind, OLD.source_file_name, OLD.source_mime_type, OLD.source_blob_key,
           OLD.source_byte_size, OLD.source_fingerprint, OLD.import_idempotency_key,
           OLD.import_fingerprint, OLD.created_by, OLD.created_at) THEN
      RAISE EXCEPTION 'Office Project import evidence is immutable';
    END IF;
    IF NEW.revision_counter NOT IN (OLD.revision_counter, OLD.revision_counter + 1) THEN
      RAISE EXCEPTION 'Office Project revision counter must be contiguous';
    END IF;
    IF NEW.revision_counter = OLD.revision_counter + 1 AND NOT EXISTS (
      SELECT 1 FROM office_revisions WHERE artifact_id = NEW.id AND project_id = NEW.project_id AND sequence = NEW.revision_counter
    ) THEN RAISE EXCEPTION 'Office Project revision counter has no revision'; END IF;
  END IF;
  SELECT * INTO source FROM project_blobs WHERE project_id = NEW.project_id AND key = NEW.source_blob_key FOR SHARE;
  IF NOT FOUND OR source.mime_type <> NEW.source_mime_type OR source.byte_size <> NEW.source_byte_size
     OR 'sha256:' || source.fingerprint <> NEW.source_fingerprint THEN
    RAISE EXCEPTION 'Office Project source Blob evidence mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_office_artifact_guard BEFORE INSERT OR UPDATE ON office_artifacts
  FOR EACH ROW EXECUTE FUNCTION guard_project_office_artifact();

CREATE FUNCTION guard_project_office_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE artifact office_artifacts; package project_blobs; state project_blobs; parent office_revisions;
BEGIN
  SELECT * INTO artifact FROM office_artifacts WHERE id = NEW.artifact_id AND project_id = NEW.project_id FOR UPDATE;
  IF NOT FOUND OR NEW.sequence <> artifact.revision_counter + 1 THEN
    RAISE EXCEPTION 'Office Project revision sequence mismatch';
  END IF;
  SELECT * INTO package FROM project_blobs WHERE project_id = NEW.project_id AND key = NEW.package_blob_key FOR SHARE;
  IF NOT FOUND OR package.mime_type <> artifact.source_mime_type OR package.mime_type <> NEW.package_mime_type
     OR package.byte_size <> NEW.package_byte_size OR 'sha256:' || package.fingerprint <> NEW.package_fingerprint THEN
    RAISE EXCEPTION 'Office Project package Blob evidence mismatch';
  END IF;
  IF NEW.state_blob_key IS NOT NULL THEN
    SELECT * INTO state FROM project_blobs WHERE project_id = NEW.project_id AND key = NEW.state_blob_key FOR SHARE;
    IF NOT FOUND OR state.byte_size <> NEW.state_byte_size OR 'sha256:' || state.fingerprint <> NEW.state_fingerprint THEN
      RAISE EXCEPTION 'Office Project state Blob evidence mismatch';
    END IF;
  END IF;
  IF NEW.sequence = 1 THEN
    IF NEW.parent_revision_id IS NOT NULL OR NEW.origin <> 'import' OR
       ROW(NEW.package_blob_key, NEW.package_mime_type, NEW.package_byte_size, NEW.package_fingerprint,
           NEW.idempotency_key, NEW.idempotency_fingerprint, NEW.created_by)
       IS DISTINCT FROM ROW(artifact.source_blob_key, artifact.source_mime_type, artifact.source_byte_size,
           artifact.source_fingerprint, artifact.import_idempotency_key, artifact.import_fingerprint, artifact.created_by) THEN
      RAISE EXCEPTION 'Office Project initial revision evidence mismatch';
    END IF;
  ELSE
    SELECT * INTO parent FROM office_revisions WHERE id = NEW.parent_revision_id
      AND artifact_id = NEW.artifact_id AND project_id = NEW.project_id;
    IF NOT FOUND OR NEW.origin = 'import' OR parent.sequence <> NEW.sequence - 1 THEN
      RAISE EXCEPTION 'Office Project parent revision mismatch';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_office_revision_guard BEFORE INSERT ON office_revisions
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION guard_project_office_revision();

CREATE FUNCTION guard_project_office_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE artifact office_artifacts; artifact_key VARCHAR; highest INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'office_artifacts' THEN artifact_key := NEW.id;
  ELSE artifact_key := NEW.artifact_id; END IF;
  SELECT * INTO artifact FROM office_artifacts WHERE id = artifact_key;
  SELECT MAX(sequence) INTO highest FROM office_revisions WHERE artifact_id = artifact_key AND project_id = artifact.project_id;
  IF artifact.revision_counter < 1 OR highest IS DISTINCT FROM artifact.revision_counter THEN
    RAISE EXCEPTION 'Office Project Artifact must commit with its current revision';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER project_office_artifact_commit AFTER INSERT OR UPDATE ON office_artifacts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION guard_project_office_commit();
CREATE CONSTRAINT TRIGGER project_office_revision_commit AFTER INSERT ON office_revisions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION guard_project_office_commit();

CREATE FUNCTION guard_project_office_command() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE blob project_blobs;
BEGIN
  SELECT * INTO blob FROM project_blobs WHERE project_id = NEW.project_id AND key = NEW.command_blob_key FOR SHARE;
  IF NOT FOUND OR blob.mime_type <> 'application/vnd.localmind.office-command+json' OR blob.byte_size <> NEW.command_byte_size
     OR 'sha256:' || blob.fingerprint <> NEW.command_fingerprint THEN
    RAISE EXCEPTION 'Office Project command Blob evidence mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_office_command_guard BEFORE INSERT ON office_command_requests
  FOR EACH ROW WHEN (NEW.project_id IS NOT NULL) EXECUTE FUNCTION guard_project_office_command();

CREATE FUNCTION guard_project_resource_office() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.office_artifact_id IS DISTINCT FROM OLD.office_artifact_id THEN
    RAISE EXCEPTION 'Project Office resource identity is immutable';
  END IF;
  IF NEW.office_artifact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM office_artifacts WHERE id = NEW.office_artifact_id AND project_id = NEW.project_id AND kind::text = NEW.kind::text
  ) THEN RAISE EXCEPTION 'Project Office resource must match its native Artifact'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_resource_office_guard BEFORE INSERT OR UPDATE ON project_resources
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_office();

CREATE OR REPLACE FUNCTION guard_project_resource_revision_counter() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE node project_resources; resource_id VARCHAR; last_sequence INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'project_resources' THEN resource_id := NEW.id;
  ELSE resource_id := NEW.resource_id; END IF;
  SELECT * INTO node FROM project_resources WHERE id = resource_id;
  SELECT MAX(sequence) INTO last_sequence FROM project_resource_revisions r WHERE r.resource_id = node.id;
  IF node.kind = 'folder' OR node.office_artifact_id IS NOT NULL THEN
    IF node.content_version <> 0 OR last_sequence IS NOT NULL THEN
      RAISE EXCEPTION 'Folders and native Office resources cannot own BlockSuite content revisions';
    END IF;
  ELSIF node.content_version < 1 OR node.content_version IS DISTINCT FROM last_sequence THEN
    RAISE EXCEPTION 'Project content must commit with its current immutable revision';
  END IF;
  RETURN NULL;
END $$;

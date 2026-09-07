-- CreateEnum
CREATE TYPE "ProjectResourceKind" AS ENUM ('folder', 'page', 'edgeless', 'document', 'workbook', 'presentation', 'pdf', 'file');

-- CreateTable
CREATE TABLE "project_resources" (
    "id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "parent_id" VARCHAR,
    "kind" "ProjectResourceKind" NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "sort_key" VARCHAR(256) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content_version" INTEGER NOT NULL DEFAULT 0,
    "creation_key" VARCHAR(256) NOT NULL,
    "creation_hash" VARCHAR(64) NOT NULL,
    "created_by" VARCHAR NOT NULL,
    "trashed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_blobs" (
    "project_id" VARCHAR NOT NULL,
    "key" VARCHAR(256) NOT NULL,
    "mime_type" VARCHAR(256) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "created_by" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_blobs_pkey" PRIMARY KEY ("project_id","key")
);

-- CreateTable
CREATE TABLE "project_resource_revisions" (
    "id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "resource_id" VARCHAR NOT NULL,
    "sequence" INTEGER NOT NULL,
    "parent_id" VARCHAR,
    "blob_key" VARCHAR(256) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "origin" VARCHAR(32) NOT NULL,
    "request_key" VARCHAR(256) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "created_by" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_resource_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_resource_audit_events" (
    "id" VARCHAR NOT NULL,
    "project_id" VARCHAR NOT NULL,
    "resource_id" VARCHAR,
    "actor_id" VARCHAR NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_resource_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_resources_project_id_parent_id_trashed_at_sort_key__idx" ON "project_resources"("project_id", "parent_id", "trashed_at", "sort_key", "id");

-- CreateIndex
CREATE INDEX "project_resources_project_id_trashed_at_updated_at_id_idx" ON "project_resources"("project_id", "trashed_at", "updated_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "project_resources_id_project_id_key" ON "project_resources"("id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_resources_project_id_created_by_creation_key_key" ON "project_resources"("project_id", "created_by", "creation_key");

-- CreateIndex
CREATE UNIQUE INDEX "project_resource_revisions_parent_id_key" ON "project_resource_revisions"("parent_id");

-- CreateIndex
CREATE INDEX "project_resource_revisions_project_id_resource_id_created_a_idx" ON "project_resource_revisions"("project_id", "resource_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_resource_revisions_id_resource_id_project_id_key" ON "project_resource_revisions"("id", "resource_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_resource_revisions_resource_id_sequence_key" ON "project_resource_revisions"("resource_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "project_resource_revisions_resource_id_created_by_request_k_key" ON "project_resource_revisions"("resource_id", "created_by", "request_key");

-- CreateIndex
CREATE INDEX "project_resource_audit_events_project_id_created_at_id_idx" ON "project_resource_audit_events"("project_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "project_resource_audit_events_project_id_resource_id_create_idx" ON "project_resource_audit_events"("project_id", "resource_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_context_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_parent_id_project_id_fkey" FOREIGN KEY ("parent_id", "project_id") REFERENCES "project_resources"("id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_blobs" ADD CONSTRAINT "project_blobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_context_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_resource_revisions" ADD CONSTRAINT "project_resource_revisions_resource_id_project_id_fkey" FOREIGN KEY ("resource_id", "project_id") REFERENCES "project_resources"("id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_resource_revisions" ADD CONSTRAINT "project_resource_revisions_project_id_blob_key_fkey" FOREIGN KEY ("project_id", "blob_key") REFERENCES "project_blobs"("project_id", "key") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_resource_revisions" ADD CONSTRAINT "project_resource_revisions_parent_id_resource_id_project_i_fkey" FOREIGN KEY ("parent_id", "resource_id", "project_id") REFERENCES "project_resource_revisions"("id", "resource_id", "project_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "project_resource_audit_events" ADD CONSTRAINT "project_resource_audit_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ai_context_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE project_resources ADD CONSTRAINT project_resource_shape CHECK (
  version > 0 AND content_version >= 0 AND length(btrim(title)) > 0
  AND title NOT IN ('.', '..') AND title !~ '[/\\\x00-\x1f]'
  AND length(sort_key) > 0 AND length(creation_key) > 0
  AND creation_hash ~ '^[a-f0-9]{64}$' AND parent_id IS DISTINCT FROM id
);
CREATE UNIQUE INDEX project_resource_folder_name ON project_resources
  (project_id, COALESCE(parent_id, ''), lower(title))
  WHERE kind = 'folder' AND trashed_at IS NULL;

ALTER TABLE project_blobs ADD CONSTRAINT project_blob_shape CHECK (
  byte_size BETWEEN 0 AND 33554432 AND length(mime_type) > 0
  AND fingerprint ~ '^[a-f0-9]{64}$' AND key = 'sha256-' || fingerprint
);
ALTER TABLE project_resource_revisions ADD CONSTRAINT project_resource_revision_shape CHECK (
  sequence > 0 AND ((sequence = 1) = (parent_id IS NULL))
  AND fingerprint ~ '^[a-f0-9]{64}$' AND request_hash ~ '^[a-f0-9]{64}$'
  AND length(request_key) > 0 AND origin IN ('user', 'ai', 'import')
);
ALTER TABLE project_resource_audit_events ADD CONSTRAINT project_resource_audit_shape CHECK (
  jsonb_typeof(evidence) = 'object' AND octet_length(evidence::text) <= 32768
);

CREATE FUNCTION guard_project_resource_tree() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ancestor RECORD;
  next_parent VARCHAR;
  depth INTEGER := 1;
  subtree_depth INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW.project_id, NEW.kind, NEW.creation_key, NEW.creation_hash, NEW.created_by, NEW.created_at)
       IS DISTINCT FROM ROW(OLD.id, OLD.project_id, OLD.kind, OLD.creation_key, OLD.creation_hash, OLD.created_by, OLD.created_at) THEN
      RAISE EXCEPTION 'Project resource identity is immutable';
    END IF;
    IF NEW.content_version NOT IN (OLD.content_version, OLD.content_version + 1) THEN
      RAISE EXCEPTION 'Project content versions must be contiguous';
    END IF;
    IF ROW(NEW.parent_id, NEW.title, NEW.sort_key, NEW.trashed_at)
       IS DISTINCT FROM ROW(OLD.parent_id, OLD.title, OLD.sort_key, OLD.trashed_at) THEN
      IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION 'Project tree mutation requires the next version';
      END IF;
    ELSIF NEW.version NOT IN (OLD.version, OLD.version + 1) THEN
      RAISE EXCEPTION 'Invalid Project tree version';
    END IF;
    IF NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id THEN RETURN NEW; END IF;
  END IF;
  PERFORM id FROM ai_context_projects WHERE id = NEW.project_id FOR UPDATE;
  next_parent := NEW.parent_id;
  WHILE next_parent IS NOT NULL LOOP
    IF next_parent = NEW.id OR depth >= 64 THEN
      RAISE EXCEPTION 'Project tree cycle or depth limit';
    END IF;
    SELECT id, parent_id, kind, trashed_at INTO ancestor FROM project_resources
      WHERE id = next_parent AND project_id = NEW.project_id;
    IF NOT FOUND OR ancestor.kind <> 'folder' OR ancestor.trashed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Project parent must be an active folder in the same Project';
    END IF;
    next_parent := ancestor.parent_id;
    depth := depth + 1;
  END LOOP;
  IF TG_OP = 'UPDATE' THEN
    WITH RECURSIVE descendants AS (
      SELECT id, 1 AS depth FROM project_resources WHERE id = NEW.id
      UNION ALL
      SELECT r.id, d.depth + 1 FROM project_resources r JOIN descendants d ON r.parent_id = d.id
        WHERE r.project_id = NEW.project_id AND d.depth <= 64
    ) SELECT MAX(descendants.depth) INTO subtree_depth FROM descendants;
    IF depth + subtree_depth - 1 > 64 THEN RAISE EXCEPTION 'Project subtree exceeds the depth limit'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_resource_tree_guard BEFORE INSERT OR UPDATE ON project_resources
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_tree();

CREATE FUNCTION guard_project_resource_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Project resource evidence is immutable';
END $$;
CREATE TRIGGER project_blob_immutable BEFORE UPDATE OR DELETE ON project_blobs
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_immutable();
CREATE TRIGGER project_revision_immutable BEFORE UPDATE OR DELETE ON project_resource_revisions
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_immutable();
CREATE TRIGGER project_resource_audit_immutable BEFORE UPDATE OR DELETE ON project_resource_audit_events
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_immutable();

CREATE FUNCTION guard_project_resource_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE node project_resources; parent project_resource_revisions; blob project_blobs;
BEGIN
  SELECT * INTO node FROM project_resources WHERE id = NEW.resource_id AND project_id = NEW.project_id FOR UPDATE;
  IF NOT FOUND OR node.kind = 'folder' OR NEW.sequence <> node.content_version + 1 THEN
    RAISE EXCEPTION 'Project revision must append to its current resource';
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent FROM project_resource_revisions WHERE id = NEW.parent_id;
    IF NOT FOUND OR parent.resource_id <> NEW.resource_id OR parent.project_id <> NEW.project_id OR parent.sequence + 1 <> NEW.sequence THEN
      RAISE EXCEPTION 'Project revision parent does not match';
    END IF;
  END IF;
  SELECT * INTO blob FROM project_blobs WHERE project_id = NEW.project_id AND key = NEW.blob_key FOR SHARE;
  IF NOT FOUND OR blob.fingerprint <> NEW.fingerprint THEN
    RAISE EXCEPTION 'Project revision Blob evidence does not match';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_resource_revision_guard BEFORE INSERT ON project_resource_revisions
  FOR EACH ROW EXECUTE FUNCTION guard_project_resource_revision();

CREATE FUNCTION guard_project_resource_revision_counter() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE node project_resources; resource_id VARCHAR; last_sequence INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'project_resources' THEN resource_id := NEW.id;
  ELSE resource_id := NEW.resource_id; END IF;
  SELECT * INTO node FROM project_resources WHERE id = resource_id;
  SELECT MAX(sequence) INTO last_sequence FROM project_resource_revisions r WHERE r.resource_id = node.id;
  IF node.kind = 'folder' THEN
    IF node.content_version <> 0 OR last_sequence IS NOT NULL THEN RAISE EXCEPTION 'Project folders cannot own content revisions'; END IF;
  ELSIF node.content_version < 1 OR node.content_version IS DISTINCT FROM last_sequence THEN
    RAISE EXCEPTION 'Project content must commit with its current immutable revision';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER project_resource_counter_guard AFTER INSERT OR UPDATE ON project_resources
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_project_resource_revision_counter();
CREATE CONSTRAINT TRIGGER project_revision_counter_guard AFTER INSERT ON project_resource_revisions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_project_resource_revision_counter();

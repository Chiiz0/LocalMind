CREATE TABLE "ai_project_byok_config" (
    "id" VARCHAR NOT NULL DEFAULT 'global',
    "revision" INTEGER NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "endpoint" VARCHAR(2048),
    "model_id" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_validated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(300),
    "last_error_at" TIMESTAMPTZ(3),
    "updated_by" VARCHAR NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_project_byok_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_project_byok_singleton" CHECK ("id" = 'global'),
    CONSTRAINT "ai_project_byok_revision" CHECK ("revision" > 0),
    CONSTRAINT "ai_project_byok_provider" CHECK ("provider" IN ('openai', 'anthropic', 'gemini')),
    CONSTRAINT "ai_project_byok_credential" CHECK (length("encrypted_api_key") > 0 AND length(trim("model_id")) > 0)
);

CREATE TABLE "ai_project_byok_audit_events" (
    "id" VARCHAR NOT NULL,
    "revision" INTEGER NOT NULL,
    "actor_id" VARCHAR NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "endpoint" VARCHAR(2048),
    "model_id" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "credential_changed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_project_byok_audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_project_byok_audit_revision" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "ai_project_byok_audit_events_revision_key" ON "ai_project_byok_audit_events"("revision");

CREATE FUNCTION protect_project_byok_audit() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Project BYOK audit events are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ai_project_byok_audit_immutable"
BEFORE UPDATE OR DELETE ON "ai_project_byok_audit_events"
FOR EACH ROW EXECUTE FUNCTION protect_project_byok_audit();

CREATE TABLE "notification_refresh" (
  "user_id" VARCHAR NOT NULL PRIMARY KEY,
  "revision" VARCHAR NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_refresh_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notification_refresh_updated_at_idx" ON "notification_refresh"("updated_at");

-- Existing access notifications also need their first realtime refresh.
INSERT INTO "notification_refresh" ("user_id", "revision")
SELECT DISTINCT "user_id", gen_random_uuid()::text
FROM "notifications"
WHERE "type" IN ('AccessRequest', 'AccessRequestResolved')
ON CONFLICT ("user_id") DO NOTHING;

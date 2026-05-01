ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarded_at" TIMESTAMP(3);

CREATE TABLE "group_join_requests" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "group_id" TEXT NOT NULL,
    "requester_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,

    CONSTRAINT "group_join_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_join_requests_group_id_requester_user_id_key"
    ON "group_join_requests"("group_id", "requester_user_id");

CREATE INDEX "group_join_requests_requester_user_id_status_idx"
    ON "group_join_requests"("requester_user_id", "status");

CREATE INDEX "group_join_requests_group_id_status_idx"
    ON "group_join_requests"("group_id", "status");

ALTER TABLE "group_join_requests"
    ADD CONSTRAINT "group_join_requests_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_join_requests"
    ADD CONSTRAINT "group_join_requests_requester_user_id_fkey"
    FOREIGN KEY ("requester_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_join_requests"
    ADD CONSTRAINT "group_join_requests_reviewed_by_fkey"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

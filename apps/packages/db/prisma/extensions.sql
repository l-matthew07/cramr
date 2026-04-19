-- Partial indexes and other DB features Prisma cannot express directly.
-- Applied by `pnpm db:setup` after `prisma migrate deploy`.
-- Safe to re-run (uses IF NOT EXISTS).

-- Only one active (un-ended) session per user.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_user
  ON study_sessions (user_id)
  WHERE ended_at IS NULL;

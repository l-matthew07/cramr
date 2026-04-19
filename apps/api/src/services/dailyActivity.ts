import { prisma } from "@cramr/db";
import { splitSessionByDay, todayInTz } from "../lib/time.js";

/**
 * Called when a session ends. Splits duration across day boundaries in user's tz
 * and upserts daily_activity rows.
 */
export async function recordSessionActivity(
  userId: string,
  timezone: string,
  startedAt: Date,
  endedAt: Date,
) {
  const chunks = splitSessionByDay(startedAt, endedAt, timezone);
  for (const { date, seconds } of chunks) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO daily_activity (user_id, activity_date, total_seconds, session_count, items_completed)
       VALUES ($1::uuid, $2::date, $3, 1, 0)
       ON CONFLICT (user_id, activity_date)
       DO UPDATE SET total_seconds = daily_activity.total_seconds + EXCLUDED.total_seconds,
                     session_count = daily_activity.session_count + 1`,
      userId,
      date,
      seconds,
    );
  }
}

/**
 * Called when a progress event is created. Increments items_completed for today.
 */
export async function recordProgressActivity(userId: string, timezone: string) {
  const today = todayInTz(timezone);
  await prisma.$executeRawUnsafe(
    `INSERT INTO daily_activity (user_id, activity_date, total_seconds, session_count, items_completed)
     VALUES ($1::uuid, $2::date, 0, 0, 1)
     ON CONFLICT (user_id, activity_date)
     DO UPDATE SET items_completed = daily_activity.items_completed + 1`,
    userId,
    today,
  );
}

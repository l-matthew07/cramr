import { prisma } from "@cramr/db";
import { addDays, todayInTz } from "../lib/time.js";

/**
 * Update a user's streak based on activity on a given date.
 * Call after any session or progress that adds to `daily_activity`.
 * Idempotent — safe to call multiple times for the same day.
 */
export async function updateStreak(userId: string, timezone: string) {
  const today = todayInTz(timezone);

  const current = await prisma.streak.findUnique({ where: { userId } });
  if (!current) {
    await prisma.streak.create({
      data: { userId, currentLength: 1, longestLength: 1, lastActiveDate: new Date(today) },
    });
    return;
  }

  const last = current.lastActiveDate
    ? current.lastActiveDate.toISOString().slice(0, 10)
    : null;

  if (last === today) return; // already counted today

  let nextCurrent = 1;
  if (last && last === addDays(today, -1)) {
    nextCurrent = current.currentLength + 1;
  }

  await prisma.streak.update({
    where: { userId },
    data: {
      currentLength: nextCurrent,
      longestLength: Math.max(current.longestLength, nextCurrent),
      lastActiveDate: new Date(today),
    },
  });
}

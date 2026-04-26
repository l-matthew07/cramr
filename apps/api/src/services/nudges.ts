import { Prisma } from "@prisma/client";
import { prisma } from "@cramr/db";
import { addDays, todayInTz } from "../lib/time.js";
import { sendEmail } from "../lib/email.js";
import { escapeHtml } from "../lib/html.js";

/**
 * Evaluate nudge rules for a single user and enqueue messages.
 * Runs nightly.
 */
export async function evaluateNudgesForUser(userId: string, timezone: string) {
  const today = todayInTz(timezone);
  const twoDaysAgo = addDays(today, -2);

  const streak = await prisma.streak.findUnique({ where: { userId } });
  const lastActive = streak?.lastActiveDate?.toISOString().slice(0, 10) ?? null;

  // Fetch user email for sending
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } });
  const userEmail = user?.email ?? "";
  const userName = user?.displayName ?? "there";
  const safeUserName = escapeHtml(userName);

  // Rule: streak at risk.
  if (streak && streak.currentLength >= 3 && lastActive && lastActive < today) {
    await prisma.nudge.create({
      data: {
        userId,
        kind: "streak_at_risk",
        payload: { streak: streak.currentLength, lastActive },
      },
    });
    await sendEmail({
      to: userEmail,
      subject: `Don't break your ${streak.currentLength}-day streak 🔥`,
      html: `<p>Hey ${safeUserName},</p><p>You have a <strong>${streak.currentLength}-day streak</strong> going. Study for even 5 minutes today to keep it alive.</p>`,
      text: `Hey ${userName}, you have a ${streak.currentLength}-day streak going. Study today to keep it alive.`,
    });
  }

  // Rule: inactive 2+ days.
  if (!lastActive || lastActive <= twoDaysAgo) {
    await prisma.nudge.create({
      data: { userId, kind: "inactive_2d", payload: { lastActive } },
    });
    await sendEmail({
      to: userEmail,
      subject: "Haven't seen you in a while 👋",
      html: `<p>Hey ${safeUserName},</p><p>You haven't studied in over 2 days. Even 5 minutes counts.</p>`,
      text: `Hey ${userName}, you haven't studied in over 2 days. Come back and keep the habit alive.`,
    });
  }

  // Rule: groupmates completed items user hasn't.
  const groups = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });
  for (const { groupId } of groups) {
    const members = await prisma.groupMembership.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const otherIds = members.map((m) => m.userId).filter((id) => id !== userId);
    if (otherIds.length === 0) continue;

    // Find course items most group-members have completed but this user hasn't.
    const laggingItems = await prisma.$queryRaw<
      Array<{ course_item_id: string; title: string; completers: bigint }>
    >(Prisma.sql`
      SELECT ci.id AS course_item_id, ci.title, COUNT(DISTINCT pe.user_id) AS completers
         FROM progress_events pe
         JOIN course_items ci ON ci.id = pe.course_item_id
        WHERE pe.user_id = ANY(ARRAY[${Prisma.join(otherIds)}]::uuid[])
          AND ci.id NOT IN (
            SELECT course_item_id FROM progress_events WHERE user_id = CAST(${userId} AS uuid)
          )
        GROUP BY ci.id, ci.title
       HAVING COUNT(DISTINCT pe.user_id) >= ${Math.max(2, Math.ceil(otherIds.length * 0.6))}
        ORDER BY completers DESC
        LIMIT 1`);
    if (laggingItems[0]) {
      await prisma.nudge.create({
        data: {
          userId,
          kind: "group_ahead",
          payload: {
            groupId,
            itemTitle: laggingItems[0].title,
            completers: Number(laggingItems[0].completers),
            groupSize: otherIds.length + 1,
          },
        },
      });
    }
  }
}

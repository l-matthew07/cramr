import { prisma } from "@cramr/db";
import { sendEmail } from "../lib/email.js";
import { addDays, todayInTz } from "../lib/time.js";

/**
 * Sends a Monday morning weekly summary email to each user.
 * Compares this week's study time vs last week.
 */
async function runWeeklyEmails() {
  const now = new Date();
  // Only fire on Mondays between 08:00-09:00 in user's local timezone
  const users = await prisma.user.findMany({
    select: { id: true, email: true, displayName: true, timezone: true },
  });

  for (const user of users) {
    try {
      const localFmt = new Intl.DateTimeFormat("en-US", {
        timeZone: user.timezone,
        weekday: "long",
        hour: "2-digit",
        hour12: false,
      });
      const parts = localFmt.formatToParts(now);
      const weekday = parts.find((p) => p.type === "weekday")?.value;
      const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");

      if (weekday !== "Monday" || hour !== 8) continue;

      const today = todayInTz(user.timezone);
      const thisWeekStart = addDays(today, -6);
      const lastWeekStart = addDays(today, -13);
      const lastWeekEnd = addDays(today, -7);

      const [thisWeek, lastWeek] = await Promise.all([
        prisma.dailyActivity.aggregate({
          where: {
            userId: user.id,
            activityDate: { gte: new Date(thisWeekStart), lte: new Date(today) },
          },
          _sum: { totalSeconds: true },
        }),
        prisma.dailyActivity.aggregate({
          where: {
            userId: user.id,
            activityDate: { gte: new Date(lastWeekStart), lte: new Date(lastWeekEnd) },
          },
          _sum: { totalSeconds: true },
        }),
      ]);

      const thisHours = Math.round(((thisWeek._sum.totalSeconds ?? 0) / 3600) * 10) / 10;
      const lastHours = Math.round(((lastWeek._sum.totalSeconds ?? 0) / 3600) * 10) / 10;
      const diff = thisHours - lastHours;
      const diffStr =
        diff > 0 ? `+${diff.toFixed(1)}h vs last week 📈` : diff < 0 ? `${diff.toFixed(1)}h vs last week` : "same as last week";

      await sendEmail({
        to: user.email,
        subject: `Your Cramr week: ${thisHours}h studied`,
        html: `
          <p>Hey ${user.displayName},</p>
          <p>Last week you studied <strong>${thisHours} hours</strong> (${diffStr}).</p>
          ${thisHours === 0 ? "<p>A fresh week starts today — open Cramr and start a session. ⏱</p>" : "<p>Keep the momentum going this week!</p>"}
          <p>— Cramr</p>
        `,
        text: `Hey ${user.displayName}, last week you studied ${thisHours} hours (${diffStr}). Keep it up!`,
      });
    } catch (e) {
      console.error("[weeklyEmail] user", user.id, e);
    }
  }
}

const HOURLY_MS = 60 * 60 * 1000;

export function startWeeklyEmailJob() {
  setInterval(() => {
    runWeeklyEmails().catch((e) => console.error("[weeklyEmail]", e));
  }, HOURLY_MS);
}

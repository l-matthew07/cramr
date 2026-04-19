import { prisma } from "@cramr/db";
import { evaluateNudgesForUser } from "../services/nudges.js";

const HOURLY_MS = 60 * 60 * 1000;

async function runOnce() {
  const users = await prisma.user.findMany({
    select: { id: true, timezone: true },
  });
  // Only run for users where it is currently 20:00 local time (approx window).
  const now = new Date();
  for (const u of users) {
    try {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: u.timezone,
          hour: "2-digit",
          hour12: false,
        }).format(now),
      );
      if (hour === 20) {
        await evaluateNudgesForUser(u.id, u.timezone);
      }
    } catch (e) {
      console.error("[nudges] user", u.id, e);
    }
  }
}

export function startNightlyNudgesJob() {
  // Run at every hour-ish; the inner check only acts at 20:00 local.
  setInterval(() => {
    runOnce().catch((e) => console.error("[nudges]", e));
  }, HOURLY_MS);
}

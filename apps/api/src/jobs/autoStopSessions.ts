import { prisma } from "@cramr/db";
import { recordSessionActivity } from "../services/dailyActivity.js";
import { updateStreak } from "../services/streaks.js";
import { emitPresence } from "../lib/socket.js";

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;
const INTERVAL_MS = 2 * 60 * 1000;

async function runOnce() {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
  const maxStart = new Date(Date.now() - MAX_DURATION_MS);

  const stale = await prisma.studySession.findMany({
    where: {
      endedAt: null,
      OR: [{ lastHeartbeatAt: { lt: cutoff } }, { startedAt: { lt: maxStart } }],
    },
    include: { user: { select: { timezone: true } } },
    take: 200,
  });

  for (const s of stale) {
    const endedAt = s.lastHeartbeatAt < s.startedAt ? new Date() : s.lastHeartbeatAt;
    const capped = new Date(s.startedAt.getTime() + MAX_DURATION_MS);
    const finalEnd = endedAt > capped ? capped : endedAt;
    const duration = Math.floor((finalEnd.getTime() - s.startedAt.getTime()) / 1000);
    if (duration < 0) continue;
    await prisma.studySession.update({
      where: { id: s.id },
      data: { endedAt: finalEnd, durationSeconds: duration },
    });
    try {
      await recordSessionActivity(s.userId, s.user.timezone, s.startedAt, finalEnd);
      await updateStreak(s.userId, s.user.timezone);
      await emitPresence({ type: "session_ended", userId: s.userId, sessionId: s.id });
    } catch (e) {
      console.error("[autoStop] post-processing failed", s.id, e);
    }
  }

  if (stale.length > 0) {
    console.log(`[autoStop] closed ${stale.length} stale sessions`);
  }
}

export function startAutoStopJob() {
  runOnce().catch((e) => console.error("[autoStop] initial run", e));
  setInterval(() => {
    runOnce().catch((e) => console.error("[autoStop]", e));
  }, INTERVAL_MS);
}

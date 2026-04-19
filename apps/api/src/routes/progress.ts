import { Router } from "express";
import { prisma } from "@cramr/db";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { recordProgressActivity } from "../services/dailyActivity.js";
import { updateStreak } from "../services/streaks.js";

export const progressRouter = Router();

progressRouter.post("/:courseItemId/complete", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { courseItemId } = req.params;
    if (!courseItemId) throw new HttpError(400, "missing_id");

    // Idempotent: one row per (user, item).
    const existing = await prisma.progressEvent.findUnique({
      where: { userId_courseItemId: { userId, courseItemId } },
    });
    if (existing) return res.json(existing);

    // Attach to active session if any.
    const active = await prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true },
    });

    const event = await prisma.progressEvent.create({
      data: {
        userId,
        courseItemId,
        sessionId: active?.id ?? null,
      },
    });
    await recordProgressActivity(userId, req.user!.timezone);
    await updateStreak(userId, req.user!.timezone);
    res.json(event);
  } catch (e) {
    next(e);
  }
});

progressRouter.delete("/:courseItemId", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { courseItemId } = req.params;
    if (!courseItemId) throw new HttpError(400, "missing_id");
    await prisma.progressEvent.deleteMany({ where: { userId, courseItemId } });
    // Note: we don't decrement items_completed in daily_activity on undo — it's a
    // cumulative activity signal, not a live state. The heatmap is still correct.
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

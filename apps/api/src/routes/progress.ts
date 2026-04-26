import { Router } from "express";
import { prisma } from "@cramr/db";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { recordProgressActivity } from "../services/dailyActivity.js";
import { updateStreak } from "../services/streaks.js";

export const progressRouter = Router();

async function requireCourseItemMembership(userId: string, courseItemId: string) {
  const item = await prisma.courseItem.findUnique({
    where: { id: courseItemId },
    select: { courseId: true },
  });
  if (!item) throw new HttpError(404, "not_found");
  const membership = await prisma.courseMembership.findUnique({
    where: { userId_courseId: { userId, courseId: item.courseId } },
  });
  if (!membership) throw new HttpError(403, "not_a_member");
}

progressRouter.post("/:courseItemId/complete", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { courseItemId } = req.params;
    if (!courseItemId) throw new HttpError(400, "missing_id");
    await requireCourseItemMembership(userId, courseItemId);

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
    await requireCourseItemMembership(userId, courseItemId);
    await prisma.progressEvent.deleteMany({ where: { userId, courseItemId } });
    // Note: we don't decrement items_completed in daily_activity on undo — it's a
    // cumulative activity signal, not a live state. The heatmap is still correct.
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cramr/db";
import { StartSessionSchema } from "@cramr/shared";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { recordSessionActivity } from "../services/dailyActivity.js";
import { updateStreak } from "../services/streaks.js";
import { emitPresence } from "../lib/socket.js";

export const sessionsRouter = Router();

const MAX_DURATION_SECONDS = 4 * 60 * 60;

sessionsRouter.post("/start", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { courseId } = StartSessionSchema.parse(req.body ?? {});
    try {
      const session = await prisma.studySession.create({
        data: {
          userId,
          courseId: courseId ?? null,
          startedAt: new Date(),
          lastHeartbeatAt: new Date(),
        },
      });
      const user = req.user!;
      await emitPresence({
        type: "session_started",
        userId,
        displayName: user.displayName,
        avatarUrl: null,
        courseId: session.courseId,
        sessionId: session.id,
        startedAt: session.startedAt.toISOString(),
      });
      res.json(session);
    } catch (err) {
      // Partial unique index collision → active session exists
      if ((err as { code?: string }).code === "P2002") {
        throw new HttpError(409, "active_session_exists");
      }
      throw err;
    }
  } catch (e) {
    next(e);
  }
});

sessionsRouter.post("/:id/stop", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const session = await prisma.studySession.findUnique({ where: { id } });
    if (!session || session.userId !== userId) throw new HttpError(404, "not_found");
    if (session.endedAt) return res.json(session); // idempotent

    const endedAt = new Date();
    const rawSeconds = Math.floor(
      (endedAt.getTime() - session.startedAt.getTime()) / 1000,
    );
    const cappedSeconds = Math.min(rawSeconds, MAX_DURATION_SECONDS);
    const actualEndedAt =
      cappedSeconds < rawSeconds
        ? new Date(session.startedAt.getTime() + cappedSeconds * 1000)
        : endedAt;

    const updated = await prisma.studySession.update({
      where: { id },
      data: { endedAt: actualEndedAt, durationSeconds: cappedSeconds },
    });

    await recordSessionActivity(
      userId,
      req.user!.timezone,
      session.startedAt,
      actualEndedAt,
    );
    await updateStreak(userId, req.user!.timezone);

    await emitPresence({ type: "session_ended", userId, sessionId: id });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

sessionsRouter.post("/:id/heartbeat", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const result = await prisma.studySession.updateMany({
      where: { id, userId, endedAt: null },
      data: { lastHeartbeatAt: new Date() },
    });
    if (result.count === 0) throw new HttpError(404, "not_found_or_ended");
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

sessionsRouter.get("/active", async (req, res) => {
  const userId = requireUser(req);
  const session = await prisma.studySession.findFirst({
    where: { userId, endedAt: null },
    include: { course: { select: { id: true, code: true, name: true } } },
  });
  res.json(session);
});

sessionsRouter.get("/", async (req, res) => {
  const userId = requireUser(req);
  const limit = Math.min(
    100,
    Math.max(1, Number(z.coerce.number().default(20).parse(req.query.limit))),
  );
  const sessions = await prisma.studySession.findMany({
    where: { userId, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { course: { select: { id: true, code: true } } },
  });
  res.json(sessions);
});

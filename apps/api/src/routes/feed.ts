import { Router } from "express";
import { prisma } from "@cramr/db";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import type { FeedItem } from "@cramr/shared";

export const feedRouter = Router();

feedRouter.get("/group/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const membership = await prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });
    if (!membership) throw new HttpError(403, "not_a_member");

    const memberIds = (
      await prisma.groupMembership.findMany({
        where: { groupId: id },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    const [sessions, progress] = await Promise.all([
      prisma.studySession.findMany({
        where: { userId: { in: memberIds }, endedAt: { not: null } },
        orderBy: { endedAt: "desc" },
        take: 40,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          course: { select: { code: true } },
        },
      }),
      prisma.progressEvent.findMany({
        where: { userId: { in: memberIds } },
        orderBy: { completedAt: "desc" },
        take: 40,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          courseItem: {
            select: {
              title: true,
              course: { select: { code: true } },
            },
          },
        },
      }),
    ]);

    const items: FeedItem[] = [];
    for (const s of sessions) {
      items.push({
        kind: "session",
        id: s.id,
        userId: s.user.id,
        displayName: s.user.displayName,
        avatarUrl: s.user.avatarUrl,
        courseCode: s.course?.code ?? null,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt!.toISOString(),
        durationSeconds: s.durationSeconds ?? 0,
      });
    }
    for (const p of progress) {
      items.push({
        kind: "progress",
        id: p.id,
        userId: p.user.id,
        displayName: p.user.displayName,
        avatarUrl: p.user.avatarUrl,
        courseCode: p.courseItem.course.code,
        itemTitle: p.courseItem.title,
        completedAt: p.completedAt.toISOString(),
      });
    }
    items.sort((a, b) => {
      const at = a.kind === "session" ? a.endedAt : a.completedAt;
      const bt = b.kind === "session" ? b.endedAt : b.completedAt;
      return bt.localeCompare(at);
    });
    res.json(items.slice(0, 50));
  } catch (e) {
    next(e);
  }
});

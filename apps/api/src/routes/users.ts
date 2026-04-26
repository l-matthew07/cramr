import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@cramr/db";
import type { FeedItem } from "@cramr/shared";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { addDays, todayInTz } from "../lib/time.js";
import { getUserGameStats } from "../services/gamification.js";

export const usersRouter = Router();

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

usersRouter.get("/:id/profile", async (req, res, next) => {
  try {
    const viewerId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        timezone: true,
      },
    });
    if (!user) throw new HttpError(404, "not_found");

    const [sharedGroups, sharedCourses] = await Promise.all([
      prisma.group.findMany({
        where: {
          memberships: { some: { userId: viewerId } },
          AND: [{ memberships: { some: { userId: id } } }],
        },
        select: { id: true, name: true, inviteCode: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.course.findMany({
        where: {
          memberships: { some: { userId: viewerId } },
          AND: [{ memberships: { some: { userId: id } } }],
        },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
    ]);

    if (viewerId !== id && sharedGroups.length === 0 && sharedCourses.length === 0) {
      throw new HttpError(403, "not_connected");
    }

    const today = todayInTz(user.timezone);
    const last30 = addDays(today, -29);
    const last84 = addDays(today, -83);

    const [
      streak,
      totalStudyAgg,
      last30StudyAgg,
      totalCompletedItems,
      groupCount,
      courseCount,
      heatmapRows,
      recentSessions,
      recentProgress,
      strengths,
      game,
    ] = await Promise.all([
      prisma.streak.findUnique({ where: { userId: id } }),
      prisma.dailyActivity.aggregate({
        where: { userId: id },
        _sum: { totalSeconds: true },
      }),
      prisma.dailyActivity.aggregate({
        where: {
          userId: id,
          activityDate: { gte: new Date(last30), lte: new Date(today) },
        },
        _sum: { totalSeconds: true },
      }),
      prisma.progressEvent.count({ where: { userId: id } }),
      prisma.groupMembership.count({ where: { userId: id } }),
      prisma.courseMembership.count({ where: { userId: id } }),
      prisma.dailyActivity.findMany({
        where: {
          userId: id,
          activityDate: { gte: new Date(last84), lte: new Date(today) },
        },
        orderBy: { activityDate: "asc" },
      }),
      prisma.studySession.findMany({
        where: { userId: id, endedAt: { not: null } },
        orderBy: { endedAt: "desc" },
        take: 10,
        include: {
          course: { select: { code: true } },
        },
      }),
      prisma.progressEvent.findMany({
        where: { userId: id },
        orderBy: { completedAt: "desc" },
        take: 10,
        include: {
          courseItem: {
            select: {
              title: true,
              course: { select: { code: true } },
            },
          },
        },
      }),
      prisma.$queryRaw<
        Array<{
          id: string;
          code: string;
          name: string;
          total_items: bigint;
          completed_items: bigint;
        }>
      >(Prisma.sql`
        SELECT c.id, c.code, c.name,
                COUNT(ci.id)::bigint AS total_items,
                COUNT(pe.id)::bigint AS completed_items
           FROM course_memberships cm
           JOIN courses c ON c.id = cm.course_id
      LEFT JOIN course_items ci ON ci.course_id = c.id
      LEFT JOIN progress_events pe
             ON pe.user_id = cm.user_id
            AND pe.course_item_id = ci.id
          WHERE cm.user_id = CAST(${id} AS uuid)
          GROUP BY c.id, c.code, c.name
          ORDER BY completed_items DESC, total_items DESC, c.code ASC
          LIMIT 6`),
      getUserGameStats(id, user.timezone),
    ]);

    const recentActivity: FeedItem[] = [
      ...recentSessions.map((s) => ({
        kind: "session" as const,
        id: s.id,
        userId: id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        courseCode: s.course?.code ?? null,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt!.toISOString(),
        durationSeconds: s.durationSeconds ?? 0,
      })),
      ...recentProgress.map((p) => ({
        kind: "progress" as const,
        id: p.id,
        userId: id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        courseCode: p.courseItem.course.code,
        itemTitle: p.courseItem.title,
        completedAt: p.completedAt.toISOString(),
      })),
    ].sort((a, b) => {
      const at = a.kind === "session" ? a.endedAt : a.completedAt;
      const bt = b.kind === "session" ? b.endedAt : b.completedAt;
      return bt.localeCompare(at);
    }).slice(0, 12);

    res.json({
      id: user.id,
      email: viewerId === id ? user.email : null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      streak: {
        current: streak?.currentLength ?? 0,
        longest: streak?.longestLength ?? 0,
      },
      game,
      stats: {
        totalStudySeconds: totalStudyAgg._sum.totalSeconds ?? 0,
        last30DaysSeconds: last30StudyAgg._sum.totalSeconds ?? 0,
        completedItems: totalCompletedItems,
        groupsCount: groupCount,
        coursesCount: courseCount,
      },
      sharedGroups,
      sharedCourses,
      strengths: strengths.map((row) => {
        const totalItems = Number(row.total_items ?? 0);
        const completedItems = Number(row.completed_items ?? 0);
        return {
          id: row.id,
          code: row.code,
          name: row.name,
          totalItems,
          completedItems,
          completionRate: totalItems > 0 ? completedItems / totalItems : 0,
        };
      }),
      heatmap: heatmapRows.map((row) => ({
        date: toDateStr(row.activityDate),
        value: row.totalSeconds,
        sessions: row.sessionCount,
        items: row.itemsCompleted,
      })),
      recentActivity,
    });
  } catch (e) {
    next(e);
  }
});

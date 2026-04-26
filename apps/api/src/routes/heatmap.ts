import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@cramr/db";
import { clampHeatmapWindow } from "@cramr/shared";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { cacheGet, cacheSet } from "../lib/redis.js";

export const heatmapRouter = Router();

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

heatmapRouter.get("/me", async (req, res) => {
  const userId = requireUser(req);
  const { start, end } = clampHeatmapWindow(
    req.query.from as string | undefined,
    req.query.to as string | undefined,
  );
  const rows = await prisma.dailyActivity.findMany({
    where: {
      userId,
      activityDate: { gte: start, lte: end },
    },
    orderBy: { activityDate: "asc" },
  });
  res.json(
    rows.map((r) => ({
      date: toDateStr(r.activityDate),
      value: r.totalSeconds,
      sessions: r.sessionCount,
      items: r.itemsCompleted,
    })),
  );
});

heatmapRouter.get("/group/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const membership = await prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });
    if (!membership) throw new HttpError(403, "not_a_member");

    const { start, end } = clampHeatmapWindow(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );

    const rows = await prisma.$queryRaw<
      Array<{
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        activity_date: Date;
        total_seconds: number;
      }>
    >(Prisma.sql`
      SELECT u.id AS user_id, u.display_name, u.avatar_url,
              da.activity_date, da.total_seconds
         FROM group_memberships gm
         JOIN users u ON u.id = gm.user_id
    LEFT JOIN daily_activity da
           ON da.user_id = u.id
          AND da.activity_date BETWEEN CAST(${toDateStr(start)} AS date) AND CAST(${toDateStr(end)} AS date)
        WHERE gm.group_id = CAST(${id} AS uuid)
        ORDER BY u.display_name, da.activity_date`);

    const byUser = new Map<
      string,
      { id: string; displayName: string; avatarUrl: string | null; cells: Array<{ date: string; value: number }> }
    >();
    for (const row of rows) {
      let u = byUser.get(row.user_id);
      if (!u) {
        u = {
          id: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          cells: [],
        };
        byUser.set(row.user_id, u);
      }
      if (row.activity_date) {
        u.cells.push({
          date: toDateStr(new Date(row.activity_date)),
          value: row.total_seconds ?? 0,
        });
      }
    }
    res.json(Array.from(byUser.values()));
  } catch (e) {
    next(e);
  }
});

heatmapRouter.get("/course/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const membership = await prisma.courseMembership.findUnique({
      where: { userId_courseId: { userId, courseId: id } },
    });
    if (!membership) throw new HttpError(403, "not_a_member");

    const { start, end } = clampHeatmapWindow(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );
    const cacheKey = `heatmap:course:${id}:${toDateStr(start)}:${toDateStr(end)}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return res.json(cached);

    const rows = await prisma.$queryRaw<
      Array<{ activity_date: Date; total_seconds: bigint; active_users: bigint }>
    >(Prisma.sql`
      SELECT da.activity_date,
              SUM(da.total_seconds)::bigint AS total_seconds,
              COUNT(DISTINCT da.user_id)::bigint AS active_users
         FROM daily_activity da
         JOIN course_memberships cm ON cm.user_id = da.user_id
        WHERE cm.course_id = CAST(${id} AS uuid)
          AND da.activity_date BETWEEN CAST(${toDateStr(start)} AS date) AND CAST(${toDateStr(end)} AS date)
        GROUP BY da.activity_date
        ORDER BY da.activity_date`);
    const out = rows.map((r) => ({
      date: toDateStr(new Date(r.activity_date)),
      value: Number(r.total_seconds ?? 0),
      activeUsers: Number(r.active_users ?? 0),
    }));
    await cacheSet(cacheKey, out, 300);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

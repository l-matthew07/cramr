import { Router } from "express";
import { prisma } from "@cramr/db";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { addDays, todayInTz } from "../lib/time.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/group/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const membership = await prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });
    if (!membership) throw new HttpError(403, "not_a_member");

    const window = (req.query.window as string) ?? "week";
    const days = window === "month" ? 30 : 7;
    const today = todayInTz(req.user!.timezone);
    const start = addDays(today, -days + 1);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        total_seconds: bigint;
        current_streak: number | null;
      }>
    >(
      `SELECT u.id AS user_id, u.display_name, u.avatar_url,
              COALESCE(SUM(da.total_seconds), 0)::bigint AS total_seconds,
              s.current_length AS current_streak
         FROM group_memberships gm
         JOIN users u ON u.id = gm.user_id
    LEFT JOIN daily_activity da
           ON da.user_id = u.id
          AND da.activity_date BETWEEN $2::date AND $3::date
    LEFT JOIN streaks s ON s.user_id = u.id
        WHERE gm.group_id = $1::uuid
        GROUP BY u.id, u.display_name, u.avatar_url, s.current_length
        ORDER BY total_seconds DESC`,
      id,
      start,
      today,
    );

    res.json(
      rows.map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        totalSeconds: Number(r.total_seconds),
        currentStreak: r.current_streak ?? 0,
      })),
    );
  } catch (e) {
    next(e);
  }
});

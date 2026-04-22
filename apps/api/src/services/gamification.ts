import { prisma } from "@cramr/db";
import { addDays, todayInTz } from "../lib/time.js";

export interface GameBadge {
  title: string;
  tone: "amber" | "emerald" | "sky" | "rose";
  description: string;
}

export interface GameStats {
  weeklySeconds: number;
  activeDays7d: number;
  todaySeconds: number;
  streak: number;
  weeklyGoalSeconds: number;
  score: number;
  level: number;
  nextLevelScore: number;
  progress: number;
  badges: GameBadge[];
}

export function computeStudyScore(params: {
  weeklySeconds: number;
  activeDays7d: number;
  streak: number;
}) {
  const { weeklySeconds, activeDays7d, streak } = params;
  return Math.round(weeklySeconds / 60 + activeDays7d * 40 + streak * 18);
}

export function computeWeeklyGoalSeconds(streak: number) {
  return Math.max(6 * 3600, Math.min(14 * 3600, (8 + Math.min(streak, 6)) * 3600));
}

export function computeLevel(score: number) {
  const level = Math.max(1, Math.floor(score / 250) + 1);
  const intoLevel = score - (level - 1) * 250;
  return {
    level,
    nextLevelScore: level * 250,
    progress: intoLevel / 250,
  };
}

export function buildBadges(params: {
  streak: number;
  weeklySeconds: number;
  activeDays7d: number;
  rank?: number | null;
}): GameBadge[] {
  const { streak, weeklySeconds, activeDays7d, rank } = params;
  const badges: GameBadge[] = [];

  if (streak >= 7) {
    badges.push({
      title: "Flame Keeper",
      tone: "amber",
      description: `${streak}-day streak alive`,
    });
  }
  if (weeklySeconds >= 8 * 3600) {
    badges.push({
      title: "Deep Work",
      tone: "emerald",
      description: "8h+ logged this week",
    });
  }
  if (activeDays7d >= 5) {
    badges.push({
      title: "Consistent",
      tone: "sky",
      description: `${activeDays7d} active days this week`,
    });
  }
  if (rank === 1) {
    badges.push({
      title: "Front Runner",
      tone: "rose",
      description: "leading the pack",
    });
  }

  return badges.slice(0, 3);
}

export function buildGameStats(params: {
  weeklySeconds: number;
  activeDays7d: number;
  todaySeconds: number;
  streak: number;
  rank?: number | null;
}): GameStats {
  const { weeklySeconds, activeDays7d, todaySeconds, streak, rank } = params;
  const score = computeStudyScore({ weeklySeconds, activeDays7d, streak });
  const level = computeLevel(score);

  return {
    weeklySeconds,
    activeDays7d,
    todaySeconds,
    streak,
    weeklyGoalSeconds: computeWeeklyGoalSeconds(streak),
    score,
    level: level.level,
    nextLevelScore: level.nextLevelScore,
    progress: level.progress,
    badges: buildBadges({ streak, weeklySeconds, activeDays7d, rank }),
  };
}

export async function getUserGameStats(userId: string, timezone: string): Promise<GameStats> {
  const today = todayInTz(timezone);
  const start = addDays(today, -6);

  const [streakRow, dailyRows] = await Promise.all([
    prisma.streak.findUnique({ where: { userId } }),
    prisma.dailyActivity.findMany({
      where: {
        userId,
        activityDate: { gte: new Date(start), lte: new Date(today) },
      },
      orderBy: { activityDate: "asc" },
    }),
  ]);

  const weeklySeconds = dailyRows.reduce((sum, row) => sum + row.totalSeconds, 0);
  const activeDays7d = dailyRows.filter((row) => row.totalSeconds > 0).length;
  const todaySeconds =
    dailyRows.find((row) => row.activityDate.toISOString().slice(0, 10) === today)?.totalSeconds ?? 0;

  return buildGameStats({
    weeklySeconds,
    activeDays7d,
    todaySeconds,
    streak: streakRow?.currentLength ?? 0,
  });
}

export interface RankedEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalSeconds: number;
  currentStreak: number;
}

export interface HeatmapLikeCell {
  date: string;
  value: number;
  sessions?: number;
}

export function sumHeatmap(cells: HeatmapLikeCell[] | undefined, days: number) {
  return cells?.slice(-days).reduce((acc, cell) => acc + cell.value, 0) ?? 0;
}

export function activeDays(cells: HeatmapLikeCell[] | undefined, days: number) {
  return cells?.slice(-days).filter((cell) => cell.value > 0).length ?? 0;
}

export function todaysSeconds(cells: HeatmapLikeCell[] | undefined) {
  return cells?.[cells.length - 1]?.value ?? 0;
}

export function makeStudyScore({
  weeklySeconds,
  activeDays7d,
  streak,
}: {
  weeklySeconds: number;
  activeDays7d: number;
  streak: number;
}) {
  return Math.round(weeklySeconds / 60 + activeDays7d * 40 + streak * 18);
}

export function makeLevel(score: number) {
  const level = Math.max(1, Math.floor(score / 250) + 1);
  const intoLevel = score - (level - 1) * 250;
  return {
    level,
    score,
    nextLevelScore: level * 250,
    progress: intoLevel / 250,
  };
}

export function weeklyGoalSeconds(streak: number) {
  return Math.max(6 * 3600, Math.min(14 * 3600, (8 + Math.min(streak, 6)) * 3600));
}

export function rankSummary(entries: RankedEntry[] | undefined, meUserId: string | undefined) {
  if (!entries?.length || !meUserId) return null;
  const sorted = [...entries].sort((a, b) => b.totalSeconds - a.totalSeconds);
  const rank = sorted.findIndex((entry) => entry.userId === meUserId);
  if (rank === -1) return null;

  const me = sorted[rank]!;
  const ahead = rank > 0 ? sorted[rank - 1]! : null;
  const behind = rank < sorted.length - 1 ? sorted[rank + 1]! : null;

  return {
    rank: rank + 1,
    total: sorted.length,
    me,
    ahead,
    behind,
    gapUp: ahead ? ahead.totalSeconds - me.totalSeconds : 0,
    gapDown: behind ? me.totalSeconds - behind.totalSeconds : 0,
    leader: sorted[0]!,
  };
}

export function badgeSet({
  streak,
  weeklySeconds,
  activeDays7d,
  rank,
}: {
  streak: number;
  weeklySeconds: number;
  activeDays7d: number;
  rank?: number;
}) {
  const badges: Array<{ title: string; tone: string; description: string }> = [];

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

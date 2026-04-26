import { Link } from "react-router-dom";
import { fmtDuration } from "../lib/time";
import {
  activeDays,
  rankSummary,
  sumHeatmap,
  todaysSeconds,
  type HeatmapLikeCell,
  type RankedEntry,
} from "../lib/gamify";
import type { GameStats } from "../lib/api";

export function DashboardGameCard({
  heatmap,
  streak,
  game,
  leaderboard,
  meUserId,
  groupName,
  groupId,
}: {
  heatmap: HeatmapLikeCell[] | undefined;
  streak: number;
  game?: GameStats;
  leaderboard: RankedEntry[] | undefined;
  meUserId: string | undefined;
  groupName?: string;
  groupId?: string;
}) {
  const weeklySeconds = game?.weeklySeconds ?? sumHeatmap(heatmap, 7);
  const todaySeconds = game?.todaySeconds ?? todaysSeconds(heatmap);
  const activeDays7d = game?.activeDays7d ?? activeDays(heatmap, 7);
  const level = {
    level: game?.level ?? 1,
    score: game?.score ?? 0,
    nextLevelScore: game?.nextLevelScore ?? 250,
    progress: game?.progress ?? 0,
  };
  const goal = game?.weeklyGoalSeconds ?? Math.max(6 * 3600, Math.min(14 * 3600, (8 + Math.min(streak, 6)) * 3600));
  const rank = rankSummary(leaderboard, meUserId);
  const badges = game?.badges ?? [];

  const quests = [
    {
      label: "Get one focused hour in today",
      current: todaySeconds,
      goal: 3600,
      value: fmtDuration(todaySeconds),
    },
    {
      label: "Show up 5 days this week",
      current: activeDays7d,
      goal: 5,
      value: `${activeDays7d}/5 days`,
    },
    {
      label: "Hit your weekly target",
      current: weeklySeconds,
      goal,
      value: fmtDuration(weeklySeconds),
    },
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-orange-200/75 font-semibold">
              Study Season
            </div>
            <div className="mt-2 flex items-end gap-3">
              <div className="text-4xl font-semibold text-white drop-shadow-md">Lvl {level.level}</div>
              <div className="pb-1 text-sm text-stone-200/70 font-medium">{level.score} score</div>
            </div>
            <p className="mt-2 max-w-xl text-sm text-stone-100/90 leading-relaxed">
              Build momentum every day, stack streak bonuses, and chase the next person above you.
            </p>
          </div>
          {rank && (
            <div className="rounded-2xl border border-white/10 bg-stone-950/40 shadow-inner px-5 py-4 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-stone-300/70 font-medium">
                {groupName ?? "Current league"}
              </div>
              <div className="mt-1 text-3xl font-semibold text-orange-200 drop-shadow-sm">
                #{rank.rank}
              </div>
              <div className="text-xs text-stone-400 font-medium mt-1">
                of {rank.total}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/5 bg-stone-950/30 shadow-inner p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-stone-300/70 font-semibold">
              <span>Level progress</span>
              <span className="text-orange-200">{Math.round(level.progress * 100)}%</span>
            </div>
            <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-stone-900/50 shadow-inner border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                style={{ width: `${Math.max(6, level.progress * 100)}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatChip label="This week" value={fmtDuration(weeklySeconds)} />
              <StatChip label="Active days" value={`${activeDays7d}/7`} />
              <StatChip label="Streak bonus" value={`+${streak * 18}`} />
            </div>

            {rank ? (
              <div className="mt-5 rounded-2xl border border-orange-500/30 bg-orange-950/40 backdrop-blur-sm p-5 shadow-lg">
                <div className="text-[11px] uppercase tracking-[0.18em] text-orange-200/80 font-bold">
                  Rival Target
                </div>
                {rank.ahead ? (
                  <>
                    <div className="mt-2 text-lg font-semibold text-white">
                      Catch {rank.ahead.displayName}
                    </div>
                    <p className="mt-1.5 text-sm text-stone-200/90 leading-relaxed">
                      You are <span className="text-orange-300 font-medium">{fmtDuration(rank.gapUp)}</span> behind in the current {groupName ? `${groupName} ` : ""}race.
                    </p>
                    {groupId && (
                      <Link
                        to={`/groups/${groupId}`}
                        className="mt-4 inline-flex rounded-full border border-orange-300/30 bg-orange-900/20 px-4 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-800/40 transition-colors"
                      >
                        Open the league →
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-lg font-medium text-white">
                      You’re setting the pace
                    </div>
                    <p className="mt-1.5 text-sm text-stone-200/90">
                      Protect the lead and make the next person chase you.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-stone-950/40 p-5 text-sm text-stone-200/90 leading-relaxed shadow-sm">
                Join a group to unlock rank races, rival gaps, and weekly ladder progression.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/5 bg-stone-950/30 shadow-inner p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-300/70 font-semibold mb-4">
              Quests
            </div>
            <div className="flex flex-col gap-3">
              {quests.map((quest) => (
                <QuestRow
                  key={quest.label}
                  label={quest.label}
                  current={quest.current}
                  goal={quest.goal}
                  value={quest.value}
                />
              ))}
            </div>

            {badges.length > 0 && (
              <>
                <div className="mt-6 text-[11px] uppercase tracking-[0.18em] text-stone-300/70 font-semibold mb-3">
                  Earned
                </div>
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <BadgePill
                      key={badge.title}
                      title={badge.title}
                      description={badge.description}
                      tone={badge.tone}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function GroupRaceCard({
  entries,
  meUserId,
  groupName,
}: {
  entries: RankedEntry[] | undefined;
  meUserId: string | undefined;
  groupName: string;
}) {
  const rank = rankSummary(entries, meUserId);
  const podium = entries?.slice(0, 3) ?? [];

  return (
    <section className="rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-amber-200/75 font-semibold">
              {groupName} League
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white drop-shadow-md">Weekly study board</h2>
            <p className="mt-2 text-sm text-stone-200/90 leading-relaxed font-medium">
              Keep the pressure up. The board updates with every session.
            </p>
          </div>
          {rank && (
            <div className="rounded-2xl border border-white/10 bg-stone-950/40 shadow-inner px-5 py-4 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-stone-300/70 font-medium">Your rank</div>
              <div className="mt-1 text-3xl font-semibold text-orange-200 drop-shadow-sm">#{rank.rank}</div>
              <div className="text-xs text-stone-400 font-medium mt-1">of {rank.total}</div>
            </div>
          )}
        </div>

        {podium.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {podium.map((entry, idx) => (
              <div
                key={entry.userId}
                className={`rounded-3xl border shadow-lg p-5 ${idx === 0
                    ? "border-amber-400/40 bg-amber-900/30 backdrop-blur-sm"
                    : idx === 1
                      ? "border-stone-400/30 bg-stone-800/40 backdrop-blur-sm"
                      : "border-orange-500/30 bg-orange-900/20 backdrop-blur-sm"
                  }`}
              >
                <div className={`text-[11px] uppercase tracking-[0.25em] font-bold ${idx === 0 ? "text-amber-200" : idx === 1 ? "text-stone-300" : "text-orange-300"}`}>
                  {idx === 0 ? "1st" : idx === 1 ? "2nd" : "3rd"}
                </div>
                <div className="mt-3 text-xl font-semibold text-white">{entry.displayName}</div>
                <div className="mt-1 text-sm text-stone-200/80 font-medium">{fmtDuration(entry.totalSeconds)}</div>
                {entry.currentStreak > 0 && (
                  <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-stone-950/30 px-3 py-1.5 text-xs text-amber-200 font-semibold shadow-inner">
                    🔥 {entry.currentStreak} day streak
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {rank && (
          <div className="grid gap-4 md:grid-cols-2 mt-2">
            <RaceCallout
              title={rank.ahead ? `Next target: ${rank.ahead.displayName}` : "You’re in front"}
              body={
                rank.ahead
                  ? `You need ${fmtDuration(rank.gapUp)} to overtake them this week.`
                  : "Nobody is ahead of you right now. Extend the gap before they answer back."
              }
              tone="amber"
            />
            <RaceCallout
              title={rank.behind ? `${rank.behind.displayName} is chasing` : "No one on your tail"}
              body={
                rank.behind
                  ? `Your cushion is ${fmtDuration(rank.gapDown)}. One solid block keeps them behind you.`
                  : "Build more distance so the race stays uncomfortable for everyone else."
              }
              tone="orange"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-stone-900/40 px-4 py-3 shadow-inner">
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-300/70 font-semibold">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white drop-shadow-sm">{value}</div>
    </div>
  );
}

function QuestRow({
  label,
  current,
  goal,
  value,
}: {
  label: string;
  current: number;
  goal: number;
  value: string;
}) {
  const progress = Math.min(1, goal === 0 ? 1 : current / goal);
  const complete = current >= goal;

  return (
    <div className="rounded-2xl border border-white/5 bg-stone-900/50 px-4 py-3.5 shadow-inner">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-stone-100">{label}</div>
        <div className={`text-[11px] font-bold uppercase tracking-wider ${complete ? "text-amber-200" : "text-stone-400"}`}>
          {complete ? "Cleared" : value}
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-950/60 shadow-inner border border-white/5">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${complete ? "bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "bg-gradient-to-r from-stone-500 to-stone-400"}`}
          style={{ width: `${Math.max(progress * 100, complete ? 100 : 6)}%` }}
        />
      </div>
    </div>
  );
}

function BadgePill({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: string;
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/30 bg-amber-900/20 text-amber-200"
      : tone === "sky"
        ? "border-sky-500/30 bg-sky-900/20 text-sky-200"
        : tone === "rose"
          ? "border-rose-500/30 bg-rose-900/20 text-rose-200"
          : "border-orange-500/30 bg-orange-900/20 text-orange-200";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass} backdrop-blur-sm shadow-sm`}>
      <div className="text-xs font-bold tracking-wide">{title}</div>
      <div className="mt-1 text-[11px] opacity-90 font-medium">{description}</div>
    </div>
  );
}

function RaceCallout({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "orange" | "amber";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-lg backdrop-blur-sm ${tone === "orange"
          ? "border-orange-500/20 bg-orange-900/20"
          : "border-amber-500/20 bg-amber-900/20"
        }`}
    >
      <div className={`text-sm font-bold tracking-wide ${tone === "orange" ? "text-orange-200" : "text-amber-200"}`}>{title}</div>
      <div className="mt-2 text-sm text-stone-200/90 leading-relaxed font-medium">{body}</div>
    </div>
  );
}

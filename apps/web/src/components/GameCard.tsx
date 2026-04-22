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
    <section className="rounded-[28px] border border-emerald-900/50 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.18),_transparent_38%),linear-gradient(135deg,_rgba(8,12,10,0.98),_rgba(14,30,20,0.94))] p-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/75">
              Study Season
            </div>
            <div className="mt-2 flex items-end gap-3">
              <div className="text-4xl font-semibold text-white">Lvl {level.level}</div>
              <div className="pb-1 text-sm text-emerald-100/70">{level.score} score</div>
            </div>
            <p className="mt-2 max-w-xl text-sm text-emerald-50/80">
              Build momentum every day, stack streak bonuses, and chase the next person above you.
            </p>
          </div>
          {rank && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/55">
                {groupName ?? "Current league"}
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                #{rank.rank}
              </div>
              <div className="text-xs text-emerald-100/65">
                of {rank.total}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-emerald-100/55">
              <span>Level progress</span>
              <span>{Math.round(level.progress * 100)}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lime-300 via-emerald-400 to-green-500"
                style={{ width: `${Math.max(6, level.progress * 100)}%` }}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <StatChip label="This week" value={fmtDuration(weeklySeconds)} />
              <StatChip label="Active days" value={`${activeDays7d}/7`} />
              <StatChip label="Streak bonus" value={`+${streak * 18}`} />
            </div>

            {rank ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/70">
                  Rival Target
                </div>
                {rank.ahead ? (
                  <>
                    <div className="mt-2 text-lg font-medium text-white">
                      Catch {rank.ahead.displayName}
                    </div>
                    <p className="mt-1 text-sm text-emerald-50/78">
                      You are {fmtDuration(rank.gapUp)} behind in the current {groupName ? `${groupName} ` : ""}race.
                    </p>
                    {groupId && (
                      <Link
                        to={`/groups/${groupId}`}
                        className="mt-3 inline-flex rounded-full border border-emerald-300/20 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-300/10"
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
                    <p className="mt-1 text-sm text-emerald-50/78">
                      Protect the lead and make the next person chase you.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-emerald-50/78">
                Join a group to unlock rank races, rival gaps, and weekly ladder progression.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/55">
              Quests
            </div>
            <div className="mt-3 flex flex-col gap-3">
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
                <div className="mt-5 text-[11px] uppercase tracking-[0.18em] text-emerald-100/55">
                  Earned
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
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
    <section className="rounded-[28px] border border-ink-800 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.08),_transparent_32%),linear-gradient(180deg,_rgba(18,18,20,0.98),_rgba(11,11,13,0.98))] p-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-amber-300/65">
              {groupName} League
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Weekly study board</h2>
            <p className="mt-1 text-sm text-ink-300">
              Keep the pressure up. The board updates with every session.
            </p>
          </div>
          {rank && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Your rank</div>
              <div className="mt-1 text-2xl font-semibold text-white">#{rank.rank}</div>
              <div className="text-xs text-ink-400">of {rank.total}</div>
            </div>
          )}
        </div>

        {podium.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {podium.map((entry, idx) => (
              <div
                key={entry.userId}
                className={`rounded-2xl border p-4 ${idx === 0
                    ? "border-amber-400/40 bg-amber-500/10"
                    : idx === 1
                      ? "border-slate-400/30 bg-slate-300/5"
                      : "border-orange-500/30 bg-orange-500/5"
                  }`}
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">
                  {idx === 0 ? "1st" : idx === 1 ? "2nd" : "3rd"}
                </div>
                <div className="mt-2 text-lg font-medium text-white">{entry.displayName}</div>
                <div className="mt-1 text-sm text-ink-300">{fmtDuration(entry.totalSeconds)}</div>
                {entry.currentStreak > 0 && (
                  <div className="mt-3 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs text-amber-300">
                    🔥 {entry.currentStreak} day streak
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {rank && (
          <div className="grid gap-3 md:grid-cols-2">
            <RaceCallout
              title={rank.ahead ? `Next target: ${rank.ahead.displayName}` : "You’re in front"}
              body={
                rank.ahead
                  ? `You need ${fmtDuration(rank.gapUp)} to overtake them this week.`
                  : "Nobody is ahead of you right now. Extend the gap before they answer back."
              }
              tone="emerald"
            />
            <RaceCallout
              title={rank.behind ? `${rank.behind.displayName} is chasing` : "No one on your tail"}
              body={
                rank.behind
                  ? `Your cushion is ${fmtDuration(rank.gapDown)}. One solid block keeps them behind you.`
                  : "Build more distance so the race stays uncomfortable for everyone else."
              }
              tone="amber"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/50">{label}</div>
      <div className="mt-2 text-lg font-medium text-white">{value}</div>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white">{label}</div>
        <div className={`text-xs font-medium ${complete ? "text-emerald-300" : "text-ink-400"}`}>
          {complete ? "Cleared" : value}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${complete ? "bg-emerald-400" : "bg-amber-300"}`}
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
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : tone === "sky"
        ? "border-sky-400/25 bg-sky-400/10 text-sky-200"
        : tone === "rose"
          ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
          : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";

  return (
    <div className={`rounded-full border px-3 py-2 ${toneClass}`}>
      <div className="text-xs font-medium">{title}</div>
      <div className="mt-0.5 text-[11px] opacity-80">{description}</div>
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
  tone: "emerald" | "amber";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${tone === "emerald"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5"
        }`}
    >
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-1 text-sm text-ink-300">{body}</div>
    </div>
  );
}

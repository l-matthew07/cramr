import { Link, useNavigate } from "react-router-dom";
import {
  useActiveSession,
  useMe,
  useMyCourses,
  useMyGroups,
  usePersonalHeatmap,
  useStartSession,
  useNudges,
  useDismissNudge,
  useLeaderboard,
} from "../lib/api";
import { DashboardGameCard } from "../components/GameCard";
import { Heatmap } from "../components/Heatmap";
import { StudyingNow } from "../components/StudyingNow";
import { useState } from "react";
import { fmtDuration } from "../lib/time";

export function Dashboard() {
  const me = useMe();
  const active = useActiveSession();
  const courses = useMyCourses();
  const groups = useMyGroups();
  const heatmap = usePersonalHeatmap();
  const nudges = useNudges();
  const dismiss = useDismissNudge();
  const start = useStartSession();
  const navigate = useNavigate();

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const primaryGroup = groups.data?.[0];
  const leaderboard = useLeaderboard(primaryGroup?.id, "week");

  async function handleStart() {
    if (active.data) {
      navigate("/session");
      return;
    }
    await start.mutateAsync(selectedCourseId);
    navigate("/session");
  }

  const total7d = heatmap.data
    ?.slice(-7)
    .reduce((acc, c) => acc + c.value, 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {greet()}, {me.data?.displayName.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-ink-400 text-sm mt-1">
            {total7d === 0
              ? "No study time this week yet. Let's change that."
              : `${fmtDuration(total7d)} studied in the last 7 days.`}
          </p>
        </div>
        {me.data?.streak && me.data.streak.current > 0 && (
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-400">
              🔥 {me.data.streak.current}
            </div>
            <div className="text-xs text-ink-400">day streak</div>
          </div>
        )}
      </header>

      <DashboardGameCard
        heatmap={heatmap.data}
        streak={me.data?.streak.current ?? 0}
        game={me.data?.game}
        leaderboard={leaderboard.data}
        meUserId={me.data?.id}
        groupName={primaryGroup?.name}
        groupId={primaryGroup?.id}
      />

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-medium mb-1">
              {active.data ? "You're studying" : "Start a session"}
            </div>
            <div className="text-xs text-ink-400">
              {active.data
                ? `Started ${new Date(active.data.startedAt).toLocaleTimeString()}`
                : "One-tap timer. Tag it to a course for progress."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!active.data && (
              <select
                className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2"
                value={selectedCourseId ?? ""}
                onChange={(e) => setSelectedCourseId(e.target.value || null)}
              >
                <option value="">Free study</option>
                {courses.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleStart}
              disabled={start.isPending}
              className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium text-sm disabled:opacity-50"
            >
              {active.data ? "Return to timer →" : "Start session"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <StudyingNow />
      </section>

      {nudges.data && nudges.data.length > 0 && (
        <section className="flex flex-col gap-2">
          {nudges.data.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 flex items-start justify-between gap-3"
            >
              <div className="text-sm text-amber-100">{nudgeText(n.kind, n.payload)}</div>
              <button
                onClick={() => dismiss.mutate(n.id)}
                className="text-xs text-ink-400 hover:text-ink-200"
              >
                ✕
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Your activity</div>
          <div className="text-xs text-ink-500">last 12 weeks</div>
        </div>
        {heatmap.data && <Heatmap cells={heatmap.data} />}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Courses</div>
          <Link to="/profile" className="text-xs text-ink-400 hover:text-ink-200">
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {courses.data?.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${c.id}`}
              className="rounded-lg border border-ink-800 bg-ink-900 p-4 hover:border-ink-700"
            >
              <div className="text-xs text-ink-500">{c.code}</div>
              <div className="text-sm font-medium">{c.name}</div>
            </Link>
          ))}
          {courses.data?.length === 0 && (
            <div className="text-ink-500 text-sm">
              You haven't joined a course yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function nudgeText(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case "streak_at_risk":
      return `Don't break your ${payload.streak}-day streak — start a session today.`;
    case "inactive_2d":
      return `Haven't seen you in a couple days. 5 minutes is enough to keep the habit alive.`;
    case "group_ahead":
      return `${payload.completers}/${payload.groupSize} of your group finished ${payload.itemTitle}. You haven't.`;
    default:
      return "You've got a nudge.";
  }
}

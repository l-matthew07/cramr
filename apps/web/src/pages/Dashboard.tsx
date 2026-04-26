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
    <div className="min-h-screen">
      <div className="min-h-screen bg-stone-900/30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
          <header className="flex items-start justify-between gap-4 rounded-3xl bg-stone-900/60 px-8 py-6 shadow-2xl backdrop-blur-md border border-white/10">
            <div>
              <h1 className="text-3xl font-semibold text-stone-100 drop-shadow-md">
                {greet()}, {me.data?.displayName.split(" ")[0] ?? "there"}
              </h1>
              <p className="text-stone-300 text-sm mt-2 drop-shadow-sm font-medium">
                {total7d === 0
                  ? "No study time this week yet. Grab a coffee and let's get started."
                  : `${fmtDuration(total7d)} studied in the last 7 days.`}
              </p>
            </div>
            {me.data?.streak && me.data.streak.current > 0 && (
              <div className="text-right bg-stone-950/40 px-4 py-2 rounded-2xl border border-white/5">
                <div className="text-3xl font-bold text-amber-200">
                  🔥 {me.data.streak.current}
                </div>
                <div className="text-xs text-stone-400 font-medium tracking-wide uppercase mt-1">day streak</div>
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

      <section className="rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-base font-medium mb-1 text-stone-100">
              {active.data ? "You're studying" : "Start a session"}
            </div>
            <div className="text-sm text-stone-300">
              {active.data
                ? `Started ${new Date(active.data.startedAt).toLocaleTimeString()}`
                : "One-tap timer. Tag it to a course for progress."}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!active.data && (
              <select
                className="bg-stone-950/50 border border-white/10 rounded-xl text-sm px-4 py-2.5 text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
              className="px-6 py-2.5 rounded-xl bg-orange-700/80 hover:bg-orange-600/90 font-medium text-sm text-white disabled:opacity-50 transition-colors shadow-lg border border-orange-500/20"
            >
              {active.data ? "Return to timer →" : "Start session"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
        <StudyingNow />
      </section>

      {nudges.data && nudges.data.length > 0 && (
        <section className="flex flex-col gap-3">
          {nudges.data.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-amber-500/30 bg-amber-950/60 backdrop-blur-md p-4 flex items-start justify-between gap-4 shadow-lg"
            >
              <div className="text-sm text-amber-50 font-medium leading-relaxed">{nudgeText(n.kind, n.payload)}</div>
              <button
                onClick={() => dismiss.mutate(n.id)}
                className="text-xs text-amber-200 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-medium text-stone-100">Your activity</div>
          <div className="text-xs text-stone-400 uppercase tracking-widest font-semibold">last 12 weeks</div>
        </div>
        {heatmap.data && <Heatmap cells={heatmap.data} />}
      </section>

      <section className="rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-medium text-stone-100">Courses</div>
          <Link to="/profile" className="text-xs text-stone-400 hover:text-stone-200 uppercase tracking-wider font-semibold transition-colors">
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courses.data?.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${c.id}`}
              className="rounded-2xl border border-white/5 bg-stone-950/40 p-5 hover:border-white/20 transition-all hover:bg-stone-900/80"
            >
              <div className="text-xs text-stone-400 font-medium tracking-wide">{c.code}</div>
              <div className="text-lg font-medium text-stone-100 mt-1">{c.name}</div>
            </Link>
          ))}
          {courses.data?.length === 0 && (
            <div className="text-stone-400 text-sm">
               You haven't joined a course yet.
            </div>
          )}
        </div>
      </section>
        </div>
      </div>
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

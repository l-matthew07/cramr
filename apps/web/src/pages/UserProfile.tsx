import { Link, useParams } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { Heatmap } from "../components/Heatmap";
import { useUserProfile } from "../lib/api";
import { fmtDuration } from "../lib/time";

export function UserProfilePage() {
  const { id } = useParams();
  const profile = useUserProfile(id);

  if (!id) return null;
  if (profile.isLoading) return <div className="p-8 text-ink-400">loading…</div>;
  if (profile.isError || !profile.data) {
    return <div className="p-8 text-ink-400">Couldn’t load that profile.</div>;
  }

  const user = profile.data;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <section className="rounded-[28px] border border-ink-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_35%),linear-gradient(180deg,_rgba(18,18,20,0.98),_rgba(12,12,14,0.98))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink-800 text-2xl font-semibold text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-300/65">
                Study profile
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-white">{user.displayName}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                <ProfilePill label={`Lvl ${user.game.level}`} />
                <ProfilePill label={`${user.game.score} score`} />
                <ProfilePill label={`🔥 ${user.streak.current} day streak`} />
                <ProfilePill label={fmtDuration(user.stats.last30DaysSeconds) + " in last 30d"} />
              </div>
              {user.email && (
                <div className="mt-3 text-sm text-ink-400">{user.email}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="This week" value={fmtDuration(user.game.weeklySeconds)} />
            <StatTile label="Active days" value={`${user.game.activeDays7d}/7`} />
            <StatTile label="Completed" value={`${user.stats.completedItems}`} />
            <StatTile label="Longest streak" value={`${user.streak.longest}`} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Study heatmap</div>
            <div className="text-xs text-ink-500">last 12 weeks</div>
          </div>
          <Heatmap cells={user.heatmap} />
        </section>

        <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div className="text-sm font-medium">Ask them about</div>
          <div className="mt-4 flex flex-col gap-3">
            {user.strengths.length > 0 ? (
              user.strengths.map((course) => (
                <div key={course.id} className="rounded-2xl border border-ink-800 bg-ink-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-ink-500">{course.code}</div>
                      <div className="text-sm font-medium text-white">{course.name}</div>
                    </div>
                    <Link
                      to={`/courses/${course.id}`}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      Open →
                    </Link>
                  </div>
                  <div className="mt-3 text-sm text-ink-300">
                    {course.completedItems}/{course.totalItems} items done
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(4, course.completionRate * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-ink-500">No course history yet.</div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div className="text-sm font-medium">Shared context</div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.16em] text-ink-500">Groups</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.sharedGroups.length > 0 ? (
                user.sharedGroups.map((group) => (
                  <Link
                    key={group.id}
                    to={`/groups/${group.id}`}
                    className="rounded-full border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800"
                  >
                    {group.name}
                  </Link>
                ))
              ) : (
                <div className="text-sm text-ink-500">No shared groups.</div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-[0.16em] text-ink-500">Courses</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.sharedCourses.length > 0 ? (
                user.sharedCourses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.id}`}
                    className="rounded-full border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800"
                  >
                    {course.code}
                  </Link>
                ))
              ) : (
                <div className="text-sm text-ink-500">No shared courses.</div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div className="text-sm font-medium mb-3">Recent activity</div>
          <ActivityFeed items={user.recentActivity} />
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-ink-500">{label}</div>
      <div className="mt-2 text-lg font-medium text-white">{value}</div>
    </div>
  );
}

function ProfilePill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      {label}
    </span>
  );
}

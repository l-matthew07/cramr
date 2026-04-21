import { fmtDuration } from "../lib/time";

interface Entry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalSeconds: number;
  currentStreak: number;
}

export function Leaderboard({ entries, meUserId }: { entries: Entry[]; meUserId?: string }) {
  if (!entries.length) {
    return (
      <div className="text-ink-500 text-sm py-6 text-center">No sessions this week.</div>
    );
  }
  const max = Math.max(...entries.map((e) => e.totalSeconds), 1);
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e, idx) => {
        const pct = (e.totalSeconds / max) * 100;
        const isMe = e.userId === meUserId;
        const medal = idx === 0 ? "👑" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
        return (
          <li
            key={e.userId}
            className={`relative rounded-md border px-3 py-2 overflow-hidden ${
              isMe ? "border-emerald-700 bg-emerald-950/40" : "border-ink-800 bg-ink-900"
            }`}
          >
            <div
              className={`absolute inset-y-0 left-0 ${
                idx === 0 ? "bg-amber-500/12" : idx === 1 ? "bg-slate-300/8" : idx === 2 ? "bg-orange-500/10" : "bg-ink-800"
              }`}
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-ink-500 w-5 text-right text-xs">#{idx + 1}</span>
                {medal && <span className="text-sm">{medal}</span>}
                <span className="font-medium">{e.displayName}</span>
                {e.currentStreak > 0 && (
                  <span className="text-[11px] text-amber-400">
                    🔥 {e.currentStreak}
                  </span>
                )}
              </div>
              <span className="text-sm tabular-nums">{fmtDuration(e.totalSeconds)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

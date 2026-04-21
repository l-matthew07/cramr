import { useParams } from "react-router-dom";
import {
  useGroup,
  useGroupFeed,
  useGroupHeatmap,
  useLeaderboard,
  useMe,
} from "../lib/api";
import { GroupRaceCard } from "../components/GameCard";
import { GroupHeatmap } from "../components/Heatmap";
import { Leaderboard } from "../components/Leaderboard";
import { ActivityFeed } from "../components/ActivityFeed";
import { useState } from "react";

export function GroupPage() {
  const { id } = useParams();
  const group = useGroup(id);
  const feed = useGroupFeed(id);
  const heatmap = useGroupHeatmap(id);
  const [lbWindow, setLbWindow] = useState<"week" | "month">("week");
  const leaderboard = useLeaderboard(id, lbWindow);
  const me = useMe();
  const [copied, setCopied] = useState(false);

  if (!id) return null;
  if (group.isLoading) return <div className="p-8 text-ink-400">loading…</div>;
  if (!group.data) return <div className="p-8 text-ink-400">Group not found.</div>;

  const inviteLink = `${window.location.origin}/join/${group.data.inviteCode}`;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{group.data.name}</h1>
          <div className="text-sm text-ink-400">
            {group.data.members.length} member{group.data.members.length === 1 ? "" : "s"}
          </div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="px-3 py-1.5 rounded-md bg-ink-800 hover:bg-ink-700 text-sm"
        >
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </header>

      <GroupRaceCard
        entries={leaderboard.data}
        meUserId={me.data?.id}
        groupName={group.data.name}
      />

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Leaderboard</div>
          <div className="flex rounded-md overflow-hidden border border-ink-700 text-xs">
            <button
              onClick={() => setLbWindow("week")}
              className={`px-3 py-1 ${lbWindow === "week" ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:bg-ink-800"}`}
            >
              Week
            </button>
            <button
              onClick={() => setLbWindow("month")}
              className={`px-3 py-1 ${lbWindow === "month" ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:bg-ink-800"}`}
            >
              Month
            </button>
          </div>
        </div>
        {leaderboard.data ? (
          <Leaderboard entries={leaderboard.data} meUserId={me.data?.id} />
        ) : (
          <div className="text-ink-500 text-sm">loading…</div>
        )}
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <div className="text-sm font-medium mb-3">Group activity</div>
        {heatmap.data && heatmap.data.length > 0 ? (
          <GroupHeatmap rows={heatmap.data} />
        ) : (
          <div className="text-ink-500 text-sm">No activity yet.</div>
        )}
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <div className="text-sm font-medium mb-3">Feed</div>
        <ActivityFeed items={feed.data ?? []} />
      </section>
    </div>
  );
}

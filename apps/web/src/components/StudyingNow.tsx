import { Link } from "react-router-dom";
import { useMyGroups, useGroupPresence } from "../lib/api";

export function StudyingNow() {
  const groups = useMyGroups();
  return (
    <div className="flex flex-col gap-2">
      {groups.data?.map((g) => (
        <GroupPresence key={g.id} groupId={g.id} groupName={g.name} />
      ))}
    </div>
  );
}

function GroupPresence({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { data } = useGroupPresence(groupId);
  if (!data || data.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-ink-400">{groupName}:</span>
      <div className="flex -space-x-2">
        {data.slice(0, 6).map((p) => (
          <Link
            key={p.sessionId}
            to={`/users/${p.userId}`}
            title={`${p.displayName} · ${p.course?.code ?? "free study"}`}
            className="w-7 h-7 rounded-full bg-ink-700 border-2 border-ink-900 flex items-center justify-center text-xs font-medium"
          >
            {p.displayName.charAt(0).toUpperCase()}
          </Link>
        ))}
      </div>
      <span className="text-ink-300 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        {data.length} studying now
      </span>
    </div>
  );
}

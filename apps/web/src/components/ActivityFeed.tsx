import type { FeedItem } from "@cramr/shared";
import { fmtDuration, fmtRelative } from "../lib/time";

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-ink-500 text-sm py-8 text-center">
        No activity yet. Start a session to kick things off.
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-ink-800">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="py-3 flex items-start gap-3">
          <Avatar name={item.displayName} />
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-medium">{item.displayName}</span>{" "}
              {item.kind === "session" ? (
                <>
                  studied for{" "}
                  <span className="text-emerald-400 font-medium">
                    {fmtDuration(item.durationSeconds)}
                  </span>
                  {item.courseCode && (
                    <span className="text-ink-400"> · {item.courseCode}</span>
                  )}
                </>
              ) : (
                <>
                  completed{" "}
                  <span className="text-ink-100">{item.itemTitle}</span>
                  {item.courseCode && (
                    <span className="text-ink-400"> · {item.courseCode}</span>
                  )}
                </>
              )}
            </div>
            <div className="text-xs text-ink-500">
              {fmtRelative(item.kind === "session" ? item.endedAt : item.completedAt)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 shrink-0 rounded-full bg-ink-700 flex items-center justify-center text-xs font-semibold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

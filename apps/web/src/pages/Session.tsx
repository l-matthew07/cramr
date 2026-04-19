import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useActiveSession,
  useCourse,
  useHeartbeat,
  useStopSession,
  useToggleProgress,
  useStartSession,
  useMyCourses,
} from "../lib/api";
import { fmtHMS } from "../lib/time";

export function SessionPage() {
  const active = useActiveSession();
  const stop = useStopSession();
  const heartbeat = useHeartbeat();
  const courses = useMyCourses();
  const start = useStartSession();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [finishedSessionId, setFinishedSessionId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!active.data) return;
    const id = active.data.id;
    const t = setInterval(() => heartbeat.mutate(id), 60_000);
    return () => clearInterval(t);
  }, [active.data?.id]);

  async function handleStart() {
    const s = await start.mutateAsync(selectedCourseId);
    // s is the created session
    void s;
  }

  async function handleStop() {
    if (!active.data) return;
    const id = active.data.id;
    await stop.mutateAsync(id);
    setFinishedSessionId(id);
  }

  if (!active.data && !finishedSessionId) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Ready to study</h1>
          <p className="text-ink-400 mt-2 text-sm">
            Pick a course (optional) and hit start.
          </p>
        </div>
        <select
          className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2"
          value={selectedCourseId ?? ""}
          onChange={(e) => setSelectedCourseId(e.target.value || null)}
        >
          <option value="">Free study</option>
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleStart}
          disabled={start.isPending}
          className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
        >
          Start session
        </button>
      </div>
    );
  }

  if (finishedSessionId) {
    return (
      <CompletionModal
        sessionId={finishedSessionId}
        courseId={active.data?.courseId ?? null}
        onClose={() => {
          setFinishedSessionId(null);
          navigate("/");
        }}
      />
    );
  }

  const elapsed = Math.max(
    0,
    Math.floor((now - new Date(active.data!.startedAt).getTime()) / 1000),
  );

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-ink-400 text-sm">
        {active.data!.course?.code
          ? `studying ${active.data!.course?.code}`
          : "free study session"}
      </div>
      <div className="text-7xl font-bold tabular-nums tracking-tight">
        {fmtHMS(elapsed)}
      </div>
      <button
        onClick={handleStop}
        disabled={stop.isPending}
        className="px-8 py-3 rounded-lg bg-red-600 hover:bg-red-500 font-medium"
      >
        End session
      </button>
      <div className="text-xs text-ink-500">
        Sessions auto-stop after 4 hours. Keep this tab open.
      </div>
    </div>
  );
}

function CompletionModal({
  sessionId: _sessionId,
  courseId,
  onClose,
}: {
  sessionId: string;
  courseId: string | null;
  onClose: () => void;
}) {
  const course = useCourse(courseId ?? undefined);
  const toggle = useToggleProgress();
  const [toggling, setToggling] = useState<string | null>(null);

  if (!courseId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-sm text-center flex flex-col gap-4">
          <div className="text-3xl">🎉</div>
          <div className="text-xl font-semibold">Nice session!</div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const items = course.data?.items ?? [];

  return (
    <div className="max-w-lg mx-auto p-8 flex flex-col gap-5">
      <div>
        <div className="text-sm text-ink-400">Session ended</div>
        <h2 className="text-2xl font-semibold">What did you complete?</h2>
        <p className="text-xs text-ink-500 mt-1">
          Skip if nothing to log — this is optional.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-ink-800 rounded-lg border border-ink-800 bg-ink-900">
        {items.map((it) => {
          const completed = !!it.completedAt;
          return (
            <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                checked={completed}
                disabled={toggling === it.id}
                onChange={async (e) => {
                  setToggling(it.id);
                  try {
                    await toggle.mutateAsync({
                      itemId: it.id,
                      completed: e.target.checked,
                    });
                  } finally {
                    setToggling(null);
                  }
                }}
                className="w-4 h-4 accent-emerald-500"
              />
              <span className={`text-sm flex-1 ${completed ? "text-ink-500 line-through" : ""}`}>
                {it.title}
              </span>
              <span className="text-[11px] text-ink-500 capitalize">{it.kind}</span>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onClose}
        className="self-end px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium text-sm"
      >
        Done
      </button>
    </div>
  );
}

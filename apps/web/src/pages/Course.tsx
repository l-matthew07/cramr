import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useCourse,
  useCourseHeatmap,
  useCoursePercentile,
  useToggleProgress,
  useAddCourseItems,
  useDeleteCourseItem,
  useMe,
  type CourseItemDraft,
} from "../lib/api";
import { Heatmap } from "../components/Heatmap";

type ItemKind = "lecture" | "assignment" | "exam";

export function CoursePage() {
  const { id } = useParams();
  const course = useCourse(id);
  const heatmap = useCourseHeatmap(id);
  const percentile = useCoursePercentile(id);
  const toggle = useToggleProgress();
  const me = useMe();

  if (!id) return null;
  if (course.isLoading) return <div className="p-8 text-ink-400">loading…</div>;
  if (!course.data) return <div className="p-8 text-ink-400">Course not found.</div>;

  const c = course.data;
  const isCreator = me.data?.id === c.createdBy;
  const completed = c.items.filter((i) => i.completedAt).length;
  const total = c.items.length;
  const pctDone = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <header>
        <div className="text-xs text-ink-400 uppercase tracking-wide">{c.code}</div>
        <h1 className="text-2xl font-semibold">{c.name}</h1>
        <div className="text-sm text-ink-400">
          {c.school} · {c.term} · {c.memberCount} enrolled
        </div>
      </header>

      {percentile.data && percentile.data.peers > 0 && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm">
          You're ahead of{" "}
          <span className="font-semibold text-emerald-300">
            {percentile.data.percentile}%
          </span>{" "}
          of your classmates.
        </div>
      )}

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">
            Progress — {completed}/{total}
          </div>
          <div className="text-xs text-ink-500">{pctDone}%</div>
        </div>
        <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pctDone}%` }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <div className="text-sm font-medium mb-3">When the class studies</div>
        {heatmap.data && heatmap.data.length > 0 ? (
          <Heatmap cells={heatmap.data} />
        ) : (
          <div className="text-ink-500 text-sm">Not enough data yet.</div>
        )}
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 overflow-hidden">
        <div className="px-5 py-3 text-sm font-medium border-b border-ink-800">
          Course items
          {total === 0 && isCreator && (
            <span className="ml-2 text-xs text-ink-500">— add items below</span>
          )}
        </div>
        {c.items.length > 0 ? (
          <ul className="divide-y divide-ink-800">
            {c.items.map((it) => {
              const done = !!it.completedAt;
              const rate = Math.round(it.classCompletionRate * 100);
              return (
                <li key={it.id} className="flex items-center gap-3 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={(e) =>
                      toggle.mutate({ itemId: it.id, completed: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${done ? "text-ink-500 line-through" : ""}`}>
                      {it.title}
                    </div>
                    <div className="text-[11px] text-ink-500 capitalize">
                      {it.kind}
                      {it.dueAt && (
                        <> · due {new Date(it.dueAt).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs text-ink-400 tabular-nums">
                      {rate}% of class
                    </div>
                    {isCreator && (
                      <DeleteItemButton courseId={id} itemId={it.id} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-ink-500 text-sm">
            No items yet.{isCreator ? " Add some below." : " Ask the course creator to add items."}
          </div>
        )}
      </section>

      {isCreator && <AddItemsPanel courseId={id} />}
    </div>
  );
}

function DeleteItemButton({ courseId, itemId }: { courseId: string; itemId: string }) {
  const del = useDeleteCourseItem(courseId);
  return (
    <button
      onClick={() => del.mutate(itemId)}
      disabled={del.isPending}
      className="text-ink-700 hover:text-red-400 text-xs px-1 transition-colors"
      title="Delete item"
    >
      ✕
    </button>
  );
}

function AddItemsPanel({ courseId }: { courseId: string }) {
  const addItems = useAddCourseItems(courseId);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Single item state
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind>("lecture");

  // Bulk paste state
  const [bulkText, setBulkText] = useState("");

  async function addSingle() {
    if (!title.trim()) return;
    await addItems.mutateAsync([{ kind, title: title.trim() }]);
    setTitle("");
  }

  async function addBulk() {
    const items: CourseItemDraft[] = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const l = line.toLowerCase();
        let k: ItemKind = "lecture";
        if (/\b(assignment|homework|\bhw\b|problem set|\bpset\b|lab|project)\b/.test(l))
          k = "assignment";
        else if (/\b(exam|midterm|final|quiz|test)\b/.test(l)) k = "exam";
        return { kind: k, title: line.replace(/^[\s\d\.\-\*\•]+/, "").trim() || line };
      });
    if (!items.length) return;
    await addItems.mutateAsync(items);
    setBulkText("");
    setOpen(false);
  }

  return (
    <section className="rounded-xl border border-ink-800 bg-ink-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-ink-800/50 transition-colors"
      >
        <span>Manage items</span>
        <span className="text-ink-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-800 p-5 flex flex-col gap-4">
          {/* Mode tabs */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setMode("single")}
              className={`px-3 py-1 rounded-md ${mode === "single" ? "bg-ink-700 text-ink-100" : "text-ink-500 hover:text-ink-300"}`}
            >
              Add one
            </button>
            <button
              onClick={() => setMode("bulk")}
              className={`px-3 py-1 rounded-md ${mode === "bulk" ? "bg-ink-700 text-ink-100" : "text-ink-500 hover:text-ink-300"}`}
            >
              Bulk paste
            </button>
          </div>

          {mode === "single" && (
            <div className="flex items-center gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ItemKind)}
                className="text-xs bg-ink-800 border border-ink-700 rounded-md px-2 py-2"
              >
                <option value="lecture">Lecture</option>
                <option value="assignment">Assignment</option>
                <option value="exam">Exam</option>
              </select>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSingle()}
                placeholder="Item title…"
                className="flex-1 bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2"
              />
              <button
                onClick={addSingle}
                disabled={!title.trim() || addItems.isPending}
                className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
          )}

          {mode === "bulk" && (
            <div className="flex flex-col gap-3">
              <textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"One item per line. Keywords like 'exam', 'homework', 'midterm' are auto-detected.\n\nWeek 1: Intro\nWeek 2: Linear Algebra\nAssignment 1\nMidterm Exam"}
                className="w-full bg-ink-800 border border-ink-700 rounded-lg text-sm px-4 py-3 resize-y font-mono leading-relaxed placeholder:text-ink-600"
              />
              <button
                onClick={addBulk}
                disabled={!bulkText.trim() || addItems.isPending}
                className="self-start px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-40"
              >
                {addItems.isPending ? "Adding…" : "Add items"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

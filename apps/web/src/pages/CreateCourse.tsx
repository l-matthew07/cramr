import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCourse, type CourseItemDraft } from "../lib/api";
import { parseSyllabus, detectKind, type ItemKind } from "../lib/syllabusParser";

type Step = "info" | "import" | "done";

interface ParsedItem extends CourseItemDraft {
  id: number; // local key only
}

// ---------- Auto-suggest current term ----------
function currentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month <= 5) return `Spring ${year}`;
  if (month <= 8) return `Summer ${year}`;
  return `Fall ${year}`;
}

// ---------- Main Component ----------

export function CreateCourse() {
  const navigate = useNavigate();
  const createCourse = useCreateCourse();

  const [step, setStep] = useState<Step>("info");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string>("");

  // Step 1 state
  const [school, setSchool] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [term, setTerm] = useState(currentTerm());
  const [infoError, setInfoError] = useState<string | null>(null);

  // Step 2 state
  const [syllabusText, setSyllabusText] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [parsed, setParsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemKind, setNewItemKind] = useState<ItemKind>("lecture");

  async function handleInfoNext() {
    setInfoError(null);
    if (!school.trim() || !code.trim() || !name.trim() || !term.trim()) {
      setInfoError("All fields are required.");
      return;
    }
    setStep("import");
  }

  function handleParse() {
    const result = parseSyllabus(syllabusText).map((item, i) => ({ ...item, id: i }));
    setItems(result);
    setParsed(true);
  }

  function addManualItem() {
    if (!newItemTitle.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: Date.now(), title: newItemTitle.trim(), kind: newItemKind },
    ]);
    setNewItemTitle("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const course = await createCourse.mutateAsync({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        school: school.trim(),
        term: term.trim(),
        items: items.map(({ kind, title }) => ({ kind, title })),
      });
      setCreatedId(course.id);
      setCreatedCode(course.code);
      setStep("done");
    } catch (e) {
      setSaving(false);
      alert((e as Error).message);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {(["info", "import", "done"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              ["info", "import", "done"].indexOf(step) >= i
                ? "bg-emerald-500"
                : "bg-ink-800"
            }`}
          />
        ))}
      </div>

      {step === "info" && (
        <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-100 drop-shadow-md">Create a course</h1>
            <p className="text-sm text-stone-300 drop-shadow-sm mt-1">
              Your classmates can join by searching for the course code.
            </p>
          </div>

          <div className="grid gap-4">
            <Field label="University / School">
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="Stanford, MIT, UCB…"
                className={INPUT}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Course code">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CS229"
                  className={INPUT}
                />
              </Field>
              <Field label="Term">
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Fall 2026"
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label="Course name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Machine Learning"
                className={INPUT}
              />
            </Field>
          </div>

          {infoError && <p className="text-sm text-red-400">{infoError}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleInfoNext}
              className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium text-sm"
            >
              Next →
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2 rounded-md text-ink-400 hover:text-ink-200 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "import" && (
        <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-100 drop-shadow-md">Import course outline</h1>
            <p className="text-sm text-stone-300 drop-shadow-sm mt-1">
              Paste your syllabus or course schedule below. We'll extract lectures,
              assignments, and exams automatically.
            </p>
          </div>

          {!parsed ? (
            <>
              <textarea
                rows={10}
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
                placeholder={`Paste your syllabus here, for example:\n\nWeek 1: Introduction to Machine Learning\nWeek 2: Linear Regression\nAssignment 1: Problem Set\nMidterm Exam\nWeek 8: Neural Networks\nFinal Exam`}
                className="w-full bg-ink-800 border border-ink-700 rounded-lg text-sm px-4 py-3 resize-y font-mono leading-relaxed placeholder:text-ink-600"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleParse}
                  disabled={!syllabusText.trim()}
                  className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-40"
                >
                  Parse outline
                </button>
                <button
                  onClick={() => {
                    setItems([]);
                    setParsed(true);
                  }}
                  className="px-4 py-2 rounded-md text-ink-400 hover:text-ink-200 text-sm"
                >
                  Skip — add items manually
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-ink-800 bg-ink-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
                  <span className="text-sm font-medium">{items.length} items</span>
                  <button
                    onClick={() => setParsed(false)}
                    className="text-xs text-ink-500 hover:text-ink-300"
                  >
                    Re-paste
                  </button>
                </div>

                {items.length > 0 && (
                  <ul className="divide-y divide-ink-800 max-h-72 overflow-y-auto">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 px-4 py-2">
                        <KindPill
                          kind={item.kind}
                          onChange={(k) =>
                            setItems((prev) =>
                              prev.map((it) => it.id === item.id ? { ...it, kind: k } : it),
                            )
                          }
                        />
                        <input
                          value={item.title}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id ? { ...it, title: e.target.value } : it,
                              ),
                            )
                          }
                          className="flex-1 text-sm bg-transparent border-0 outline-none focus:bg-ink-800 rounded px-1"
                        />
                        <button
                          onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                          className="text-ink-600 hover:text-red-400 text-xs px-1"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add item row */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-ink-800 bg-ink-950/40">
                  <select
                    value={newItemKind}
                    onChange={(e) => setNewItemKind(e.target.value as ItemKind)}
                    className="text-xs bg-ink-700 border border-ink-600 rounded-md px-2 py-1"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="assignment">Assignment</option>
                    <option value="exam">Exam</option>
                  </select>
                  <input
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addManualItem()}
                    placeholder="Add item…"
                    className="flex-1 text-sm bg-transparent outline-none border-0 placeholder:text-ink-600"
                  />
                  <button
                    onClick={addManualItem}
                    className="text-emerald-500 hover:text-emerald-400 text-xs font-medium"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium text-sm disabled:opacity-50"
                >
                  {saving ? "Creating…" : `Create course${items.length > 0 ? ` with ${items.length} items` : ""}`}
                </button>
                <button
                  onClick={() => setStep("info")}
                  className="px-4 py-2 text-ink-400 hover:text-ink-200 text-sm"
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "done" && createdId && (
        <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-stone-900/60 backdrop-blur-md shadow-2xl p-6">
          <div>
            <div className="text-3xl mb-3">🎓</div>
            <h1 className="text-2xl font-semibold text-stone-100 drop-shadow-md">Course created!</h1>
            <p className="text-sm text-stone-300 drop-shadow-sm mt-1">
              Share the code below with your classmates so they can join.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-emerald-400 mb-1">Course code</div>
              <div className="text-2xl font-bold font-mono tracking-widest">{createdCode}</div>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(createdCode)}
              className="px-3 py-2 rounded-md bg-ink-800 hover:bg-ink-700 text-sm shrink-0"
            >
              Copy code
            </button>
          </div>

          <button
            onClick={() => navigate(`/courses/${createdId}`)}
            className="self-start px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium text-sm"
          >
            Go to course →
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

const KIND_STYLES: Record<ItemKind, string> = {
  lecture: "bg-blue-950 text-blue-400 border-blue-800",
  assignment: "bg-amber-950 text-amber-400 border-amber-800",
  exam: "bg-red-950 text-red-400 border-red-800",
};
const KIND_LABELS: Record<ItemKind, string> = {
  lecture: "Lecture",
  assignment: "Assign",
  exam: "Exam",
};
const KINDS: ItemKind[] = ["lecture", "assignment", "exam"];

function KindPill({ kind, onChange }: { kind: ItemKind; onChange: (k: ItemKind) => void }) {
  const next = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length]!;
  return (
    <button
      onClick={() => onChange(next)}
      title="Click to change type"
      className={`text-[10px] font-medium px-2 py-0.5 rounded border shrink-0 ${KIND_STYLES[kind]}`}
    >
      {KIND_LABELS[kind]}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-400">{label}</span>
      {children}
    </label>
  );
}

const INPUT =
  "bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 w-full focus:outline-none focus:border-emerald-700";

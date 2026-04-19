import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateGroup, useJoinCourse, useJoinGroup, useMe, useUpdateMe } from "../lib/api";

// Full IANA timezone list, sorted alphabetically
const ALL_TZS: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone") as string[];
  } catch {
    // Fallback for older browsers
    return [
      "America/Los_Angeles",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "Europe/London",
      "Europe/Berlin",
      "Asia/Kolkata",
      "Asia/Singapore",
      "Asia/Tokyo",
      "Australia/Sydney",
      "UTC",
    ];
  }
})();

type Step = "name" | "group" | "course" | "done";

export function Onboarding() {
  const me = useMe();
  const [step, setStep] = useState<Step>("name");
  const navigate = useNavigate();

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Progress step={step} />
        {step === "name" && <NameStep onNext={() => setStep("group")} />}
        {step === "group" && <GroupStep onNext={() => setStep("course")} />}
        {step === "course" && <CourseStep onNext={() => setStep("done")} />}
        {step === "done" && (
          <div className="text-center flex flex-col gap-4">
            <div className="text-3xl">🎯</div>
            <div className="text-xl font-semibold">You're set up.</div>
            <p className="text-sm text-ink-400">
              Start a session to put your first mark on the heatmap.
            </p>
            <button
              onClick={() => {
                me.refetch();
                navigate("/");
              }}
              className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  const steps: Step[] = ["name", "group", "course", "done"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex gap-2 mb-8">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full ${i <= idx ? "bg-emerald-500" : "bg-ink-800"}`}
        />
      ))}
    </div>
  );
}

function NameStep({ onNext }: { onNext: () => void }) {
  const me = useMe();
  const updateMe = useUpdateMe();
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to Cramr</h1>
        <p className="text-sm text-ink-400 mt-1">
          Let's get your timezone right — heatmaps depend on it.
        </p>
      </div>
      <label className="text-xs text-ink-400">
        Timezone
        <select
          className="block mt-1 bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 w-full"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        >
          {ALL_TZS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await updateMe.mutateAsync({ timezone: tz });
            me.refetch();
            onNext();
          } finally {
            setSaving(false);
          }
        }}
        className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium text-sm disabled:opacity-50"
      >
        {saving ? "Saving…" : "Next →"}
      </button>
    </div>
  );
}

function GroupStep({ onNext }: { onNext: () => void }) {
  const [createName, setCreateName] = useState("My Squad");
  const [joinCode, setJoinCode] = useState("");
  const create = useCreateGroup();
  const join = useJoinGroup();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Find your group</h1>
        <p className="text-sm text-ink-400 mt-1">
          Small groups are where accountability happens. Create one or join a friend's.
        </p>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4 flex flex-col gap-2">
        <div className="text-xs text-ink-400">Create new</div>
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2"
        />
        <button
          onClick={async () => {
            if (!createName.trim()) return;
            await create.mutateAsync(createName.trim());
            onNext();
          }}
          className="self-start px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
        >
          Create &amp; continue
        </button>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4 flex flex-col gap-2">
        <div className="text-xs text-ink-400">Or join with invite code</div>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ABCD1234"
          className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 uppercase"
        />
        <button
          onClick={async () => {
            if (!joinCode.trim()) return;
            await join.mutateAsync(joinCode.trim());
            onNext();
          }}
          className="self-start px-4 py-2 rounded-md bg-ink-700 hover:bg-ink-600 text-sm font-medium"
        >
          Join &amp; continue
        </button>
      </div>

      <button onClick={onNext} className="text-xs text-ink-500 self-end hover:text-ink-300">
        Skip for now
      </button>
    </div>
  );
}

function CourseStep({ onNext }: { onNext: () => void }) {
  const [code, setCode] = useState("");
  const join = useJoinCourse();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Join a course</h1>
        <p className="text-sm text-ink-400 mt-1">
          Ask your professor or classmates for the course code, or skip for now.
        </p>
      </div>
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4 flex flex-col gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CS229-S26"
          className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 uppercase"
        />
        {err && <div className="text-xs text-red-400">{err}</div>}
        <button
          onClick={async () => {
            setErr(null);
            try {
              await join.mutateAsync(code.trim());
              onNext();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
          className="self-start px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
        >
          Join &amp; continue
        </button>
      </div>
      <button onClick={onNext} className="text-xs text-ink-500 self-end hover:text-ink-300">
        Skip for now
      </button>
    </div>
  );
}

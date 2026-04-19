import { useState } from "react";
import { useMe, useMyCourses, useMyGroups, useJoinCourse, useJoinGroup, useCreateGroup, useUpdateMe } from "../lib/api";
import { Link } from "react-router-dom";

// Full IANA timezone list with graceful fallback
const COMMON_TZS: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone") as string[];
  } catch {
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

export function Profile() {
  const me = useMe();
  const courses = useMyCourses();
  const groups = useMyGroups();
  const updateMe = useUpdateMe();

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5 flex flex-col gap-3">
        <div className="text-sm font-medium">Account</div>
        <div className="text-sm text-ink-400">
          <div>{me.data?.displayName}</div>
          <div>{me.data?.email}</div>
        </div>
        <label className="text-xs text-ink-400 mt-2">
          Timezone
          <select
            className="block mt-1 bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 w-full max-w-xs"
            value={me.data?.timezone ?? "UTC"}
            onChange={async (e) => {
              await updateMe.mutateAsync({ timezone: e.target.value });
            }}
          >
            {COMMON_TZS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5 flex flex-col gap-4">
        <div className="text-sm font-medium">Groups</div>
        <div className="flex flex-col gap-1">
          {groups.data?.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} className="text-sm hover:underline">
              {g.name} <span className="text-ink-500">· {g.memberCount}</span>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CreateGroupForm />
          <JoinGroupForm />
        </div>
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5 flex flex-col gap-4">
        <div className="text-sm font-medium">Courses</div>
        <div className="flex flex-col gap-1">
          {courses.data?.map((c) => (
            <Link key={c.id} to={`/courses/${c.id}`} className="text-sm hover:underline">
              {c.code} <span className="text-ink-500">· {c.name}</span>
            </Link>
          ))}
          {!courses.data?.length && (
            <div className="text-xs text-ink-500">No courses yet.</div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-xs text-ink-400">Create a course</div>
            <Link
              to="/courses/new"
              className="self-start px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
            >
              + Create course
            </Link>
          </div>
          <JoinCourseForm />
        </div>
      </section>
    </div>
  );
}

function CreateGroupForm() {
  const [name, setName] = useState("");
  const create = useCreateGroup();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await create.mutateAsync(name.trim());
        setName("");
      }}
    >
      <label className="text-xs text-ink-400">Create a group</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Study Squad"
        className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2"
      />
      <button className="self-start px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50">
        Create
      </button>
    </form>
  );
}

function JoinGroupForm() {
  const [code, setCode] = useState("");
  const join = useJoinGroup();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        await join.mutateAsync(code.trim());
        setCode("");
      }}
    >
      <label className="text-xs text-ink-400">Join by invite code</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABCD1234"
        className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 uppercase"
      />
      <button className="self-start px-3 py-1.5 rounded-md bg-ink-700 hover:bg-ink-600 text-sm font-medium">
        Join
      </button>
    </form>
  );
}

function JoinCourseForm() {
  const [code, setCode] = useState("");
  const join = useJoinCourse();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        await join.mutateAsync(code.trim());
        setCode("");
      }}
    >
      <label className="text-xs text-ink-400">Join a course</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="CS229-S26"
        className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 uppercase max-w-xs"
      />
      <button className="self-start px-3 py-1.5 rounded-md bg-ink-700 hover:bg-ink-600 text-sm font-medium">
        Join
      </button>
    </form>
  );
}

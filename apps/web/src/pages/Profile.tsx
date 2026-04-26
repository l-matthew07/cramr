import { useState } from "react";
import {
  useApproveGroupJoinRequest,
  useCreateGroup,
  useIncomingGroupJoinRequests,
  useJoinCourse,
  useMarkOnboarded,
  useMe,
  useMyCourses,
  useMyGroupJoinRequests,
  useMyGroups,
  useRejectGroupJoinRequest,
  useRequestGroupJoin,
  useUpdateMe,
} from "../lib/api";
import { Link } from "react-router-dom";

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
  const incomingRequests = useIncomingGroupJoinRequests();
  const myRequests = useMyGroupJoinRequests();
  const updateMe = useUpdateMe();
  const markOnboarded = useMarkOnboarded();

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
        <button
          onClick={() => markOnboarded.mutate()}
          className="self-start px-3 py-1.5 rounded-md bg-ink-800 hover:bg-ink-700 text-xs font-medium"
        >
          Mark onboarding complete
        </button>
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5 flex flex-col gap-4">
        <div className="text-sm font-medium">Groups</div>
        <div className="flex flex-col gap-1">
          {groups.data?.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} className="text-sm hover:underline">
              {g.name} <span className="text-ink-500">· {g.memberCount}</span>
            </Link>
          ))}
          {!groups.data?.length && (
            <div className="text-xs text-ink-500">No groups yet.</div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CreateGroupForm />
          <RequestGroupAccessForm />
        </div>
      </section>

      {(incomingRequests.data?.length || myRequests.data?.length) ? (
        <section className="rounded-xl border border-ink-800 bg-ink-900 p-5 flex flex-col gap-4">
          <div className="text-sm font-medium">Access requests</div>
          {incomingRequests.data && incomingRequests.data.length > 0 && <IncomingRequests />}
          {myRequests.data && myRequests.data.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs uppercase tracking-[0.16em] text-ink-500">
                My requests
              </div>
              {myRequests.data.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2 text-sm text-ink-300"
                >
                  <span className="font-medium text-ink-100">{request.group.name}</span>
                  <span className="text-ink-500"> · {request.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

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

function RequestGroupAccessForm() {
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const requestAccess = useRequestGroupJoin();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        const result = await requestAccess.mutateAsync(code.trim());
        setNotice(
          result.status === "already_member"
            ? `You're already in ${result.group.name}.`
            : `Request sent to ${result.request.groupName}.`,
        );
        setCode("");
      }}
    >
      <label className="text-xs text-ink-400">Request access by invite code</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABCD1234"
        className="bg-ink-800 border border-ink-700 rounded-md text-sm px-3 py-2 uppercase"
      />
      {notice && <div className="text-xs text-emerald-400">{notice}</div>}
      <button className="self-start px-3 py-1.5 rounded-md bg-ink-700 hover:bg-ink-600 text-sm font-medium">
        Request access
      </button>
    </form>
  );
}

function IncomingRequests() {
  const requests = useIncomingGroupJoinRequests();
  const approve = useApproveGroupJoinRequest();
  const reject = useRejectGroupJoinRequest();

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-[0.16em] text-ink-500">
        Waiting on your approval
      </div>
      {requests.data?.map((request) => (
        <div
          key={request.id}
          className="rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-sm text-ink-100">
              {request.requester.displayName} wants to join{" "}
              <span className="text-emerald-300">{request.group.name}</span>
            </div>
            <div className="text-xs text-ink-500 mt-1">{request.requester.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => approve.mutate(request.id)}
              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium"
            >
              Approve
            </button>
            <button
              onClick={() => reject.mutate(request.id)}
              className="px-3 py-1.5 rounded-md bg-ink-800 hover:bg-ink-700 text-xs font-medium"
            >
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
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

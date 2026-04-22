import type { FeedItem } from "@cramr/shared";

type GameBadge = {
  title: string;
  tone: "amber" | "emerald" | "sky" | "rose";
  description: string;
};

type GameStats = {
  weeklySeconds: number;
  activeDays7d: number;
  todaySeconds: number;
  streak: number;
  weeklyGoalSeconds: number;
  score: number;
  level: number;
  nextLevelScore: number;
  progress: number;
  badges: GameBadge[];
};

type Me = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  streak: { current: number; longest: number };
  game: GameStats;
  onboarded: boolean;
};

type CourseItem = {
  id: string;
  kind: "lecture" | "assignment" | "exam";
  title: string;
  orderIndex: number;
  dueAt: string | null;
  completedAt: string | null;
  classCompleters: number;
  classCompletionRate: number;
};

type CourseDetail = {
  id: string;
  code: string;
  name: string;
  school: string;
  term: string;
  createdBy: string;
  memberCount: number;
  items: CourseItem[];
};

type GroupMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  streak: number;
};

type GroupDetail = {
  id: string;
  name: string;
  inviteCode: string;
  members: GroupMember[];
};

type ActiveSession = {
  id: string;
  userId: string;
  courseId: string | null;
  startedAt: string;
  course: { id: string; code: string; name: string } | null;
};

type HeatmapRow = {
  date: string;
  value: number;
  sessions?: number;
  items?: number;
  activeUsers?: number;
};

type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalSeconds: number;
  activeDays7d: number;
  currentStreak: number;
  score: number;
  level: number;
  nextLevelScore: number;
  progress: number;
  badges: GameBadge[];
};

type PresenceEntry = {
  sessionId: string;
  startedAt: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  course: { id: string; code: string } | null;
};

type Nudge = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  sentAt: string;
};

type MockState = {
  me: Me;
  groups: GroupDetail[];
  courses: CourseDetail[];
  activeSession: ActiveSession | null;
  personalHeatmap: HeatmapRow[];
  peerHeatmaps: Record<string, HeatmapRow[]>;
  leaderboard: Record<string, { week: LeaderboardEntry[]; month: LeaderboardEntry[] }>;
  feed: Record<string, FeedItem[]>;
  nudges: Nudge[];
  presence: Record<string, PresenceEntry[]>;
};

let mockApiActive = false;

const IDS = {
  me: "11111111-1111-4111-8111-111111111111",
  ava: "22222222-2222-4222-8222-222222222222",
  marcus: "33333333-3333-4333-8333-333333333333",
  group: "44444444-4444-4444-8444-444444444444",
  course: "55555555-5555-4555-8555-555555555555",
  course2: "66666666-6666-4666-8666-666666666666",
} as const;

let state = createInitialState();

export function isMockApiActive() {
  return mockApiActive;
}

export function activateMockApi() {
  mockApiActive = true;
}

export async function mockFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  mockApiActive = true;
  await delay(80);

  const url = new URL(path, "http://mock.local");
  const method = (init.method ?? "GET").toUpperCase();
  const body = parseBody(init.body);

  if (url.pathname === "/api/me" && method === "GET") {
    return clone(state.me) as T;
  }

  if (url.pathname === "/api/me" && method === "PATCH") {
    const patch: Partial<Me> = {};
    if (typeof body.displayName === "string") patch.displayName = body.displayName;
    if (typeof body.timezone === "string") patch.timezone = body.timezone;
    if (typeof body.avatarUrl === "string" || body.avatarUrl === null) {
      patch.avatarUrl = body.avatarUrl;
    }
    state.me = {
      ...state.me,
      ...patch,
    };
    state.me.game = makeGameStats(
      state.personalHeatmap,
      state.me.streak.current,
      null,
    );
    return clone(state.me) as T;
  }

  if (url.pathname === "/api/sessions/active" && method === "GET") {
    return clone(state.activeSession) as T;
  }

  if (url.pathname === "/api/sessions/start" && method === "POST") {
    if (!state.activeSession) {
      const courseId = typeof body.courseId === "string" ? body.courseId : null;
      const course = courseId
        ? state.courses.find((item) => item.id === courseId) ?? null
        : null;
      state.activeSession = {
        id: crypto.randomUUID(),
        userId: state.me.id,
        courseId,
        startedAt: new Date().toISOString(),
        course: course
          ? { id: course.id, code: course.code, name: course.name }
          : null,
      };
      syncPresenceForActiveSession();
    }
    return clone(state.activeSession) as T;
  }

  const stopMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/stop$/);
  if (stopMatch && method === "POST") {
    const session = state.activeSession;
    if (!session || session.id !== stopMatch[1]) {
      throw new Error("not_found");
    }
    const endedAt = new Date();
    const elapsed = Math.max(
      900,
      Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000),
    );
    applyStoppedSession(session, elapsed, endedAt.toISOString());
    return clone({
      ...session,
      endedAt: endedAt.toISOString(),
      durationSeconds: elapsed,
    }) as T;
  }

  const heartbeatMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch && method === "POST") {
    return { ok: true } as T;
  }

  if (url.pathname === "/api/courses" && method === "GET") {
    return clone(state.courses.map(summarizeCourse)) as T;
  }

  if (url.pathname === "/api/courses/join" && method === "POST") {
    const code = String(body.code ?? "").trim().toUpperCase();
    const course = state.courses.find((item) => item.code.toUpperCase() === code);
    if (!course) throw new Error("course_not_found");
    state.me.onboarded = true;
    return clone(summarizeCourse(course)) as T;
  }

  if (url.pathname === "/api/courses" && method === "POST") {
    const course: CourseDetail = {
      id: crypto.randomUUID(),
      code: String(body.code ?? "NEW101").trim().toUpperCase(),
      name: String(body.name ?? "Untitled Course").trim(),
      school: String(body.school ?? "Your School").trim(),
      term: String(body.term ?? new Date().getFullYear()).trim(),
      createdBy: state.me.id,
      memberCount: 1,
      items: Array.isArray(body.items)
        ? body.items.map(
            (
              item: { kind?: "lecture" | "assignment" | "exam"; title?: string },
              index: number,
            ) => ({
              id: crypto.randomUUID(),
              kind: item.kind ?? "lecture",
              title: String(item.title ?? `Item ${index + 1}`),
              orderIndex: index,
              dueAt: null,
              completedAt: null,
              classCompleters: 0,
              classCompletionRate: 0,
            }),
          )
        : [],
    };
    state.courses = [course, ...state.courses];
    state.me.onboarded = true;
    return clone(summarizeCourse(course)) as T;
  }

  const courseMatch = url.pathname.match(/^\/api\/courses\/([^/]+)$/);
  if (courseMatch && method === "GET") {
    const course = findCourse(courseMatch[1]!);
    return clone(course) as T;
  }

  const percentileMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/percentile$/);
  if (percentileMatch && method === "GET") {
    const course = findCourse(percentileMatch[1]!);
    const done = course.items.filter((item) => item.completedAt).length;
    const peers = Math.max(0, course.memberCount - 1);
    const percentile = peers === 0 ? 100 : Math.min(100, 45 + done * 8);
    return { percentile, peers, myScore: done } as T;
  }

  const addItemsMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/items$/);
  if (addItemsMatch && method === "POST") {
    const course = findCourse(addItemsMatch[1]!);
    const nextIndex = course.items.reduce((max, item) => Math.max(max, item.orderIndex), -1) + 1;
    const items = Array.isArray(body.items) ? body.items : [];
    course.items.push(
      ...items.map(
        (
          item: { kind?: "lecture" | "assignment" | "exam"; title?: string; dueAt?: string | null },
          index: number,
        ) => ({
          id: crypto.randomUUID(),
          kind: item.kind ?? "lecture",
          title: String(item.title ?? `Item ${index + 1}`),
          orderIndex: nextIndex + index,
          dueAt: item.dueAt ?? null,
          completedAt: null,
          classCompleters: 0,
          classCompletionRate: 0,
        }),
      ),
    );
    return { created: items.length } as T;
  }

  const deleteItemMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/items\/([^/]+)$/);
  if (deleteItemMatch && method === "DELETE") {
    const course = findCourse(deleteItemMatch[1]!);
    course.items = course.items.filter((item) => item.id !== deleteItemMatch[2]!);
    return { ok: true } as T;
  }

  const progressMatch = url.pathname.match(/^\/api\/progress\/([^/]+)(?:\/complete)?$/);
  if (progressMatch && (method === "POST" || method === "DELETE")) {
    const itemId = progressMatch[1]!;
    const { course, item } = findCourseItem(itemId);
    const completed = method === "POST";
    item.completedAt = completed ? new Date().toISOString() : null;
    item.classCompleters = Math.max(
      completed ? 1 : 0,
      item.classCompleters + (completed ? 1 : -1),
    );
    item.classCompletionRate =
      course.memberCount > 0 ? item.classCompleters / course.memberCount : 0;
    prependFeedItemForProgress(course, item, completed);
    return { ok: true } as T;
  }

  if (url.pathname === "/api/groups" && method === "GET") {
    return clone(state.groups.map(summarizeGroup)) as T;
  }

  if (url.pathname === "/api/groups" && method === "POST") {
    const name = String(body.name ?? "").trim() || "New Group";
    const group: GroupDetail = {
      id: crypto.randomUUID(),
      name,
      inviteCode: randomInviteCode(),
      members: [
        {
          id: state.me.id,
          displayName: state.me.displayName,
          avatarUrl: state.me.avatarUrl,
          role: "owner",
          streak: state.me.streak.current,
        },
      ],
    };
    state.groups = [group, ...state.groups];
    state.leaderboard[group.id] = {
      week: [
        makeLeaderboardEntry(
          state.me.id,
          state.me.displayName,
          state.me.avatarUrl,
          5400,
          2,
          state.me.streak.current,
          1,
        ),
      ],
      month: [
        makeLeaderboardEntry(
          state.me.id,
          state.me.displayName,
          state.me.avatarUrl,
          21600,
          8,
          state.me.streak.current,
          1,
        ),
      ],
    };
    state.feed[group.id] = [];
    state.presence[group.id] = [];
    state.me.onboarded = true;
    return clone(summarizeGroup(group)) as T;
  }

  if (url.pathname === "/api/groups/join" && method === "POST") {
    const inviteCode = String(body.inviteCode ?? "").trim().toUpperCase();
    const group = state.groups.find((item) => item.inviteCode === inviteCode);
    if (!group) throw new Error("group_not_found");
    if (!group.members.some((item) => item.id === state.me.id)) {
      group.members = [
        ...group.members,
        {
          id: state.me.id,
          displayName: state.me.displayName,
          avatarUrl: state.me.avatarUrl,
          role: "member",
          streak: state.me.streak.current,
        },
      ];
    }
    state.me.onboarded = true;
    return clone(summarizeGroup(group)) as T;
  }

  const groupMatch = url.pathname.match(/^\/api\/groups\/([^/]+)$/);
  if (groupMatch && method === "GET") {
    const group = findGroup(groupMatch[1]!);
    return clone(group) as T;
  }

  const presenceMatch = url.pathname.match(/^\/api\/groups\/([^/]+)\/presence$/);
  if (presenceMatch && method === "GET") {
    return clone(state.presence[presenceMatch[1]!] ?? []) as T;
  }

  if (url.pathname === "/api/heatmap/me" && method === "GET") {
    return clone(state.personalHeatmap) as T;
  }

  const groupHeatmapMatch = url.pathname.match(/^\/api\/heatmap\/group\/([^/]+)$/);
  if (groupHeatmapMatch && method === "GET") {
    const group = findGroup(groupHeatmapMatch[1]!);
    const rows = group.members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      cells: member.id === state.me.id ? state.personalHeatmap : state.peerHeatmaps[member.id] ?? [],
    }));
    return clone(rows) as T;
  }

  const courseHeatmapMatch = url.pathname.match(/^\/api\/heatmap\/course\/([^/]+)$/);
  if (courseHeatmapMatch && method === "GET") {
    return clone(buildCourseHeatmap(courseHeatmapMatch[1]!)) as T;
  }

  const feedMatch = url.pathname.match(/^\/api\/feed\/group\/([^/]+)$/);
  if (feedMatch && method === "GET") {
    return clone(state.feed[feedMatch[1]!] ?? []) as T;
  }

  const leaderboardMatch = url.pathname.match(/^\/api\/leaderboard\/group\/([^/]+)$/);
  if (leaderboardMatch && method === "GET") {
    const window = url.searchParams.get("window") === "month" ? "month" : "week";
    return clone(state.leaderboard[leaderboardMatch[1]!]?.[window] ?? []) as T;
  }

  const userProfileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/profile$/);
  if (userProfileMatch && method === "GET") {
    return clone(buildUserProfile(userProfileMatch[1]!)) as T;
  }

  if (url.pathname === "/api/nudges" && method === "GET") {
    return clone(state.nudges) as T;
  }

  const readNudgeMatch = url.pathname.match(/^\/api\/nudges\/([^/]+)\/read$/);
  if (readNudgeMatch && method === "POST") {
    state.nudges = state.nudges.filter((item) => item.id !== readNudgeMatch[1]);
    return { ok: true } as T;
  }

  throw new Error(`mock_unhandled:${method}:${url.pathname}`);
}

function createInitialState(): MockState {
  const meHeatmap = buildSeededHeatmap(0);
  const avaHeatmap = buildSeededHeatmap(1);
  const marcusHeatmap = buildSeededHeatmap(2);

  const me: Me = {
    id: IDS.me,
    email: "dev@cramr.local",
    displayName: "Dev User",
    avatarUrl: null,
    timezone: "America/Toronto",
    streak: { current: 4, longest: 11 },
    game: makeGameStats(meHeatmap, 4, 2),
    onboarded: true,
  };

  const course: CourseDetail = {
    id: IDS.course,
    code: "CS229",
    name: "Machine Learning",
    school: "Demo University",
    term: "Fall 2026",
    createdBy: IDS.me,
    memberCount: 12,
    items: [
      createCourseItem("lecture", "Week 1: Linear Regression", 0, true, 8, 12),
      createCourseItem("lecture", "Week 2: Logistic Regression", 1, true, 7, 12),
      createCourseItem("assignment", "Problem Set 1", 2, false, 5, 12),
      createCourseItem("lecture", "Week 3: Generalization", 3, false, 3, 12),
      createCourseItem("exam", "Midterm", 4, false, 0, 12),
    ],
  };

  const course2: CourseDetail = {
    id: IDS.course2,
    code: "MATH101",
    name: "Calculus I",
    school: "Demo University",
    term: "Fall 2026",
    createdBy: IDS.ava,
    memberCount: 34,
    items: [
      createCourseItem("lecture", "Limits and Continuity", 0, false, 14, 34),
      createCourseItem("assignment", "Homework 1", 1, false, 9, 34),
      createCourseItem("exam", "Quiz 1", 2, false, 6, 34),
    ],
  };

  const groups: GroupDetail[] = [
    {
      id: IDS.group,
      name: "Midterm Sprint",
      inviteCode: "DEMO1234",
      members: [
        {
          id: IDS.me,
          displayName: me.displayName,
          avatarUrl: null,
          role: "owner",
          streak: me.streak.current,
        },
        {
          id: IDS.ava,
          displayName: "Ava",
          avatarUrl: null,
          role: "member",
          streak: 7,
        },
        {
          id: IDS.marcus,
          displayName: "Marcus",
          avatarUrl: null,
          role: "member",
          streak: 2,
        },
      ],
    },
  ];

  return {
    me,
    groups,
    courses: [course, course2],
    activeSession: null,
    personalHeatmap: meHeatmap,
    peerHeatmaps: {
      [IDS.ava]: avaHeatmap,
      [IDS.marcus]: marcusHeatmap,
    },
    leaderboard: {
      [IDS.group]: {
        week: [
          makeLeaderboardEntry(IDS.ava, "Ava", null, 14100, 5, 7, 1),
          makeLeaderboardEntry(IDS.me, me.displayName, null, 11400, 4, me.streak.current, 2),
          makeLeaderboardEntry(IDS.marcus, "Marcus", null, 6600, 3, 2, 3),
        ],
        month: [
          makeLeaderboardEntry(IDS.me, me.displayName, null, 46800, 18, me.streak.current, 1),
          makeLeaderboardEntry(IDS.ava, "Ava", null, 42900, 17, 7, 2),
          makeLeaderboardEntry(IDS.marcus, "Marcus", null, 20100, 10, 2, 3),
        ],
      },
    },
    feed: {
      [IDS.group]: [
        {
          kind: "progress",
          id: crypto.randomUUID(),
          userId: IDS.ava,
          displayName: "Ava",
          avatarUrl: null,
          courseCode: "CS229",
          itemTitle: "Problem Set 1",
          completedAt: hoursAgo(3),
        },
        {
          kind: "session",
          id: crypto.randomUUID(),
          userId: IDS.me,
          displayName: me.displayName,
          avatarUrl: null,
          courseCode: "CS229",
          startedAt: hoursAgo(6),
          endedAt: hoursAgo(5),
          durationSeconds: 3600,
        },
        {
          kind: "session",
          id: crypto.randomUUID(),
          userId: IDS.marcus,
          displayName: "Marcus",
          avatarUrl: null,
          courseCode: "MATH101",
          startedAt: hoursAgo(28),
          endedAt: hoursAgo(27),
          durationSeconds: 3000,
        },
      ],
    },
    nudges: [
      {
        id: crypto.randomUUID(),
        kind: "streak_at_risk",
        payload: { streak: 4 },
        sentAt: hoursAgo(2),
      },
      {
        id: crypto.randomUUID(),
        kind: "group_ahead",
        payload: { completers: 3, groupSize: 5, itemTitle: "Problem Set 1" },
        sentAt: hoursAgo(20),
      },
    ],
    presence: {
      [IDS.group]: [
        {
          sessionId: crypto.randomUUID(),
          startedAt: minutesAgo(18),
          userId: IDS.ava,
          displayName: "Ava",
          avatarUrl: null,
          course: { id: IDS.course, code: "CS229" },
        },
      ],
    },
  };
}

function findCourse(id: string) {
  const course = state.courses.find((item) => item.id === id);
  if (!course) throw new Error("course_not_found");
  return course;
}

function findGroup(id: string) {
  const group = state.groups.find((item) => item.id === id);
  if (!group) throw new Error("group_not_found");
  return group;
}

function findCourseItem(itemId: string) {
  for (const course of state.courses) {
    const item = course.items.find((entry) => entry.id === itemId);
    if (item) return { course, item };
  }
  throw new Error("item_not_found");
}

function summarizeCourse(course: CourseDetail) {
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    school: course.school,
    term: course.term,
  };
}

function summarizeGroup(group: GroupDetail) {
  const meMember = group.members.find((item) => item.id === state.me.id);
  return {
    id: group.id,
    name: group.name,
    inviteCode: group.inviteCode,
    memberCount: group.members.length,
    role: meMember?.role ?? "member",
  };
}

function buildUserProfile(userId: string) {
  const profileMap = {
    [IDS.me]: {
      id: IDS.me,
      email: state.me.email,
      displayName: state.me.displayName,
      avatarUrl: null,
      timezone: state.me.timezone,
      streak: state.me.streak,
      game: makeGameStats(state.personalHeatmap, state.me.streak.current, 2),
      stats: {
        totalStudySeconds: state.personalHeatmap.reduce((sum, cell) => sum + cell.value, 0),
        last30DaysSeconds: state.personalHeatmap.slice(-30).reduce((sum, cell) => sum + cell.value, 0),
        completedItems: state.courses.reduce(
          (sum, course) => sum + course.items.filter((item) => item.completedAt).length,
          0,
        ),
        groupsCount: state.groups.length,
        coursesCount: state.courses.length,
      },
      sharedGroups: state.groups.map((group) => ({
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
      })),
      sharedCourses: state.courses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
      })),
      strengths: buildStrengthsForUser(IDS.me),
      heatmap: state.personalHeatmap,
      recentActivity: flattenRecentActivityForUser(IDS.me),
    },
    [IDS.ava]: {
      id: IDS.ava,
      email: null,
      displayName: "Ava",
      avatarUrl: null,
      timezone: "America/Toronto",
      streak: { current: 7, longest: 13 },
      game: makeGameStats(state.peerHeatmaps[IDS.ava] ?? [], 7, 1),
      stats: {
        totalStudySeconds: (state.peerHeatmaps[IDS.ava] ?? []).reduce((sum, cell) => sum + cell.value, 0),
        last30DaysSeconds: (state.peerHeatmaps[IDS.ava] ?? []).slice(-30).reduce((sum, cell) => sum + cell.value, 0),
        completedItems: 11,
        groupsCount: 1,
        coursesCount: 2,
      },
      sharedGroups: state.groups.map((group) => ({
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
      })),
      sharedCourses: state.courses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
      })),
      strengths: buildStrengthsForUser(IDS.ava),
      heatmap: state.peerHeatmaps[IDS.ava] ?? [],
      recentActivity: flattenRecentActivityForUser(IDS.ava),
    },
    [IDS.marcus]: {
      id: IDS.marcus,
      email: null,
      displayName: "Marcus",
      avatarUrl: null,
      timezone: "America/Toronto",
      streak: { current: 2, longest: 6 },
      game: makeGameStats(state.peerHeatmaps[IDS.marcus] ?? [], 2, 3),
      stats: {
        totalStudySeconds: (state.peerHeatmaps[IDS.marcus] ?? []).reduce((sum, cell) => sum + cell.value, 0),
        last30DaysSeconds: (state.peerHeatmaps[IDS.marcus] ?? []).slice(-30).reduce((sum, cell) => sum + cell.value, 0),
        completedItems: 6,
        groupsCount: 1,
        coursesCount: 1,
      },
      sharedGroups: state.groups.map((group) => ({
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
      })),
      sharedCourses: state.courses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
      })),
      strengths: buildStrengthsForUser(IDS.marcus),
      heatmap: state.peerHeatmaps[IDS.marcus] ?? [],
      recentActivity: flattenRecentActivityForUser(IDS.marcus),
    },
  } as const;

  const profile = profileMap[userId as keyof typeof profileMap];
  if (!profile) throw new Error("not_found");
  return profile;
}

function buildSeededHeatmap(seed: number): HeatmapRow[] {
  return Array.from({ length: 84 }, (_, index) => {
    const date = daysAgoIso(83 - index);
    const phase = (index + 3 * seed) % 11;
    const active = phase !== 0 && phase !== 4;
    const value = active ? (30 + ((index * 17 + seed * 11) % 95)) * 60 : 0;
    return {
      date,
      value,
      sessions: active ? 1 : 0,
      items: phase === 2 ? 1 : 0,
    };
  });
}

function buildCourseHeatmap(courseId: string): HeatmapRow[] {
  const course = findCourse(courseId);
  return state.personalHeatmap.map((cell, index) => ({
    date: cell.date,
    value: Math.round(cell.value * 1.8 + ((index + course.items.length) % 4) * 900),
    activeUsers: Math.min(course.memberCount, 2 + ((index + course.memberCount) % 6)),
  }));
}

function applyStoppedSession(session: ActiveSession, durationSeconds: number, endedAt: string) {
  state.activeSession = null;

  const today = todayIso();
  const cell = state.personalHeatmap.find((item) => item.date === today);
  if (cell) {
    cell.value += durationSeconds;
    cell.sessions = (cell.sessions ?? 0) + 1;
  } else {
    state.personalHeatmap.push({ date: today, value: durationSeconds, sessions: 1, items: 0 });
    state.personalHeatmap.sort((a, b) => a.date.localeCompare(b.date));
  }

  state.me.game = makeGameStats(state.personalHeatmap, state.me.streak.current, 2);

  for (const group of state.groups) {
    if (!group.members.some((item) => item.id === state.me.id)) continue;
    const entry: FeedItem = {
      kind: "session",
      id: session.id,
      userId: state.me.id,
      displayName: state.me.displayName,
      avatarUrl: state.me.avatarUrl,
      courseCode: session.course?.code ?? null,
      startedAt: session.startedAt,
      endedAt,
      durationSeconds,
    };
    state.feed[group.id] = [
      entry,
      ...(state.feed[group.id] ?? []),
    ].slice(0, 12);

    const week = state.leaderboard[group.id]?.week;
    if (week) {
      const me = week.find((item) => item.userId === state.me.id);
      if (me) {
        me.totalSeconds += durationSeconds;
        refreshLeaderboardEntry(me);
      }
      week.sort((a, b) => b.totalSeconds - a.totalSeconds);
    }

    const month = state.leaderboard[group.id]?.month;
    if (month) {
      const me = month.find((item) => item.userId === state.me.id);
      if (me) {
        me.totalSeconds += durationSeconds;
        refreshLeaderboardEntry(me);
      }
      month.sort((a, b) => b.totalSeconds - a.totalSeconds);
    }
  }

  syncPresenceForActiveSession();
}

function prependFeedItemForProgress(course: CourseDetail, item: CourseItem, completed: boolean) {
  if (!completed) return;
  state.me.game = makeGameStats(state.personalHeatmap, state.me.streak.current, 2);
  for (const group of state.groups) {
    if (!group.members.some((member) => member.id === state.me.id)) continue;
    const entry: FeedItem = {
      kind: "progress",
      id: crypto.randomUUID(),
      userId: state.me.id,
      displayName: state.me.displayName,
      avatarUrl: state.me.avatarUrl,
      courseCode: course.code,
      itemTitle: item.title,
      completedAt: new Date().toISOString(),
    };
    state.feed[group.id] = [
      entry,
      ...(state.feed[group.id] ?? []),
    ].slice(0, 12);
  }
}

function syncPresenceForActiveSession() {
  for (const group of state.groups) {
    const others = (state.presence[group.id] ?? []).filter((item) => item.userId !== state.me.id);
    if (!group.members.some((member) => member.id === state.me.id)) {
      state.presence[group.id] = others;
      continue;
    }
    if (state.activeSession) {
      others.unshift({
        sessionId: state.activeSession.id,
        startedAt: state.activeSession.startedAt,
        userId: state.me.id,
        displayName: state.me.displayName,
        avatarUrl: state.me.avatarUrl,
        course: state.activeSession.course
          ? { id: state.activeSession.course.id, code: state.activeSession.course.code }
          : null,
      });
    }
    state.presence[group.id] = others;
  }
}

function createCourseItem(
  kind: "lecture" | "assignment" | "exam",
  title: string,
  orderIndex: number,
  completed: boolean,
  classCompleters: number,
  memberCount: number,
): CourseItem {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    orderIndex,
    dueAt: null,
    completedAt: completed ? daysAgoIso(2) + "T17:00:00.000Z" : null,
    classCompleters,
    classCompletionRate: classCompleters / memberCount,
  };
}

function buildStrengthsForUser(userId: string) {
  const base = userId === IDS.ava
    ? [
        { id: IDS.course, code: "CS229", name: "Machine Learning", totalItems: 5, completedItems: 4 },
        { id: IDS.course2, code: "MATH101", name: "Calculus I", totalItems: 3, completedItems: 2 },
      ]
    : userId === IDS.marcus
      ? [{ id: IDS.course2, code: "MATH101", name: "Calculus I", totalItems: 3, completedItems: 2 }]
      : state.courses.map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name,
          totalItems: course.items.length,
          completedItems: course.items.filter((item) => item.completedAt).length,
        }));

  return base.map((course) => ({
    ...course,
    completionRate: course.totalItems > 0 ? course.completedItems / course.totalItems : 0,
  }));
}

function flattenRecentActivityForUser(userId: string) {
  return Object.values(state.feed)
    .flat()
    .filter((item) => item.userId === userId)
    .sort((a, b) => {
      const at = a.kind === "session" ? a.endedAt : a.completedAt;
      const bt = b.kind === "session" ? b.endedAt : b.completedAt;
      return bt.localeCompare(at);
    })
    .slice(0, 12);
}

function makeLeaderboardEntry(
  userId: string,
  displayName: string,
  avatarUrl: string | null,
  totalSeconds: number,
  activeDays7d: number,
  currentStreak: number,
  rank: number,
): LeaderboardEntry {
  const score = Math.round(totalSeconds / 60 + activeDays7d * 40 + currentStreak * 18);
  const level = Math.max(1, Math.floor(score / 250) + 1);
  const nextLevelScore = level * 250;
  const progress = (score - (level - 1) * 250) / 250;
  return {
    userId,
    displayName,
    avatarUrl,
    totalSeconds,
    activeDays7d,
    currentStreak,
    score,
    level,
    nextLevelScore,
    progress,
    badges: buildBadges(currentStreak, totalSeconds, activeDays7d, rank),
  };
}

function refreshLeaderboardEntry(entry: LeaderboardEntry) {
  const fresh = makeLeaderboardEntry(
    entry.userId,
    entry.displayName,
    entry.avatarUrl,
    entry.totalSeconds,
    entry.activeDays7d,
    entry.currentStreak,
    2,
  );
  Object.assign(entry, fresh);
}

function makeGameStats(cells: HeatmapRow[], streak: number, rank: number | null): GameStats {
  const weeklyCells = cells.slice(-7);
  const weeklySeconds = weeklyCells.reduce((sum, cell) => sum + cell.value, 0);
  const activeDays7d = weeklyCells.filter((cell) => cell.value > 0).length;
  const todaySeconds = cells[cells.length - 1]?.value ?? 0;
  const score = Math.round(weeklySeconds / 60 + activeDays7d * 40 + streak * 18);
  const level = Math.max(1, Math.floor(score / 250) + 1);
  const nextLevelScore = level * 250;
  const progress = (score - (level - 1) * 250) / 250;
  return {
    weeklySeconds,
    activeDays7d,
    todaySeconds,
    streak,
    weeklyGoalSeconds: Math.max(6 * 3600, Math.min(14 * 3600, (8 + Math.min(streak, 6)) * 3600)),
    score,
    level,
    nextLevelScore,
    progress,
    badges: buildBadges(streak, weeklySeconds, activeDays7d, rank),
  };
}

function buildBadges(streak: number, weeklySeconds: number, activeDays7d: number, rank: number | null) {
  const badges: GameBadge[] = [];
  if (streak >= 7) badges.push({ title: "Flame Keeper", tone: "amber", description: `${streak}-day streak alive` });
  if (weeklySeconds >= 8 * 3600) badges.push({ title: "Deep Work", tone: "emerald", description: "8h+ logged this week" });
  if (activeDays7d >= 5) badges.push({ title: "Consistent", tone: "sky", description: `${activeDays7d} active days this week` });
  if (rank === 1) badges.push({ title: "Front Runner", tone: "rose", description: "leading the pack" });
  return badges.slice(0, 3);
}

function parseBody(body: RequestInit["body"]) {
  if (typeof body !== "string") return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

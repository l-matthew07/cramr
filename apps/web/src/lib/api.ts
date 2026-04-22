import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FeedItem } from "@cramr/shared";
import { useTokenGetter } from "./auth";
import { track } from "./analytics";
import { activateMockApi, isMockApiActive, mockFetch } from "./mockApi";

const API =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:4000" : "");
// In local dev, let the UI fall back to mock data even if Clerk is configured.
// That keeps the signed-in flow usable while the backend is down or not fully wired.
const allowDevMockFallback = import.meta.env.DEV;

export { isMockApiActive };

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  if (isMockApiActive()) {
    return mockFetch<T>(path, init);
  }

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);

  try {
    const res = await fetch(`${API}${path}`, { ...init, headers });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        msg = j.error ?? msg;
      } catch {}

      if (allowDevMockFallback && (res.status === 401 || res.status >= 500)) {
        activateMockApi();
        return mockFetch<T>(path, init);
      }

      throw new Error(msg);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (error) {
    if (allowDevMockFallback) {
      activateMockApi();
      return mockFetch<T>(path, init);
    }
    throw error;
  }
}

function useApi() {
  const getToken = useTokenGetter();
  return async function <T>(path: string, init: RequestInit = {}) {
    const token = await getToken();
    return apiFetch<T>(path, { ...init, token });
  };
}

// ---------- Hooks ----------

export interface GameBadge {
  title: string;
  tone: "amber" | "emerald" | "sky" | "rose";
  description: string;
}

export interface GameStats {
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
}

export interface Me {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  streak: { current: number; longest: number };
  game: GameStats;
  onboarded: boolean;
}

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/api/me"),
  });
}

export function useUpdateMe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { displayName?: string; timezone?: string; avatarUrl?: string | null }) =>
      api<Me>("/api/me", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export interface ActiveSession {
  id: string;
  userId: string;
  courseId: string | null;
  startedAt: string;
  course: { id: string; code: string; name: string } | null;
}

export function useActiveSession() {
  const api = useApi();
  return useQuery({
    queryKey: ["session", "active"],
    queryFn: () => api<ActiveSession | null>("/api/sessions/active"),
    refetchInterval: 30_000,
  });
}

export function useStartSession() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId?: string | null) =>
      api("/api/sessions/start", {
        method: "POST",
        body: JSON.stringify({ courseId: courseId ?? null }),
      }),
    onSuccess: () => {
      track("session_started");
      qc.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

export function useStopSession() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/sessions/${id}/stop`, { method: "POST" }),
    onSuccess: () => {
      track("session_ended");
      qc.invalidateQueries();
    },
  });
}

export function useHeartbeat() {
  const api = useApi();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/sessions/${id}/heartbeat`, { method: "POST" }),
  });
}

// ---------- Courses ----------
export interface Course {
  id: string;
  code: string;
  name: string;
  school: string;
  term: string;
}

export function useMyCourses() {
  const api = useApi();
  return useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => api<Course[]>("/api/courses"),
  });
}

export interface CourseDetail extends Course {
  memberCount: number;
  createdBy: string;
  items: Array<{
    id: string;
    kind: "lecture" | "assignment" | "exam";
    title: string;
    orderIndex: number;
    dueAt: string | null;
    completedAt: string | null;
    classCompleters: number;
    classCompletionRate: number;
  }>;
}

export function useCourse(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["course", id],
    queryFn: () => api<CourseDetail>(`/api/courses/${id}`),
    enabled: !!id,
  });
}

export function useCoursePercentile(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["course", id, "percentile"],
    queryFn: () =>
      api<{ percentile: number; peers: number; myScore?: number }>(
        `/api/courses/${id}/percentile`,
      ),
    enabled: !!id,
  });
}

export interface CourseItemDraft {
  kind: "lecture" | "assignment" | "exam";
  title: string;
  dueAt?: string | null;
}

export function useJoinCourse() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api<Course>("/api/courses/join", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useCreateCourse() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      code: string;
      name: string;
      school: string;
      term: string;
      items: CourseItemDraft[];
    }) => api<Course>("/api/courses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });
}

export function useAddCourseItems(courseId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: CourseItemDraft[]) =>
      api(`/api/courses/${courseId}/items`, {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course", courseId] }),
  });
}

export function useDeleteCourseItem(courseId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api(`/api/courses/${courseId}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course", courseId] }),
  });
}

export function useToggleProgress() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      if (completed) {
        return api(`/api/progress/${itemId}/complete`, { method: "POST" });
      }
      return api(`/api/progress/${itemId}`, { method: "DELETE" });
    },
    onSuccess: (_data, { completed }) => {
      if (completed) track("progress_completed");
      qc.invalidateQueries({ queryKey: ["course"] });
    },
  });
}

// ---------- Groups ----------
export interface GroupSummary {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  role: string;
}

export function useMyGroups() {
  const api = useApi();
  return useQuery({
    queryKey: ["groups", "mine"],
    queryFn: () => api<GroupSummary[]>("/api/groups"),
  });
}

export interface GroupDetail {
  id: string;
  name: string;
  inviteCode: string;
  members: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    streak: number;
  }>;
}

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  streak: { current: number; longest: number };
  game: GameStats;
  stats: {
    totalStudySeconds: number;
    last30DaysSeconds: number;
    completedItems: number;
    groupsCount: number;
    coursesCount: number;
  };
  sharedGroups: Array<{ id: string; name: string; inviteCode: string }>;
  sharedCourses: Array<{ id: string; code: string; name: string }>;
  strengths: Array<{
    id: string;
    code: string;
    name: string;
    totalItems: number;
    completedItems: number;
    completionRate: number;
  }>;
  heatmap: HeatmapRow[];
  recentActivity: FeedItem[];
}

export function useGroup(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["group", id],
    queryFn: () => api<GroupDetail>(`/api/groups/${id}`),
    enabled: !!id,
  });
}

export function useUserProfile(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["user", id, "profile"],
    queryFn: () => api<UserProfile>(`/api/users/${id}/profile`),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<GroupSummary>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      track("group_created");
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useJoinGroup() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) =>
      api<GroupSummary>("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode }),
      }),
    onSuccess: () => {
      track("group_joined");
      qc.invalidateQueries();
    },
  });
}

// ---------- Heatmap ----------
export interface HeatmapRow {
  date: string;
  value: number;
  sessions?: number;
  items?: number;
  activeUsers?: number;
}

export function usePersonalHeatmap() {
  const api = useApi();
  return useQuery({
    queryKey: ["heatmap", "me"],
    queryFn: () => api<HeatmapRow[]>("/api/heatmap/me"),
  });
}

export function useGroupHeatmap(groupId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["heatmap", "group", groupId],
    queryFn: () =>
      api<
        Array<{
          id: string;
          displayName: string;
          avatarUrl: string | null;
          cells: Array<{ date: string; value: number }>;
        }>
      >(`/api/heatmap/group/${groupId}`),
    enabled: !!groupId,
  });
}

export function useCourseHeatmap(courseId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["heatmap", "course", courseId],
    queryFn: () => api<HeatmapRow[]>(`/api/heatmap/course/${courseId}`),
    enabled: !!courseId,
  });
}

// ---------- Feed + leaderboard + presence ----------
export function useGroupFeed(groupId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["feed", groupId],
    queryFn: () => api<FeedItem[]>(`/api/feed/group/${groupId}`),
    enabled: !!groupId,
  });
}

export function useLeaderboard(groupId: string | undefined, window: "week" | "month" = "week") {
  const api = useApi();
  return useQuery({
    queryKey: ["leaderboard", groupId, window],
    queryFn: () =>
      api<
        Array<{
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
        }>
      >(`/api/leaderboard/group/${groupId}?window=${window}`),
    enabled: !!groupId,
  });
}

export function useGroupPresence(groupId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["presence", "group", groupId],
    queryFn: () =>
      api<
        Array<{
          sessionId: string;
          startedAt: string;
          userId: string;
          displayName: string;
          avatarUrl: string | null;
          course: { id: string; code: string } | null;
        }>
      >(`/api/groups/${groupId}/presence`),
    enabled: !!groupId,
    refetchInterval: 30_000,
  });
}

export function useNudges() {
  const api = useApi();
  return useQuery({
    queryKey: ["nudges"],
    queryFn: () =>
      api<
        Array<{
          id: string;
          kind: string;
          payload: Record<string, unknown>;
          sentAt: string;
        }>
      >("/api/nudges"),
  });
}

export function useDismissNudge() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/nudges/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      track("nudge_clicked");
      qc.invalidateQueries({ queryKey: ["nudges"] });
    },
  });
}

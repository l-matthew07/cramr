import { z } from "zod";

// ---------- Sessions ----------
export const StartSessionSchema = z.object({
  courseId: z.string().uuid().optional().nullable(),
});
export type StartSessionInput = z.infer<typeof StartSessionSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  courseId: z.string().uuid().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

// ---------- Courses ----------
export const CourseItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["lecture", "assignment", "exam"]),
  title: z.string(),
  orderIndex: z.number(),
  dueAt: z.string().nullable(),
});
export type CourseItem = z.infer<typeof CourseItemSchema>;

export const JoinCourseSchema = z.object({
  code: z.string().min(2).max(40),
});

// ---------- Groups ----------
export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(80),
});

export const JoinGroupSchema = z.object({
  inviteCode: z.string().min(4).max(40),
});

// ---------- Heatmap ----------
export const HeatmapCellSchema = z.object({
  date: z.string(),
  value: z.number(),
  userId: z.string().uuid().optional(),
});
export type HeatmapCell = z.infer<typeof HeatmapCellSchema>;

export const HeatmapQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// ---------- Presence (WebSocket events) ----------
export type PresenceEvent =
  | {
      type: "session_started";
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      courseId: string | null;
      sessionId: string;
      startedAt: string;
    }
  | { type: "session_ended"; userId: string; sessionId: string };

// ---------- Feed ----------
export type FeedItem =
  | {
      kind: "session";
      id: string;
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      courseCode: string | null;
      startedAt: string;
      endedAt: string;
      durationSeconds: number;
    }
  | {
      kind: "progress";
      id: string;
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      courseCode: string | null;
      itemTitle: string;
      completedAt: string;
    };

// ---------- Utilities ----------
export const DATE_FMT = /^\d{4}-\d{2}-\d{2}$/;

export function clampHeatmapWindow(from?: string, to?: string) {
  const now = new Date();
  const end = to && DATE_FMT.test(to) ? new Date(to) : now;
  const start =
    from && DATE_FMT.test(from)
      ? new Date(from)
      : new Date(end.getTime() - 1000 * 60 * 60 * 24 * 84); // 12 weeks
  return { start, end };
}

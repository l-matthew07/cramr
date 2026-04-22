import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cramr/db";
import { JoinCourseSchema } from "@cramr/shared";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const coursesRouter = Router();

coursesRouter.get("/", async (req, res) => {
  const userId = requireUser(req);
  const memberships = await prisma.courseMembership.findMany({
    where: { userId },
    include: { course: true },
    orderBy: { joinedAt: "desc" },
  });
  res.json(memberships.map((m: { course: unknown }) => m.course));
});

coursesRouter.post("/join", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { code } = JoinCourseSchema.parse(req.body);
    const course = await prisma.course.findUnique({ where: { code } });
    if (!course) throw new HttpError(404, "course_not_found");
    await prisma.courseMembership.upsert({
      where: { userId_courseId: { userId, courseId: course.id } },
      update: {},
      create: { userId, courseId: course.id },
    });
    res.json(course);
  } catch (e) {
    next(e);
  }
});

coursesRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orderIndex: "asc" } },
        _count: { select: { memberships: true } },
      },
    });
    if (!course) throw new HttpError(404, "not_found");

    const myCompletions = await prisma.progressEvent.findMany({
      where: { userId, courseItemId: { in: course.items.map((i) => i.id) } },
      select: { courseItemId: true, completedAt: true },
    });
    const doneByItem = new Map(myCompletions.map((p) => [p.courseItemId, p.completedAt]));

    // Aggregate: how many course members have completed each item.
    const aggregate = await prisma.$queryRawUnsafe<
      Array<{ course_item_id: string; completers: bigint }>
    >(
      `SELECT pe.course_item_id, COUNT(DISTINCT pe.user_id) AS completers
         FROM progress_events pe
         JOIN course_memberships cm ON cm.user_id = pe.user_id
        WHERE cm.course_id = $1::uuid
          AND pe.course_item_id IN (
            SELECT id FROM course_items WHERE course_id = $1::uuid
          )
        GROUP BY pe.course_item_id`,
      id,
    );
    const completersByItem = new Map(
      aggregate.map((r) => [r.course_item_id, Number(r.completers)]),
    );

    const memberCount = course._count.memberships;

    res.json({
      id: course.id,
      code: course.code,
      name: course.name,
      school: course.school,
      term: course.term,
      createdBy: course.createdBy,
      memberCount,
      items: course.items.map((i: { id: string; kind: string; title: string; orderIndex: number; dueAt: Date | null }) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        orderIndex: i.orderIndex,
        dueAt: i.dueAt ? i.dueAt.toISOString() : null,
        completedAt: (doneByItem.get(i.id) as Date | undefined)?.toISOString() ?? null,
        classCompleters: completersByItem.get(i.id) ?? 0,
        classCompletionRate:
          memberCount > 0 ? (completersByItem.get(i.id) ?? 0) / memberCount : 0,
      })),
    });
  } catch (e) {
    next(e);
  }
});

coursesRouter.get("/:id/percentile", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    // % of members the user has completed more items than.
    const rows = await prisma.$queryRawUnsafe<
      Array<{ user_id: string; done: bigint }>
    >(
      `SELECT cm.user_id, COUNT(pe.id) AS done
         FROM course_memberships cm
    LEFT JOIN progress_events pe
           ON pe.user_id = cm.user_id
          AND pe.course_item_id IN (SELECT id FROM course_items WHERE course_id = $1::uuid)
        WHERE cm.course_id = $1::uuid
        GROUP BY cm.user_id`,
      id,
    );
    if (rows.length === 0) return res.json({ percentile: 0, peers: 0 });
    const me = rows.find((r: { user_id: string; done: bigint }) => r.user_id === userId);
    const myScore = me ? Number(me.done) : 0;
    const peers = rows.filter((r: { user_id: string; done: bigint }) => r.user_id !== userId);
    if (peers.length === 0) return res.json({ percentile: 100, peers: 0 });
    const behind = peers.filter((r: { user_id: string; done: bigint }) => Number(r.done) < myScore).length;
    const percentile = Math.round((behind / peers.length) * 100);
    res.json({ percentile, peers: peers.length, myScore });
  } catch (e) {
    next(e);
  }
});

// Simple admin-style create (in MVP, no auth gate — rely on honor system or disable in prod).
const CreateCourseSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(1).max(200),
  school: z.string().min(1).max(100),
  term: z.string().min(1).max(40),
  items: z
    .array(
      z.object({
        kind: z.enum(["lecture", "assignment", "exam"]),
        title: z.string().min(1).max(200),
      }),
    )
    .default([]),
});

coursesRouter.post("/", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const body = CreateCourseSchema.parse(req.body);
    const course = await prisma.course.create({
      data: {
        code: body.code,
        name: body.name,
        school: body.school,
        term: body.term,
        createdBy: userId,
        items: {
          create: body.items.map((it, idx) => ({
            kind: it.kind,
            title: it.title,
            orderIndex: idx,
          })),
        },
      },
    });
    await prisma.courseMembership.create({
      data: { userId, courseId: course.id },
    });
    res.json(course);
  } catch (e) {
    next(e);
  }
});

// Update course metadata (creator only).
coursesRouter.patch("/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new HttpError(404, "not_found");
    if (course.createdBy !== userId) throw new HttpError(403, "not_creator");
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        school: z.string().min(1).max(100).optional(),
        term: z.string().min(1).max(40).optional(),
      })
      .parse(req.body);
    const updated = await prisma.course.update({ where: { id }, data: body });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Add items to existing course (creator only).
const AddItemsSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum(["lecture", "assignment", "exam"]),
      title: z.string().min(1).max(200),
      dueAt: z.string().datetime().optional().nullable(),
    }),
  ).min(1),
});

coursesRouter.post("/:id/items", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new HttpError(404, "not_found");
    if (course.createdBy !== userId) throw new HttpError(403, "not_creator");
    const { items } = AddItemsSchema.parse(req.body);

    // Start orderIndex after the current max.
    const maxIdx = await prisma.courseItem.aggregate({
      where: { courseId: id },
      _max: { orderIndex: true },
    });
    const startIdx = (maxIdx._max.orderIndex ?? -1) + 1;

    const created = await prisma.courseItem.createMany({
      data: items.map((it, i) => ({
        courseId: id,
        kind: it.kind,
        title: it.title,
        orderIndex: startIdx + i,
        dueAt: it.dueAt ? new Date(it.dueAt) : null,
      })),
    });
    res.json({ created: created.count });
  } catch (e) {
    next(e);
  }
});

// Delete a course item (creator only).
coursesRouter.delete("/:id/items/:itemId", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id, itemId } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new HttpError(404, "not_found");
    if (course.createdBy !== userId) throw new HttpError(403, "not_creator");
    await prisma.courseItem.deleteMany({ where: { id: itemId, courseId: id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

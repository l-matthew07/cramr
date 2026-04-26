import { Router } from "express";
import { z } from "zod";
import { prisma } from "@cramr/db";
import { requireUser } from "../middleware/auth.js";
import { getUserGameStats } from "../services/gamification.js";

export const meRouter = Router();

meRouter.get("/", async (req, res) => {
  const userId = requireUser(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [streak, groupCount, courseCount, pendingGroupRequestCount, game] = await Promise.all([
    prisma.streak.findUnique({ where: { userId } }),
    prisma.groupMembership.count({ where: { userId } }),
    prisma.courseMembership.count({ where: { userId } }),
    prisma.groupJoinRequest.count({
      where: { requesterUserId: userId, status: "pending" },
    }),
    getUserGameStats(userId, user.timezone),
  ]);
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    streak: streak
      ? { current: streak.currentLength, longest: streak.longestLength }
      : { current: 0, longest: 0 },
    game,
    onboarded:
      user.onboardedAt !== null ||
      groupCount > 0 ||
      courseCount > 0 ||
      pendingGroupRequestCount > 0,
  });
});

const UpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[\p{L}\p{N} ._'-]+$/u, "invalid_display_name")
    .optional(),
  timezone: z.string().min(1).max(80).optional(),
  avatarUrl: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith("https://"), "avatar_must_be_https")
    .nullable()
    .optional(),
}).strict();

meRouter.patch("/", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const data = UpdateSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: userId }, data });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

meRouter.post("/onboarded", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    await prisma.user.update({
      where: { id: userId },
      data: { onboardedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

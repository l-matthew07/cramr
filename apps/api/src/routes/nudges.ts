import { Router } from "express";
import { prisma } from "@cramr/db";
import { requireUser } from "../middleware/auth.js";

export const nudgesRouter = Router();

nudgesRouter.get("/", async (req, res) => {
  const userId = requireUser(req);
  const nudges = await prisma.nudge.findMany({
    where: { userId, readAt: null },
    orderBy: { sentAt: "desc" },
    take: 10,
  });
  res.json(nudges);
});

nudgesRouter.post("/:id/read", async (req, res) => {
  const userId = requireUser(req);
  const { id } = req.params;
  await prisma.nudge.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

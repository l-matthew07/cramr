import { Router } from "express";
import { randomBytes } from "crypto";
import { prisma } from "@cramr/db";
import { CreateGroupSchema, JoinGroupSchema } from "@cramr/shared";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const groupsRouter = Router();

function generateInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

groupsRouter.get("/", async (req, res) => {
  const userId = requireUser(req);
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: {
      group: {
        include: { _count: { select: { memberships: true } } },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  res.json(
    memberships.map((m: { group: { id: string; name: string; inviteCode: string; _count: { memberships: number } }; role: string }) => ({
      id: m.group.id,
      name: m.group.name,
      inviteCode: m.group.inviteCode,
      memberCount: m.group._count.memberships,
      role: m.role,
    })),
  );
});

groupsRouter.post("/", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { name } = CreateGroupSchema.parse(req.body);

    // Retry a few times on invite-code collision.
    let group = null;
    for (let i = 0; i < 5; i++) {
      try {
        group = await prisma.group.create({
          data: {
            name,
            inviteCode: generateInviteCode(),
            createdBy: userId,
            memberships: { create: { userId, role: "owner" } },
          },
        });
        break;
      } catch (err) {
        if ((err as { code?: string }).code !== "P2002") throw err;
      }
    }
    if (!group) throw new HttpError(500, "invite_code_collision");
    res.json(group);
  } catch (e) {
    next(e);
  }
});

groupsRouter.post("/join", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { inviteCode } = JoinGroupSchema.parse(req.body);
    const group = await prisma.group.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });
    if (!group) throw new HttpError(404, "group_not_found");
    await prisma.groupMembership.upsert({
      where: { userId_groupId: { userId, groupId: group.id } },
      update: {},
      create: { userId, groupId: group.id },
    });
    res.json(group);
  } catch (e) {
    next(e);
  }
});

groupsRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const membership = await prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });
    if (!membership) throw new HttpError(403, "not_a_member");

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                streak: {
                  select: { currentLength: true, longestLength: true },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    if (!group) throw new HttpError(404, "not_found");

    res.json({
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      members: group.memberships.map((m: { user: { id: string; displayName: string; avatarUrl: string | null; streak: { currentLength: number; longestLength: number } | null }; role: string }) => ({
        id: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        streak: m.user.streak?.currentLength ?? 0,
      })),
    });
  } catch (e) {
    next(e);
  }
});

groupsRouter.get("/:id/presence", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;
    if (!id) throw new HttpError(400, "missing_id");
    const membership = await prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });
    if (!membership) throw new HttpError(403, "not_a_member");

    const active = await prisma.studySession.findMany({
      where: {
        endedAt: null,
        user: {
          groupMemberships: { some: { groupId: id } },
        },
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        course: { select: { id: true, code: true } },
      },
    });
    res.json(
      active.map((s: { id: string; startedAt: Date; user: { id: string; displayName: string; avatarUrl: string | null }; course: { id: string; code: string } | null }) => ({
        sessionId: s.id,
        startedAt: s.startedAt,
        userId: s.user.id,
        displayName: s.user.displayName,
        avatarUrl: s.user.avatarUrl,
        course: s.course,
      })),
    );
  } catch (e) {
    next(e);
  }
});

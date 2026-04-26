import { Router } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@cramr/db";
import { CreateGroupSchema, JoinGroupSchema } from "@cramr/shared";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

export const groupsRouter = Router();

function generateInviteCode() {
  return randomBytes(8).toString("hex").toUpperCase();
}

async function requireOwner(userId: string, groupId: string) {
  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) throw new HttpError(403, "not_a_member");
  if (membership.role !== "owner") throw new HttpError(403, "not_owner");
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
    memberships.map((m) => ({
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
      include: {
        memberships: {
          where: { userId },
          select: { userId: true },
        },
      },
    });
    if (!group) throw new HttpError(404, "group_not_found");

    if (group.memberships.length > 0) {
      return res.json({
        status: "already_member",
        group: {
          id: group.id,
          name: group.name,
          inviteCode: group.inviteCode,
        },
      });
    }

    const request = await prisma.groupJoinRequest.upsert({
      where: {
        groupId_requesterUserId: {
          groupId: group.id,
          requesterUserId: userId,
        },
      },
      update: {
        status: "pending",
        requestedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
      },
      create: {
        groupId: group.id,
        requesterUserId: userId,
      },
    });

    res.json({
      status: "pending",
      request: {
        id: request.id,
        groupId: group.id,
        groupName: group.name,
        inviteCode: group.inviteCode,
        requestedAt: request.requestedAt.toISOString(),
      },
    });
  } catch (e) {
    next(e);
  }
});

groupsRouter.get("/requests/incoming", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const rows = await prisma.groupJoinRequest.findMany({
      where: {
        status: "pending",
        group: {
          memberships: {
            some: { userId, role: "owner" },
          },
        },
      },
      orderBy: { requestedAt: "asc" },
      include: {
        group: { select: { id: true, name: true, inviteCode: true } },
        requester: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
    });

    res.json(
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        requestedAt: row.requestedAt.toISOString(),
        group: row.group,
        requester: row.requester,
      })),
    );
  } catch (e) {
    next(e);
  }
});

groupsRouter.get("/requests/mine", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const rows = await prisma.groupJoinRequest.findMany({
      where: { requesterUserId: userId },
      orderBy: { requestedAt: "desc" },
      include: {
        group: { select: { id: true, name: true, inviteCode: true } },
      },
    });

    res.json(
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        requestedAt: row.requestedAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        group: row.group,
      })),
    );
  } catch (e) {
    next(e);
  }
});

groupsRouter.post("/requests/:id/approve", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const requestId = z.string().uuid().parse(req.params.id);
    const request = await prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        group: { select: { id: true, name: true, inviteCode: true } },
      },
    });
    if (!request) throw new HttpError(404, "not_found");
    await requireOwner(userId, request.groupId);
    if (request.status !== "pending") throw new HttpError(409, "request_not_pending");

    await prisma.$transaction([
      prisma.groupMembership.upsert({
        where: {
          userId_groupId: {
            userId: request.requesterUserId,
            groupId: request.groupId,
          },
        },
        update: {},
        create: {
          userId: request.requesterUserId,
          groupId: request.groupId,
          role: "member",
        },
      }),
      prisma.groupJoinRequest.update({
        where: { id: request.id },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: userId,
        },
      }),
    ]);

    res.json({
      ok: true,
      group: request.group,
      requesterUserId: request.requesterUserId,
    });
  } catch (e) {
    next(e);
  }
});

groupsRouter.post("/requests/:id/reject", async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const requestId = z.string().uuid().parse(req.params.id);
    const request = await prisma.groupJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new HttpError(404, "not_found");
    await requireOwner(userId, request.groupId);
    if (request.status !== "pending") throw new HttpError(409, "request_not_pending");

    await prisma.groupJoinRequest.update({
      where: { id: request.id },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: userId,
      },
    });

    res.json({ ok: true });
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
        _count: {
          select: {
            joinRequests: {
              where: { status: "pending" },
            },
          },
        },
      },
    });
    if (!group) throw new HttpError(404, "not_found");

    res.json({
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      viewerRole: membership.role,
      pendingRequestCount: group._count.joinRequests,
      members: group.memberships.map((m) => ({
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
      active.map((s) => ({
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

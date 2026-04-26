import type { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { verifyToken } from "@clerk/clerk-sdk-node";
import { prisma } from "@cramr/db";
import type { PresenceEvent } from "@cramr/shared";
import { getAllowedOrigins } from "./origins.js";

let io: IOServer | null = null;

function isSocketAuthExpired(socket: Parameters<Parameters<IOServer["on"]>[1]>[0]) {
  const expiresAt = socket.data.expiresAtMs as number | undefined;
  return typeof expiresAt === "number" && Date.now() >= expiresAt;
}

export function initSocket(server: HttpServer) {
  io = new IOServer(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      // Dev bypass
      if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) {
        socket.data.userId = process.env.DEV_USER_ID;
        return next();
      }
      if (!token) return next(new Error("missing_token"));
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      const user = await prisma.user.findUnique({
        where: { clerkId: payload.sub },
      });
      if (!user) return next(new Error("unknown_user"));
      socket.data.userId = user.id;
      if (typeof payload.exp === "number") {
        socket.data.expiresAtMs = payload.exp * 1000;
      }
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket) => {
    const expiresAtMs = socket.data.expiresAtMs as number | undefined;
    if (typeof expiresAtMs === "number") {
      const timeoutMs = Math.max(0, expiresAtMs - Date.now());
      setTimeout(() => {
        if (socket.connected && isSocketAuthExpired(socket)) {
          socket.emit("auth_expired");
          socket.disconnect(true);
        }
      }, timeoutMs);
    }

    socket.on("subscribe:group", async (groupId: string) => {
      try {
        if (isSocketAuthExpired(socket)) {
          socket.emit("auth_expired");
          socket.disconnect(true);
          return;
        }
        if (typeof groupId !== "string") return;
        const membership = await prisma.groupMembership.findUnique({
          where: {
            userId_groupId: {
              userId: socket.data.userId as string,
              groupId,
            },
          },
        });
        if (membership) socket.join(`group:${groupId}`);
      } catch (error) {
        console.error("[ws] subscribe:group", error);
      }
    });
    socket.on("unsubscribe:group", (groupId: string) => {
      if (isSocketAuthExpired(socket)) {
        socket.emit("auth_expired");
        socket.disconnect(true);
        return;
      }
      socket.leave(`group:${groupId}`);
    });
    socket.on("subscribe:course", async (courseId: string) => {
      try {
        if (isSocketAuthExpired(socket)) {
          socket.emit("auth_expired");
          socket.disconnect(true);
          return;
        }
        if (typeof courseId !== "string") return;
        const membership = await prisma.courseMembership.findUnique({
          where: {
            userId_courseId: {
              userId: socket.data.userId as string,
              courseId,
            },
          },
        });
        if (membership) socket.join(`course:${courseId}`);
      } catch (error) {
        console.error("[ws] subscribe:course", error);
      }
    });
    socket.on("unsubscribe:course", (courseId: string) => {
      if (isSocketAuthExpired(socket)) {
        socket.emit("auth_expired");
        socket.disconnect(true);
        return;
      }
      socket.leave(`course:${courseId}`);
    });
  });

  console.log("[ws] socket.io initialized");
  return io;
}

export function getIO(): IOServer | null {
  return io;
}

/**
 * Emit a presence event to all groups and (optionally) the course room the user is in.
 */
export async function emitPresence(event: PresenceEvent) {
  const ws = getIO();
  if (!ws) return;

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: event.userId },
    select: { groupId: true },
  });
  for (const m of memberships) ws.to(`group:${m.groupId}`).emit("presence", event);

  if (event.type === "session_started" && event.courseId) {
    ws.to(`course:${event.courseId}`).emit("presence", event);
  }
}

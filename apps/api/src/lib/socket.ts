import type { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { verifyToken } from "@clerk/clerk-sdk-node";
import { prisma } from "@cramr/db";
import type { PresenceEvent } from "@cramr/shared";

let io: IOServer | null = null;

export function initSocket(server: HttpServer) {
  io = new IOServer(server, {
    cors: {
      origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      // Dev bypass
      if (process.env.DEV_USER_ID) {
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
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:group", (groupId: string) => {
      if (typeof groupId === "string") socket.join(`group:${groupId}`);
    });
    socket.on("unsubscribe:group", (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });
    socket.on("subscribe:course", (courseId: string) => {
      if (typeof courseId === "string") socket.join(`course:${courseId}`);
    });
    socket.on("unsubscribe:course", (courseId: string) => {
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

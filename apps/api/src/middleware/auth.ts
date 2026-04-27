import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "@clerk/clerk-sdk-node";
import { prisma } from "@cramr/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      user?: { id: string; email: string; displayName: string; timezone: string };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Dev shortcut — skip Clerk entirely.
    if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) {
      const user = await prisma.user.upsert({
        where: { id: process.env.DEV_USER_ID },
        update: {},
        create: {
          id: process.env.DEV_USER_ID,
          email: process.env.DEV_USER_EMAIL ?? "dev@cramr.local",
          displayName: "Dev User",
          timezone: "America/Los_Angeles",
        },
      });
      req.userId = user.id;
      req.user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        timezone: user.timezone,
      };
      return next();
    }

    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "missing_token" });
    }
    const token = auth.slice("Bearer ".length);

    let payload: Awaited<ReturnType<typeof verifyToken>>;
    try {
      payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    } catch (err) {
      console.warn("[auth] token verification failed", err);
      return res.status(401).json({ error: "invalid_token" });
    }
    const clerkId = payload.sub;
    if (!clerkId) return res.status(401).json({ error: "invalid_token" });

    let user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      // Clerk webhook hasn't fired yet (or is misconfigured) — lazy-create.
      const email =
        (payload as { email?: string }).email ?? `${clerkId}@clerk.local`;
      user = await prisma.user.create({
        data: {
          clerkId,
          email,
          displayName: email.split("@")[0] ?? "user",
        },
      });
    }
    req.userId = user.id;
    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req: Request): string {
  if (!req.userId) throw Object.assign(new Error("unauthorized"), { status: 401 });
  return req.userId;
}

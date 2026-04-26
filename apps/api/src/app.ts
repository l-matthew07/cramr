import express from "express";
import cors from "cors";
import { getAllowedOrigins } from "./lib/origins.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { securityHeaders } from "./middleware/security.js";
import { meRouter } from "./routes/me.js";
import { sessionsRouter } from "./routes/sessions.js";
import { coursesRouter } from "./routes/courses.js";
import { progressRouter } from "./routes/progress.js";
import { groupsRouter } from "./routes/groups.js";
import { heatmapRouter } from "./routes/heatmap.js";
import { feedRouter } from "./routes/feed.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { nudgesRouter } from "./routes/nudges.js";
import { usersRouter } from "./routes/users.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function buildApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  const joinLimiter = createRateLimiter({
    windowMs: 60_000,
    limit: 10,
    keyPrefix: "join",
    key: (req) => req.userId ?? req.ip ?? req.socket.remoteAddress ?? "unknown",
  });
  const meLimiter = createRateLimiter({
    windowMs: 60_000,
    limit: 30,
    keyPrefix: "me",
    key: (req) => req.userId ?? req.ip ?? req.socket.remoteAddress ?? "unknown",
  });
  const sessionStartLimiter = createRateLimiter({
    windowMs: 60_000,
    limit: 20,
    keyPrefix: "session-start",
    key: (req) => req.userId ?? req.ip ?? req.socket.remoteAddress ?? "unknown",
  });
  const courseCreateLimiter = createRateLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 3,
    keyPrefix: "course-create",
    key: (req) => req.userId ?? req.ip ?? req.socket.remoteAddress ?? "unknown",
  });

  app.set("trust proxy", 1);
  app.use(securityHeaders);

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );

  // Webhooks must use raw body for signature verification — mount before json().
  app.use("/api/webhooks", webhooksRouter);

  app.use(express.json({ limit: "32kb" }));

  app.get("/api/ping", (_req, res) => res.json({ ok: true, t: Date.now() }));

  app.use("/api", authMiddleware);
  app.use("/api/groups/join", joinLimiter);
  app.use("/api/courses/join", joinLimiter);
  app.use("/api/me", (req, res, next) => {
    if (req.method === "PATCH") return meLimiter(req, res, next);
    return next();
  });
  app.use("/api/sessions/start", sessionStartLimiter);
  app.use("/api/courses", (req, res, next) => {
    if (req.method === "POST" && req.path === "/") {
      return courseCreateLimiter(req, res, next);
    }
    return next();
  });

  app.use("/api/me", meRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/progress", progressRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/heatmap", heatmapRouter);
  app.use("/api/feed", feedRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/nudges", nudgesRouter);
  app.use("/api/users", usersRouter);

  app.use(errorHandler);

  return app;
}

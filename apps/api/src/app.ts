import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { meRouter } from "./routes/me.js";
import { sessionsRouter } from "./routes/sessions.js";
import { coursesRouter } from "./routes/courses.js";
import { progressRouter } from "./routes/progress.js";
import { groupsRouter } from "./routes/groups.js";
import { heatmapRouter } from "./routes/heatmap.js";
import { feedRouter } from "./routes/feed.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { nudgesRouter } from "./routes/nudges.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function buildApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    }),
  );

  // Webhooks must use raw body for signature verification — mount before json().
  app.use("/api/webhooks", webhooksRouter);

  app.use(express.json());

  app.get("/api/ping", (_req, res) => res.json({ ok: true, t: Date.now() }));

  app.use("/api", authMiddleware);

  app.use("/api/me", meRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/progress", progressRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/heatmap", heatmapRouter);
  app.use("/api/feed", feedRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/nudges", nudgesRouter);

  app.use(errorHandler);

  return app;
}

import "dotenv/config";
import { createServer } from "http";
import * as Sentry from "@sentry/node";
import { buildApp } from "./app.js";
import { initSocket } from "./lib/socket.js";
import { startAutoStopJob } from "./jobs/autoStopSessions.js";
import { startNightlyNudgesJob } from "./jobs/nightlyNudges.js";
import { startWeeklyEmailJob } from "./jobs/weeklyEmail.js";

// Sentry — graceful no-op without SENTRY_DSN
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

const app = buildApp();
const server = createServer(app);

initSocket(server);
startAutoStopJob();
startNightlyNudgesJob();
startWeeklyEmailJob();

const port = Number(process.env.API_PORT ?? 4000);
server.listen(port, () => {
  console.log(`[api] listening on :${port}`);
});

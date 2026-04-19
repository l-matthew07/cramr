# Cramr — Implementation Plan

A concrete, week-by-week build plan for the MVP. Designed for a solo student developer working ~15–20 hrs/week. Total timeline: **8 weeks to alpha**, +2 weeks polish before public beta.

---

## 0. Stack & Tooling (lock this in Day 1)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Fast dev loop, type safety |
| Styling | TailwindCSS + shadcn/ui | No CSS bikeshedding |
| Server state | TanStack Query | Caching + refetch out of the box |
| Client state | Zustand | Lighter than Redux, enough for UI state |
| Charts | `@nivo/calendar` or custom SVG | Heatmap — eval both in week 5 |
| Backend | Node 20 + Express + TypeScript | One language across stack |
| ORM | Prisma | Schema-first, great migrations |
| DB | Postgres 16 | Required for partial indexes + jsonb |
| Cache | Upstash Redis (free tier) | Course heatmap cache only |
| Realtime | Socket.IO | Presence channels, rooms |
| Auth | Clerk | Don't build auth yourself |
| Frontend host | Vercel | Free, zero-config |
| Backend host | Railway | Postgres + Node in one dashboard |
| Errors | Sentry (free tier) | You'll regret not having this |
| Analytics | PostHog (free tier) | Funnels for retention metrics |

### Repo layout (monorepo, pnpm workspaces)
```
cramr/
  apps/
    web/          # React app
    api/          # Express server
  packages/
    shared/       # shared types (zod schemas)
    db/           # prisma schema + migrations
  package.json    # pnpm workspace root
  pnpm-workspace.yaml
  .env.example
```

### Day 1 checklist
- [ ] Initialize pnpm monorepo, add workspaces
- [ ] Scaffold `apps/web` with Vite + Tailwind + shadcn init
- [ ] Scaffold `apps/api` with Express + TS + tsx watch
- [ ] Create Railway project, provision Postgres, copy `DATABASE_URL`
- [ ] Run `prisma init` in `packages/db`
- [ ] Set up Clerk project, wire `<ClerkProvider>` in web and Clerk middleware in api
- [ ] Deploy a hello-world on Vercel + Railway, confirm end-to-end
- [ ] Set up Sentry + PostHog SDKs (both have free tiers, init now before you forget)

**Milestone:** type a button in the web app, hit `/api/ping`, return auth'd user email. If this works Day 1, the rest is just features.

---

## 1. Schema Rollout (migrations, in order)

Each migration maps to a phase below. Write them as separate Prisma migrations so you can revert cleanly.

| # | Migration | Phase |
|---|---|---|
| 001 | `users` (synced from Clerk via webhook), `timezone` field | Week 1 |
| 002 | `study_sessions` + partial unique index `one_active_session` | Week 2 |
| 003 | `courses`, `course_items`, `course_memberships` | Week 3 |
| 004 | `progress_events` with unique `(user_id, course_item_id)` | Week 3 |
| 005 | `groups`, `group_memberships` | Week 4 |
| 006 | `daily_activity` (denormalized aggregate) | Week 5 |
| 007 | `streaks` | Week 5 |
| 008 | `nudges` | Week 7 |

**Rule:** never write to production DB from a local dev branch. Use `prisma migrate dev` locally, `prisma migrate deploy` in CI.

---

## 2. Phased Build

Each phase ends with a **demoable** vertical slice — don't go broad before you go deep.

### Phase 1 — Skeleton & Auth (Week 1)

**Goal:** authed user lands on an empty dashboard with their name.

- [ ] Clerk webhook → `POST /api/webhooks/clerk` → upsert `users` row with `clerk_id`, `email`, `display_name`
- [ ] Middleware: attach `req.user` from Clerk session on every API route
- [ ] `GET /api/me` returns the user
- [ ] Dashboard route `/` — shows `Hello, {name}`, timezone picker (save to user)
- [ ] 404 + error boundary components
- [ ] CI: GitHub Actions runs `pnpm typecheck` + `pnpm test` on PR

**Definition of done:** sign up on prod, see your name on the dashboard.

---

### Phase 2 — Study Sessions (Week 2)

**Goal:** start a timer, see it running, end it, see it in a list.

- [ ] Migration 002
- [ ] `POST /api/sessions/start` — rejects if active session exists (DB enforces via partial index; catch the error, return 409)
- [ ] `POST /api/sessions/:id/stop` — sets `ended_at`, computes `duration_seconds`
- [ ] `GET /api/sessions/active` — returns current user's in-progress session
- [ ] `GET /api/sessions?limit=20` — recent sessions
- [ ] Cap duration server-side at 4 hours on stop
- [ ] Heartbeat: client sends `POST /api/sessions/:id/heartbeat` every 60s; cron job (Railway scheduled task, runs every 2 min) auto-stops sessions with no heartbeat for 5 min using `last_heartbeat_at`
- [ ] Frontend: Big "Start Session" button → timer view → "End Session" → list below

**Testing checkpoint:** start a session, force-quit the tab, wait 6 min, confirm it auto-stopped with a reasonable `ended_at`. This is the edge case that burns real users.

**Definition of done:** you personally use it to study for one session. If the UX annoys you, fix it before moving on.

---

### Phase 3 — Courses & Progress (Week 3)

**Goal:** tag sessions to a course, check off lectures.

- [ ] Migrations 003, 004
- [ ] Admin seed script: `pnpm db:seed-course <code> <items.json>` — manually curate 3 real courses at your school from public syllabi
- [ ] `POST /api/courses/:id/join` — creates membership
- [ ] `GET /api/courses/:id` — course + items + user's progress
- [ ] `POST /api/progress/:course_item_id/complete` + `DELETE` to uncheck
- [ ] Session start accepts optional `course_id`; session view shows course item chips
- [ ] Course view page: item list with checkboxes, your completion bar
- [ ] Dashboard: course picker on the Start Session button

**Definition of done:** seed CS229-S26 with 10 lectures, join it, start a session tagged to it, check off lecture 1, see your progress bar move.

---

### Phase 4 — Groups & Feed (Week 4)

**Goal:** create a group, invite a friend, see each other's sessions in a feed.

- [ ] Migration 005
- [ ] `POST /api/groups` — auto-generates 8-char `invite_code`
- [ ] `POST /api/groups/join` with `{ invite_code }`
- [ ] `GET /api/groups/:id` — group + members + recent activity
- [ ] Activity feed = union query of recent `study_sessions` (ended) + `progress_events` for group members, sorted desc, paginated with cursor
- [ ] Group view page: member list, feed, invite link with copy button
- [ ] Deep-link: `/join/:invite_code` → if unauthed, sign up; if authed, join and redirect to group

**Testing checkpoint:** invite a real friend. Both of you complete a session. Both see each other's activity. If the feed feels dead with 2 users, the product is broken — iterate.

**Definition of done:** one friend uses it with you for a full day.

---

### Phase 5 — Heatmaps & Streaks (Week 5) **← the differentiator week**

**Goal:** personal heatmap on dashboard, group heatmap on group page, streak counter.

- [ ] Migrations 006, 007
- [ ] On session stop: upsert `daily_activity` — **split across midnight in user's timezone** (this is the bug everyone ships)
- [ ] On progress event: upsert `items_completed++`
- [ ] Backfill script for existing data: `pnpm db:backfill-daily-activity`
- [ ] Streak updater: on each daily_activity upsert, update `streaks` row (if `last_active_date == today - 1`, increment; if today, no-op; else reset to 1)
- [ ] `GET /api/heatmap/me?from=&to=` — 12-week window default
- [ ] `GET /api/heatmap/group/:id?from=&to=` — per-member rows
- [ ] `<Heatmap />` component: takes `cells: { date, value, userId? }[]`, computes quartile-based color buckets client-side, renders SVG grid
- [ ] Dashboard: personal heatmap + streak badge + "longest streak" stat
- [ ] Group view: multi-row group heatmap (one row per member, labeled)

**Tricky correctness tests to write now:**
- Session from 22:00 Mon to 02:00 Tue (user in PST) → 2 hours credited to Mon, 2 hours to Tue
- User changes timezone → historical `daily_activity` stays as-is (dates are frozen); new sessions use new tz
- Streak: study Mon, miss Tue, study Wed → current streak = 1, longest = 1 (Mon) or 1 (Wed) depending on which happened first in DB

**Definition of done:** your 2 weeks of dog-food data renders as a filled heatmap that makes you want to keep studying.

---

### Phase 6 — Course Aggregates (Week 6)

**Goal:** course-level benchmarking and heatmap.

- [ ] `GET /api/courses/:id/progress` — for each course_item, `%` of members who completed it
- [ ] `GET /api/heatmap/course/:id?from=&to=` — aggregate daily totals and unique active users; cache in Redis with 5-min TTL, key: `heatmap:course:{id}:{from}:{to}`
- [ ] Percentile calc: for a user, `SELECT count(*) FROM course_memberships cm JOIN (SELECT user_id, SUM(...) AS s FROM daily_activity ...) WHERE s < user_s`. This is expensive — compute nightly into a `course_user_stats` table, not on-read. Add migration 009 when you hit this.
- [ ] Course view page updates: "% of class done" next to each item, percentile banner, course heatmap (single row)

**Definition of done:** with 5+ users in one course, the course view tells you something real about the class.

---

### Phase 7 — Presence & Nudges (Week 7)

**Goal:** "3 friends studying now" + re-engagement emails.

- [ ] Socket.IO server in api; client connects with Clerk JWT
- [ ] Channels: `presence:group:{id}`, `presence:course:{id}`
- [ ] On session start/stop: emit to all groups + courses the user is in
- [ ] On client connect to a channel: server returns current active sessions
- [ ] Dashboard "Studying now" strip subscribes to user's groups
- [ ] Session view subscribes to user's current course
- [ ] Migration 008: `nudges` table
- [ ] Nightly cron: for each user, evaluate nudge rules, enqueue `nudges` rows, send via Resend (email) or web push:
  - No session in last 48h AND streak > 3 → "Don't break your X-day streak"
  - N/M groupmates completed an item you haven't → "3/5 of Study Squad finished Assignment 3"
  - Someone in group is studying right now (optional, rate-limited to 1/day)
- [ ] Weekly Monday morning email: "Last week you studied X hours (vs Y the week before). Top in group: Z."

**Definition of done:** a nudge email drives you back to the app during dog-food.

---

### Phase 8 — Onboarding, Polish, Seed (Week 8)

**Goal:** a new user can land cold and be studying inside 3 minutes.

- [ ] Onboarding flow (modal or dedicated route): name → timezone → join a group OR create one → join a course by code → "start your first session" prompt
- [ ] Don't let users reach `/` (dashboard) with zero groups AND zero courses; redirect to onboarding
- [ ] Empty-state copy everywhere: dashboard, group view, course view, feed
- [ ] Mobile responsive pass (everything should work on a 375px viewport — this is a phone-first product)
- [ ] Install as PWA (manifest.json, service worker for offline session recovery)
- [ ] Seed 5 courses at your university for the current term
- [ ] Analytics: PostHog events for `session_started`, `session_ended`, `progress_completed`, `group_created`, `group_joined`, `nudge_clicked`
- [ ] Sentry: confirm errors surface from both apps

**Definition of done:** give the app to a friend cold, watch them use it, fix the 3 things that confused them.

---

## 3. Weeks 9–10: Private Alpha → Public Beta

### Week 9 — Alpha (20 users)
- [ ] Invite 20 people — prioritize people in 2–3 courses you've seeded, so their course rooms aren't empty
- [ ] Daily dog-food: use the app every day, log every papercut in a GitHub issue
- [ ] Office hours: 30-min calls with 5 alpha users in week 9 — watch them use it, don't lead them
- [ ] Fix the top 10 issues. Resist new features.

### Week 10 — Beta (public on your campus)
- [ ] Post in campus group chats, subreddits, relevant Discord servers
- [ ] "Join my course room: CS229-S26 → cramr.app/c/CS229-S26"
- [ ] Monitor: D1/D7 retention, sessions per WAU, group-join rate, invite send rate
- [ ] Daily standup with yourself: one metric to watch, one bug to fix, one user to talk to

---

## 4. Testing Strategy

Don't write 100% coverage. Do write tests for the things that will silently corrupt data.

**Must-have unit tests:**
- Midnight-spanning session → correct `daily_activity` splits
- Streak transitions (consecutive days, broken streak, same-day double session)
- Partial unique index rejects double session starts
- Course percentile with tied scores

**Must-have integration tests (hit real Postgres):**
- Full flow: start session → stop → progress event → daily_activity exists → heatmap query returns it
- Join group via invite code, feed includes inviter's activity

**Don't bother (yet):**
- E2E browser tests. Manual dog-fooding catches more at this stage.
- Load tests. You don't have enough users. Premature.

---

## 5. Deployment & Environments

- **Environments:** `local` (dev machine), `preview` (Vercel per-PR + Railway staging DB), `prod` (Vercel prod + Railway prod DB). No "staging" as a separate long-lived env — preview deploys suffice.
- **Secrets:** Railway + Vercel env vars. Never commit `.env`. `.env.example` in repo with the keys listed.
- **DB backups:** Railway daily snapshots (free). Before every production migration, manually trigger a snapshot.
- **Migration workflow:** PR includes `prisma migrate dev` output. Merge to main → CI runs `prisma migrate deploy` → deploys api. Never auto-deploy migrations that drop columns; split into two PRs (stop writing → drop column next release).

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Empty course rooms kill the benchmark feature | Launch only in 3–5 high-density courses; pre-seed structure |
| Fake/inflated sessions break leaderboards | 4-hour cap, heartbeat auto-stop, small-group social policing |
| Timezone bugs corrupt heatmap | Store user tz; date-bucket server-side on write; test midnight-spanning cases explicitly |
| Solo dev burnout in week 6 | Phase gates are demoable — shipping weekly to yourself is the reward |
| Scope creep (chat, uploads, AI) | Re-read the "OUT" list in the design doc before starting any new feature |
| Clerk / third-party lock-in | Acceptable MVP cost; your `users` table has `clerk_id` but all business logic uses internal `user_id` |
| Railway free tier runs out | Budget $20/mo starting week 8; Railway + Vercel + Upstash stay well under this at alpha scale |

---

## 7. "Not Now" Parking Lot

Capture the good ideas here instead of building them. Revisit after 500 WAU.

- Canvas / Google Classroom / Notion integration
- Mobile native apps (iOS/Android)
- Video-together study rooms
- AI-generated study plan from a syllabus PDF
- Paid tier (custom themes, private groups > 10, advanced analytics)
- Professor/TA dashboards
- Public profile pages
- Cross-course heatmap overlays
- Accountability partner matching
- Proof-of-work: photo uploads, Anki deck integration, browser activity tracking

---

## 8. Success Criteria for MVP (end of Week 10)

Ship means nothing without these hitting. If metrics are far off, stop adding features and diagnose.

- **100+ signups** from one campus
- **D7 retention ≥ 20%** (aiming for 25%)
- **Median sessions/WAU/week ≥ 4**
- **Group-join rate ≥ 50%** within 24h of signup
- **At least 3 users with 14+ day streaks** (proves the core loop hooks)
- **You personally used the app every study day for 10 weeks** (if you didn't, ship is premature)

If you hit these, raise a pre-seed round or apply to YC. If you don't, the design doc has a retro section to fill in — figure out which assumption broke before you keep building.

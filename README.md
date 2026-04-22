# Cramr

Multiplayer study accountability platform. Start sessions, track course progress, see your friends grind alongside you, watch a GitHub-style heatmap fill in.

See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the full week-by-week build plan.

## Stack

- **Monorepo:** pnpm workspaces
- **Frontend:** React + Vite + TypeScript + Tailwind (`apps/web`)
- **Backend:** Node + Express + TypeScript + Socket.IO (`apps/api`)
- **Database:** Postgres 16 + Prisma (`packages/db`)
- **Shared types:** Zod schemas (`packages/shared`)
- **Auth:** Clerk (with `DEV_USER_ID` local-dev bypass)
- **Cache:** Upstash Redis (optional in dev)

## Quick start

```bash
# 1. Install
pnpm install

# 2. Set up env
cp .env.example .env
# fill in DATABASE_URL at minimum

# 3. Set up database (runs migrations + applies partial indexes)
pnpm db:setup

# 4. (Optional) seed a demo course
pnpm db:seed

# 5. Run both apps
pnpm dev
# web  → http://localhost:5173
# api  → http://localhost:4000
```

### Running without Clerk (fast local dev)

Set `DEV_USER_ID` in `.env` to any UUID and the api will treat every request as that user. Create the row via `pnpm db:seed` or a Prisma Studio insert.

## Layout

```
apps/
  web/         React + Vite frontend
  api/         Express + Socket.IO backend
packages/
  db/          Prisma schema, migrations, seed
  shared/      Zod schemas + TypeScript types shared across web/api
```

## Scripts (root)

| Script | What it does |
|---|---|
| `pnpm dev` | Run web + api in parallel with hot reload |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | TypeScript check across all workspaces |
| `pnpm db:setup` | Run prisma migrate + apply `extensions.sql` (partial indexes) |
| `pnpm db:migrate` | Create a new migration from schema changes |
| `pnpm db:seed` | Seed a demo user + course + items |
| `pnpm db:studio` | Open Prisma Studio |


adsfasdf
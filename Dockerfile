# ── Base ──────────────────────────────────────────────────────────────
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/packages/db/package.json ./apps/packages/db/
COPY apps/packages/shared/package.json ./apps/packages/shared/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm --filter @cramr/db build
RUN pnpm --filter @cramr/shared build
RUN pnpm --filter @cramr/api build

# ── Production ────────────────────────────────────────────────────────
FROM base AS production
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @cramr/db migrate:mark-applied && pnpm --filter @cramr/db migrate:deploy && pnpm --filter @cramr/db run setup && pnpm --filter @cramr/api start"]

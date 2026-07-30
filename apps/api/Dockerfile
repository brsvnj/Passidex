# Passidex API — build the workspace, then run migrations + the server.
# Build context is the repo root (see docker-compose.yml).
FROM node:22-slim

# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

# Install with the full workspace present so the lockfile stays satisfiable.
COPY . .
RUN corepack prepare pnpm@10.33.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @passidex/schema build \
  && pnpm --filter @passidex/api prisma:generate \
  && pnpm --filter @passidex/api build

EXPOSE 3001

# Apply migrations, then start. Safe to re-run: migrate deploy is idempotent.
CMD ["sh", "-lc", "pnpm --filter @passidex/api prisma:deploy && node apps/api/dist/main.js"]

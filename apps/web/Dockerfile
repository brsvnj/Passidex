# Passidex web — build the static SPA, serve it with nginx.
# Build context is the repo root (see docker-compose.yml).
FROM node:22-slim AS build

RUN corepack enable
WORKDIR /app

# VITE_API_URL is baked into the bundle at build time.
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN corepack prepare pnpm@10.33.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @passidex/schema build \
  && pnpm --filter @passidex/web build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

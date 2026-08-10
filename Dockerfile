# ---- 1. Install dependencies (pnpm workspace) + build the frontend (Vite) ----
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile
COPY client/ client/
COPY server/ server/
# Vite inlines VITE_* at BUILD time (client/src/shared/sentry.ts reads import.meta.env.VITE_SENTRY_DSN),
# so unlike every server-side key these can't be supplied as runtime env vars — they have to reach
# this build stage or client-side error tracking is silently off. Declared as build args (Railway
# and `docker build --build-arg` both feed service variables in this way) and re-exported as env so
# the vite process sees them. Both are optional: an empty value builds a bundle with Sentry
# disabled, exactly as before. Neither is a secret — a Sentry DSN is public by design (it only
# allows POSTing events), which is why it's safe to bake into a client bundle at all.
ARG VITE_SENTRY_DSN=""
ARG VITE_APP_VERSION=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN pnpm --filter jobtrack-client build
RUN pnpm --filter jobtrack-server build

# ---- 2. Runtime: Node API serving the built client ----
FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
# Unprivileged runtime user — the container shouldn't run the process as root.
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json server/package.json
# --ignore-scripts: a --prod install has no devDependencies, so the root package.json's
# `prepare` script (husky) has no binary to run and would fail the build. Nothing in the
# server's runtime deps needs a postinstall anyway — pnpm's `onlyBuiltDependencies` (root
# package.json) already allows exactly one, esbuild, which is a devDependency.
RUN pnpm install --filter jobtrack-server --prod --frozen-lockfile --ignore-scripts
# Compiled JS (dist/) — the .ts sources aren't needed at runtime.
COPY --from=build /app/server/dist /app/server/dist
# Built frontend, where dist/index.js expects to find it (../../client/dist).
COPY --from=build /app/client/dist /app/client/dist
# Generated migrations — db/client.ts resolves them relative to its own file (server/drizzle),
# and runs migrate() at import time, so without them the container can't even boot.
COPY --from=build /app/server/drizzle /app/server/drizzle
RUN chown -R app:app /app
ENV PORT=3001
EXPOSE 3001
WORKDIR /app/server
USER app
# wget ships with busybox (alpine's default) — checks the API is alive without extra dependencies.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "--no-warnings", "dist/index.js"]

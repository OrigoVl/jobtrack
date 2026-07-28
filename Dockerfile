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
RUN pnpm install --filter jobtrack-server --prod --frozen-lockfile
# Compiled JS (dist/) — the .ts sources aren't needed at runtime.
COPY --from=build /app/server/dist /app/server/dist
# Built frontend, where dist/index.js expects to find it (../../client/dist).
COPY --from=build /app/client/dist /app/client/dist
RUN chown -R app:app /app
ENV PORT=3001
EXPOSE 3001
WORKDIR /app/server
USER app
# wget ships with busybox (alpine's default) — checks the API is alive without extra dependencies.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "--no-warnings", "dist/index.js"]

# ---- 1. Встановлення залежностей (pnpm workspace) + збірка фронтенду (Vite) ----
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

# ---- 2. Рантайм: Node API, що роздає зібраний клієнт ----
FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
# Непривілейований користувач для рантайму — контейнер не повинен виконувати процес від root.
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --filter jobtrack-server --prod --frozen-lockfile
# скомпільований JS (dist/) — вихідники .ts у рантаймі не потрібні
COPY --from=build /app/server/dist /app/server/dist
# зібраний фронтенд туди, звідки його читає dist/index.js (../../client/dist)
COPY --from=build /app/client/dist /app/client/dist
# каталог для БД (монтується як volume) — має належати процесу, що в нього пише
RUN mkdir -p /app/data && chown -R app:app /app
ENV PORT=3001
ENV DB_PATH=/app/data/jobtrack.db
EXPOSE 3001
WORKDIR /app/server
USER app
# wget є в busybox (alpine "з коробки") — без зайвих залежностей перевіряє, що API живе.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "--no-warnings", "dist/index.js"]

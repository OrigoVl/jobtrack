# ---- 1. Встановлення залежностей (pnpm workspace) + збірка фронтенду (Vite) ----
FROM node:26-alpine AS build
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
FROM node:26-alpine
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --filter jobtrack-server --prod --frozen-lockfile
# скомпільований JS (dist/) — вихідники .ts у рантаймі не потрібні
COPY --from=build /app/server/dist /app/server/dist
# зібраний фронтенд туди, звідки його читає dist/index.js (../../client/dist)
COPY --from=build /app/client/dist /app/client/dist
# каталог для БД (монтується як volume)
RUN mkdir -p /app/data
ENV PORT=3001
ENV DB_PATH=/app/data/jobtrack.db
EXPOSE 3001
WORKDIR /app/server
CMD ["node", "--no-warnings", "dist/index.js"]

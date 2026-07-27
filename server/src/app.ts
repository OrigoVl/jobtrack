// Збирає Express-застосунок: middleware → /api роутер → статика фронтенду → error handler.
// Винесено окремо від index.ts, щоб app можна було імпортувати в тестах без app.listen().
import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import type { IncomingMessage } from "http";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { errorHandler } from "./core/error-handler.js";
import { apiLimiter } from "./core/rate-limit.js";
import routes from "./routes.js";

export const app = express();

// CSP вимкнено: застосунок сам віддає свій SPA (inline Vite-скрипти) з того ж origin,
// решта helmet-заголовків (HSTS, no-sniff, frameguard тощо) лишаються увімкненими.
app.use(helmet({ contentSecurityPolicy: false }));
// Same-origin в проді (сервер сам роздає client/dist) — CORS потрібен лише для dev
// (Vite на іншому порту) та потенційних зовнішніх інтеграцій. Без CORS_ORIGIN у .env — дозволені
// всі origin (без credentials: кук/сесій немає, застосунок однокористувацький, auth не потрібен).
// Задай CORS_ORIGIN, якщо потрібно явно обмежити список дозволених доменів.
app.use(cors(env.corsOrigins ? { origin: env.corsOrigins } : {}));
app.use(express.json({ limit: "4mb" }));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req: IncomingMessage) => req.url === "/api/health" },
  }),
);

app.use("/api", apiLimiter, routes);
// невідомий API-ендпоінт → JSON 404 (а не HTML SPA)
app.use("/api", (_q, res) => res.status(404).json({ error: "Ендпоінт не знайдено" }));

// віддаємо зібраний фронтенд, якщо є
if (fs.existsSync(env.clientDistPath)) {
  app.use(express.static(env.clientDistPath));
  // Express 5 (path-to-regexp v8): голий "*" більше не працює як catch-all — потрібен
  // іменований splat-параметр ("/*name"). SPA-фолбек: усе, що не /api і не статичний файл,
  // віддає index.html (маршрутизація — на клієнті, React Router).
  app.get("/*splat", (_q, res) => res.sendFile(path.join(env.clientDistPath, "index.html")));
}

// єдиний обробник помилок — консистентний формат {error, details}
app.use(errorHandler);

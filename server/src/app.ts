// Збирає Express-застосунок: middleware → /api роутер → статика фронтенду → error handler.
// Винесено окремо від index.ts, щоб app можна було імпортувати в тестах без app.listen().
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import type { IncomingMessage } from "http";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { errorHandler } from "./core/error-handler.js";
import routes from "./routes.js";

export const app = express();

// CSP вимкнено: застосунок сам віддає свій SPA (inline Vite-скрипти) з того ж origin,
// решта helmet-заголовків (HSTS, no-sniff, frameguard тощо) лишаються увімкненими.
app.use(helmet({ contentSecurityPolicy: false }));
// Same-origin в проді (сервер сам роздає client/dist) — CORS потрібен лише для dev
// (Vite на іншому порту) та потенційних зовнішніх інтеграцій, тож дозволяємо всі origin,
// але без credentials (кук/сесій немає — застосунок однокористувацький, auth не потрібен).
app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req: IncomingMessage) => req.url === "/api/health" },
  }),
);

// Захист від runaway-циклів і зловживання платними LLM-викликами: щедрий ліміт для
// живої людини за UI, але зупиняє нескінченні цикли/скрипти. Health не лічимо.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: { error: "Забагато запитів. Спробуй ще раз за кілька хвилин." },
});
app.use("/api", apiLimiter, routes);
// невідомий API-ендпоінт → JSON 404 (а не HTML SPA)
app.use("/api", (_q, res) => res.status(404).json({ error: "Ендпоінт не знайдено" }));

// віддаємо зібраний фронтенд, якщо є
if (fs.existsSync(env.clientDistPath)) {
  app.use(express.static(env.clientDistPath));
  app.get("*", (_q, res) => res.sendFile(path.join(env.clientDistPath, "index.html")));
}

// єдиний обробник помилок — консистентний формат {error, details}
app.use(errorHandler);

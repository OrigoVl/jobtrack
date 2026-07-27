// Збирає Express-застосунок: middleware → /api роутер → статика фронтенду → error handler.
// Винесено окремо від index.ts, щоб app можна було імпортувати в тестах без app.listen().
import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import type { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { errorHandler } from "./core/error-handler.js";
import { apiLimiter } from "./core/rate-limit.js";
import { runWithRequestContext } from "./core/request-context.js";
import routes from "./routes.js";

export const app = express();

// За замовчуванням вимкнено (env.trustProxy === false) — довіряти проксі можна лише свідомо
// через TRUST_PROXY, інакше express-rate-limit і req.ip бачитимуть чужий/спільний IP.
app.set("trust proxy", env.trustProxy);

// CSP: застосунок сам віддає свій SPA з того ж origin (Vite білдить зовнішні <script type="module">,
// inline-скриптів немає), тож можна тримати сувору політику. Єдиний зовнішній ресурс — Google Fonts
// (стилі + шрифти), решта (script/connect/img/frame) обмежені 'self'.
// style-src розділено на дві CSP3-директиви замість одного спільного 'unsafe-inline':
//   - styleSrcElem (елементи <style>/<link>) — суворо БЕЗ 'unsafe-inline'. Це головний XSS-вектор
//     (інжект цілого <style>-блоку/@import), і ми його повністю блокуємо.
//   - styleSrcAttr (атрибут style="…") — 'unsafe-inline' лишається свідомо: у клієнті ~9 місць
//     з динамічним style={{ width: `${pct}%` }} (progress bars), яких без CSS-nonce на кожен рендер
//     інакше не зробити; ризик значно менший (не можна підключити зовнішній CSS чи @import).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrcElem: ["'self'", "https://fonts.googleapis.com"],
        styleSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  }),
);
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
// Прокидуємо reqId (виданий pino-http вище) через AsyncLocalStorage, щоб код без прямого
// доступу до `req` (LLM-клієнт, глибокі сервіси) міг долучити його до своїх логів через
// core/logger.ts#contextLogger() — наскрізна кореляція одного запиту в логах.
app.use((req, _res, next) => {
  runWithRequestContext(req.id != null ? String(req.id) : randomUUID(), next);
});

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

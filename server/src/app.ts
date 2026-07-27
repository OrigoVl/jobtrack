// Збирає Express-застосунок: middleware → /api роутер → статика фронтенду → error handler.
// Винесено окремо від index.ts, щоб app можна було імпортувати в тестах без app.listen().
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import type { IncomingMessage } from "http";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { errorHandler } from "./core/error-handler.js";
import routes from "./routes.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req: IncomingMessage) => req.url === "/api/health" },
  }),
);
app.use("/api", routes);
// невідомий API-ендпоінт → JSON 404 (а не HTML SPA)
app.use("/api", (_q, res) => res.status(404).json({ error: "Ендпоінт не знайдено" }));

// віддаємо зібраний фронтенд, якщо є
if (fs.existsSync(env.clientDistPath)) {
  app.use(express.static(env.clientDistPath));
  app.get("*", (_q, res) => res.sendFile(path.join(env.clientDistPath, "index.html")));
}

// єдиний обробник помилок — консистентний формат {error, details}
app.use(errorHandler);

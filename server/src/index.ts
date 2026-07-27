// Точка входу: піднімає HTTP-сервер поверх зібраного застосунку (app.ts).
import { app } from "./app.js";
import { env } from "./config/env.js";
import logger from "./core/logger.js";

app.listen(env.port, () =>
  logger.info(`✅ JobTrack API на http://localhost:${env.port} (LLM: ${env.llm.isAvailable ? "on" : "off — офлайн-режим"})`),
);

// Точка входу: піднімає HTTP-сервер поверх зібраного застосунку (app.ts).
import { app } from "./app.js";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { closeDb } from "./db/index.js";

const server = app.listen(env.port, () =>
  logger.info(`✅ JobTrack API на http://localhost:${env.port} (LLM: ${env.llm.isAvailable ? "on" : "off — офлайн-режим"})`),
);

// Graceful shutdown: без обробника SIGTERM (напр. `docker stop`) Node вбиває процес одразу,
// обриваючи запити в льоту й лишаючи SQLite-з'єднання незакритим. Тут — даємо http.Server
// доопрацювати вже прийняті запити (server.close() більше не приймає нові з'єднання), потім
// акуратно закриваємо БД і виходимо. forceExitTimer — запобіжник, якщо якийсь запит зависне.
function shutdown(signal: string): void {
  logger.info(`${signal} отримано — graceful shutdown…`);
  const forceExitTimer = setTimeout(() => {
    logger.warn("Graceful shutdown не завершився за 10с — примусовий вихід");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();
  server.close((err) => {
    if (err) logger.error({ err }, "Помилка при закритті HTTP-сервера");
    closeDb();
    process.exit(err ? 1 : 0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

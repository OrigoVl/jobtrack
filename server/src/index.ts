// Точка входу: піднімає HTTP-сервер поверх зібраного застосунку (app.ts).
import { app } from "./app.js";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { closeDb } from "./db/index.js";

// Без цих двох обробників несподіваний виняток поза Express-запитом (напр. throw у
// setTimeout/фоновому таймері, або unhandled Promise-rejection з коду, який ніхто не await'нув)
// або впав би з неструктурованим стек-трейсом просто у stderr (Node's default), або — в
// новіших версіях Node — обірвав би процес одразу без жодного шансу залогувати причину
// структуровано (з reqId/контекстом, як усе інше в застосунку йде через pino).
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  // uncaughtException — сигнал, що стан процесу вже може бути непередбачуваним (пошкоджені
  // замикання/ресурси). Best practice Node: залогувати з максимальним контекстом і ЗАВЕРШИТИ
  // процес (а не "лікувати" й жити далі) — supervisor (Docker/pm2/systemd) підніме новий.
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

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

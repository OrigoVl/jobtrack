// Централізований pino-логер. У dev — людяний вивід через pino-pretty,
// у prod — структурований JSON (легко парситься лог-агрегаторами).
import pino from "pino";
import { env } from "../config/env.js";
import { getRequestId } from "./request-context.js";

const logger = pino({
  level: env.logLevel,
  transport: env.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});

/**
 * Child-логер із прив'язаним reqId поточного HTTP-запиту (через AsyncLocalStorage), якщо код
 * виконується всередині обробки запиту — інакше звичайний базовий логер. Використовуй у коді
 * без прямого доступу до `req` (напр. llm/client.ts), щоб його логи можна було зкорелювати
 * з конкретним запитом користувача так само, як робить pino-http для HTTP access-логів.
 */
export function contextLogger(): pino.Logger {
  const reqId = getRequestId();
  return reqId ? logger.child({ reqId }) : logger;
}

export default logger;

// Ліміти запитів. Винесено окремо від app.ts, щоб модулі з дорогими LLM-ендпоінтами
// могли імпортувати `aiLimiter` без циклічної залежності на app.ts.
//
// Сховище лічильників: за замовчуванням express-rate-limit тримає їх У ПАМ'ЯТІ процесу
// (немає `store` нижче). Це свідомо прийнятне рішення для поточного деплою — один процес
// Node на один SQLite-файл (server/src/db/client.ts), тож окремого координування лімітів
// між інстансами не потрібно. Якщо застосунок коли-небудь піде в multi-instance деплой
// (кілька реплік за LB) — ЦЕЙ файл треба буде змінити першим: лічильники в пам'яті кожної
// репліки перестануть бути спільними (ефективний ліміт стане в N разів вищим за задекларований,
// і кожна репліка забуде лічильник іншого користувача). Рішення на той момент — підключити
// зовнішнє сховище через опцію `store` (напр. `rate-limit-redis` + `ioredis`, чи будь-який
// інший сумісний з express-rate-limit Store), синхронізоване з тим самим Redis/DB, куди
// на той момент вже мігрує й персистентність (див. розділ "Міграція на Postgres" у README).
import rateLimit, { type RateLimitExceededEventHandler } from "express-rate-limit";
import { contextLogger } from "./logger.js";

// Спільний handler замість default-поведінки express-rate-limit: той просто пише
// res.status(...).json(message) без жодного логу. Без цього спрацьований лімiт (особливо
// aiLimiter — ознака runaway-циклу у фронтенді чи спроби спалити платну LLM-квоту) був би
// видимий ЛИШЕ клієнту (тост про помилку), а на сервері не лишалось би жодного слідy.
function logAndReject(name: string): RateLimitExceededEventHandler {
  return (req, res, _next, options) => {
    contextLogger().warn({ path: req.path, ip: req.ip, limiter: name }, "Rate limit exceeded");
    res.status(options.statusCode).json(options.message);
  };
}

// Захист від runaway-циклів і зловживання платними LLM-викликами: щедрий ліміт для
// живої людини за UI, але зупиняє нескінченні цикли/скрипти. Health не лічимо.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: { error: "Забагато запитів. Спробуй ще раз за кілька хвилин." },
  handler: logAndReject("api"),
});

// Окремий, суворіший ліміт саме для ендпоінтів, що викликають LLM (OpenAI/Anthropic).
// Кожен такий запит коштує реальних грошей і секунди затримки провайдера, тож ліміт
// значно нижчий за загальний `apiLimiter` — щоб бага у фронтенді чи скрипт не спалили
// платний квоту за хвилини.
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Забагато AI-запитів. Зачекай кілька хвилин і спробуй ще раз." },
  handler: logAndReject("ai"),
});

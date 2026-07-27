// Ліміти запитів. Винесено окремо від app.ts, щоб модулі з дорогими LLM-ендпоінтами
// могли імпортувати `aiLimiter` без циклічної залежності на app.ts.
import rateLimit from "express-rate-limit";

// Захист від runaway-циклів і зловживання платними LLM-викликами: щедрий ліміт для
// живої людини за UI, але зупиняє нескінченні цикли/скрипти. Health не лічимо.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: { error: "Забагато запитів. Спробуй ще раз за кілька хвилин." },
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
});

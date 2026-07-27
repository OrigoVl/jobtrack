// Єдина точка доступу до змінних оточення. Решта коду НЕ читає process.env напряму —
// це спрощує тестування, дає one-shot валідацію дефолтів і IDE-автодоповнення.
import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/config/env.ts -> server/ (корінь пакета)
const serverRoot = path.join(__dirname, "..", "..");

const isProduction = process.env.NODE_ENV === "production";

// Валідуємо "сирі" process.env одразу при старті — краще впасти з чітким повідомленням
// (напр. одрукований LLM_PROVIDER), ніж мовчки підхопити дефолт і зламатись десь глибоко.
const RawEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  DB_PATH: z.string().trim().min(1).optional(),
  // Список дозволених origin через кому (напр. "https://app.example.com,https://admin.example.com").
  // Не задано → CORS відкритий для всіх origin (застосунок без auth/cookies, читає лише свій /api).
  CORS_ORIGIN: z.string().trim().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  LLM_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-4o-mini"),
  OPENAI_MODEL_SMART: z.string().trim().min(1).default("gpt-4o"),
  ANTHROPIC_API_KEY: z.string().trim().min(1).optional(),
  ANTHROPIC_MODEL: z.string().trim().min(1).default("claude-haiku-4-5-20251001"),
  ANTHROPIC_MODEL_SMART: z.string().trim().min(1).default("claude-sonnet-4-5-20250929"),
  // Скільки чекати відповіді від LLM-провайдера, перш ніж відмовитись — щоб зависла
  // відповідь OpenAI/Anthropic не тримала запит користувача (і з'єднання) вічно.
  // Two-tier timeout: "fast" (екстракція/підказки) фейлиться швидше, ніж "smart"
  // (складна структурована генерація, якій потрібно більше часу) — швидший fallback
  // на офлайн-евристику для простих задач, які не повинні "висіти" довго.
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  LLM_TIMEOUT_MS_FAST: z.coerce.number().int().positive().default(15_000),
  // Express "trust proxy" — треба вмикати, лише якщо застосунок реально стоїть за
  // reverse-proxy/LB (nginx, Cloudflare тощо), інакше req.ip і rate-limit бачитимуть IP проксі,
  // а не клієнта. За замовчуванням вимкнено (застосунок слухає напряму).
  // Приклади значень: "false" (дефолт), "1" (довіряти першому хопу), "loopback".
  TRUST_PROXY: z.string().trim().default("false"),
});

const parsedEnv = RawEnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`).join("\n");
  // eslint-disable-next-line no-console -- логер ще не готовий на цій стадії старту застосунку
  console.error(`❌ Некоректні змінні оточення (перевір server/.env):\n${issues}`);
  process.exit(1);
}
const raw = parsedEnv.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction,
  port: raw.PORT,
  dbPath: raw.DB_PATH || path.join(serverRoot, "jobtrack.db"),
  // undefined → cors() без обмежень (дозволяє будь-який origin); масив → лише перелічені.
  corsOrigins: raw.CORS_ORIGIN
    ? raw.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : undefined,
  logLevel: raw.LOG_LEVEL || (isProduction ? "info" : "debug"),
  clientDistPath: path.join(serverRoot, "..", "client", "dist"),
  // Express приймає boolean | number | string для "trust proxy" — коерсимо з рядка env.
  trustProxy: (raw.TRUST_PROXY === "true"
    ? true
    : raw.TRUST_PROXY === "false"
      ? false
      : /^\d+$/.test(raw.TRUST_PROXY)
        ? Number(raw.TRUST_PROXY)
        : raw.TRUST_PROXY) as boolean | number | string,

  llm: {
    provider: raw.LLM_PROVIDER,
    openaiApiKey: raw.OPENAI_API_KEY,
    openaiModel: raw.OPENAI_MODEL,
    openaiModelSmart: raw.OPENAI_MODEL_SMART,
    anthropicApiKey: raw.ANTHROPIC_API_KEY,
    anthropicModel: raw.ANTHROPIC_MODEL,
    anthropicModelSmart: raw.ANTHROPIC_MODEL_SMART,
    timeoutMs: raw.LLM_TIMEOUT_MS,
    timeoutMsFast: raw.LLM_TIMEOUT_MS_FAST,
    get isAvailable(): boolean {
      return !!(env.llm.openaiApiKey || env.llm.anthropicApiKey);
    },
  },
} as const;

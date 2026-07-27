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
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  LLM_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-4o-mini"),
  OPENAI_MODEL_SMART: z.string().trim().min(1).default("gpt-4o"),
  ANTHROPIC_API_KEY: z.string().trim().min(1).optional(),
  ANTHROPIC_MODEL: z.string().trim().min(1).default("claude-3-5-haiku-latest"),
  ANTHROPIC_MODEL_SMART: z.string().trim().min(1).default("claude-3-5-sonnet-latest"),
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
  logLevel: raw.LOG_LEVEL || (isProduction ? "info" : "debug"),
  clientDistPath: path.join(serverRoot, "..", "client", "dist"),

  llm: {
    provider: raw.LLM_PROVIDER,
    openaiApiKey: raw.OPENAI_API_KEY,
    openaiModel: raw.OPENAI_MODEL,
    openaiModelSmart: raw.OPENAI_MODEL_SMART,
    anthropicApiKey: raw.ANTHROPIC_API_KEY,
    anthropicModel: raw.ANTHROPIC_MODEL,
    anthropicModelSmart: raw.ANTHROPIC_MODEL_SMART,
    get isAvailable(): boolean {
      return !!(env.llm.openaiApiKey || env.llm.anthropicApiKey);
    },
  },
} as const;

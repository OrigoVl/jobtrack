// Єдина точка доступу до змінних оточення. Решта коду НЕ читає process.env напряму —
// це спрощує тестування, дає one-shot валідацію дефолтів і IDE-автодоповнення.
import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/config/env.ts -> server/ (корінь пакета)
const serverRoot = path.join(__dirname, "..", "..");

const isProduction = process.env.NODE_ENV === "production";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: Number(process.env.PORT) || 3001,
  dbPath: process.env.DB_PATH || path.join(serverRoot, "jobtrack.db"),
  logLevel: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  clientDistPath: path.join(serverRoot, "..", "client", "dist"),

  llm: {
    provider: (process.env.LLM_PROVIDER || "openai") as "openai" | "anthropic",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openaiModelSmart: process.env.OPENAI_MODEL_SMART || "gpt-4o",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
    anthropicModelSmart: process.env.ANTHROPIC_MODEL_SMART || "claude-3-5-sonnet-latest",
    get isAvailable(): boolean {
      return !!(env.llm.openaiApiKey || env.llm.anthropicApiKey);
    },
  },
} as const;

import express from "express";
import { llmAvailable } from "../../llm/index.js";
import { pingDb } from "../../db/index.js";

const r = express.Router();

// Перевіряємо реальну доступність БД (SELECT 1), а не лише "процес живий" — щоб оркестратор
// (Docker HEALTHCHECK, k8s liveness/readiness) міг відрізнити застряглий/пошкоджений SQLite-файл
// від справді здорового застосунку. 503 замість 200, якщо БД недоступна.
r.get("/health", (_q, res) => {
  const dbOk = pingDb();
  res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk, llm: llmAvailable() });
});

export default r;

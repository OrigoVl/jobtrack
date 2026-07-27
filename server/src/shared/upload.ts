// Спільний multer-інстанс для файлових ендпоінтів (CV upload, LinkedIn import).
import type { RequestHandler } from "express";
import multer from "multer";

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/**
 * Типізована обгортка над `upload.single()`. `@types/multer` досі тягне за собою
 * `@types/express@4` (DefinitelyTyped ще не оновили пакет під Express 5), тож "сирий"
 * `upload.single(...)` не проходить перевірку типів у `router.post(path, upload.single(...), ...)`
 * на Express 5, хоча рантайм-поведінка middleware не змінилась. Каст ізольовано в одному
 * місці, щоб не розкидати `as unknown as RequestHandler` по кожному роуту.
 */
export function uploadSingle(field: string): RequestHandler {
  return upload.single(field) as unknown as RequestHandler;
}

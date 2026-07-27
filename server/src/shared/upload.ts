// Спільний multer-інстанс для файлових ендпоінтів (CV upload, LinkedIn import).
import type { RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../core/http.js";

// /cv/upload приймає pdf/docx/doc/txt (парситься в cv-extract.service.ts),
// /cv/linkedin-import приймає zip (LinkedIn "Get a copy of your data" експорт).
// Обидва роути ділять один multer-інстанс, тож фільтр дозволяє об'єднаний список.
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".zip"];
const ALLOWED_MIME_PATTERNS = [/pdf/, /wordprocessingml/, /msword/, /^text\/plain$/, /zip/];

function isAllowedFile(originalname: string, mimetype: string): boolean {
  const name = originalname.toLowerCase();
  const mt = mimetype.toLowerCase();
  // Розширення — основний сигнал (браузери часто шлють generic application/octet-stream),
  // mimetype — додаткова перевірка, якщо розширення відсутнє/нетипове.
  if (ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return ALLOWED_MIME_PATTERNS.some((re) => re.test(mt));
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  // Рання відмова невідповідного типу файлу — чіткий 400 замість того, щоб пропустити
  // довільний файл далі й отримати незрозумілу помилку глибоко в парсері (mammoth/pdfjs/adm-zip).
  // Параметри типізуються контекстно від multer.Options — уникаємо явного `Request` з "express",
  // бо @types/multer досі тягне @types/express@4 (той самий конфлікт, що й у uploadSingle нижче).
  fileFilter: (_req, file, cb) => {
    if (isAllowedFile(file.originalname, file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new HttpError(400, "Непідтримуваний тип файлу. Дозволено: PDF, DOCX, DOC, TXT, ZIP."));
  },
});

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

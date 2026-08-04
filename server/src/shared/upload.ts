// Shared multer instance for file endpoints (CV upload, LinkedIn import).
import type { RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../core/http.js";

// /cv/upload accepts pdf/docx/doc/txt (parsed in cv-extract.service.ts),
// /cv/linkedin-import accepts zip (LinkedIn "Get a copy of your data" export).
// Both routes share a single multer instance, so the filter allows the combined list.
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".zip"];
const ALLOWED_MIME_PATTERNS = [/pdf/, /wordprocessingml/, /msword/, /^text\/plain$/, /zip/];

function isAllowedFile(originalname: string, mimetype: string): boolean {
  const name = originalname.toLowerCase();
  const mt = mimetype.toLowerCase();
  // Extension is the primary signal (browsers often send generic application/octet-stream),
  // mimetype is a secondary check if the extension is missing/atypical.
  if (ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return ALLOWED_MIME_PATTERNS.some((re) => re.test(mt));
}

// Not exported — every route goes through uploadSingle() below, no one needs the "raw" multer instance externally.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  // Early rejection of a mismatched file type — a clear 400 instead of letting an arbitrary
  // file through and getting a confusing error deep inside the parser (mammoth/pdfjs/adm-zip).
  // Parameters are typed contextually from multer.Options — we avoid an explicit `Request`
  // from "express", since @types/multer still pulls in @types/express@4 (the same conflict as in uploadSingle below).
  fileFilter: (_req, file, cb) => {
    if (isAllowedFile(file.originalname, file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new HttpError(400, "Unsupported file type. Allowed: PDF, DOCX, DOC, TXT, ZIP.", null, "UNSUPPORTED_FILE_TYPE"));
  },
});

/**
 * Typed wrapper around `upload.single()`. `@types/multer` still pulls in `@types/express@4`
 * (DefinitelyTyped hasn't updated the package for Express 5 yet), so the "raw"
 * `upload.single(...)` fails type checking in `router.post(path, upload.single(...), ...)`
 * on Express 5, even though the middleware's runtime behavior hasn't changed. The cast is
 * isolated in one place so `as unknown as RequestHandler` doesn't have to be scattered across every route.
 */
export function uploadSingle(field: string): RequestHandler {
  return upload.single(field) as unknown as RequestHandler;
}

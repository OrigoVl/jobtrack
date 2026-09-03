// Shared multer instance for file endpoints (CV upload, LinkedIn import).
import type { RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../core/http.js";

// /cv/upload accepts pdf/docx/txt (parsed in cv-extract.service.ts),
// /cv/linkedin-import accepts zip (LinkedIn "Get a copy of your data" export).
// Both routes share a single multer instance, so the filter allows the combined list.
// Legacy binary .doc is deliberately NOT in this list: mammoth (the library cv-extract.service.ts
// uses for word documents) only understands modern OOXML .docx, not the old binary format — it
// throws deep inside the parser on a real .doc file. Advertising an extension that reliably fails
// would be worse than not accepting it; full legacy .doc support needs a different library and is
// out of scope here. The msword MIME pattern below is kept (for the occasional browser that
// mislabels a real .docx upload as application/msword) — a stray legacy .doc that slips through
// on that MIME match still fails cleanly, since cv.routes.ts wraps the extractText() call in a
// try/catch and turns any parser exception into a 400, not a raw 500.
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".zip"];
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
    cb(new HttpError(400, "Unsupported file type. Allowed: PDF, DOCX, TXT, ZIP.", null, "UNSUPPORTED_FILE_TYPE"));
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

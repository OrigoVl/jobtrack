// Assembles the Express app: middleware → /api router → frontend static files → error handler.
// Kept separate from index.ts so app can be imported in tests without app.listen().
import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import type { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { errorHandler } from "./core/error-handler.js";
import { apiLimiter } from "./core/rate-limit.js";
import { runWithRequestContext } from "./core/request-context.js";
import routes from "./routes.js";

export const app = express();

// Disabled by default (env.trustProxy === false) — trusting the proxy must be an explicit
// opt-in via TRUST_PROXY, otherwise express-rate-limit and req.ip would see a shared/foreign IP.
app.set("trust proxy", env.trustProxy);

// CSP: the app serves its own SPA from the same origin (Vite builds external
// <script type="module"> tags, there are no inline scripts), so we can keep a strict policy.
// The only external resource is Google Fonts (styles + fonts); everything else
// (script/connect/img/frame) is restricted to 'self'.
// style-src is split into two CSP3 directives instead of one shared 'unsafe-inline':
//   - styleSrcElem (<style>/<link> elements) — strictly WITHOUT 'unsafe-inline'. This is the
//     main XSS vector (injecting a whole <style> block/@import), and we block it entirely.
//   - styleSrcAttr (the style="…" attribute) — 'unsafe-inline' is kept deliberately: the client
//     has ~9 places with dynamic style={{ width: `${pct}%` }} (progress bars) that can't be done
//     any other way without a CSS nonce on every render; the risk is much smaller (no way to
//     load external CSS or @import).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-eval' — a deliberate, narrowly-scoped exception ONLY for `new Function(...)` in
        // features/study/runner.ts (the "run JS code" sandbox for drill practice) — without it
        // CSP blocks the eval call itself even INSIDE a Web Worker (the worker inherits the
        // page's script-src; there's no separate "worker-only eval" CSP directive). The residual
        // risk is acceptable: (1) the code runs in an ISOLATED Worker — no access to the main
        // page's window/document/localStorage/cookies, only console.log interception;
        // (2) 'unsafe-eval' by itself does NOT allow loading an external script (the fact that
        // there's no dangerouslySetInnerHTML/innerHTML in the client — see the audit — means
        // there's no other XSS vector this eval could be abused through).
        scriptSrc: ["'self'", "'unsafe-eval'"],
        // worker-src doesn't inherit 'self' from script-src for blob: (a known CSP quirk:
        // 'self' matches SCHEME+ORIGIN, while blob:/data: are special "local" schemes that must
        // be allowed explicitly even when the blob: was created by the same origin) — without
        // this line `new Worker(blobUrl)` in runner.ts is blocked by CSP ("worker-src not set,
        // falling back to script-src... blocked") before the code inside ever gets to run.
        workerSrc: ["'self'", "blob:"],
        styleSrcElem: ["'self'", "https://fonts.googleapis.com"],
        styleSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        // Sentry ingest hosts, allowed unconditionally: harmless when client Sentry (VITE_SENTRY_DSN)
        // is unset (nothing ever calls them), and avoids a CSP violation silently dropping every
        // client-side error event the moment someone does configure it.
        connectSrc: ["'self'", "https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io", "https://*.ingest.de.sentry.io"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  }),
);
// Same-origin in prod (the server serves client/dist itself) — CORS is only needed for dev
// (Vite on a different port) and potential external integrations. Without CORS_ORIGIN in
// .env, all origins are allowed (no credentials: there are no cookies/sessions, the app is
// single-user, auth isn't needed). Set CORS_ORIGIN if you need to explicitly restrict the
// list of allowed domains.
app.use(cors(env.corsOrigins ? { origin: env.corsOrigins } : {}));
app.use(express.json({ limit: "4mb" }));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req: IncomingMessage) => req.url === "/api/health" },
  }),
);
// Thread the reqId (issued by pino-http above) through AsyncLocalStorage so that code without
// direct access to `req` (the LLM client, deep services) can attach it to its own logs via
// core/logger.ts#contextLogger() — end-to-end correlation of a single request across logs.
app.use((req, _res, next) => {
  runWithRequestContext(req.id != null ? String(req.id) : randomUUID(), next);
});

app.use("/api", apiLimiter, routes);
// unknown API endpoint → JSON 404 (not the HTML SPA)
app.use("/api", (_q, res) => res.status(404).json({ error: "Endpoint not found" }));

// serve the built frontend if it exists
if (fs.existsSync(env.clientDistPath)) {
  app.use(express.static(env.clientDistPath));
  // Express 5 (path-to-regexp v8): a bare "*" no longer works as a catch-all — a named
  // splat parameter is required ("/*name"). SPA fallback: anything that's not /api and not
  // a static file gets index.html (routing happens on the client, via React Router).
  app.get("/*splat", (_q, res) => res.sendFile(path.join(env.clientDistPath, "index.html")));
}

// single error handler — consistent {error, details} format
app.use(errorHandler);

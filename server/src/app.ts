// Assembles the Express app: middleware → /api router → frontend static files → error handler.
// Kept separate from index.ts so app can be imported in tests without app.listen().
import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import type { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { errorHandler } from "./core/error-handler.js";
import { apiLimiter } from "./core/rate-limit.js";
import { runWithRequestContext } from "./core/request-context.js";
import { DEFAULT_LOCALE, isAppLocale } from "./shared/locale.js";
import { auth } from "./auth/auth.js";
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
// Same-origin in prod (the server serves client/dist itself) and in dev (Vite proxies /api to
// this server, see client/vite.config.ts) — cookies never actually cross an origin in either
// case, so CORS_ORIGIN is only needed for a genuinely split deployment (client hosted
// separately from this API). `credentials: true` is required there since better-auth's
// sessions are cookie-based — and only safe to combine with an explicit origin list, never a
// wildcard (the browser rejects credentialed requests against `Access-Control-Allow-Origin: *`
// anyway, so this isn't a new restriction, just made explicit).
app.use(cors(env.corsOrigins ? { origin: env.corsOrigins, credentials: true } : {}));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req: IncomingMessage) => req.url === "/api/health" },
  }),
);
// Thread the reqId (issued by pino-http above) through AsyncLocalStorage so that code without
// direct access to `req` (the LLM client, deep services) can attach it to its own logs via
// core/logger.ts#contextLogger() — end-to-end correlation of a single request across logs.
// Locale rides the same context (see request-context.ts) — read here from the client's X-Locale
// header (shared/api.ts, auth-client.ts) so it's available to better-auth's email callbacks
// below AND to llm/client.ts deep in the stack, from one middleware. An unrecognized/missing
// header value falls back to the default rather than rejecting the request — this header is
// metadata about presentation, never something a request should 400 over.
app.use((req, _res, next) => {
  // Node normalizes a repeated header into an array — a client only ever sends one, but treat
  // that case as "no locale" rather than throwing.
  const rawLocale = req.headers["x-locale"];
  const headerValue = typeof rawLocale === "string" ? rawLocale : undefined;
  const locale = headerValue && isAppLocale(headerValue) ? headerValue : DEFAULT_LOCALE;
  runWithRequestContext(req.id != null ? String(req.id) : randomUUID(), locale, next);
});

// better-auth's handler reads the raw request body itself — it MUST be mounted before
// express.json() below (a body-parsing middleware that's already consumed the stream would
// leave nothing for it to read). Not behind apiLimiter: better-auth has its own built-in,
// IP-keyed rate limiter for these specific endpoints (auto-enabled in production).
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "4mb" }));
app.use("/api", apiLimiter, routes);
// unknown API endpoint → JSON 404 (not the HTML SPA)
app.use("/api", (_q, res) => res.status(404).json({ error: "Endpoint not found" }));

// serve the built frontend if it exists
if (fs.existsSync(env.clientDistPath)) {
  app.use(express.static(env.clientDistPath));
  // Express 5 (path-to-regexp v8): a bare "*" no longer works as a catch-all — a named
  // splat parameter is required ("/*name"). SPA fallback: anything that's not /api and not
  // a static file gets index.html (routing happens on the client, via React Router).
  //
  // `{ root: ... }` + a relative filename — NOT `sendFile(path.join(clientDistPath, "index.html"))`
  // with no root. Without `root`, the `send` package (Express's sendFile implementation) applies
  // its default `dotfiles: "ignore"` check to the ENTIRE absolute path, not just the part below
  // the served directory — if the app is deployed/checked out anywhere under a dot-prefixed
  // directory (e.g. a CI workspace, a `.deploy/` path, this project's own git-worktree-based
  // agent sandboxes under `.claude/worktrees/...`), that check silently 404s every single SPA
  // route, even though `index.html` plainly exists. Passing `root` makes the dotfiles check
  // (correctly) only look at the path *relative to* the served directory.
  app.get("/*splat", (_q, res) => res.sendFile("index.html", { root: env.clientDistPath }));
}

// single error handler — consistent {error, details} format
app.use(errorHandler);

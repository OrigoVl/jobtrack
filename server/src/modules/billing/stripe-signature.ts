// Verifies a Stripe webhook's Stripe-Signature header per Stripe's documented scheme
// (https://docs.stripe.com/webhooks#verify-manually) — hand-rolled (no `stripe` SDK, see
// billing.repo.ts's header comment on this module's overall no-SDK stance) since the scheme is
// ~25 lines of node:crypto against a stable, published spec. This is the single most
// security-sensitive function in the billing module: it is the ONLY authentication on
// POST /api/billing/webhook (stripe-webhook.ts). Pure/no I/O — fully unit-testable with
// HMACs computed in-test, no network, no real Stripe account needed.
import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SEC = 300;

/** Parses "t=1614556800,v1=abc...,v1=def..." (Stripe sends two v1 values during a signing-secret
 * rotation — accept if EITHER matches) into { t, v1s }. Returns null if `t` is missing/not a
 * number or there isn't at least one v1. */
function parseSignatureHeader(header: string): { t: number; v1s: string[] } | null {
  let t: number | null = null;
  const v1s: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) t = parsed;
    } else if (key === "v1" && value) {
      v1s.push(value);
    }
  }
  if (t === null || v1s.length === 0) return null;
  return { t, v1s };
}

/** Constant-time-ish hex comparison — timingSafeEqual THROWS on mismatched buffer lengths, so
 * that has to be checked first (an attacker-controlled signature of the wrong length must fail
 * closed, not crash the request). */
function hexEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * @param rawBody The EXACT bytes Stripe sent — must come from a raw-body-preserving middleware
 * (see app.ts's `express.raw()` mount for /api/billing/webhook), never from a re-serialized
 * `JSON.stringify(req.body)` (whitespace/unicode-escaping differences would make every
 * signature fail).
 * @param sigHeader The raw `Stripe-Signature` header value, or undefined if absent.
 * @param secret `STRIPE_WEBHOOK_SECRET`.
 * @param nowMs Injectable for tests; defaults to the real clock.
 * @param toleranceSec Replay-attack window — a signature timestamped further from `nowMs` than
 * this (in EITHER direction) is rejected even if the HMAC itself matches.
 */
export function verifyStripeSignature(
  rawBody: Buffer,
  sigHeader: string | undefined,
  secret: string,
  nowMs: number = Date.now(),
  toleranceSec: number = DEFAULT_TOLERANCE_SEC,
): boolean {
  if (!sigHeader) return false;
  const parsed = parseSignatureHeader(sigHeader);
  if (!parsed) return false;
  const { t, v1s } = parsed;

  if (Math.abs(nowMs / 1000 - t) > toleranceSec) return false;

  const expected = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${t}.`), rawBody]))
    .digest("hex");

  return v1s.some((v1) => hexEquals(v1, expected));
}

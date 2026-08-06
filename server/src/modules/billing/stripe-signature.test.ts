// The highest-value test in the billing module: verifyStripeSignature() is the ONLY
// authentication on POST /api/billing/webhook. Every HMAC here is computed in-test with a known
// secret — no network, no real Stripe account, no `stripe` SDK.
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-signature.js";

const SECRET = "whsec_test_secret";
const NOW_MS = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);

function sign(body: string, tSec: number, secret: string): string {
  const hmac = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${tSec}.`), Buffer.from(body)]))
    .digest("hex");
  return `t=${tSec},v1=${hmac}`;
}

describe("verifyStripeSignature()", () => {
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" }));

  it("accepts a validly signed payload within the tolerance window", () => {
    const header = sign(body.toString(), NOW_SEC, SECRET);
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(true);
  });

  it("rejects a tampered body (HMAC no longer matches)", () => {
    const header = sign(body.toString(), NOW_SEC, SECRET);
    const tampered = Buffer.from(JSON.stringify({ id: "evt_1", type: "customer.subscription.DELETED" }));
    expect(verifyStripeSignature(tampered, header, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const header = sign(body.toString(), NOW_SEC, "whsec_wrong_secret");
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a timestamp older than the tolerance window (replay of an old event)", () => {
    const oldSec = NOW_SEC - 600; // 10 minutes ago, tolerance is 300s
    const header = sign(body.toString(), oldSec, SECRET);
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a timestamp in the future beyond the tolerance window", () => {
    const futureSec = NOW_SEC + 600;
    const header = sign(body.toString(), futureSec, SECRET);
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(false);
  });

  it("accepts a timestamp exactly at the edge of the tolerance window", () => {
    const edgeSec = NOW_SEC - 300;
    const header = sign(body.toString(), edgeSec, SECRET);
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(true);
  });

  it("rejects when the header is missing entirely", () => {
    expect(verifyStripeSignature(body, undefined, SECRET, NOW_MS)).toBe(false);
  });

  it("rejects a garbage/malformed header", () => {
    expect(verifyStripeSignature(body, "not-a-valid-header", SECRET, NOW_MS)).toBe(false);
    expect(verifyStripeSignature(body, "t=abc,v1=", SECRET, NOW_MS)).toBe(false);
    expect(verifyStripeSignature(body, "v1=onlyv1nott", SECRET, NOW_MS)).toBe(false);
  });

  it("accepts when ONE of two v1 values matches (secret-rotation window: old + new secret both sent)", () => {
    const correctHmac = createHmac("sha256", SECRET)
      .update(Buffer.concat([Buffer.from(`${NOW_SEC}.`), body]))
      .digest("hex");
    const wrongHmac = createHmac("sha256", "some-other-secret")
      .update(Buffer.concat([Buffer.from(`${NOW_SEC}.`), body]))
      .digest("hex");
    const header = `t=${NOW_SEC},v1=${wrongHmac},v1=${correctHmac}`;
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(true);
  });

  it("returns false (does not throw) for a v1 of the wrong hex length", () => {
    const header = `t=${NOW_SEC},v1=abcd`;
    expect(() => verifyStripeSignature(body, header, SECRET, NOW_MS)).not.toThrow();
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(false);
  });

  it("returns false for a v1 containing non-hex characters", () => {
    const header = `t=${NOW_SEC},v1=not-valid-hex-at-all-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz`;
    expect(() => verifyStripeSignature(body, header, SECRET, NOW_MS)).not.toThrow();
    expect(verifyStripeSignature(body, header, SECRET, NOW_MS)).toBe(false);
  });
});

// The webhook handler is exported separately (not mounted on this router) because it needs the
// RAW request body — it's mounted directly in app.ts, before express.json() consumes the
// stream. See app.ts's comment at that mount point for exactly why.
import express, { type RequestHandler } from "express";
import { authed, asyncHandler } from "../../core/http.js";
import { parseCheckoutInput } from "../../shared/validation.js";
import { getBillingStateForUser, openBillingPortal, processStripeWebhook, startCheckout } from "./billing.service.js";

const r = express.Router();

r.get(
  "/billing/me",
  authed(async (userId, _req, res) => {
    res.json(await getBillingStateForUser(userId));
  }),
);

r.post(
  "/billing/checkout",
  authed(async (userId, req, res) => {
    const { plan } = parseCheckoutInput(req.body);
    res.json(await startCheckout(userId, plan));
  }),
);

r.post(
  "/billing/portal",
  authed(async (userId, _req, res) => {
    res.json(await openBillingPortal(userId));
  }),
);

export const stripeWebhookHandler: RequestHandler = asyncHandler(async (req, res) => {
  const sigHeader = req.header("stripe-signature");
  // `req.body` is a Buffer here — this route is mounted with express.raw() in app.ts, never
  // reaching the express.json() middleware that every other route relies on.
  const rawBody = req.body as Buffer;
  const { status } = await processStripeWebhook(rawBody, sigHeader);
  // No response body either way — a security-relevant check (the signature) must not leak an
  // oracle via a distinguishable success/failure payload.
  res.status(status).end();
});

export default r;

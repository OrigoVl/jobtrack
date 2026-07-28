// Sends auth emails (verification, password reset) via the Resend HTTP API directly — no SDK,
// consistent with this codebase's pattern of hand-rolled provider calls over a heavier client
// (see llm/client.ts). Gated behind RESEND_API_KEY, same graceful-offline-fallback shape as the
// LLM keys: without one, the email is logged instead of sent, so local dev/e2e need zero setup
// to exercise the full registration/verification/reset flow.
import { env } from "../config/env.js";
import { contextLogger } from "../core/logger.js";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  if (!env.email.isAvailable) {
    // Deliberately at "info" level, not "debug" — without a configured provider this IS the
    // delivery mechanism (the verification/reset link only exists here), so it must be visible
    // in default-level logs, not hidden behind a verbosity flag.
    contextLogger().info({ to, subject, html }, "Email provider not configured — logging instead of sending");
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.email.resendApiKey}` },
    body: JSON.stringify({ from: env.email.from, to, subject, html }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    // Never throw: a failed verification/reset email shouldn't 500 the registration/reset
    // request itself — the user can always ask for the link again once the provider issue is
    // fixed. Logged at error level so a real delivery problem in production doesn't go unnoticed.
    contextLogger().error({ status: r.status, body: body.slice(0, 500), to }, "Failed to send email via Resend");
  }
}

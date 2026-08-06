import { LegalPage } from "./legal-page";

/** Content adapted from PRIVACY.md at the repo root — includes the Stripe sub-processor row and
 * billing data collection now that a subscription/payment system exists (server/src/modules/
 * billing/). Everything else, including unfilled `[PLACEHOLDER]`s, is kept as-is per the source
 * draft. */
export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        <strong>Effective date:</strong> [EFFECTIVE DATE]
        <br />
        <strong>Last updated:</strong> [LAST UPDATED DATE]
      </p>
      <p>
        [PRODUCT NAME] ("we", "us", "the Service") is operated by [FULL LEGAL NAME OF ФОП/ENTITY], registered in Ukraine ([РНОКПП / ЄДРПОУ
        NUMBER]), [REGISTERED ADDRESS]. This Policy explains what data we collect, why, and what rights you have over it.
      </p>

      <h2>1. What we collect</h2>
      <p>
        <strong>Account data.</strong> Email, name, and password hash (or your Google account identifier, if you sign in with Google) — via
        our authentication provider (better-auth). We never see or store your Google password; Google handles that authentication directly.
      </p>
      <p>
        <strong>Content you create.</strong> Your profile (skills, target role), CV text, tracked job postings, companies and interview
        notes, CV Builder documents, and study/practice progress. This is the core content the Service exists to store and help you act on.
      </p>
      <p>
        <strong>AI processing metadata.</strong> Which AI feature you used, the model/provider, token counts, and an estimated cost — used
        for your own usage limits and our internal cost accounting. We do <strong>not</strong> store the AI provider's raw responses beyond
        what's needed to show you the result; see Section 3 for what's sent to the AI provider itself.
      </p>
      <p>
        <strong>Usage/product analytics.</strong> Which features you use and when (e.g. that you ran a job search), aggregated for product
        improvement. We do not sell this data or use it for advertising — we don't run ads.
      </p>
      <p>
        <strong>Technical/error data.</strong> IP address (for rate-limiting and abuse prevention), request logs, and error reports (via
        Sentry) — the latter with secrets (passwords, tokens, cookies, authorization headers) automatically redacted before being sent.
      </p>
      <p>
        <strong>Subscription/billing data.</strong> If you subscribe to a paid plan: your plan, subscription status, and renewal date, plus
        the Stripe customer/subscription identifiers needed to manage your subscription.{" "}
        <strong>We never see or store your card number or other payment details</strong> — Stripe collects and processes those directly; we
        only receive the identifiers above and status updates (e.g. "payment succeeded," "subscription renewed").
      </p>

      <h2>2. Why we collect it (legal basis, for EU/UK users)</h2>
      <ul>
        <li>
          <strong>Contract necessity</strong> — account data, your content, and payment status: we can't provide the Service without them.
        </li>
        <li>
          <strong>Legitimate interest</strong> — technical/error data, rate-limiting, abuse prevention.
        </li>
        <li>
          <strong>Consent</strong> — nothing beyond the above currently requires separate consent; if that changes (e.g. marketing emails),
          we'll ask explicitly and let you opt out at any time.
        </li>
      </ul>

      <h2>3. Who we share it with (sub-processors)</h2>
      <ul>
        <li>
          <strong>[OpenAI / Anthropic — whichever is configured]</strong> — receives the text you submit to an AI feature (CV text, job
          posting text, your prompt) to generate the AI response you requested (CV review, cover letter, mock interview scoring, etc.).
        </li>
        <li>
          <strong>Stripe</strong> — receives your email address, and (directly from you, never through us) your payment details, if you
          subscribe to a paid plan, to process payments and manage your subscription. Stripe is PCI-compliant; we never see your card
          details.
        </li>
        <li>
          <strong>Resend</strong> — receives your email address, to send verification, password-reset, account-deletion-confirmation, and
          digest emails.
        </li>
        <li>
          <strong>Sentry</strong> — receives error reports (secrets redacted), to diagnose bugs/crashes.
        </li>
        <li>
          <strong>[Railway / hosting provider]</strong> — hosts the database and application (everything, since it's the infrastructure your
          data lives on).
        </li>
      </ul>
      <p>
        We do not sell your data to anyone, for any reason. If you have an AI feature turned off (no provider configured), no content ever
        leaves our servers for AI processing.
      </p>
      <p>
        <strong>International transfers.</strong> If you're in the EU/UK, your CV/job-posting text may be processed by an AI provider based
        in the US when you use an AI feature. [We rely on Standard Contractual Clauses / the provider's own data processing agreement —
        CONFIRM WITH ACTUAL DPA ON FILE].
      </p>

      <h2>4. How long we keep it</h2>
      <p>
        Your content stays until you delete it or delete your account. Account deletion is immediate and permanent (see Section 5) — it
        cascades to every table: profile, vacancies, companies, CV documents, study progress, subscription/billing status, and usage
        history. If you have an active paid subscription, deleting your account also cancels it immediately with Stripe (see the Terms of
        Service) — Stripe retains its own transaction records per its own retention policy and applicable financial-recordkeeping law,
        independent of this deletion. We don't keep a "soft-deleted" copy afterward.
      </p>
      <p>
        Error logs and usage/product analytics are retained for [90 / 180 days — CONFIRM RETENTION POLICY] for debugging and
        product-improvement purposes, then aggregated or discarded.
      </p>

      <h2>5. Your rights</h2>
      <ul>
        <li>
          <strong>Export.</strong> Download a full copy of your own data (profile, vacancies, companies, contacts, study progress) as JSON
          at any time from the Account page.
        </li>
        <li>
          <strong>Deletion.</strong> Permanently delete your account and everything in it, at any time, from the Account page — a
          confirmation email prevents accidental/malicious deletion, but once confirmed it cannot be undone.
        </li>
        <li>
          <strong>Correction.</strong> Edit your profile/content directly in the app at any time.
        </li>
        <li>
          <strong>EU/UK users (GDPR)</strong> additionally have the right to restrict processing, object to processing, and lodge a
          complaint with your local data protection authority.
        </li>
        <li>
          <strong>California users (CCPA/CPRA):</strong> we do not sell personal information; you may request deletion or a copy of your
          data using the tools above, or by contacting us.
        </li>
      </ul>
      <p>To exercise any right not directly available in the app, contact [SUPPORT EMAIL].</p>

      <h2>6. Cookies</h2>
      <p>
        We use only an essential session cookie (to keep you signed in) and no third-party advertising or tracking cookies. We don't run
        analytics scripts that track you across other websites.
      </p>

      <h2>7. Children's privacy</h2>
      <p>
        The Service is not directed at children under 16. We do not knowingly collect data from anyone under 16; if you believe a child has
        created an account, contact us and we'll delete it.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>We'll update the "Last updated" date above and, for material changes, notify you by email before they take effect.</p>

      <h2>9. Contact</h2>
      <p>Questions about this policy or your data: [SUPPORT EMAIL], or by post at [REGISTERED ADDRESS].</p>
    </LegalPage>
  );
}

# Privacy Policy — DRAFT (not published, not legal advice)

> **Status: internal draft, now live at `/privacy`** (linked from the footer). Placeholders are
> marked `[LIKE THIS]` and shown as-is on the page — it is a solid, standard-practice starting
> point, not a substitute for a real lawyer's review, which is still needed before this is
> presented as final to a real user. The payment-processor sub-processor (Stripe) and
> subscription-status data below are restored now that billing actually ships
> (server/src/modules/billing/) — they were previously removed here and from the live page while
> no payment system existed.

**Effective date:** [EFFECTIVE DATE]
**Last updated:** [LAST UPDATED DATE]

[PRODUCT NAME] ("we", "us", "the Service") is operated by [FULL LEGAL NAME OF ФОП/ENTITY],
registered in Ukraine ([РНОКПП / ЄДРПОУ NUMBER]), [REGISTERED ADDRESS]. This Policy explains what
data we collect, why, and what rights you have over it.

## 1. What we collect

**Account data.** Email, name, and password hash (or your Google account identifier, if you sign
in with Google) — via our authentication provider (better-auth). We never see or store your
Google password; Google handles that authentication directly.

**Content you create.** Your profile (skills, target role), CV text, tracked job postings,
companies and interview notes, CV Builder documents, and study/practice progress. This is the
core content the Service exists to store and help you act on.

**AI processing metadata.** Which AI feature you used, the model/provider, token counts, and an
estimated cost — used for your own usage limits (see Section 5) and our internal cost accounting.
We do **not** store the AI provider's raw responses beyond what's needed to show you the result;
see Section 3 for what's sent to the AI provider itself.

**Subscription/billing data.** If you subscribe to a paid plan: your plan, subscription status,
and renewal date, plus the Stripe customer/subscription identifiers needed to manage your
subscription. **We never see or store your card number or other payment details** — Stripe
collects and processes those directly; we only receive the identifiers above and status updates
(e.g. "payment succeeded," "subscription renewed").

**Usage/product analytics.** Which features you use and when (e.g. that you ran a job search),
aggregated for product improvement. We do not sell this data or use it for advertising — we don't
run ads.

**Technical/error data.** IP address (for rate-limiting and abuse prevention), request logs, and
error reports (via Sentry) — the latter with secrets (passwords, tokens, cookies, authorization
headers) automatically redacted before being sent.

## 2. Why we collect it (legal basis, for EU/UK users)

- **Contract necessity** — account data, your content, and payment status: we can't provide the
  Service without them.
- **Legitimate interest** — technical/error data, rate-limiting, abuse prevention.
- **Consent** — nothing beyond the above currently requires separate consent; if that changes
  (e.g. marketing emails), we'll ask explicitly and let you opt out at any time.

## 3. Who we share it with (sub-processors)

| Who | What they receive | Why |
|---|---|---|
| **[OpenAI / Anthropic — whichever is configured]** | The text you submit to an AI feature (CV text, job posting text, your prompt) | To generate the AI response you requested (CV review, cover letter, mock interview scoring, etc.) |
| **Stripe** | Your email address, and (directly from you, never through us) your payment details, if you subscribe to a paid plan | Processing payments and managing your subscription — Stripe is PCI-compliant; we never see your card details |
| **Resend** | Your email address | Sending verification, password-reset, and account-deletion-confirmation emails |
| **Sentry** | Error reports (secrets redacted) | Diagnosing bugs/crashes |
| **[Railway / hosting provider]** | Everything (it's the infrastructure your data lives on) | Hosting the database and application |

We do not sell your data to anyone, for any reason. If you have an AI feature turned off (no
provider configured), no content ever leaves our servers for AI processing.

**International transfers.** If you're in the EU/UK, your CV/job-posting text may be processed by
an AI provider based in the US when you use an AI feature. [We rely on Standard Contractual
Clauses / the provider's own data processing agreement — CONFIRM WITH ACTUAL DPA ON FILE].

## 4. How long we keep it

Your content stays until you delete it or delete your account. Account deletion is immediate and
permanent (see Section 5) — it cascades to every table: profile, vacancies, companies, CV
documents, study progress, subscription/billing status, and usage history. If you have an active
paid subscription, deleting your account also cancels it immediately with Stripe (see the Terms
of Service, Section 7) — Stripe retains its own transaction records per its own retention policy
and applicable financial-recordkeeping law, independent of this deletion. We don't keep a
"soft-deleted" copy afterward.

Error logs and usage/product analytics are retained for [90 / 180 days — CONFIRM RETENTION
POLICY] for debugging and product-improvement purposes, then aggregated or discarded.

## 5. Your rights

- **Export.** Download a full copy of your own data (profile, vacancies, companies, contacts,
  study progress) as JSON at any time from the Account page.
- **Deletion.** Permanently delete your account and everything in it, at any time, from the
  Account page — a confirmation email prevents accidental/malicious deletion, but once confirmed
  it cannot be undone.
- **Correction.** Edit your profile/content directly in the app at any time.
- **EU/UK users (GDPR)** additionally have the right to restrict processing, object to
  processing, and lodge a complaint with your local data protection authority.
- **California users (CCPA/CPRA)**: we do not sell personal information; you may request
  deletion or a copy of your data using the tools above, or by contacting us.

To exercise any right not directly available in the app, contact **[SUPPORT EMAIL]**.

## 6. Cookies

We use only an essential session cookie (to keep you signed in) and no third-party advertising or
tracking cookies. We don't run analytics scripts that track you across other websites.

## 7. Children's privacy

The Service is not directed at children under 16. We do not knowingly collect data from anyone
under 16; if you believe a child has created an account, contact us and we'll delete it.

## 8. Changes to this policy

We'll update the "Last updated" date above and, for material changes, notify you by email before
they take effect.

## 9. Contact

Questions about this policy or your data: **[SUPPORT EMAIL]**, or by post at [REGISTERED ADDRESS].

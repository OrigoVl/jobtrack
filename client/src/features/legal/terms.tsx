import { LegalPage } from "./legal-page";

/** Content adapted from TERMS.md at the repo root — Section 4 ("Subscriptions and billing")
 * describes the Free/Pro plans and Stripe as payment processor, restored now that billing
 * actually ships (server/src/modules/billing/). Everything else, including unfilled
 * `[PLACEHOLDER]`s, is kept as-is per the source draft. */
export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        <strong>Effective date:</strong> [EFFECTIVE DATE]
        <br />
        <strong>Last updated:</strong> [LAST UPDATED DATE]
      </p>
      <p>
        These Terms govern your use of [PRODUCT NAME] (the "Service"), operated by [FULL LEGAL NAME OF ФОП/ENTITY], registered in Ukraine
        ([РНОКПП / ЄДРПОУ NUMBER]), [REGISTERED ADDRESS] ("we", "us"). By creating an account, you agree to these Terms and to our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 16 years old to use the Service. By registering, you confirm you meet this requirement and that the information
        you provide is accurate.
      </p>

      <h2>2. Your account</h2>
      <p>
        You're responsible for keeping your password secure and for all activity under your account. Tell us immediately ([SUPPORT EMAIL])
        if you suspect unauthorized access. We may suspend or terminate accounts that violate Section 5 (Acceptable Use) or that we
        reasonably believe are fraudulent.
      </p>

      <h2>3. The Service, and its AI features specifically</h2>
      <p>
        The Service provides job-search tracking, CV tools, market-demand analysis, and — when an AI provider is configured — AI-assisted
        features (CV review, cover-letter drafting, mock-interview scoring, and similar). The core Service is free; some AI features are
        limited on the free plan and unlimited (subject to fair use) on the paid plan — see Section 4.
      </p>
      <p>
        <strong>AI output is a starting point, not a guarantee.</strong> AI-generated text can be inaccurate, generic, or occasionally wrong
        about facts in your own CV/experience. You are solely responsible for reviewing, editing, and verifying anything AI-generated before
        sending it to a real employer, recruiter, or anyone else. We do not guarantee that using AI features will improve your job-search
        outcomes.
      </p>
      <p>
        <strong>Offline/degraded mode.</strong> If no AI provider is configured (by us) or the AI provider is temporarily unavailable, AI
        features fall back to a simpler, non-AI heuristic and are clearly marked as such — the rest of the Service continues to work
        normally.
      </p>

      <h2>4. Subscriptions and billing</h2>
      <p>
        The Service offers a free plan ("Free") and a paid plan ("Pro"); current features and pricing are shown on the{" "}
        <a href="/pricing">Pricing page</a>. Pro is billed monthly, in advance, through <strong>Stripe</strong>, our payment processor — we
        never see or store your card details; Stripe handles that directly and is PCI-compliant on our behalf. Your subscription{" "}
        <strong>renews automatically</strong> each month until you cancel.
      </p>
      <p>
        <strong>Canceling.</strong> Cancel anytime from the Account page ("Manage billing," which opens Stripe's Billing Portal). Canceling
        stops future renewals; you keep Pro access until the end of the period you've already paid for. We don't offer partial refunds for
        unused time within a billing period, except where required by applicable law.
      </p>
      <p>
        <strong>Fair use.</strong> Each plan's AI features are subject to a monthly usage allowance (Free) or a fair-use spending ceiling
        (Pro), described on the Pricing page — a safeguard against abuse, not a way to advertise a lower quality of service than what
        typical use actually gets.
      </p>
      <p>
        <strong>Price changes.</strong> If we change the price of a plan you're subscribed to, we'll notify you by email before it takes
        effect on your next renewal, with a chance to cancel first.
      </p>

      <h2>5. Your content</h2>
      <p>
        You own everything you create in the Service — your CV, notes, tracked vacancies, everything. You grant us a limited license to
        store, process, and display that content <strong>solely to provide the Service to you</strong> (including sending it to an AI
        provider when you trigger an AI feature). We claim no ownership over your content and don't use it to train any model.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        Don't: use the Service to store or generate unlawful, harassing, or infringing content; attempt to scrape, reverse-engineer, or
        overload the Service beyond normal personal use; share your account with others; use automated tools against the Service outside of
        its documented API/UI; or resell access to the Service.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may delete your account at any time (Account page) — this is immediate, permanent, and removes all of your data (see the{" "}
        <a href="/privacy">Privacy Policy</a>). <strong>Deleting your account also immediately cancels any active Pro subscription</strong>{" "}
        — there is no partial-period access to preserve once the account itself is gone. We may suspend or terminate your account for a
        violation of Section 6, with notice where reasonably possible, except where immediate action is needed to protect the Service or
        other users.
      </p>

      <h2>8. Disclaimers and limitation of liability</h2>
      <p>
        The Service is provided "as is," without warranties of any kind, to the maximum extent permitted by law. We are not liable for
        indirect, incidental, or consequential damages (including lost job opportunities, lost income, or reliance on AI-generated content)
        arising from your use of the Service, to the maximum extent permitted by law.
      </p>
      <p>
        Nothing in this section limits liability that cannot be limited under applicable law (e.g. liability for our own gross negligence or
        willful misconduct, under Ukrainian consumer-protection law where applicable).
      </p>

      <h2>9. Changes to these Terms</h2>
      <p>
        We'll update the "Last updated" date above and notify you by email before material changes take effect, with a chance to cancel
        before the new Terms apply to you.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of Ukraine, without regard to conflict-of-law principles. [CONFIRM DISPUTE-RESOLUTION MECHANISM
        — e.g. courts of Ukraine, or arbitration, per your lawyer's recommendation once you have users in multiple countries.]
      </p>

      <h2>11. Contact</h2>
      <p>[SUPPORT EMAIL], or by post at [REGISTERED ADDRESS].</p>
    </LegalPage>
  );
}

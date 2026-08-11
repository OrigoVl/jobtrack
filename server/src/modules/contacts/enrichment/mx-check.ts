// Asks DNS whether a domain accepts mail at all. This is a VERIFICATION step, not a discovery one:
// it never proposes an address, it only flags one already extracted from a posting as pointing at
// a domain that can't receive mail — a typo'd or long-dead domain, caught before the user writes
// to it.
//
// Deliberately stops at the domain. Probing a specific mailbox means an SMTP `RCPT TO` handshake,
// which (a) tells you little — a large share of providers answer catch-all, so "accepted" doesn't
// mean the mailbox exists — and (b) is what bulk address-verification services do, so the outbound
// IP earns a reputation for it and the app's own transactional mail starts landing in spam. The
// cheap, honest half of the check is worth having; the expensive, misleading half is not.
import dns from "node:dns/promises";
import { contextLogger } from "../../../core/logger.js";

/** "unknown" is the answer whenever DNS itself was the problem (timeout, resolver failure) — it is
 * NOT the same as "no", and the UI must not warn on it: a flaky lookup should never cast doubt on
 * an address a posting actually stated. */
export type MailDomainStatus = "accepts-mail" | "no-mail" | "unknown";

const LOOKUP_TIMEOUT_MS = 3000;

/** "" for anything that isn't an address with a real domain. Callers hand this mixed lists — a
 * posting yields Telegram handles alongside emails, and "@handle" also contains an "@" — so
 * requiring both a local part and a dotted domain is what stops a handle being looked up as a host. */
function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "";
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain.includes(".") ? domain : "";
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * One domain, one MX lookup. Falls back to an A/AAAA record when there is no MX: a domain with an
 * address record but no MX is still a legal mail destination under RFC 5321 (the implicit MX rule),
 * and small company domains genuinely rely on that — treating them as "no mail" would warn about
 * perfectly good addresses.
 */
export async function checkMailDomain(domain: string): Promise<MailDomainStatus> {
  const host = String(domain ?? "")
    .trim()
    .toLowerCase();
  if (!host || !host.includes(".")) return "unknown";
  try {
    const mx = await withTimeout(dns.resolveMx(host), LOOKUP_TIMEOUT_MS);
    if (mx === null) return "unknown"; // timed out
    if (mx.length > 0) return "accepts-mail";
  } catch (err) {
    // ENOTFOUND/ENODATA are real answers ("this domain has no MX"), anything else is a resolver
    // problem and must stay "unknown" — see the type comment above.
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOTFOUND" && code !== "ENODATA") {
      contextLogger().debug({ host, code }, "MX lookup failed for a reason other than 'no such record'");
      return "unknown";
    }
    if (code === "ENOTFOUND") return "no-mail";
  }
  try {
    const a = await withTimeout(dns.lookup(host), LOOKUP_TIMEOUT_MS);
    return a === null ? "unknown" : "accepts-mail";
  } catch {
    return "no-mail";
  }
}

/** Checks every distinct domain among the given addresses, once each, in parallel. Returns a map
 * keyed by lowercase domain; an address whose domain isn't in the map was never checked. */
export async function checkMailDomains(emails: string[]): Promise<Map<string, MailDomainStatus>> {
  const domains = [...new Set(emails.map(domainOf).filter(Boolean))];
  const results = await Promise.all(domains.map(async (d) => [d, await checkMailDomain(d)] as const));
  return new Map(results);
}

export { domainOf as mailDomainOf };

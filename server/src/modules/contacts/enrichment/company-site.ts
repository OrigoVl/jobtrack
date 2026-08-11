// Reads the contact addresses a company publishes on its OWN site — the careers/team/contact
// pages it puts up precisely so people can get in touch. Same "exact, never guessed" rule as
// posting-contacts.ts: every address returned was literally on the page.
//
// This is the one part of contact discovery where the server goes out and fetches something, so
// the safety work is the bulk of the file rather than an afterthought:
//
// - SSRF. Every URL — including each redirect hop — goes through assertSafeVacancyUrl(), which
//   rejects non-https, localhost/internal hostnames and private/reserved IPs. Redirects are
//   followed MANUALLY (`redirect: "manual"`) for exactly this reason: with the default
//   "follow", a public host answering 302 → http://169.254.169.254/ would be fetched by undici
//   without the guard ever seeing that address.
// - Response size. Bodies are read through a stream and abandoned past MAX_BYTES, so a site that
//   streams an endless response can't exhaust memory.
// - Volume. At most MAX_PAGES well-known paths per company, each with its own timeout — this
//   visits a handful of pages a person could open by hand, and is not a crawler that follows
//   links.
// - robots.txt is fetched first and honored. Not a legal requirement, but this is an automated
//   client reading someone else's site: if they've asked automation to stay out of a path, we do.
import { assertSafeVacancyUrl } from "../../../shared/validation.js";
import { contextLogger } from "../../../core/logger.js";

/** Pages a company puts its hiring/contact details on, most specific first. */
const CANDIDATE_PATHS = ["/careers", "/jobs", "/contact", "/contacts", "/team", "/about"];
const MAX_PAGES = 6;
const MAX_BYTES = 512 * 1024;
const PAGE_TIMEOUT_MS = 8000;
const ROBOTS_TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; ZoryaContactFinder/1.0)";

export interface SiteContact {
  email: string;
  /** Path the address was found on, for attribution in the UI ("/careers"). */
  page: string;
}

export interface SiteContactsResult {
  contacts: SiteContact[];
  /** Paths actually fetched — excludes anything robots.txt disallowed or that failed. */
  pagesRead: string[];
  /** True when robots.txt told us to stay out of every candidate path. */
  blockedByRobots: boolean;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Addresses that belong to the site's tooling rather than its people. Left out because a user
// mailing them reaches nobody: they're template leftovers, image assets, or tracking pixels.
const NOISE_LOCAL_PARTS = new Set(["example", "email", "your", "name", "user", "sentry", "noreply", "no-reply", "donotreply"]);
const NOISE_DOMAINS = ["sentry.io", "example.com", "example.org", "domain.com", "wixpress.com"];

function isNoise(email: string): boolean {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  if (NOISE_LOCAL_PARTS.has(local)) return true;
  if (NOISE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  // "@2x.png", "@font-face" and friends: an address whose domain ends in an asset extension.
  return /\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(domain);
}

/** One group of a robots.txt file: the Allow/Disallow paths that apply to a user-agent. */
interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/**
 * Minimal robots.txt reader: the rules for `*` (this client never claims its own group). Path
 * matching below follows the usual longest-match-wins convention, so an `Allow: /careers` under a
 * blanket `Disallow: /` is honored the way the site intended.
 */
export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let inStarGroup = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]!.trim();
    if (!line) continue;
    const [rawField, ...rest] = line.split(":");
    const field = rawField!.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (field === "user-agent") {
      inStarGroup = value === "*";
      continue;
    }
    if (!inStarGroup) continue;
    // An empty Disallow means "nothing is disallowed" — it must not be read as a "/" prefix that
    // matches every path.
    if (field === "disallow" && value) rules.disallow.push(value);
    if (field === "allow" && value) rules.allow.push(value);
  }
  return rules;
}

export function isPathAllowed(path: string, rules: RobotsRules): boolean {
  const longestMatch = (patterns: string[]) =>
    patterns.filter((p) => path.startsWith(p)).reduce((best, p) => (p.length > best ? p.length : best), 0);
  const disallowed = longestMatch(rules.disallow);
  if (disallowed === 0) return true;
  return longestMatch(rules.allow) >= disallowed;
}

/** Fetches with a byte cap and manual, re-validated redirects. Returns "" on any failure — a site
 * being down or hostile is an ordinary outcome here, not an error worth failing the request over. */
async function fetchTextCapped(url: string, timeoutMs: number): Promise<string> {
  let current: string;
  try {
    current = assertSafeVacancyUrl(url);
  } catch {
    return "";
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain" },
        redirect: "manual",
        signal: ac.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return "";
        // Re-validated on every hop — this is the whole point of following redirects by hand.
        try {
          current = assertSafeVacancyUrl(new URL(location, current).toString());
        } catch {
          return "";
        }
        continue;
      }
      if (!res.ok || !res.body) return "";

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
    }
  }
  return "";
}

/** Every distinct, non-noise address in a page's HTML. `mailto:` links first — an address written
 * as a link is deliberately published, which plain text in the body isn't always. */
export function emailsInHtml(html: string): string[] {
  const fromLinks = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]!));
  const fromText = [...html.matchAll(EMAIL_RE)].map((m) => m[0]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of [...fromLinks, ...fromText]) {
    const clean = email.trim().replace(/[.,;]+$/, "");
    const key = clean.toLowerCase();
    if (!clean || seen.has(key) || isNoise(clean)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/**
 * Looks for published addresses on a company's own site. `website` is whatever the company row
 * holds — a bare host or a full URL; anything that isn't resolvable to an https origin yields an
 * empty result rather than an error.
 */
export async function findContactsOnSite(website: string): Promise<SiteContactsResult> {
  const empty: SiteContactsResult = { contacts: [], pagesRead: [], blockedByRobots: false };
  const host = String(website ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  if (!host || !host.includes(".")) return empty;
  const origin = `https://${host}`;

  const robotsText = await fetchTextCapped(`${origin}/robots.txt`, ROBOTS_TIMEOUT_MS);
  const rules = parseRobots(robotsText);
  const allowedPaths = CANDIDATE_PATHS.filter((p) => isPathAllowed(p, rules)).slice(0, MAX_PAGES);
  if (allowedPaths.length === 0) return { ...empty, blockedByRobots: true };

  // Sequential, not Promise.all: this is someone else's site, and a handful of polite serial
  // requests is the difference between reading a few pages and hammering a small host.
  const contacts: SiteContact[] = [];
  const pagesRead: string[] = [];
  const seen = new Set<string>();
  for (const path of allowedPaths) {
    const html = await fetchTextCapped(`${origin}${path}`, PAGE_TIMEOUT_MS);
    if (!html) continue;
    pagesRead.push(path);
    for (const email of emailsInHtml(html)) {
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({ email, page: path });
    }
  }
  contextLogger().debug({ host, pagesRead: pagesRead.length, found: contacts.length }, "Company site contact scan finished");
  return { contacts, pagesRead, blockedByRobots: false };
}

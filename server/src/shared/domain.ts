// Normalizes an arbitrary "where does this company live on the web" input (a full URL, a bare
// host, or an email address) down to a bare domain — the shape modules/contacts/enrichment/ uses
// as its provider/cache key (companies.website, EnrichmentQuery.domain). Deliberately lenient and
// NEVER throws: every call site treats "" as "unusable/unknown" rather than an error.
const MAX_DOMAIN_LENGTH = 253;
const VALID_DOMAIN_CHARS_RE = /^[a-z0-9.-]+$/;

export function toDomain(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";

  // An email address ("hr@acme.com") — keep only the host after the last "@".
  const atIdx = s.lastIndexOf("@");
  if (atIdx >= 0) s = s.slice(atIdx + 1);

  // Strip a URL scheme ("https://", "http://", or any other "scheme://" prefix).
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  // Strip a leading "www.".
  s = s.replace(/^www\./i, "");
  // Strip path/query/hash — everything from the first "/", "?" or "#" onward.
  const cut = s.search(/[/?#]/);
  if (cut >= 0) s = s.slice(0, cut);
  // Drop a trailing port ("acme.com:8080").
  s = s.replace(/:\d+$/, "");

  s = s.toLowerCase();
  if (!s || s.length > MAX_DOMAIN_LENGTH) return "";
  if (!VALID_DOMAIN_CHARS_RE.test(s)) return "";
  if (!s.includes(".")) return "";
  if (s.startsWith(".") || s.endsWith(".") || s.startsWith("-") || s.endsWith("-")) return "";

  return s;
}

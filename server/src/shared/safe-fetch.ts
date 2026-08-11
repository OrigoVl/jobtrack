// The one place this app fetches a URL that a user influenced. Every such call needs the same
// three controls, and the reason they live together is that they had already drifted apart once:
// the company-site scanner grew manual redirect handling while fetchVacancyText kept the default,
// which meant the same SSRF guard protected one caller and not the other.
//
// 1. SSRF, on EVERY hop. `redirect: "manual"` is load-bearing. assertSafeVacancyUrl() rejects
//    non-https, localhost/internal hostnames and private/reserved IPs — but with the default
//    `redirect: "follow"` it only ever inspects the FIRST url. A public host answering
//    302 → http://169.254.169.254/ is then fetched by undici with the guard none the wiser, and
//    the response body (cloud instance credentials, typically) comes back to the caller. Following
//    hops by hand is what lets the guard see each one.
// 2. A byte cap. Bodies stream in and are abandoned past `maxBytes`, so a host that answers with
//    an endless response can't exhaust memory.
// 3. A timeout, applied per hop.
import { assertSafeVacancyUrl } from "./validation.js";

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  accept?: string;
}

export interface SafeFetchResult {
  /** The body, or "" when the request didn't complete with a 2xx. */
  text: string;
  /** Final HTTP status, or 0 when no response was produced at all — a blocked url, a network
   * failure, or a redirect chain that ran too long. Callers that need to distinguish "the site
   * said no" from "we never reached it" have it here. */
  status: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/**
 * Fetches text from a user-influenced URL with the controls above. Never throws for an ordinary
 * remote failure — a site being down, hostile or redirecting somewhere it shouldn't is a normal
 * outcome here, and each caller decides what that means for its own response.
 */
export async function fetchTextSafely(url: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    userAgent = "Mozilla/5.0 (Zorya)",
    accept = "text/html,text/plain",
  } = options;

  let current: string;
  try {
    current = assertSafeVacancyUrl(url);
  } catch {
    return { text: "", status: 0 };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        headers: { "user-agent": userAgent, accept },
        redirect: "manual",
        signal: ac.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { text: "", status: res.status };
        try {
          // Resolved against the CURRENT url so a relative Location works, then re-checked — this
          // is the whole reason redirects are followed by hand.
          current = assertSafeVacancyUrl(new URL(location, current).toString());
        } catch {
          return { text: "", status: 0 };
        }
        continue;
      }

      if (!res.ok || !res.body) return { text: "", status: res.status };
      return { text: await readCapped(res.body, maxBytes), status: res.status };
    } catch {
      return { text: "", status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
  return { text: "", status: 0 };
}

async function readCapped(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  // Non-fatal: a body cut off mid-character at the cap must yield the text we did get, not throw.
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

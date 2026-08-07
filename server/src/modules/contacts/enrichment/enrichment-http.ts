// Private HTTP helper for contact-enrichment provider calls — sibling of (not shared with)
// modules/jobs/job-search.service.ts's fetchJson/fetchRemote: same AbortController + 8s timeout +
// never-throw contract, but tuned for AUTHED third-party APIs (method/body/headers to send, not
// just a bare GET) and stricter about what gets logged — these requests routinely carry an API
// key (Hunter's travels as a query param) and the response bodies carry real people's personal
// data (recruiter names/emails), neither of which belongs in application logs. So, unlike
// job-search.service.ts's fetchJson (which logs the plain, public, keyless aggregator URL), this
// NEVER logs the URL or the response body — only `{ provider, status }`.
import { contextLogger } from "../../../core/logger.js";

export interface AuthedFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export async function fetchJsonAuthed<T = unknown>(
  provider: string,
  url: string,
  init: AuthedFetchInit = {},
  ms = 8000,
): Promise<T | null> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...init.headers },
      body: init.body,
      signal: ac.signal,
    });
    if (!res.ok) {
      contextLogger().warn({ provider, status: res.status }, "Contact-enrichment provider responded with non-2xx status");
      return null;
    }
    return (await res.json().catch((e: unknown) => {
      contextLogger().warn(
        { provider, err: e instanceof Error ? e.message : String(e) },
        "Contact-enrichment provider returned a 2xx response with invalid JSON",
      );
      return null;
    })) as T | null;
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    contextLogger().warn(
      { provider },
      timedOut ? "Contact-enrichment provider request timed out" : "Contact-enrichment provider request failed",
    );
    return null;
  } finally {
    clearTimeout(to);
  }
}

// Job search across external aggregators (Remotive, Arbeitnow, DOU, RemoteOK, Djinni, Jobicy,
// WeWorkRemotely) — no API keys needed.
import { contextLogger } from "../../core/logger.js";
import { normalizeTags } from "../../shared/tag-format.js";
import { extractTechs } from "../../shared/tech-dict.js";

export interface RawJob {
  company: string;
  position: string;
  url: string;
  location: string;
  tags: string[];
  source: string;
  /** ISO instant, or null when the source didn't provide a usable posting date — lets the client
   * offer "sort by newest" alongside the default relevance ranking (job-ranking.ts). */
  postedAt: string | null;
}

/** Every source expresses "when posted" differently (an ISO string with/without offset, a plain
 * RFC 2822 date string, or a Unix epoch in SECONDS) — this normalizes any of them to one ISO
 * instant, or null if missing/unparseable. A bare number is assumed to be epoch seconds (as
 * Arbeitnow's `created_at` is) since Date.parse() has no numeric-input form of its own. */
function toIsoOrNull(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchRemote(url: string, ms = 8000): Promise<Response | null> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Zorya)" }, signal: ac.signal });
    // Used to silently return null on any non-2xx response — if an aggregator (Remotive/
    // Arbeitnow/DOU) changes its schema, starts blocking, or goes down, /jobs/search would
    // just silently return fewer results (or offline:true), with NO log to dig into.
    if (!res.ok) {
      contextLogger().warn({ url, status: res.status }, "Job aggregator responded with non-2xx status");
      return null;
    }
    return res;
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    contextLogger().warn({ url, err: e }, timedOut ? "Job aggregator request timed out" : "Job aggregator request failed");
    return null;
  } finally {
    clearTimeout(to);
  }
}
async function fetchJson<T = unknown>(url: string, ms = 8000): Promise<T | null> {
  const res = await fetchRemote(url, ms);
  if (!res) return null;
  return (await res.json().catch((e: unknown) => {
    contextLogger().warn({ url, err: e }, "Job aggregator returned a 2xx response with invalid JSON");
    return null;
  })) as T | null;
}
async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const res = await fetchRemote(url, ms);
  if (!res) return null;
  return res.text().catch((e: unknown) => {
    contextLogger().warn({ url, err: e }, "Job aggregator response body could not be read as text");
    return null;
  });
}

interface RemotiveJob {
  company_name?: string;
  title?: string;
  url?: string;
  candidate_required_location?: string;
  tags?: unknown[];
  publication_date?: string;
}
interface RemotiveResponse {
  jobs?: RemotiveJob[];
}

export async function fetchRemotive(query: string): Promise<RawJob[]> {
  const url = `https://remotive.com/api/remote-jobs?limit=100${query ? `&search=${encodeURIComponent(query)}` : ""}`;
  const d = await fetchJson<RemotiveResponse>(url);
  return (d?.jobs || []).slice(0, 100).map((j) => ({
    company: j.company_name || "—",
    position: j.title || "—",
    url: j.url || "",
    location: j.candidate_required_location || "Remote",
    tags: Array.isArray(j.tags) ? normalizeTags((j.tags as string[]).slice(0, 10)) : [],
    source: "Remotive",
    postedAt: toIsoOrNull(j.publication_date),
  }));
}

interface ArbeitnowJob {
  company_name?: string;
  title?: string;
  url?: string;
  location?: string;
  remote?: boolean;
  tags?: unknown[];
  created_at?: number;
}
interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
}

export async function fetchArbeitnow(query: string): Promise<RawJob[]> {
  const pages = await Promise.all(
    [1, 2, 3].map((p) => fetchJson<ArbeitnowResponse>(`https://www.arbeitnow.com/api/job-board-api?page=${p}`)),
  );
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return pages
    .flatMap((d) => d?.data || [])
    .map((j) => ({
      company: j.company_name || "—",
      position: j.title || "—",
      url: j.url || "",
      location: j.location || (j.remote ? "Remote" : "—"),
      tags: Array.isArray(j.tags) ? normalizeTags((j.tags as string[]).slice(0, 10)) : [],
      source: "Arbeitnow",
      // Arbeitnow's own `created_at` is Unix epoch SECONDS, not milliseconds.
      postedAt: toIsoOrNull(j.created_at),
    }))
    .filter(
      (j) =>
        !terms.length ||
        terms.some((t) => j.position.toLowerCase().includes(t) || j.tags.some((tag) => String(tag).toLowerCase().includes(t))),
    )
    .slice(0, 60);
}

// RemoteOK's public JSON API — well-known, widely-used endpoint with no key/auth. The FIRST
// array element is always a non-job "legal notice" object (no `id`), not an actual posting —
// filtered out below rather than sliced, since relying on array position is more fragile than
// checking the shape that actually distinguishes it.
interface RemoteOkJob {
  id?: string;
  company?: string;
  position?: string;
  url?: string;
  location?: string;
  tags?: unknown[];
  date?: string;
}

export async function fetchRemoteOk(query: string): Promise<RawJob[]> {
  const d = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (d || [])
    .filter((j): j is RemoteOkJob & { id: string } => !!j.id)
    .map((j) => ({
      company: j.company || "—",
      position: j.position || "—",
      url: j.url || "",
      location: j.location || "Remote",
      tags: Array.isArray(j.tags) ? normalizeTags((j.tags as string[]).slice(0, 10)) : [],
      source: "RemoteOK",
      postedAt: toIsoOrNull(j.date),
    }))
    .filter(
      (j) =>
        !terms.length || terms.some((t) => j.position.toLowerCase().includes(t) || j.tags.some((tag) => tag.toLowerCase().includes(t))),
    )
    .slice(0, 100);
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&");
}
// DOU titles are real Ukrainian text from their RSS feed ("Position в Company, Location") —
// the " в " (Ukrainian "at/in") separator below is functional parsing, not translatable text.
function splitDouTitle(title: string): { position: string; company: string; location: string } {
  const idx = title.lastIndexOf(" в ");
  if (idx < 0) return { position: title, company: "—", location: "" };
  const after = title.slice(idx + 3);
  const comma = after.indexOf(", ");
  return {
    position: title.slice(0, idx),
    company: comma < 0 ? after : after.slice(0, comma),
    location: comma < 0 ? "" : after.slice(comma + 2),
  };
}
export async function fetchDou(query: string): Promise<RawJob[]> {
  const url = query ? `https://jobs.dou.ua/vacancies/feeds/?search=${encodeURIComponent(query)}` : "https://jobs.dou.ua/vacancies/feeds/";
  const xml = await fetchText(url);
  if (!xml) return [];
  const jobs: RawJob[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && jobs.length < 60) {
    const item = m[1] ?? "";
    const title = decodeXml((item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim());
    const link = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    if (!title || !link) continue;
    const { position, company, location } = splitDouTitle(title);
    const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    jobs.push({
      company,
      position,
      url: link,
      location: location || "Ukraine",
      tags: [],
      source: "DOU",
      postedAt: toIsoOrNull(pubDate || null),
    });
  }
  return jobs;
}

function stripHtml(s: string): string {
  return decodeXml(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// Djinni's RSS feed (djinni.co/jobs/rss/) has no search/keyword query param (unlike DOU) and no
// separate company field — the title is just the position ("Lead Backend Engineer"), the company
// name only ever appears (inconsistently, in Ukrainian or English prose) inside the HTML
// <description>, too unreliable to regex out. So: filter client-side by query terms (same
// fallback fetchArbeitnow already uses for the same reason), leave company as "—", and derive
// tags from the feed's own <category> plus extractTechs() over the stripped description text —
// richer than DOU's always-empty tags, since Djinni's description is real, parseable prose.
export async function fetchDjinni(query: string): Promise<RawJob[]> {
  const xml = await fetchText("https://djinni.co/jobs/rss/");
  if (!xml) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const jobs: RawJob[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && jobs.length < 60) {
    const item = m[1] ?? "";
    const position = decodeXml((item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim());
    const link = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    if (!position || !link) continue;
    const category = decodeXml((item.match(/<category>([\s\S]*?)<\/category>/)?.[1] || "").trim());
    const description = stripHtml(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "");
    const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    const techTags = extractTechs(description).map((t) => t.name);
    const tags = normalizeTags([category, ...techTags].filter(Boolean).slice(0, 10));
    if (terms.length && !terms.some((t) => position.toLowerCase().includes(t) || tags.some((tag) => tag.toLowerCase().includes(t))))
      continue;
    jobs.push({ company: "—", position, url: link, location: "Ukraine", tags, source: "Djinni", postedAt: toIsoOrNull(pubDate || null) });
  }
  return jobs;
}

// Jobicy's public JSON API (jobicy.com/api/v2/remote-jobs) — no key/auth. No confirmed
// server-side keyword filter param, so (like Djinni/Arbeitnow above) it's filtered client-side
// against the fetched page instead of relying on an undocumented query param.
interface JobicyJob {
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobIndustry?: unknown[];
  jobType?: unknown[];
  pubDate?: string;
}
interface JobicyResponse {
  jobs?: JobicyJob[];
}

export async function fetchJobicy(query: string): Promise<RawJob[]> {
  const d = await fetchJson<JobicyResponse>("https://jobicy.com/api/v2/remote-jobs?count=100");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (d?.jobs || [])
    .map((j) => ({
      company: j.companyName || "—",
      position: j.jobTitle || "—",
      url: j.url || "",
      location: j.jobGeo || "Remote",
      // Jobicy's JSON string fields come HTML-entity-encoded (e.g. "Customer Support &amp;
      // Success") even though this isn't XML — decodeXml's entity set covers HTML too.
      tags: normalizeTags(
        [...(Array.isArray(j.jobIndustry) ? (j.jobIndustry as string[]) : []), ...(Array.isArray(j.jobType) ? (j.jobType as string[]) : [])]
          .map((tag) => decodeXml(String(tag)))
          .slice(0, 10),
      ),
      source: "Jobicy",
      postedAt: toIsoOrNull(j.pubDate),
    }))
    .filter(
      (j) =>
        !terms.length || terms.some((t) => j.position.toLowerCase().includes(t) || j.tags.some((tag) => tag.toLowerCase().includes(t))),
    )
    .slice(0, 100);
}

// WorkingNomads' public JSON API — no key/auth, verified live (curl) before adding: returns a
// small (~40 postings), CURATED "exposed jobs" feed rather than a paginated firehose, so no
// server-side search param exists (nor is one needed at this size) — filtered client-side like
// Arbeitnow/RemoteOK/Jobicy above. (Himalayas' public API — himalayas.app/jobs/api — was also
// evaluated and rejected: ~97k jobs with NO server-side search/filter param at all, confirmed by
// requesting the same page with and without `search=` and getting byte-identical results, so
// there's no way to fetch just the relevant slice without deep, wasteful pagination.)
interface WorkingNomadsJob {
  url?: string;
  title?: string;
  company_name?: string;
  category_name?: string;
  // Comma-separated STRING here, unlike every other source's tags array — e.g.
  // "fastapi,python,postgresql,aws,graphql".
  tags?: string;
  location?: string;
  pub_date?: string;
}

export async function fetchWorkingNomads(query: string): Promise<RawJob[]> {
  const d = await fetchJson<WorkingNomadsJob[]>("https://www.workingnomads.com/api/exposed_jobs/");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (d || [])
    .map((j) => ({
      company: j.company_name || "—",
      position: j.title || "—",
      url: j.url || "",
      location: j.location || "Remote",
      tags: normalizeTags(
        [j.category_name, ...(j.tags ? j.tags.split(",") : [])]
          .filter(Boolean)
          .map((t) => t as string)
          .slice(0, 10),
      ),
      source: "WorkingNomads",
      postedAt: toIsoOrNull(j.pub_date),
    }))
    .filter(
      (j) =>
        !terms.length || terms.some((t) => j.position.toLowerCase().includes(t) || j.tags.some((tag) => tag.toLowerCase().includes(t))),
    )
    .slice(0, 60);
}

// WeWorkRemotely's RSS feed — titles come as "Company: Position" (unlike DOU's " в "/Djinni's
// plain-position formats), no native keyword filter either.
function splitWwrTitle(title: string): { position: string; company: string } {
  const idx = title.indexOf(": ");
  if (idx < 0) return { position: title, company: "—" };
  return { company: title.slice(0, idx), position: title.slice(idx + 2) };
}

export async function fetchWeWorkRemotely(query: string): Promise<RawJob[]> {
  const xml = await fetchText("https://weworkremotely.com/remote-jobs.rss");
  if (!xml) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const jobs: RawJob[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && jobs.length < 60) {
    const item = m[1] ?? "";
    const rawTitle = decodeXml((item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim());
    const link = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    if (!rawTitle || !link) continue;
    const { position, company } = splitWwrTitle(rawTitle);
    const region = decodeXml((item.match(/<region>([\s\S]*?)<\/region>/)?.[1] || "").trim());
    const category = decodeXml((item.match(/<category>([\s\S]*?)<\/category>/)?.[1] || "").trim());
    const description = stripHtml(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "");
    const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    const techTags = extractTechs(description).map((t) => t.name);
    const tags = normalizeTags([category, ...techTags].filter(Boolean).slice(0, 10));
    if (terms.length && !terms.some((t) => position.toLowerCase().includes(t) || tags.some((tag) => tag.toLowerCase().includes(t))))
      continue;
    jobs.push({
      company,
      position,
      url: link,
      location: region || "Remote",
      tags,
      source: "WeWorkRemotely",
      postedAt: toIsoOrNull(pubDate || null),
    });
  }
  return jobs;
}

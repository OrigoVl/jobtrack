// Job search across external aggregators (Remotive, Arbeitnow, DOU) — no API keys needed.
import { contextLogger } from "../../core/logger.js";
import { normalizeTags } from "../../shared/tag-format.js";

export interface RawJob {
  company: string;
  position: string;
  url: string;
  location: string;
  tags: string[];
  source: string;
}

async function fetchRemote(url: string, ms = 8000): Promise<Response | null> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (DevRadar)" }, signal: ac.signal });
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
  }));
}

interface ArbeitnowJob {
  company_name?: string;
  title?: string;
  url?: string;
  location?: string;
  remote?: boolean;
  tags?: unknown[];
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
    }))
    .filter(
      (j) =>
        !terms.length ||
        terms.some((t) => j.position.toLowerCase().includes(t) || j.tags.some((tag) => String(tag).toLowerCase().includes(t))),
    )
    .slice(0, 60);
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
    jobs.push({ company, position, url: link, location: location || "Ukraine", tags: [], source: "DOU" });
  }
  return jobs;
}

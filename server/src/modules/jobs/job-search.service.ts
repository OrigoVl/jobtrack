// Пошук вакансій у зовнішніх агрегаторах (Remotive, Arbeitnow, DOU) — без API-ключів.

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
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (JobTrack)" }, signal: ac.signal });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}
async function fetchJson<T = unknown>(url: string, ms = 8000): Promise<T | null> {
  const res = await fetchRemote(url, ms);
  return res ? (res.json().catch(() => null) as Promise<T | null>) : null;
}
async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const res = await fetchRemote(url, ms);
  return res ? res.text().catch(() => null) : null;
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
    tags: Array.isArray(j.tags) ? (j.tags.slice(0, 10) as string[]) : [],
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
      tags: Array.isArray(j.tags) ? (j.tags.slice(0, 10) as string[]) : [],
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
    const title = decodeXml((m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim());
    const link = (m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    if (!title || !link) continue;
    const { position, company, location } = splitDouTitle(title);
    jobs.push({ company, position, url: link, location: location || "Україна", tags: [], source: "DOU" });
  }
  return jobs;
}

export function interleave<T>(lists: T[][], limit: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < limit; i += 1) {
    let added = false;
    for (const list of lists) {
      if (list[i]) {
        out.push(list[i]);
        added = true;
        if (out.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return out;
}

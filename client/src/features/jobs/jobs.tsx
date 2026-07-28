import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useAddVacancy, useProfile } from "../../shared/queries";
import { Btn, Card, Chip, EmptyState, PageHeader, Segmented } from "../../shared/ui";
import type { JobResult, JobSearchResult } from "../../shared/types";

/* ---------- Job search (aggregators) ---------- */
const LI_COUNTRIES: { code: string; label: string; geoId?: string; wt?: string }[] = [
  { code: "remote", label: "🌍 Remote / anywhere", wt: "2" },
  { code: "ua", label: "🇺🇦 Ukraine", geoId: "102264497" },
  { code: "pl", label: "🇵🇱 Poland", geoId: "105072130" },
  { code: "de", label: "🇩🇪 Germany", geoId: "101282230" },
  { code: "gb", label: "🇬🇧 United Kingdom", geoId: "101165590" },
  { code: "us", label: "🇺🇸 USA", geoId: "103644278" },
  { code: "nl", label: "🇳🇱 Netherlands", geoId: "102890719" },
  { code: "es", label: "🇪🇸 Spain", geoId: "105646813" },
];
function externalLinks(q: string, country: { geoId?: string; wt?: string }): { label: string; url: string }[] {
  const e = encodeURIComponent(q.trim());
  const li = new URLSearchParams({ keywords: q.trim() });
  if (country.geoId) li.set("geoId", country.geoId);
  if (country.wt) li.set("f_WT", country.wt);
  const slug = (q.trim() || "jobs").replace(/\s+/g, "-").toLowerCase();
  return [
    { label: "🔗 LinkedIn (with country filter)", url: `https://www.linkedin.com/jobs/search/?${li.toString()}` },
    { label: "🟢 Djinni", url: `https://djinni.co/jobs/?all-keywords=${e}` },
    { label: "🔵 DOU", url: `https://jobs.dou.ua/vacancies/?search=${e}` },
    { label: "🟠 Work.ua", url: `https://www.work.ua/jobs/?search=${e}` },
    { label: "🔴 robota.ua", url: `https://robota.ua/zapros/${encodeURIComponent(slug)}/ukraine` },
  ];
}
export function Jobs() {
  const { data: profile } = useProfile();
  const addVacancyMutation = useAddVacancy();
  const [q, setQ] = useUi("jobs.q", "");
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [country, setCountry] = useUi("jobs.country", "remote");
  const [region, setRegion] = useUi("jobs.region", "all");
  const [page, setPage] = useUi("jobs.page", 1);
  const [pageSize, setPageSize] = useUi("jobs.pageSize", 8);
  // Parameters of the last submitted search — separate from the "live" input, so we
  // don't hit the network on every keystroke, and results get cached via TanStack Query.
  const [submitted, setSubmitted] = useUi<{ q: string; region: string } | null>("jobs.submitted", null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const goPage = (p: number) => {
    setPage(p);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const effectiveQ = q || (profile?.skills.slice(0, 3).join(" ") ?? "");
  const {
    data,
    isFetching: loading,
    isError,
  } = useQuery<JobSearchResult>({
    queryKey: ["jobs-search", submitted?.q, submitted?.region],
    queryFn: () => api.searchJobs(submitted!.q, submitted!.region),
    enabled: !!submitted,
  });
  const search = () => {
    setSubmitted({ q: effectiveQ, region });
    setPage(1);
  };
  const addJob = async (job: JobResult) => {
    await addVacancyMutation.mutateAsync({
      company: job.company,
      position: job.position,
      url: job.url,
      stack: job.tags,
      status: "Want to apply",
    });
    setAdded((a) => ({ ...a, [job.url]: true }));
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Job search"
        subtitle="Real vacancies from aggregators (Remotive + Arbeitnow) matched to your skills. Found something interesting — add it to the tracker in one click."
      />
      <Card>
        <div className="flex gap-2 flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            aria-label="Keywords for the job search"
            placeholder={profile?.skills.slice(0, 3).join(" ") || "e.g. react node typescript"}
            className="flex-1 min-w-[220px] bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <Btn onClick={search} loading={loading}>
            {loading ? "Searching…" : "🔎 Search"}
          </Btn>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">Sources:</span>
          <Segmented
            value={region}
            onChange={setRegion}
            options={[
              { value: "all", label: "All" },
              { value: "ua", label: "🇺🇦 Ukraine (DOU)" },
              { value: "remote", label: "🌍 Remote" },
            ]}
          />
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Empty query → we search by your top skills. "Ukraine" = DOU, "Remote" = Remotive + Arbeitnow.
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold text-slate-700 mb-1">🌐 Search on external sites</div>
        <div className="text-xs text-slate-400 mb-2">
          Djinni and LinkedIn don't have an open API (scraping would violate ToS). So here are ready-made search links with your query and a
          country filter for LinkedIn.
        </div>
        <div className="flex gap-2 items-center flex-wrap mb-2">
          <span className="text-xs font-semibold text-slate-500">Country (LinkedIn):</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {LI_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {externalLinks(effectiveQ, LI_COUNTRIES.find((c) => c.code === country) ?? LI_COUNTRIES[0]).map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-indigo-700 hover:bg-slate-200 transition-colors font-medium"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      </Card>
      {isError && !loading && (
        <Card>
          <EmptyState icon="⚠️" title="Search failed" hint="A network or server problem. Try again." />
        </Card>
      )}
      {data && data.jobs.length === 0 && (
        <Card>
          <EmptyState
            icon="🔍"
            title="Nothing found"
            hint={
              data.offline
                ? "The aggregators are unavailable (network/timeout). Try again later."
                : "Try different keywords or a broader query."
            }
          />
        </Card>
      )}
      {data &&
        data.jobs.length > 0 &&
        (() => {
          const totalPages = Math.max(1, Math.ceil(data.jobs.length / pageSize));
          const current = Math.min(page, totalPages);
          const start = (current - 1) * pageSize;
          const pageJobs = data.jobs.slice(start, start + pageSize);
          return (
            <div className="space-y-2">
              <div ref={listTopRef} className="scroll-mt-4 flex items-center gap-2 flex-wrap">
                <div className="text-sm text-slate-500">
                  Found {data.count} for "{data.query}" · showing {start + 1}–{start + pageJobs.length}
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Per page:</span>
                  <Segmented
                    value={pageSize}
                    onChange={(n) => {
                      setPageSize(n);
                      goPage(1);
                    }}
                    options={[8, 16, 32].map((n) => ({ value: n, label: String(n) }))}
                  />
                </div>
              </div>
              {pageJobs.map((job) => {
                // One mutation hook serves every card's button on the page — scope isPending by
                // variables.url (the arguments of THIS SPECIFIC call), otherwise the loader would
                // flash on every card at once when adding any one of them.
                const isAdding = addVacancyMutation.isPending && addVacancyMutation.variables?.url === job.url;
                return (
                  <Card key={job.url} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{job.position}</span>
                      {job.matchCount > 0 && <Chip tone="emerald">★ {job.matchCount} match</Chip>}
                      <Chip>{job.source}</Chip>
                      <span className="text-xs text-slate-400 ml-auto">{job.location}</span>
                    </div>
                    <div className="text-sm text-slate-500">{job.company}</div>
                    {job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {job.tags.slice(0, 8).map((t) => (
                          <Chip key={t}>{t}</Chip>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-indigo-600 hover:bg-slate-200 transition-colors"
                      >
                        Open ↗
                      </a>
                      <Btn size="sm" variant="ghost" loading={isAdding} onClick={() => addJob(job)} disabled={added[job.url]}>
                        {added[job.url] ? "✓ in tracker" : "➕ add to tracker"}
                      </Btn>
                    </div>
                  </Card>
                );
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <Btn size="sm" variant="ghost" onClick={() => goPage(current - 1)} disabled={current <= 1}>
                    ← Back
                  </Btn>
                  <span className="text-sm text-slate-500">
                    Page {current} of {totalPages}
                  </span>
                  <Btn size="sm" variant="ghost" onClick={() => goPage(current + 1)} disabled={current >= totalPages}>
                    Next →
                  </Btn>
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}

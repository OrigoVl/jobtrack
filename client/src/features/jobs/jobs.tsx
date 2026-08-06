import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useAddVacancy, useAddSavedSearch, useDeleteSavedSearch, useProfile, useSavedSearches, useVacancies } from "../../shared/queries";
import { Btn, Card, Chip, Dropdown, EmptyState, PageHeader, Segmented, Select, Spinner } from "../../shared/ui";
import { useConfirm } from "../../shared/use-confirm";
import { filterAndSortJobs, ALL_JOB_SOURCES, type JobSortKey } from "./jobs-filter";
import type { JobResult, JobSearchRegion, JobSearchResult } from "../../shared/types";

/** Job alerts (saved searches) — a re-runs-every-few-hours background email digest of newly
 * appeared postings for a query/region (see the "Alert me" button next to the search bar
 * below, and server/src/modules/saved-searches/). Just the list + delete here. */
function SavedSearchesCard() {
  const { t, i18n } = useTranslation(["jobs", "common"]);
  const confirm = useConfirm();
  const { data: searches, isLoading } = useSavedSearches();
  const deleteMutation = useDeleteSavedSearch();
  if (isLoading) return null;
  if (!searches || searches.length === 0) return null;
  return (
    <Card>
      <div className="text-sm font-semibold text-ink mb-2">{t("alerts.heading")}</div>
      <div className="space-y-1.5">
        {searches.map((s) => {
          const isDeleting = deleteMutation.isPending && deleteMutation.variables === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg border border-grid">
              <span className="font-medium text-ink truncate">{s.label || s.query}</span>
              <Chip>
                {s.region === "all" ? t("alerts.regionAll") : s.region === "ua" ? t("alerts.regionUkraine") : t("alerts.regionRemote")}
              </Chip>
              <span className="text-xs text-ink-dim ml-auto whitespace-nowrap">
                {s.lastNotifiedAt
                  ? t("alerts.lastAlert", { date: new Date(s.lastNotifiedAt).toLocaleDateString(i18n.language) })
                  : t("alerts.noAlertsSent")}
              </span>
              <button
                onClick={async () => {
                  if (await confirm({ title: t("alerts.deleteConfirmTitle", { name: s.label || s.query }) })) deleteMutation.mutate(s.id);
                }}
                disabled={isDeleting}
                className="text-ink-dim hover:text-rose-500 disabled:opacity-50 shrink-0"
                aria-label={t("alerts.deleteAriaLabel", { name: s.label || s.query })}
                title={t("alerts.deleteTitle")}
              >
                {isDeleting ? <Spinner className="h-3.5 w-3.5" /> : "✕"}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Job search (aggregators) ---------- */
// Country codes + LinkedIn search params — pure data, no user-facing text (labels are looked up
// via `t()` inside the component, see `countryLabel` below).
const LI_COUNTRIES: { code: string; geoId?: string; wt?: string }[] = [
  { code: "remote", wt: "2" },
  { code: "ua", geoId: "102264497" },
  { code: "pl", geoId: "105072130" },
  { code: "de", geoId: "101282230" },
  { code: "gb", geoId: "101165590" },
  { code: "us", geoId: "103644278" },
  { code: "nl", geoId: "102890719" },
  { code: "es", geoId: "105646813" },
];
export function Jobs() {
  const { t } = useTranslation(["jobs", "common"]);
  // Explicit switch (not a dynamic `t(`countries.${code}`)`) so every key stays a literal i18next
  // can type-check — same reasoning as shared/status-labels.ts's statusLabel.
  const countryLabel = (code: string): string => {
    switch (code) {
      case "remote":
        return t("countries.remote");
      case "ua":
        return t("countries.ua");
      case "pl":
        return t("countries.pl");
      case "de":
        return t("countries.de");
      case "gb":
        return t("countries.gb");
      case "us":
        return t("countries.us");
      case "nl":
        return t("countries.nl");
      case "es":
        return t("countries.es");
      default:
        return code;
    }
  };
  const externalLinks = (q: string, country: { geoId?: string; wt?: string }): { label: string; url: string }[] => {
    const e = encodeURIComponent(q.trim());
    const li = new URLSearchParams({ keywords: q.trim() });
    if (country.geoId) li.set("geoId", country.geoId);
    if (country.wt) li.set("f_WT", country.wt);
    const slug = (q.trim() || "jobs").replace(/\s+/g, "-").toLowerCase();
    // RemoteOK's own site search is a path, not a query param — confirmed live: remoteok.com/
    // remote-<term>-jobs (spaces joined with "+", e.g. remoteok.com/remote-api+dev-jobs).
    const remoteOkSlug = (q.trim() || "dev").trim().split(/\s+/).join("+").toLowerCase();
    return [
      { label: t("external.linkedin"), url: `https://www.linkedin.com/jobs/search/?${li.toString()}` },
      { label: t("external.djinni"), url: `https://djinni.co/jobs/?all-keywords=${e}` },
      { label: t("external.dou"), url: `https://jobs.dou.ua/vacancies/?search=${e}` },
      { label: t("external.workUa"), url: `https://www.work.ua/jobs/?search=${e}` },
      { label: t("external.robotaUa"), url: `https://robota.ua/zapros/${encodeURIComponent(slug)}/ukraine` },
      { label: t("external.remoteok"), url: `https://remoteok.com/remote-${remoteOkSlug}-jobs` },
      { label: t("external.remotive"), url: `https://remotive.com/remote-jobs?query=${e}` },
      { label: t("external.arbeitnow"), url: `https://www.arbeitnow.com/?search=${e}` },
      { label: t("external.jobicy"), url: `https://jobicy.com/jobs?s=${e}` },
      { label: t("external.weworkremotely"), url: `https://weworkremotely.com/remote-jobs-search?term=${e}` },
    ];
  };
  const { data: profile } = useProfile();
  const addVacancyMutation = useAddVacancy();
  const { data: savedSearches = [] } = useSavedSearches();
  const addSavedSearchMutation = useAddSavedSearch();
  const [q, setQ] = useUi("jobs.q", "");
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [country, setCountry] = useUi("jobs.country", "remote");
  const [region, setRegion] = useUi<JobSearchRegion>("jobs.region", "all");
  const [page, setPage] = useUi("jobs.page", 1);
  const [pageSize, setPageSize] = useUi("jobs.pageSize", 8);
  const [hiddenSources, setHiddenSources] = useUi<string[]>("jobs.hiddenSources", []);
  const [hideAdded, setHideAdded] = useUi("jobs.hideAdded", false);
  const [sortBy, setSortBy] = useUi<JobSortKey>("jobs.sortBy", "relevance");
  const toggleSource = (src: string) =>
    setHiddenSources(hiddenSources.includes(src) ? hiddenSources.filter((s) => s !== src) : [...hiddenSources, src]);
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
  // Already-tracked vacancies (from the tracker itself, not just this session's "added" clicks) —
  // combined below with `added` so "hide already tracked" also catches jobs added in a PAST
  // session, not only ones added in this one.
  const { data: vacancies = [] } = useVacancies();
  const trackedUrls = new Set([...vacancies.map((v) => v.url).filter(Boolean), ...Object.keys(added).filter((url) => added[url])]);
  const visibleJobs = data ? filterAndSortJobs(data.jobs, { hiddenSources, hideAdded, trackedUrls, sortBy }) : [];
  const hasActiveJobFilters = hiddenSources.length > 0 || hideAdded;
  const resetJobFilters = () => {
    setHiddenSources([]);
    setHideAdded(false);
  };
  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <Card>
        <div className="flex gap-2 flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            aria-label={t("search.keywordsAriaLabel")}
            placeholder={profile?.skills.slice(0, 3).join(" ") || t("search.keywordsPlaceholder")}
            className="flex-1 min-w-[220px] bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <Btn onClick={search} loading={loading}>
            {loading ? t("search.searching") : t("search.search")}
          </Btn>
          <Btn
            variant="ghost"
            title={t("search.alertMeTitle")}
            disabled={!effectiveQ.trim() || savedSearches.some((s) => s.query === effectiveQ.trim() && s.region === region)}
            loading={addSavedSearchMutation.isPending}
            onClick={() => addSavedSearchMutation.mutate({ query: effectiveQ.trim(), region, label: effectiveQ.trim() })}
          >
            {t("search.alertMe")}
          </Btn>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs font-semibold text-ink-dim">{t("search.sources")}</span>
          <Segmented
            value={region}
            onChange={setRegion}
            options={[
              { value: "all", label: t("search.sourceAll") },
              { value: "ua", label: t("search.sourceUkraine") },
              { value: "remote", label: t("search.sourceRemote") },
            ]}
          />
          <Dropdown label={t("results.filterSources")}>
            {ALL_JOB_SOURCES.map((src) => (
              <label
                key={src}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-ink rounded-lg hover:bg-surface-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!hiddenSources.includes(src)}
                  onChange={() => toggleSource(src)}
                  className="accent-signal"
                />
                {src}
              </label>
            ))}
          </Dropdown>
        </div>
        <div className="text-xs text-ink-dim mt-2">{t("search.hint")}</div>
      </Card>
      <SavedSearchesCard />
      <Card>
        <div className="text-sm font-semibold text-ink mb-1">{t("external.heading")}</div>
        <div className="text-xs text-ink-dim mb-2">{t("external.hint")}</div>
        <div className="flex gap-2 items-center flex-wrap mb-2">
          <span className="text-xs font-semibold text-ink-dim">{t("external.countryLabel")}</span>
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            {LI_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {countryLabel(c.code)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {externalLinks(effectiveQ, LI_COUNTRIES.find((c) => c.code === country) ?? LI_COUNTRIES[0]).map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 text-ink-dim hover:text-signal hover:bg-grid transition-colors font-medium"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      </Card>
      {isError && !loading && (
        <Card>
          <EmptyState title={t("results.searchFailedTitle")} hint={t("results.searchFailedHint")} />
        </Card>
      )}
      {data && data.needsQuery && (
        <Card>
          <EmptyState title={t("results.needsQueryTitle")} hint={t("results.needsQueryHint")} />
        </Card>
      )}
      {data && !data.needsQuery && data.jobs.length === 0 && (
        <Card>
          <EmptyState
            title={t("results.nothingFoundTitle")}
            hint={data.offline ? t("results.nothingFoundHintOffline") : t("results.nothingFoundHint")}
          />
        </Card>
      )}
      {data && data.jobs.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-sm text-ink-dim cursor-pointer">
              <input type="checkbox" checked={hideAdded} onChange={(e) => setHideAdded(e.target.checked)} className="accent-signal" />
              {t("results.hideAdded")}
            </label>
            <span className="text-xs font-semibold text-ink-dim ml-2">{t("results.sortBy")}</span>
            <Segmented
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "relevance", label: t("results.sortRelevance") },
                { value: "newest", label: t("results.sortNewest") },
              ]}
            />
            {hasActiveJobFilters && (
              <Btn size="sm" variant="ghost" onClick={resetJobFilters}>
                {t("results.resetFilters")}
              </Btn>
            )}
          </div>
        </Card>
      )}
      {data && data.jobs.length > 0 && visibleJobs.length === 0 && (
        <Card>
          <EmptyState
            title={t("results.noMatches.title")}
            hint={t("results.noMatches.hint")}
            action={
              <Btn size="sm" variant="ghost" onClick={resetJobFilters}>
                {t("results.resetFilters")}
              </Btn>
            }
          />
        </Card>
      )}
      {data &&
        visibleJobs.length > 0 &&
        (() => {
          const totalPages = Math.max(1, Math.ceil(visibleJobs.length / pageSize));
          const current = Math.min(page, totalPages);
          const start = (current - 1) * pageSize;
          const pageJobs = visibleJobs.slice(start, start + pageSize);
          return (
            <div className="space-y-2">
              <div ref={listTopRef} className="scroll-mt-4 flex items-center gap-2 flex-wrap">
                <div className="text-sm text-ink-dim">
                  {t("results.found", { count: visibleJobs.length, query: data.query, start: start + 1, end: start + pageJobs.length })}
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-ink-dim">
                  <span>{t("results.perPage")}</span>
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
                      <span className="font-semibold text-ink">{job.position}</span>
                      {job.matchCount > 0 && <Chip tone="emerald">{t("results.matches", { count: job.matchCount })}</Chip>}
                      <Chip>{job.source}</Chip>
                      <span className="text-xs text-ink-dim ml-auto">{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-ink-dim">
                      <span>{job.company}</span>
                      {job.postedAt && (
                        <span className="text-xs text-ink-dim ml-auto">
                          {t("results.postedOn", { date: new Date(job.postedAt).toLocaleDateString() })}
                        </span>
                      )}
                    </div>
                    {job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {job.tags.slice(0, 8).map((tag) => (
                          <Chip key={tag}>{tag}</Chip>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 text-ink-dim hover:text-signal hover:bg-grid transition-colors"
                      >
                        {t("results.open")}
                      </a>
                      <Btn size="sm" variant="ghost" loading={isAdding} onClick={() => addJob(job)} disabled={added[job.url]}>
                        {added[job.url] ? t("results.addedToTracker") : t("results.addToTracker")}
                      </Btn>
                    </div>
                  </Card>
                );
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <Btn size="sm" variant="ghost" onClick={() => goPage(current - 1)} disabled={current <= 1}>
                    {t("results.back")}
                  </Btn>
                  <span className="text-sm text-ink-dim">{t("results.pageOf", { current, totalPages })}</span>
                  <Btn size="sm" variant="ghost" onClick={() => goPage(current + 1)} disabled={current >= totalPages}>
                    {t("results.next")}
                  </Btn>
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}

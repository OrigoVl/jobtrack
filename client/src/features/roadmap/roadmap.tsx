import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { Card, CardsSkeleton, Chip, EmptyState, PageHeader, ProgressBar, Segmented } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import { useUi } from "../../shared/ui-state";
import { useHealth, useRoadmap, useSetRoadmapStatus } from "../../shared/queries";
import { SkillRadar } from "../analytics/charts";
import type { KnowledgeData, RoadmapNode, RoadmapStatus } from "../../shared/types";

// A Record (not a template literal built from the runtime status) so each value stays a literal
// key i18next's typed t() can verify against roadmap.json — same trick as calendar.tsx's TYPE_KEY,
// for the same reason. Unlike shared/status-labels.ts's statusKey() (VacancyStatus is typed as a
// loose `string` for legacy-data reasons), RoadmapStatus is a genuine closed union, so no runtime
// fallback/cast is needed here.
const STATUS_LABEL_KEY: Record<RoadmapStatus, "status.done" | "status.learning" | "status.todo"> = {
  done: "status.done",
  learning: "status.learning",
  todo: "status.todo",
};
const STATUS_META: Record<RoadmapStatus, { text: string; badge: string; ring: string; border: string }> = {
  done: { text: "text-signal", badge: "bg-signal text-white", ring: "ring-4 ring-signal/15", border: "border-signal" },
  learning: { text: "text-alert", badge: "bg-alert text-white", ring: "ring-4 ring-alert/15", border: "border-alert" },
  todo: { text: "text-ink-dim", badge: "bg-surface", ring: "", border: "border-grid" },
};
const CARD_TINT: Record<RoadmapStatus, string> = {
  done: "bg-signal/[0.04] border-signal/25 hover:border-signal/60",
  learning: "bg-alert/[0.05] border-alert/25 hover:border-alert/60",
  todo: "bg-surface border-grid hover:border-signal/40",
};
const NEXT: Record<RoadmapStatus, RoadmapStatus> = { todo: "learning", learning: "done", done: "todo" };
const ICON: Record<RoadmapStatus, string> = { done: "✓", learning: "…", todo: "" };

/** A ring-shaped progress readout (SVG donut) — the "instrument panel" stand-in for a linear bar,
 * used both for the page-level total and each group's mini summary. Local to this feature: nothing
 * else in the app needs a circular progress meter yet, so it isn't promoted to shared/ui.tsx. */
function RadialProgress({ value, max, size = 88, stroke = 8 }: { value: number; max: number; size?: number; stroke?: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-surface-2" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        fill="none"
        className="stroke-signal transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

const pill = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${
    active ? "bg-signal text-white border-signal shadow-sm" : "bg-surface-2 text-ink-dim border-grid hover:text-ink hover:border-signal/40"
  }`;

function Node({ node }: { node: RoadmapNode }) {
  const { t } = useTranslation(["roadmap", "common"]);
  const { data: health } = useHealth();
  const llm = health?.llm ?? false;
  const setRoadmapStatusMutation = useSetRoadmapStatus();
  const [open, setOpen] = useState(false);
  const [dyn, setDyn] = useState<KnowledgeData | null>(null);
  const [loadingDyn, setLoadingDyn] = useState(false);
  useEffect(() => {
    if (!open || !llm || dyn || loadingDyn) return;
    setLoadingDyn(true);
    api
      .knowledge(node.tech)
      .then(setDyn)
      .catch(() => undefined)
      .finally(() => setLoadingDyn(false));
  }, [open, llm, dyn, loadingDyn, node.tech]);
  const learn = dyn?.learn ?? node.learn;
  const resources = dyn?.resources ?? node.resources;
  const meta = STATUS_META[node.status];
  const statusLabel = t(STATUS_LABEL_KEY[node.status]);
  return (
    <div className="relative pl-8">
      <button
        onClick={() => setRoadmapStatusMutation.mutate({ tech: node.tech, status: NEXT[node.status] })}
        title={t("nodeStatusHint")}
        className={`absolute left-0 top-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${meta.badge} ${meta.border} ${meta.ring}`}
      >
        {ICON[node.status]}
      </button>
      <div className={`rounded-xl border transition-colors ${CARD_TINT[node.status]}`}>
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
          <span className="font-semibold text-ink">{node.tech}</span>
          {node.demand > 0 && <Chip tone="indigo">{t("demandChip", { count: node.demand })}</Chip>}
          {node.known && <Chip tone="emerald">{t("inProfile")}</Chip>}
          {node.drillsTotal > 0 && (
            <Chip tone={node.drillsSolved === node.drillsTotal ? "emerald" : "slate"}>
              ⌨ {node.drillsSolved}/{node.drillsTotal}
            </Chip>
          )}
          <span className={`ml-auto text-xs font-medium ${meta.text}`}>{statusLabel}</span>
          <span className="text-ink-dim text-xs w-3">{open ? "▾" : "▸"}</span>
        </button>
        {open && (
          <div className="px-3 pb-3 border-t border-surface-2 pt-3 space-y-3">
            {loadingDyn && <div className="text-xs text-ink-dim">{t("personalizing")}</div>}
            {dyn?.focus && (
              <div className="rounded-lg bg-signal/10 border border-signal/20 p-2.5 text-sm text-signal">
                <span className="font-semibold">{t("personalFocus")}</span> <Markdown text={dyn.focus} inline />
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-ink-dim mb-1 flex items-center gap-1.5">
                {t("whatToLearn")}
                {dyn?.source === "ai" && <Chip tone="indigo">{t("aiForYou")}</Chip>}
              </div>
              <ul className="list-disc pl-5 text-sm text-ink space-y-1">
                {learn.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
            {node.drillsTotal > 0 && (
              <div>
                <div className="text-xs font-semibold text-ink-dim mb-1">
                  {t("practiceProblems", { solved: node.drillsSolved, total: node.drillsTotal })}
                </div>
                <ProgressBar value={node.drillsSolved} max={node.drillsTotal} tone="emerald" />
                <div className="text-xs text-ink-dim mt-1">{t("practiceHint")}</div>
              </div>
            )}
            {resources.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-ink-dim mb-1">{t("resourcesHeading")}</div>
                <div className="flex flex-wrap gap-2">
                  {resources.map((r) => (
                    <a
                      key={r.u}
                      href={r.u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 text-signal hover:bg-grid transition-colors"
                    >
                      {r.t} ↗{r.ai ? " ✨" : ""}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Roadmap() {
  const { t } = useTranslation(["roadmap", "common"]);
  const { data: roadmap, isLoading } = useRoadmap();
  const [onlyGaps, setOnlyGaps] = useUi("roadmap.onlyGaps", false);
  const [group, setGroup] = useUi<string>("roadmap.group", "all");
  // "Radar" used to be its own sidebar page — merged in here as a second view of the same
  // underlying data (roadmap progress vs. market demand), so the two related screens aren't
  // scattered across the sidebar (see App.tsx's NAV — /radar now redirects here).
  const [view, setView] = useUi<"list" | "radar">("roadmap.view", "list");
  if (isLoading) return <CardsSkeleton count={3} />;
  if (!roadmap) return null;
  const { done, learning, total } = roadmap.progress;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const groups = roadmap.groups
    .filter((g) => group === "all" || g.group === group)
    .map((g) => ({ ...g, nodes: onlyGaps ? g.nodes.filter((n) => n.status !== "done") : g.nodes }))
    .filter((g) => g.nodes.length > 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t("view.list") },
              { value: "radar", label: t("view.radar") },
            ]}
          />
        }
      />

      {view === "radar" ? (
        <SkillRadar embedded />
      ) : (
        <>
          <Card className="relative overflow-hidden">
            {/* faint radar-sweep rings — a quiet nod to the "DevRadar" theme, not a literal chart */}
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full border border-signal/10" />
            <div aria-hidden className="pointer-events-none absolute -right-4 -top-4 w-28 h-28 rounded-full border border-signal/10" />
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative shrink-0">
                <RadialProgress value={done} max={total} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-lg font-bold text-ink">{pct}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-semibold text-ink mb-2">
                  {t("progress.prefix")} <span className="text-signal">{done}</span> {t("progress.suffix", { count: total })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip tone="emerald">
                    <span className="w-1.5 h-1.5 rounded-full bg-signal" /> {t(STATUS_LABEL_KEY.done)} · {done}
                  </Chip>
                  <Chip tone="amber">
                    <span className="w-1.5 h-1.5 rounded-full bg-alert" /> {t(STATUS_LABEL_KEY.learning)} · {learning}
                  </Chip>
                  <Chip tone="slate">
                    <span className="w-1.5 h-1.5 rounded-full border border-grid bg-surface" /> {t(STATUS_LABEL_KEY.todo)} ·{" "}
                    {total - done - learning}
                  </Chip>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-4 mt-4 border-t border-grid">
              <button onClick={() => setGroup("all")} className={pill(group === "all")}>
                {t("allAreas")}
              </button>
              {roadmap.groups.map((g) => (
                <button key={g.group} onClick={() => setGroup(g.group)} className={pill(group === g.group)}>
                  {g.group} <span className="opacity-60">· {g.nodes.length}</span>
                </button>
              ))}
              <span className="w-px h-5 bg-grid mx-1 shrink-0" />
              <button onClick={() => setOnlyGaps(!onlyGaps)} className={pill(onlyGaps)}>
                {onlyGaps ? `✓ ${t("gapsOnly")}` : t("gapsOnly")}
              </button>
            </div>
          </Card>

          {groups.length === 0 ? (
            <Card>
              <EmptyState icon="✨" title={t("empty.title")} hint={t("empty.hint")} />
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 items-start">
              {groups.map((g) => {
                const groupDone = g.nodes.filter((n) => n.status === "done").length;
                return (
                  <Card key={g.group}>
                    <div className="flex items-center gap-3 mb-4">
                      <RadialProgress value={groupDone} max={g.nodes.length} size={36} stroke={4} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold uppercase tracking-wide text-ink font-display truncate">{g.group}</div>
                        <div className="text-xs text-ink-dim">{t("groupKnown", { done: groupDone, total: g.nodes.length })}</div>
                      </div>
                    </div>
                    <div className="relative space-y-3 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-px before:bg-grid">
                      {g.nodes.map((n) => (
                        <Node key={n.tech} node={n} />
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

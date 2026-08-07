import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { Btn, Card, CardsSkeleton, Chip, EmptyState, PageHeader, ProgressBar, Segmented } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import { AlertTriangleIcon, KeyboardIcon } from "../../shared/icons";
import { useUi } from "../../shared/ui-state";
import { useHealth, useRoadmap, useSetRoadmapStatus, useSetSkillLevel } from "../../shared/queries";
import { SkillRadar } from "./skill-radar";
import { readStoredRoadmapView, storeRoadmapView, type RoadmapView } from "./roadmap-view";
// Lazy — the Materials view pulls in the whole knowledge-base page; no reason to load it for
// someone who only ever looks at the skill list.
const LearnPlan = lazy(() => import("../knowledge/learn").then((m) => ({ default: m.LearnPlan })));
const Plan21 = lazy(() => import("../plan21/plan21").then((m) => ({ default: m.Plan21 })));
import { STATUS_LABEL_KEY } from "./radar-data";
import { roadmapGroupLabel } from "../../shared/roadmap-group-labels";
import type { KnowledgeData, RoadmapNode, RoadmapStatus } from "../../shared/types";

// "done"/"learning" each get their own stoplight hue (--good green / --progress amber) rather
// than the brand indigo: with --alert now equal to --signal (see index.css's glossary — this
// landing has one accent, not two), all three statuses would otherwise render as either the same
// indigo or an unstyled neutral, making "todo"/"learning"/"done" impossible to tell apart at a
// glance on this page specifically (the one place in the app where that 3-way distinction is the
// entire point).
const STATUS_META: Record<RoadmapStatus, { text: string; badge: string; ring: string; border: string }> = {
  done: { text: "text-good", badge: "bg-good text-on-signal", ring: "ring-4 ring-good/15", border: "border-good" },
  learning: { text: "text-progress", badge: "bg-progress text-on-signal", ring: "ring-4 ring-progress/15", border: "border-progress" },
  todo: { text: "text-ink-dim", badge: "bg-surface", ring: "", border: "border-grid" },
};
const CARD_TINT: Record<RoadmapStatus, string> = {
  done: "bg-good/[0.04] border-good/25 hover:border-good/60",
  learning: "bg-progress/[0.05] border-progress/25 hover:border-progress/60",
  todo: "bg-surface border-grid hover:border-signal/40",
};
const NEXT: Record<RoadmapStatus, RoadmapStatus> = { todo: "learning", learning: "done", done: "todo" };
const ICON: Record<RoadmapStatus, string> = { done: "✓", learning: "", todo: "" };

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
        className="stroke-star transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

const pill = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 ${
    active ? "bg-star text-on-signal border-star" : "bg-surface-2 text-ink-dim border-grid hover:text-ink hover:border-signal/40"
  }`;

function Node({ node }: { node: RoadmapNode }) {
  const { t } = useTranslation(["roadmap", "common"]);
  const { data: health } = useHealth();
  const llm = health?.llm ?? false;
  const setRoadmapStatusMutation = useSetRoadmapStatus();
  const setSkillLevelMutation = useSetSkillLevel();
  const [open, setOpen] = useState(false);
  const [dyn, setDyn] = useState<KnowledgeData | null>(null);
  const [loadingDyn, setLoadingDyn] = useState(false);
  const [levelDraft, setLevelDraft] = useState(node.level);
  useEffect(() => setLevelDraft(node.level), [node.level]);
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
        aria-label={`${node.tech}: ${statusLabel}. ${t("nodeStatusHint")}`}
        className={`absolute left-0 top-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${meta.badge} ${meta.border} ${meta.ring}`}
      >
        {node.status === "learning" ? (
          <span className="flex items-center gap-0.5" aria-hidden>
            <span className="w-1 h-1 rounded-full bg-on-signal" />
            <span className="w-1 h-1 rounded-full bg-on-signal" />
            <span className="w-1 h-1 rounded-full bg-on-signal" />
          </span>
        ) : (
          ICON[node.status]
        )}
      </button>
      <div className={`rounded-xl border transition-colors ${CARD_TINT[node.status]}`}>
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
          <span className="font-semibold text-ink">{node.tech}</span>
          {node.demand > 0 && <Chip tone="indigo">{t("demandChip", { count: node.demand })}</Chip>}
          {node.known && <Chip tone="emerald">{t("inProfile")}</Chip>}
          <Chip tone={node.levelManual != null ? "amber" : "slate"}>{t("radar.tooltip.level", { level: node.level })}</Chip>
          {node.drillsTotal > 0 && (
            <Chip tone={node.drillsSolved === node.drillsTotal ? "emerald" : "slate"}>
              <span className="inline-flex items-center gap-1">
                <KeyboardIcon className="h-3 w-3" />
                {node.drillsSolved}/{node.drillsTotal}
              </span>
            </Chip>
          )}
          <span className={`ml-auto text-xs font-medium ${meta.text}`}>{statusLabel}</span>
          <span className="text-ink-dim text-xs w-3">{open ? "▾" : "▸"}</span>
        </button>
        {open && (
          <div className="px-3 pb-3 border-t border-surface-2 pt-3 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-ink-dim">{t("level.heading")}</span>
                <Chip tone={node.levelManual != null ? "amber" : "slate"}>
                  {node.levelManual != null ? t("level.manual") : t("level.auto")}
                </Chip>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={levelDraft}
                  onChange={(e) => setLevelDraft(Number(e.target.value))}
                  aria-label={t("level.sliderLabel", { tech: node.tech })}
                  className="flex-1 accent-signal"
                />
                <span className="text-sm font-semibold text-ink w-9 text-right">{levelDraft}</span>
                {levelDraft !== node.level && (
                  <Btn
                    size="sm"
                    loading={setSkillLevelMutation.isPending && setSkillLevelMutation.variables?.tech === node.tech}
                    onClick={() => setSkillLevelMutation.mutate({ tech: node.tech, level: levelDraft })}
                  >
                    {t("common:actions.save")}
                  </Btn>
                )}
                {node.levelManual != null && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    loading={setSkillLevelMutation.isPending && setSkillLevelMutation.variables?.tech === node.tech}
                    onClick={() => setSkillLevelMutation.mutate({ tech: node.tech, level: null })}
                  >
                    {t("level.reset")}
                  </Btn>
                )}
              </div>
              <div className="text-xs text-ink-dim mt-1">{t("level.hint")}</div>
              <div className="text-xs text-ink-dim mt-1">
                {t("radar.tooltip.parts", {
                  status: t(STATUS_LABEL_KEY[node.status]),
                  drills: node.levelParts.drills ?? t("level.none"),
                  recall: node.levelParts.recall ?? t("level.none"),
                })}
              </div>
              {node.practiceShared && (
                <div className="text-xs text-alert mt-1 flex items-start gap-1">
                  <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-px" />
                  {t("level.sharedTrack", { cat: node.practiceCat, tech: node.tech })}
                </div>
              )}
            </div>
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
                      className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 text-ink-dim hover:text-signal hover:bg-grid transition-colors"
                    >
                      {r.t} ↗
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
  // Radar, Materials and Intensive were each their own sidebar page once. All are views of the
  // SAME thing this page already computes — your skills against market demand — so they live here
  // as views rather than as separate destinations a newcomer has to tell apart by name ("Roadmap"
  // vs "Learning plan" vs "Intensive plan" all read as synonyms until you open them). /radar,
  // /learn and /plan21 all redirect here (see App.tsx's NAV).
  const [view, setViewUi] = useUi<RoadmapView>("roadmap.view", readStoredRoadmapView());
  const setView = (v: RoadmapView) => {
    setViewUi(v);
    storeRoadmapView(v);
  };
  const { data: health } = useHealth();
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
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t("view.list") },
              { value: "radar", label: t("view.radar") },
              { value: "materials", label: t("view.materials") },
              { value: "plan", label: t("view.plan") },
            ]}
          />
        }
      />

      {view === "radar" ? (
        <SkillRadar embedded />
      ) : view === "materials" ? (
        <Suspense fallback={<CardsSkeleton count={2} />}>
          <LearnPlan llm={health?.llm ?? false} embedded />
        </Suspense>
      ) : view === "plan" ? (
        <Suspense fallback={<CardsSkeleton count={3} />}>
          <Plan21 embedded />
        </Suspense>
      ) : (
        <>
          <Card className="relative overflow-hidden">
            {/* faint decorative rings in the corner — not a literal chart */}
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full border border-signal/10" />
            <div aria-hidden className="pointer-events-none absolute -right-4 -top-4 w-28 h-28 rounded-full border border-signal/10" />
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative shrink-0">
                <RadialProgress value={done} max={total} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-lg font-bold text-ink">{pct}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-[260px]">
                <div className="text-sm font-semibold text-ink mb-3">
                  {t("progress.prefix")} <span className="text-ink font-semibold">{done}</span> {t("progress.suffix", { count: total })}
                </div>
                {/* A hairline-gap grid of stat cells (thin 1px gaps between cells sharing one
                    border) instead of three loose pill chips. */}
                <div className="grid grid-cols-3 gap-px bg-grid border border-grid rounded-lg overflow-hidden">
                  <div className="bg-surface p-2.5">
                    <div className="eyebrow text-good">{t(STATUS_LABEL_KEY.done)}</div>
                    <div className="font-display text-xl font-bold text-ink mt-0.5">{done}</div>
                  </div>
                  <div className="bg-surface p-2.5">
                    <div className="eyebrow text-progress">{t(STATUS_LABEL_KEY.learning)}</div>
                    <div className="font-display text-xl font-bold text-ink mt-0.5">{learning}</div>
                  </div>
                  <div className="bg-surface p-2.5">
                    <div className="eyebrow text-ink-dim">{t(STATUS_LABEL_KEY.todo)}</div>
                    <div className="font-display text-xl font-bold text-ink mt-0.5">{total - done - learning}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-4 mt-4 border-t border-grid">
              <button onClick={() => setGroup("all")} className={pill(group === "all")}>
                {t("allAreas")}
              </button>
              {roadmap.groups.map((g) => (
                <button key={g.group} onClick={() => setGroup(g.group)} className={pill(group === g.group)}>
                  {roadmapGroupLabel(g.group)} <span className="opacity-60">· {g.nodes.length}</span>
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
              <EmptyState title={t("empty.title")} hint={t("empty.hint")} />
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
                        <div className="text-sm font-bold uppercase tracking-wide text-ink font-display truncate">
                          {roadmapGroupLabel(g.group)}
                        </div>
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

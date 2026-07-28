import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { Btn, Card, CardsSkeleton, Chip, PageHeader, ProgressBar } from "../../shared/ui";
import { useUi } from "../../shared/ui-state";
import { useHealth, useRoadmap, useSetRoadmapStatus } from "../../shared/queries";
import type { KnowledgeData, RoadmapNode, RoadmapStatus } from "../../shared/types";

const STATUS_META: Record<RoadmapStatus, { label: string; text: string; badge: string; icon: string }> = {
  done: { label: "Know it", text: "text-emerald-700", badge: "bg-emerald-500 text-white", icon: "✓" },
  learning: { label: "Learning", text: "text-amber-700", badge: "bg-amber-500 text-white", icon: "…" },
  todo: { label: "Not started", text: "text-slate-400", badge: "bg-white", icon: "" },
};
const NEXT: Record<RoadmapStatus, RoadmapStatus> = { todo: "learning", learning: "done", done: "todo" };

function Node({ node }: { node: RoadmapNode }) {
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
  const border = node.status === "done" ? "border-emerald-500" : node.status === "learning" ? "border-amber-500" : "border-slate-300";
  return (
    <div className="relative pl-8">
      <button
        onClick={() => setRoadmapStatusMutation.mutate({ tech: node.tech, status: NEXT[node.status] })}
        title="Click to change status (not started → learning → know it)"
        className={`absolute left-0 top-2 z-10 w-6 h-6 rounded-full border-2 ${border} ${meta.badge} flex items-center justify-center text-xs font-bold transition-colors`}
      >
        {meta.icon}
      </button>
      <div className="rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-colors">
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
          <span className="font-semibold text-slate-800">{node.tech}</span>
          {node.demand > 0 && <Chip tone="indigo">{node.demand} vac.</Chip>}
          {node.known && <Chip tone="emerald">in profile</Chip>}
          {node.drillsTotal > 0 && (
            <Chip tone={node.drillsSolved === node.drillsTotal ? "emerald" : "slate"}>
              ⌨ {node.drillsSolved}/{node.drillsTotal}
            </Chip>
          )}
          <span className={`ml-auto text-xs font-medium ${meta.text}`}>{meta.label}</span>
          <span className="text-slate-400 text-xs w-3">{open ? "▾" : "▸"}</span>
        </button>
        {open && (
          <div className="px-3 pb-3 border-t border-slate-100 pt-3 space-y-3">
            {loadingDyn && <div className="text-xs text-slate-400">✨ Personalizing to your stack…</div>}
            {dyn?.focus && (
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 text-sm text-indigo-900">
                <span className="font-semibold">✨ Personal focus:</span> {dyn.focus}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                What to learn
                {dyn?.source === "ai" && <Chip tone="indigo">AI for you</Chip>}
              </div>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {learn.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
            {node.drillsTotal > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  Practice problems: {node.drillsSolved}/{node.drillsTotal} solved
                </div>
                <ProgressBar value={node.drillsSolved} max={node.drillsTotal} tone="emerald" />
                <div className="text-xs text-slate-400 mt-1">Practice in the "Practice" tab → filter by topic.</div>
              </div>
            )}
            {resources.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Resources</div>
                <div className="flex flex-wrap gap-2">
                  {resources.map((r) => (
                    <a
                      key={r.u}
                      href={r.u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-indigo-600 hover:bg-slate-200 transition-colors"
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
  const { data: roadmap, isLoading } = useRoadmap();
  const [onlyGaps, setOnlyGaps] = useUi("roadmap.onlyGaps", false);
  const [group, setGroup] = useUi<string>("roadmap.group", "all");
  if (isLoading) return <CardsSkeleton count={3} />;
  if (!roadmap) return null;
  const { done, learning, total } = roadmap.progress;
  const groups = roadmap.groups
    .filter((g) => group === "all" || g.group === group)
    .map((g) => ({ ...g, nodes: onlyGaps ? g.nodes.filter((n) => n.status !== "done") : g.nodes }))
    .filter((g) => g.nodes.length > 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Skill roadmap"
        subtitle="A personal roadmap built from the real skills in your vacancies and CV. Click the circle to mark progress — it's all saved."
      />

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="text-sm font-semibold text-slate-700">
            Progress: <span className="text-emerald-600">{done}</span> / {total} skills
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500" /> know it
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-500" /> learning ({learning})
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white" /> not started
            </span>
          </div>
        </div>
        <ProgressBar value={done} max={total} tone="emerald" />
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-700"
          >
            <option value="all">All areas</option>
            {roadmap.groups.map((g) => (
              <option key={g.group} value={g.group}>
                {g.group}
              </option>
            ))}
          </select>
          <Btn variant={onlyGaps ? "primary" : "ghost"} size="sm" onClick={() => setOnlyGaps(!onlyGaps)}>
            {onlyGaps ? "✓ Gaps only" : "Gaps only"}
          </Btn>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {groups.map((g) => (
          <Card key={g.group}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-500">{g.group}</span>
              <span className="text-xs text-slate-400">· {g.nodes.length}</span>
            </div>
            <div className="relative space-y-3 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-px before:bg-slate-200">
              {g.nodes.map((n) => (
                <Node key={n.tech} node={n} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useLearn } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Chip, PageHeader } from "../../shared/ui";
import type { KnowledgeData, LearnGap } from "../../shared/types";

/* ---------- Learn Plan ---------- */
function LearnGapDetails({ gap, llm, defaultOpen }: { gap: LearnGap; llm: boolean; defaultOpen: boolean }) {
  const [dyn, setDyn] = useState<KnowledgeData | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const load = () => {
    if (loadedRef.current || !llm) return;
    loadedRef.current = true;
    setLoading(true);
    api
      .knowledge(gap.tech)
      .then(setDyn)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (defaultOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const topics = dyn?.learn ?? gap.learn;
  const resources = dyn?.resources ?? gap.resources;
  return (
    <details
      onToggle={(e) => e.currentTarget.open && load()}
      className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden"
      open={defaultOpen}
    >
      <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 select-none">
        <span className="font-semibold text-slate-800">{gap.tech}</span>
        <Chip tone="rose">{gap.count} vac.</Chip>
        {dyn?.source === "ai" && <Chip tone="indigo">AI for you</Chip>}
        <span className="ml-auto text-slate-400 text-sm">expand</span>
      </summary>
      <div className="px-4 pb-4 border-t border-slate-100 space-y-3">
        {loading && <div className="text-xs text-slate-400 mt-3">✨ Personalizing topics to your stack…</div>}
        {dyn?.focus && (
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 text-sm text-indigo-900 mt-3">
            <span className="font-semibold">✨ Personal focus:</span> {dyn.focus}
          </div>
        )}
        <div>
          <div className="text-xs text-slate-500 mt-3 mb-1">What to learn</div>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {topics.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Resources</div>
          <div className="flex flex-wrap gap-2">
            {resources.map((r) => (
              <a
                key={r.u}
                href={r.u}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-indigo-600 hover:bg-slate-200"
              >
                {r.t} ↗{r.ai ? " ✨" : ""}
              </a>
            ))}
          </div>
        </div>
        {gap.drills.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Practice problems (the "Practice" tab)</div>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              {gap.drills.map((d, i) => (
                <li key={i}>
                  {d.q} <span className="text-[10px] text-slate-400">({d.lvl})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
export function LearnPlan({ llm }: { llm: boolean }) {
  const { data: learn, isLoading } = useLearn();
  const [plan, setPlan] = useUi("learn.plan", "");
  const [busy, setBusy] = useState(false);
  const genPlan = async () => {
    setBusy(true);
    try {
      const r = await api.learnPlan();
      setPlan(
        r.offline
          ? "A personal AI plan is only available with the LLM enabled (set a key in server/.env). Below are materials prioritized by demand."
          : r.plan || "",
      );
    } finally {
      setBusy(false);
    }
  };
  if (isLoading) return <CardsSkeleton count={3} />;
  if (!learn) return null;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Learning plan"
        subtitle={`Built dynamically from ${learn.totalVacancies} added vacancies, compared against your profile. Close gaps top to bottom.`}
        actions={
          <Btn onClick={genPlan} loading={busy} disabled={!llm}>
            🤖 Personal plan (AI)
          </Btn>
        }
      />
      {learn.strengths.length > 0 && (
        <Card>
          <div className="text-xs text-slate-500 mb-1">✅ Your strengths against demand</div>
          <div className="flex flex-wrap gap-1">
            {learn.strengths.slice(0, 12).map((s) => (
              <Chip key={s.tech} tone="emerald">
                {s.tech} · {s.count}
              </Chip>
            ))}
          </div>
        </Card>
      )}
      {plan && (
        <Card>
          <div className="text-sm font-semibold mb-2 text-slate-700">🤖 Your personal plan</div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{plan}</div>
        </Card>
      )}

      <div className="text-sm text-slate-500">⚠️ Gaps by priority ({learn.gaps.length}):</div>
      {learn.gaps.length === 0 && (
        <Card>
          <div className="text-emerald-600 font-medium">🎉 You cover the entire stack of added vacancies!</div>
        </Card>
      )}
      {learn.gaps.map((g, idx) => (
        <LearnGapDetails key={g.tech} gap={g} llm={llm} defaultOpen={idx < 2} />
      ))}
    </div>
  );
}

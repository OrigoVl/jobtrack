import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useLearn } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Chip, PageHeader } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import type { KnowledgeData, LearnGap } from "../../shared/types";

/* ---------- Learn Plan ---------- */
function LearnGapDetails({ gap, llm, defaultOpen }: { gap: LearnGap; llm: boolean; defaultOpen: boolean }) {
  const { t } = useTranslation(["learn", "common"]);
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
      className="rounded-2xl bg-surface border border-grid shadow-card overflow-hidden"
      open={defaultOpen}
    >
      <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 select-none">
        <span className="font-semibold text-ink">{gap.tech}</span>
        <Chip tone="rose">{t("gapDetails.vacancyCount", { count: gap.count })}</Chip>
        {dyn?.source === "ai" && <Chip tone="indigo">{t("gapDetails.aiForYou")}</Chip>}
        <span className="ml-auto text-ink-dim text-sm">{t("gapDetails.expand")}</span>
      </summary>
      <div className="px-4 pb-4 border-t border-surface-2 space-y-3">
        {loading && <div className="text-xs text-ink-dim mt-3">{t("gapDetails.personalizing")}</div>}
        {dyn?.focus && (
          <div className="rounded-lg bg-signal/10 border border-signal/20 p-2.5 text-sm text-signal mt-3">
            <span className="font-semibold">{t("gapDetails.personalFocus")}</span> <Markdown text={dyn.focus} inline />
          </div>
        )}
        <div>
          <div className="text-xs text-ink-dim mt-3 mb-1">{t("gapDetails.whatToLearn")}</div>
          <ul className="list-disc pl-5 text-sm text-ink space-y-1">
            {topics.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs text-ink-dim mb-1">{t("gapDetails.resources")}</div>
          <div className="flex flex-wrap gap-2">
            {resources.map((r) => (
              <a
                key={r.u}
                href={r.u}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 text-ink-dim hover:text-signal hover:bg-grid"
              >
                {r.t} ↗
              </a>
            ))}
          </div>
        </div>
        {gap.drills.length > 0 && (
          <div>
            <div className="text-xs text-ink-dim mb-1">{t("gapDetails.practiceProblems")}</div>
            <ul className="list-disc pl-5 text-sm text-ink-dim space-y-1">
              {gap.drills.map((d, i) => (
                <li key={i}>
                  {d.q} <span className="text-[10px] text-ink-dim">({d.lvl})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
/** `embedded` skips this page's own PageHeader — used when rendered as the Roadmap's "Materials"
 * view (features/roadmap/roadmap.tsx), the same pattern MockInterview/DesignTrainer already use
 * inside Practice. The "personal plan" button that normally hangs off the header's `actions` slot
 * moves into the body instead of being dropped. */
export function LearnPlan({ llm, embedded = false }: { llm: boolean; embedded?: boolean }) {
  const { t } = useTranslation(["learn", "common"]);
  const { data: learn, isLoading } = useLearn();
  const [plan, setPlan] = useUi("learn.plan", "");
  const [busy, setBusy] = useState(false);
  const genPlan = async () => {
    setBusy(true);
    try {
      const r = await api.learnPlan();
      setPlan(r.offline ? t("offlinePlanFallback") : r.plan || "");
    } finally {
      setBusy(false);
    }
  };
  if (isLoading) return <CardsSkeleton count={3} />;
  if (!learn) return null;
  return (
    <div className="space-y-4">
      {embedded ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-ink-dim">{t("subtitle", { count: learn.totalVacancies })}</span>
          <Btn onClick={genPlan} loading={busy} disabled={!llm}>
            {t("personalPlanButton")}
          </Btn>
        </div>
      ) : (
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle", { count: learn.totalVacancies })}
          actions={
            <Btn onClick={genPlan} loading={busy} disabled={!llm}>
              {t("personalPlanButton")}
            </Btn>
          }
        />
      )}
      {learn.strengths.length > 0 && (
        <Card>
          <div className="text-xs text-ink-dim mb-1">{t("strengths")}</div>
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
          <div className="text-sm font-semibold mb-2 text-ink">{t("yourPlan")}</div>
          <Markdown text={plan} />
        </Card>
      )}

      <div className="text-sm text-ink-dim">{t("gapsByPriority", { count: learn.gaps.length })}</div>
      {learn.gaps.length === 0 && (
        <Card>
          <div className="text-ink font-medium">{t("allCovered")}</div>
        </Card>
      )}
      {learn.gaps.map((g, idx) => (
        <LearnGapDetails key={g.tech} gap={g} llm={llm} defaultOpen={idx < 2} />
      ))}
    </div>
  );
}

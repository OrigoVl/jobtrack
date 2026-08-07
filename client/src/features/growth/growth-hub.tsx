import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Card, CardsSkeleton, PageHeader, ProgressBar } from "../../shared/ui";
import { useLearn, usePlan21, useRoadmap, useStudy } from "../../shared/queries";
import { BookOpenIcon, CardsStackIcon, ListChecksIcon, MapIcon, type IconComponent } from "../../shared/icons";

// The four Growth pages, in the order they're listed both in the sidebar (App.tsx's NAV_DEF
// growth section) and below — not an order the user has to complete them in, just a consistent
// listing order.
const GROWTH_STAGE_PATHS = ["/roadmap", "/plan21", "/learn", "/study"] as const;

/** Overview page for the Growth pages (Roadmap, Intensive plan, Learning plan, Practice) —
 * each is its own independent page with its own content (not a sequence to complete in order), so
 * this deliberately does NOT number or rank them. It exists because each page's sidebar entry
 * alone doesn't show live progress at a glance — this collects all four with a progress readout
 * pulled from that page's own data, so a returning user can tell where they left off without
 * opening each one. Reachable via ⌘K — not a sidebar item itself (see App.tsx's NAV_DEF,
 * `sidebarHidden` on the /growth entry): the four pages are the sidebar-level navigation, this hub
 * is a supplementary overview, not a gate in front of them. */
export function GrowthHub() {
  const { t } = useTranslation(["growth", "common"]);
  const navigate = useNavigate();
  const { data: roadmap, isLoading: roadmapLoading } = useRoadmap();
  const { data: plan21, isLoading: plan21Loading } = usePlan21();
  const { data: learn, isLoading: learnLoading } = useLearn();
  const { data: study, isLoading: studyLoading } = useStudy();

  if (roadmapLoading || plan21Loading || learnLoading || studyLoading) return <CardsSkeleton count={4} />;

  const plan21Total = plan21?.phases.reduce((sum, p) => sum + p.days.length, 0) ?? 0;
  const plan21Done = plan21 ? Object.values(plan21.progress).filter(Boolean).length : 0;
  const gapCount = learn?.gaps.length ?? 0;

  const stages: {
    path: (typeof GROWTH_STAGE_PATHS)[number];
    icon: IconComponent;
    title: string;
    desc: string;
    stat: string;
    progress?: { value: number; max: number };
  }[] = [
    {
      path: GROWTH_STAGE_PATHS[0],
      icon: MapIcon,
      title: t("stages.roadmap.title"),
      desc: t("stages.roadmap.desc"),
      stat: t("stages.roadmap.stat", { done: roadmap?.progress.done ?? 0, total: roadmap?.progress.total ?? 0 }),
      progress: roadmap ? { value: roadmap.progress.done, max: roadmap.progress.total } : undefined,
    },
    {
      path: GROWTH_STAGE_PATHS[1],
      icon: ListChecksIcon,
      title: t("stages.plan21.title"),
      desc: t("stages.plan21.desc"),
      stat: t("stages.plan21.stat", { done: plan21Done, total: plan21Total }),
      progress: plan21 ? { value: plan21Done, max: plan21Total } : undefined,
    },
    {
      path: GROWTH_STAGE_PATHS[2],
      icon: BookOpenIcon,
      title: t("stages.learn.title"),
      desc: t("stages.learn.desc"),
      stat: gapCount > 0 ? t("stages.learn.stat", { count: gapCount }) : t("stages.learn.statEmpty"),
    },
    {
      path: GROWTH_STAGE_PATHS[3],
      icon: CardsStackIcon,
      title: t("stages.study.title"),
      desc: t("stages.study.desc"),
      stat: t("stages.study.stat", { learned: study?.learned ?? 0, total: study?.total ?? 0 }),
      progress: study ? { value: study.learned, max: study.total } : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {stages.map((stage) => (
          <button
            key={stage.path}
            onClick={() => navigate(stage.path)}
            className="group flex flex-col text-left rounded-card card-shadow bg-surface border border-grid p-4 hover:border-signal/40 transition-colors"
          >
            <div className="flex items-center gap-2.5 mb-2.5 min-w-0">
              <span className="w-8 h-8 shrink-0 rounded-full bg-surface-2 border border-grid flex items-center justify-center text-ink-dim group-hover:border-signal/40 group-hover:text-signal transition-colors">
                <stage.icon className="w-4 h-4" />
              </span>
              <span className="font-display font-bold text-ink min-w-0">{stage.title}</span>
            </div>
            <p className="text-sm text-ink-dim mb-3 flex-1">{stage.desc}</p>
            {stage.progress && <ProgressBar value={stage.progress.value} max={stage.progress.max} />}
            <div className="text-xs font-medium text-ink-dim mt-2">{stage.stat}</div>
          </button>
        ))}
      </div>
      <Card>
        <div className="text-sm text-ink-dim">{t("footerHint")}</div>
      </Card>
    </div>
  );
}

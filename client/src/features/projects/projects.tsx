import { useTranslation } from "react-i18next";
import { useProjects, useSetProjectItem } from "../../shared/queries";
import { Card, CardsSkeleton, Chip, PageHeader, ProgressBar } from "../../shared/ui";

/* ---------- Pet projects ---------- */
export function Projects() {
  const { t } = useTranslation(["projects", "common"]);
  const { data: projects, isLoading } = useProjects();
  const setProjectItemMutation = useSetProjectItem();
  if (isLoading || !projects) return <CardsSkeleton count={3} />;
  const totalItems = projects.projects.reduce((a, p) => a + p.dod.length, 0);
  const doneItems = Object.values(projects.progress).filter(Boolean).length;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<Chip tone="emerald">{t("doneCount", { done: doneItems, total: totalItems })}</Chip>}
      />
      <div className="grid lg:grid-cols-2 gap-4">
        {projects.projects.map((p) => {
          const done = p.dod.filter((d) => projects.progress[d.id]).length;
          return (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-ink text-lg">{p.name}</span>
                <Chip tone="indigo">{p.phase}</Chip>
                {p.personalized && <Chip tone="emerald">{t("aiIdea")}</Chip>}
              </div>
              <div className="text-xs text-ink-dim">{p.subtitle}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.tech.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-surface-2 text-ink-dim">
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-sm text-ink-dim mt-3">{p.goal}</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-ink-dim mb-1">
                  <span>{t("definitionOfDone")}</span>
                  <span>{t("progress", { done, total: p.dod.length })}</span>
                </div>
                <ProgressBar value={done} max={p.dod.length} tone="emerald" />
              </div>
              <ul className="mt-3 space-y-1.5">
                {p.dod.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-start gap-2 text-sm cursor-pointer group">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={!!projects.progress[d.id]}
                        onChange={(e) => setProjectItemMutation.mutate({ itemId: d.id, done: e.target.checked })}
                      />
                      <span className={projects.progress[d.id] ? "line-through text-ink-dim" : "text-ink"}>{d.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

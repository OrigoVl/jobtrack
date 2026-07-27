import { useStore } from "../../shared/store";
import { Card, CardsSkeleton, Chip, PageHeader, ProgressBar } from "../../shared/ui";

/* ---------- Pet-проєкти ---------- */
export function Projects() {
  const { projects, setProjectItem } = useStore();
  if (!projects) return <CardsSkeleton count={3} />;
  const totalItems = projects.projects.reduce((a, p) => a + p.dod.length, 0);
  const doneItems = Object.values(projects.progress).filter(Boolean).length;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Pet-проєкти"
        subtitle="Драбина з 4 проєктів на стеку вакансій. Кожен закриває конкретну прогалину й стає доказом навичок на GitHub. Відмічай пункти Definition of Done."
        actions={
          <Chip tone="emerald">
            {doneItems} / {totalItems} готово
          </Chip>
        }
      />
      <div className="grid lg:grid-cols-2 gap-4">
        {projects.projects.map((p) => {
          const done = p.dod.filter((d) => projects.progress[d.id]).length;
          return (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-lg">{p.name}</span>
                <Chip tone="indigo">{p.phase}</Chip>
              </div>
              <div className="text-xs text-slate-500">{p.subtitle}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.tech.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-600 mt-3">{p.goal}</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Definition of Done</span>
                  <span>
                    {done} / {p.dod.length}
                  </span>
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
                        onChange={(e) => setProjectItem(d.id, e.target.checked)}
                      />
                      <span className={projects.progress[d.id] ? "line-through text-slate-400" : "text-slate-700"}>{d.text}</span>
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

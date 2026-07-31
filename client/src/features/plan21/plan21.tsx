import { usePlan21, useSetPlanDay } from "../../shared/queries";
import { Card, CardsSkeleton, Chip, PageHeader, ProgressBar } from "../../shared/ui";
import { plural } from "../../shared/format";

/* ---------- Fast-track intensive plan (day count is dynamic — driven by the candidate's
   actual skill gaps, not a fixed number, so the name/copy here deliberately avoid promising
   a specific day count like "21-Day") ---------- */
export function Plan21() {
  const { data: plan21, isLoading } = usePlan21();
  const setPlanDayMutation = useSetPlanDay();
  if (isLoading || !plan21) return <CardsSkeleton count={3} />;
  const allDays = plan21.phases.flatMap((p) => p.days);
  const done = allDays.filter((d) => plan21.progress[d.id]).length;
  const pct = allDays.length ? Math.round((done / allDays.length) * 100) : 0;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Intensive plan"
        subtitle="The plan builds itself automatically from your gaps: demand from your vacancy list minus skills from your CV/profile. Add a vacancy or update your CV — phases rebuild to match the current gaps."
        actions={<Chip tone="emerald">{plural(allDays.length, "day")} total</Chip>}
      />
      <Card>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-ink">
            {plural(done, "day")} done of {allDays.length}
          </span>
          <span className="text-ink-dim">{pct}%</span>
        </div>
        <ProgressBar value={done} max={allDays.length} tone="emerald" />
      </Card>
      {plan21.phases.map((ph) => (
        <Card key={ph.id}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-ink">{ph.title}</span>
            <Chip tone="indigo">{ph.range}</Chip>
          </div>
          {ph.note && <p className="text-sm text-ink-dim mt-1">{ph.note}</p>}
          <div className="mt-3 space-y-2">
            {ph.days.map((d) => (
              <label
                key={d.id}
                className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                  plan21.progress[d.id] ? "bg-signal/10 border-signal/30" : "bg-surface-2 border-grid hover:bg-surface-2"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!plan21.progress[d.id]}
                  onChange={(e) => setPlanDayMutation.mutate({ dayId: d.id, done: e.target.checked })}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-ink text-sm">Day {d.day}</div>
                  <div className="text-sm text-ink-dim mt-0.5">
                    <span className="text-ink-dim">Theory:</span> {d.theory}
                  </div>
                  <div className="text-sm text-ink-dim">
                    <span className="text-ink-dim">Practice:</span> {d.practice}
                  </div>
                  {d.warmup && <div className="text-xs text-ink-dim mt-0.5">🔁 Warm-up: {d.warmup}</div>}
                </div>
              </label>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

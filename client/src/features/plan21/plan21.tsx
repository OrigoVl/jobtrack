import { usePlan21, useSetPlanDay } from "../../shared/queries";
import { Card, CardsSkeleton, Chip, PageHeader, ProgressBar } from "../../shared/ui";

/* ---------- Fast-track 21-day plan ---------- */
export function Plan21() {
  const { data: plan21, isLoading } = usePlan21();
  const setPlanDayMutation = useSetPlanDay();
  if (isLoading || !plan21) return <CardsSkeleton count={3} />;
  const allDays = plan21.phases.flatMap((p) => p.days);
  const done = allDays.filter((d) => plan21.progress[d.id]).length;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Personal intensive"
        subtitle="The plan builds itself automatically from your gaps: demand from your vacancy list minus skills from your CV/profile. Add a vacancy or update your CV — phases rebuild to match the current gaps."
        actions={
          <Chip tone="emerald">
            {done} / {allDays.length} days
          </Chip>
        }
      />
      <Card>
        <ProgressBar value={done} max={allDays.length} tone="emerald" />
      </Card>
      {plan21.phases.map((ph) => (
        <Card key={ph.id}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">{ph.title}</span>
            <Chip tone="indigo">{ph.range}</Chip>
          </div>
          {ph.note && <p className="text-sm text-slate-500 mt-1">{ph.note}</p>}
          <div className="mt-3 space-y-2">
            {ph.days.map((d) => (
              <label
                key={d.id}
                className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                  plan21.progress[d.id] ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!plan21.progress[d.id]}
                  onChange={(e) => setPlanDayMutation.mutate({ dayId: d.id, done: e.target.checked })}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 text-sm">Day {d.day}</div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    <span className="text-slate-400">Theory:</span> {d.theory}
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="text-slate-400">Practice:</span> {d.practice}
                  </div>
                  {d.warmup && <div className="text-xs text-slate-400 mt-0.5">🔁 Warm-up: {d.warmup}</div>}
                </div>
              </label>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

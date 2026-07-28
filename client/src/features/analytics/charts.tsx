import {
  Bar,
  BarChart,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardsSkeleton, EmptyState, PageHeader } from "../../shared/ui";
import { useAnalytics } from "../../shared/queries";

const AXIS = "#64748b";
const TOOLTIP = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 8px 24px -12px rgba(16,24,40,0.25)",
  color: "#0f172a",
} as const;

// `embedded` skips the page's own header — used when nested as a tab inside the Roadmap page
// (see roadmap.tsx), which already has its own header for the combined "Roadmap / Radar" screen.
export function SkillRadar({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: analytics, isLoading } = useAnalytics();
  const data = analytics?.radar ?? [];
  if (isLoading) return <CardsSkeleton count={1} />;
  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="Skill radar"
          subtitle="Your skills against real market demand (computed from the stack of added vacancies). Where green is smaller than purple — that's a gap."
        />
      )}
      <Card>
        {data.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No data yet"
            hint="Add vacancies or analyze their stack — and the radar will show up automatically."
          />
        ) : (
          <div style={{ height: 400 }}>
            <ResponsiveContainer>
              <RadarChart data={data}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="tech" tick={{ fill: AXIS, fontSize: 12 }} />
                <Radar name="Market demand" dataKey="demand" stroke="#6366f1" fill="#6366f1" fillOpacity={0.22} />
                <Radar name="You" dataKey="you" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                <Legend />
                <Tooltip contentStyle={TOOLTIP} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

export function Analytics() {
  const { data: analytics, isLoading } = useAnalytics();
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!analytics) return null;
  const funnel = Object.entries(analytics.funnel).map(([name, value]) => ({ name, value }));
  const funnelReached = Object.entries(analytics.funnelReached ?? {}).map(([name, value]) => ({ name, value }));
  const demand = Object.entries(analytics.demand)
    .map(([name, value]) => ({ name, value }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 12);
  const hasData = Object.values(analytics.demand).some(Boolean);
  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" subtitle="Your application funnel and technology demand — all computed from real data." />
      {!hasData ? (
        <Card>
          <EmptyState icon="📊" title="Empty for now" hint="Add vacancies and their stack — the charts will fill in on their own." />
        </Card>
      ) : (
        <>
          <Card>
            <div className="text-sm font-semibold mb-3 text-slate-700">Application funnel</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={funnel}>
                  <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: AXIS }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} contentStyle={TOOLTIP} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnel.map((_, i) => (
                      <Cell key={i} fill="#6366f1" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold mb-1 text-slate-700">How many vacancies ever reached this stage</div>
            <p className="text-xs text-slate-500 mb-3">
              Unlike the "Application funnel" above (where things stand now), this shows how many vacancies passed through each stage at
              least once, ever, regardless of how it ended up (e.g. a rejection at the interview stage still counts here).
            </p>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={funnelReached}>
                  <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: AXIS }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} contentStyle={TOOLTIP} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnelReached.map((_, i) => (
                      <Cell key={i} fill="#8b5cf6" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          {analytics.conversion.some((c) => c.rate != null) && (
            <Card>
              <div className="text-sm font-semibold mb-1 text-slate-700">Conversion between stages</div>
              <p className="text-xs text-slate-500 mb-3">
                What share of vacancies that reached a stage also reached the next one — shows where your funnel actually "filters".
              </p>
              <div className="space-y-2">
                {analytics.conversion.map((c) => (
                  <div key={`${c.from}-${c.to}`} className="flex items-center gap-3 text-sm">
                    <div className="w-56 shrink-0 truncate text-slate-600">
                      {c.from} → {c.to}
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      {c.rate != null && (
                        <div
                          className={`h-full rounded-full ${c.rate >= 50 ? "bg-emerald-500" : c.rate >= 20 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${c.rate}%` }}
                        />
                      )}
                    </div>
                    <div className="w-12 text-right font-semibold text-slate-700">{c.rate != null ? `${c.rate}%` : "—"}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {analytics.stageDurations.length > 0 && (
            <Card>
              <div className="text-sm font-semibold mb-1 text-slate-700">Where each step "gets stuck" the longest</div>
              <p className="text-xs text-slate-500 mb-3">
                Average number of days between a vacancy entering this stage and its next status change.
              </p>
              <div style={{ height: Math.max(120, analytics.stageDurations.length * 40) }}>
                <ResponsiveContainer>
                  <BarChart data={analytics.stageDurations} layout="vertical">
                    <XAxis type="number" tick={{ fill: AXIS }} allowDecimals={false} unit="d" />
                    <YAxis type="category" dataKey="status" width={110} tick={{ fill: AXIS, fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(99,102,241,0.06)" }}
                      contentStyle={TOOLTIP}
                      formatter={(v: unknown) => [`${String(v)}d`, "Average"] as [string, string]}
                    />
                    <Bar dataKey="avgDays" radius={[0, 6, 6, 0]} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card>
            <div className="text-sm font-semibold mb-3 text-slate-700">Technology demand (from added vacancies)</div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={demand} layout="vertical">
                  <XAxis type="number" tick={{ fill: AXIS }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fill: AXIS, fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "rgba(16,185,129,0.06)" }} contentStyle={TOOLTIP} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

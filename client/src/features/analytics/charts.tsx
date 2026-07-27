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

export function SkillRadar() {
  const { data: analytics, isLoading } = useAnalytics();
  const data = analytics?.radar ?? [];
  if (isLoading) return <CardsSkeleton count={1} />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Skill-radar"
        subtitle="Твої навички проти реального попиту ринку (рахується зі стеку доданих вакансій). Де зелене менше за фіолетове — там прогалина."
      />
      <Card>
        {data.length === 0 ? (
          <EmptyState icon="🎯" title="Ще немає даних" hint="Додай вакансії або спарси їхній стек — і радар зʼявиться автоматично." />
        ) : (
          <div style={{ height: 400 }}>
            <ResponsiveContainer>
              <RadarChart data={data}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="tech" tick={{ fill: AXIS, fontSize: 12 }} />
                <Radar name="Попит ринку" dataKey="demand" stroke="#6366f1" fill="#6366f1" fillOpacity={0.22} />
                <Radar name="Ти" dataKey="you" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
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
      <PageHeader title="Аналітика" subtitle="Воронка твоїх подач і попит на технології — усе рахується з реальних даних." />
      {!hasData && (
        <Card>
          <EmptyState icon="📊" title="Поки що порожньо" hint="Додай вакансії та їхній стек — графіки заповняться самі." />
        </Card>
      )}
      <Card>
        <div className="text-sm font-semibold mb-3 text-slate-700">Воронка подач</div>
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
        <div className="text-sm font-semibold mb-1 text-slate-700">Скільки вакансій колись досягли етапу</div>
        <p className="text-xs text-slate-500 mb-3">
          На відміну від «Воронки подач» вище (де зараз), тут — скільки вакансій за весь час хоч раз пройшли через кожен етап, незалежно від
          того, чим усе закінчилось (напр. відхилення на співбесіді все одно рахується тут).
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
          <div className="text-sm font-semibold mb-1 text-slate-700">Конверсія між етапами</div>
          <p className="text-xs text-slate-500 mb-3">
            Яка частка вакансій, що дійшли до етапу, дійшла й до наступного — показує, де реально «фільтрує» твоя воронка.
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
          <div className="text-sm font-semibold mb-1 text-slate-700">Де довше «застрягає» кожен крок</div>
          <p className="text-xs text-slate-500 mb-3">
            Середня к-сть днів між тим, як вакансія потрапила на цей етап, і наступною зміною статусу.
          </p>
          <div style={{ height: Math.max(120, analytics.stageDurations.length * 40) }}>
            <ResponsiveContainer>
              <BarChart data={analytics.stageDurations} layout="vertical">
                <XAxis type="number" tick={{ fill: AXIS }} allowDecimals={false} unit="д" />
                <YAxis type="category" dataKey="status" width={110} tick={{ fill: AXIS, fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "rgba(99,102,241,0.06)" }}
                  contentStyle={TOOLTIP}
                  formatter={(v: unknown) => [`${String(v)} дн.`, "Середньо"] as [string, string]}
                />
                <Bar dataKey="avgDays" radius={[0, 6, 6, 0]} fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card>
        <div className="text-sm font-semibold mb-3 text-slate-700">Попит на технології (з доданих вакансій)</div>
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
    </div>
  );
}

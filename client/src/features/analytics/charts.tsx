import { useTranslation } from "react-i18next";
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
import { statusLabel } from "../../shared/status-labels";

const AXIS = "#4c5f56"; // --ink-dim
const TOOLTIP = {
  background: "#ffffff", // --surface
  border: "1px solid #d4e0d8", // --grid
  borderRadius: 12,
  boxShadow: "0 8px 24px -12px rgba(16,24,40,0.25)",
  color: "#0e1613", // --ink
} as const;

// `embedded` skips the page's own header — used when nested as a tab inside the Roadmap page
// (see roadmap.tsx), which already has its own header for the combined "Roadmap / Radar" screen.
export function SkillRadar({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation(["analytics", "common"]);
  const { data: analytics, isLoading } = useAnalytics();
  const data = analytics?.radar ?? [];
  if (isLoading) return <CardsSkeleton count={1} />;
  return (
    <div className="space-y-4">
      {!embedded && <PageHeader title={t("radar.title")} subtitle={t("radar.subtitle")} />}
      <Card>
        {data.length === 0 ? (
          <EmptyState icon="🎯" title={t("radar.empty.title")} hint={t("radar.empty.hint")} />
        ) : (
          <div style={{ height: 400 }}>
            <ResponsiveContainer>
              <RadarChart data={data}>
                <PolarGrid stroke="#d4e0d8" />
                <PolarAngleAxis dataKey="tech" tick={{ fill: AXIS, fontSize: 12 }} />
                <Radar name={t("radar.marketDemand")} dataKey="demand" stroke="#b45309" fill="#b45309" fillOpacity={0.22} />
                <Radar name={t("radar.you")} dataKey="you" stroke="#0e8f5c" fill="#0e8f5c" fillOpacity={0.4} />
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
  const { t } = useTranslation(["analytics", "common"]);
  const { data: analytics, isLoading } = useAnalytics();
  if (isLoading) return <CardsSkeleton count={2} />;
  if (!analytics) return null;
  // funnel/funnelReached are keyed by VacancyStatus wire values (see server/src/modules/analytics)
  // — statusLabel() maps the wire value to its translated display label, same as Vacancies/Dashboard.
  const funnel = Object.entries(analytics.funnel).map(([name, value]) => ({ name: statusLabel(name), value }));
  const funnelReached = Object.entries(analytics.funnelReached ?? {}).map(([name, value]) => ({ name: statusLabel(name), value }));
  const demand = Object.entries(analytics.demand)
    .map(([name, value]) => ({ name, value }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 12);
  const hasData = Object.values(analytics.demand).some(Boolean);
  const stageDurationsData = analytics.stageDurations.map((d) => ({ ...d, status: statusLabel(d.status) }));
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {!hasData ? (
        <Card>
          <EmptyState icon="📊" title={t("empty.title")} hint={t("empty.hint")} />
        </Card>
      ) : (
        <>
          <Card>
            <div className="text-sm font-semibold mb-3 text-ink">{t("funnel.heading")}</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={funnel}>
                  <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: AXIS }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(14,143,92,0.08)" }} contentStyle={TOOLTIP} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnel.map((_, i) => (
                      <Cell key={i} fill="#0e8f5c" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <div className="text-sm font-semibold mb-1 text-ink">{t("funnelReached.heading")}</div>
            <p className="text-xs text-ink-dim mb-3">{t("funnelReached.description")}</p>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={funnelReached}>
                  <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: AXIS }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(14,143,92,0.08)" }} contentStyle={TOOLTIP} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnelReached.map((_, i) => (
                      <Cell key={i} fill="#b45309" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          {analytics.conversion.some((c) => c.rate != null) && (
            <Card>
              <div className="text-sm font-semibold mb-1 text-ink">{t("conversion.heading")}</div>
              <p className="text-xs text-ink-dim mb-3">{t("conversion.description")}</p>
              <div className="space-y-2">
                {analytics.conversion.map((c) => (
                  <div key={`${c.from}-${c.to}`} className="flex items-center gap-3 text-sm">
                    <div className="w-56 shrink-0 truncate text-ink-dim">
                      {statusLabel(c.from)} → {statusLabel(c.to)}
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                      {c.rate != null && (
                        <div
                          className={`h-full rounded-full ${c.rate >= 50 ? "bg-signal" : c.rate >= 20 ? "bg-alert" : "bg-rose-500"}`}
                          style={{ width: `${c.rate}%` }}
                        />
                      )}
                    </div>
                    <div className="w-12 text-right font-semibold text-ink">{c.rate != null ? `${c.rate}%` : "—"}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {analytics.stageDurations.length > 0 && (
            <Card>
              <div className="text-sm font-semibold mb-1 text-ink">{t("stageDurations.heading")}</div>
              <p className="text-xs text-ink-dim mb-3">{t("stageDurations.description")}</p>
              <div style={{ height: Math.max(120, analytics.stageDurations.length * 40) }}>
                <ResponsiveContainer>
                  <BarChart data={stageDurationsData} layout="vertical">
                    <XAxis type="number" tick={{ fill: AXIS }} allowDecimals={false} unit={t("stageDurations.unit")} />
                    <YAxis type="category" dataKey="status" width={110} tick={{ fill: AXIS, fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(14,143,92,0.08)" }}
                      contentStyle={TOOLTIP}
                      formatter={(v: unknown) =>
                        [`${String(v)}${t("stageDurations.unit")}`, t("stageDurations.average")] as [string, string]
                      }
                    />
                    <Bar dataKey="avgDays" radius={[0, 6, 6, 0]} fill="#b45309" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card>
            <div className="text-sm font-semibold mb-3 text-ink">{t("demand.heading")}</div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={demand} layout="vertical">
                  <XAxis type="number" tick={{ fill: AXIS }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fill: AXIS, fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "rgba(14,143,92,0.08)" }} contentStyle={TOOLTIP} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#0e8f5c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

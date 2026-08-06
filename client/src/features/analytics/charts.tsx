import { useTranslation } from "react-i18next";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardsSkeleton, EmptyState, PageHeader } from "../../shared/ui";
import { useAnalytics } from "../../shared/queries";
import { statusLabel } from "../../shared/status-labels";

// CSS custom properties (not hardcoded hex) so these Recharts props — which take inline styles/SVG
// props, not Tailwind classes — stay correct across the light/dark toggle and the token repaint.
const AXIS = "rgb(var(--ink-dim))";
const TOOLTIP = {
  background: "rgb(var(--surface))",
  border: "1px solid rgb(var(--grid))",
  borderRadius: 12,
  boxShadow: "0 8px 24px -12px rgb(var(--ink) / 0.25)",
  color: "rgb(var(--ink))",
} as const;
// `contentStyle`'s `color` only styles the tooltip's own wrapper <div> — Recharts renders the
// label and each value line as separate elements with their OWN default inline color (the value
// line in particular defaults to the hovered series' own fill/stroke, e.g. the bar's `--star`/
// `--horizon`), ignoring `contentStyle.color` entirely. Left unset, that read as "dark, hard to
// read text" in dark mode (an indigo/orange value line on an already-dark tooltip background).
// `labelStyle`/`itemStyle` are the actual props Recharts uses for those two pieces — set both to
// the same plain `--ink` so the whole tooltip is one legible color regardless of series/theme.
const TOOLTIP_LABEL = { color: "rgb(var(--ink))", fontWeight: 600 } as const;
const TOOLTIP_ITEM = { color: "rgb(var(--ink))" } as const;

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
  // `avgDaysPlot` is what the Bar actually plots; `avgDays` (the real figure, possibly 0) is what
  // the Tooltip/LabelList display. Recharts doesn't just render a 0-value bar as an invisible
  // 0-width rectangle — it drops the rectangle from its internal render list ENTIRELY (confirmed
  // via its `rects` array coming back empty), which also means NO `<LabelList>` entry exists to
  // attach a label to. So a stage everyone clears same-day (a legitimate `avgDays: 0`) rendered as
  // a completely bare chart — axis and category name, nothing else — reading as broken, not "the
  // real average is zero". Plotting a hairline non-zero stand-in keeps the rectangle (and its
  // label) in Recharts' render list while every actual number shown to the user stays the real one.
  const stageDurationsData = analytics.stageDurations.map((d) => ({
    ...d,
    status: statusLabel(d.status),
    avgDaysPlot: d.avgDays > 0 ? d.avgDays : 0.05,
  }));
  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      {!hasData ? (
        <Card>
          <EmptyState title={t("empty.title")} hint={t("empty.hint")} />
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
                  <Tooltip
                    cursor={{ fill: "rgb(var(--star) / 0.12)" }}
                    contentStyle={TOOLTIP}
                    labelStyle={TOOLTIP_LABEL}
                    itemStyle={TOOLTIP_ITEM}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnel.map((_, i) => (
                      <Cell key={i} fill="rgb(var(--star))" />
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
                  <Tooltip
                    cursor={{ fill: "rgb(var(--horizon) / 0.12)" }}
                    contentStyle={TOOLTIP}
                    labelStyle={TOOLTIP_LABEL}
                    itemStyle={TOOLTIP_ITEM}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnelReached.map((_, i) => (
                      <Cell key={i} fill="rgb(var(--horizon))" />
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
                          className={`h-full rounded-full ${c.rate >= 50 ? "bg-good" : c.rate >= 20 ? "bg-star" : "bg-rose-500"}`}
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
                      cursor={{ fill: "rgb(var(--horizon) / 0.12)" }}
                      contentStyle={TOOLTIP}
                      labelStyle={TOOLTIP_LABEL}
                      itemStyle={TOOLTIP_ITEM}
                      // Reads `item.payload.avgDays` (the REAL figure), not the raw plotted value —
                      // the Bar below tracks `avgDaysPlot`, a stand-in for legitimately-zero stages
                      // (see stageDurationsData's own comment), which the tooltip must never show.
                      formatter={(_v: unknown, _name: unknown, item: { payload?: { avgDays?: number } }) =>
                        [`${String(item.payload?.avgDays ?? 0)}${t("stageDurations.unit")}`, t("stageDurations.average")] as [
                          string,
                          string,
                        ]
                      }
                    />
                    <Bar dataKey="avgDaysPlot" radius={[0, 6, 6, 0]} fill="rgb(var(--horizon))" isAnimationActive={false}>
                      <LabelList
                        dataKey="avgDays"
                        position="right"
                        fill="rgb(var(--ink-dim))"
                        fontSize={11}
                        formatter={(v: unknown) => `${String(v)}${t("stageDurations.unit")}`}
                      />
                    </Bar>
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
                  <Tooltip
                    cursor={{ fill: "rgb(var(--star) / 0.12)" }}
                    contentStyle={TOOLTIP}
                    labelStyle={TOOLTIP_LABEL}
                    itemStyle={TOOLTIP_ITEM}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="rgb(var(--star))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

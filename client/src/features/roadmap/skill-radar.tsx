import { useTranslation } from "react-i18next";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardsSkeleton, EmptyState } from "../../shared/ui";
import { useRoadmap } from "../../shared/queries";
import { buildRadarSeries, RADAR_AXES_FULL, RADAR_MIN_AXES, STATUS_LABEL_KEY, type RadarAxis } from "./radar-data";

function RadarTooltip({ active, payload }: { active?: boolean; payload?: { payload: RadarAxis }[] }) {
  const { t } = useTranslation(["roadmap", "common"]);
  if (!active || !payload?.length) return null;
  const axis = payload[0]!.payload;
  const none = t("level.none");
  return (
    <div className="rounded-xl border border-grid bg-surface px-3 py-2.5 text-xs shadow-lg space-y-1 max-w-[220px]">
      <div className="font-semibold text-ink text-sm">{axis.tech}</div>
      <div className="text-ink-dim">{t("radar.tooltip.demand", { count: axis.demand, pct: axis.demandPct })}</div>
      <div className="text-ink font-medium">{t("radar.tooltip.level", { level: axis.level })}</div>
      <div className="text-ink-dim">
        {t("radar.tooltip.parts", {
          status: t(STATUS_LABEL_KEY[axis.status]),
          drills: axis.levelParts.drills ?? none,
          recall: axis.levelParts.recall ?? none,
        })}
      </div>
      {axis.levelManual != null && <div className="text-alert font-medium">{t("radar.tooltip.manual")}</div>}
      {axis.practiceShared && <div className="text-ink-dim italic">{t("radar.tooltip.sharedTrack", { cat: axis.practiceCat })}</div>}
    </div>
  );
}

// `embedded` skips the page's own header — used when nested as a tab inside the Roadmap page
// (see roadmap.tsx), which already has its own header for the combined "Roadmap / Radar" screen.
export function SkillRadar({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation(["roadmap", "common"]);
  const { data: roadmap, isLoading } = useRoadmap();
  const nodes = roadmap?.groups.flatMap((g) => g.nodes) ?? [];
  const axes = buildRadarSeries(nodes, RADAR_AXES_FULL);
  if (isLoading) return <CardsSkeleton count={1} />;
  const gapSummary = axes.length > 0 ? [...axes].sort((a, b) => b.demandPct - a.demandPct - (b.level - a.level))[0] : undefined;
  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{t("radar.title")}</h1>
          <p className="text-sm text-ink-dim mt-1">{t("radar.subtitle")}</p>
        </div>
      )}
      <Card>
        {axes.length === 0 ? (
          <EmptyState title={t("radar.empty.title")} hint={t("radar.empty.hint")} />
        ) : axes.length < RADAR_MIN_AXES ? (
          <EmptyState title={t("radar.empty.title")} hint={t("radar.tooFew")} />
        ) : (
          <div
            role="img"
            aria-label={
              gapSummary
                ? `${t("radar.title")}: ${gapSummary.tech} ${t("radar.tooltip.level", { level: gapSummary.level })}`
                : t("radar.title")
            }
          >
            <div style={{ height: 400 }}>
              <ResponsiveContainer>
                <RadarChart data={axes}>
                  <PolarGrid stroke="rgb(var(--grid))" />
                  <PolarAngleAxis dataKey="tech" tick={{ fill: "rgb(var(--ink-dim))", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  {/* Recharts derives the <Legend> swatch color from these stroke/fill PROPS, not from a
                      className — a Tailwind class colors the SVG path but leaves the legend icon blank.
                      Using the design tokens' CSS vars (index.css) instead of hex keeps this dark-mode-correct:
                      the vars themselves flip value under the dark theme, so the swatch/line stay in sync.
                      --chart-1/--chart-2 (not --signal/--alert, which are the same value — see index.css's
                      glossary note) so the two series are actually distinguishable, not one hue at two
                      opacities — see index.css's token comments for the dataviz-skill validation.
                      `dot` renders a small marker at every axis vertex on both series: with the full
                      8-axis view, a skill you haven't started sits at `level: 0` for several axes at
                      once, so the "you" polygon can collapse to a sliver near the center — the line
                      alone barely registers there. A dot still marks exactly which axis that 0 belongs
                      to (and the tooltip is still reachable on it), instead of the gap silently reading
                      as "no data" rather than "you're at 0 here". */}
                  <Radar
                    name={t("radar.marketDemand")}
                    dataKey="demandPct"
                    stroke="rgb(var(--chart-2))"
                    fill="rgb(var(--chart-2))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={{ r: 3, fill: "rgb(var(--chart-2))", strokeWidth: 0 }}
                  />
                  <Radar
                    name={t("radar.you")}
                    dataKey="level"
                    stroke="rgb(var(--chart-1))"
                    fill="rgb(var(--chart-1))"
                    fillOpacity={0.35}
                    strokeWidth={2}
                    dot={{ r: 3, fill: "rgb(var(--chart-1))", strokeWidth: 0 }}
                  />
                  <Legend />
                  <Tooltip content={<RadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-ink-dim text-center mt-2">{t("radar.scaleNote")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

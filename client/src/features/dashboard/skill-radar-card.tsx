import { useTranslation } from "react-i18next";
import { Card } from "../../shared/ui";
import { buildRadarSeries, RADAR_AXES_COMPACT, RADAR_MIN_AXES } from "../roadmap/radar-data";
import type { RoadmapNode } from "../../shared/types";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 78;
// Horizontal breathing room for the axis LABELS, which sit outside the circle and were being
// clipped by the viewBox at both ends ("Kubernetes" rendered as "etes", "React" as "Reac").
// Added as viewBox padding rather than by shrinking RADIUS, so the chart itself stays the same
// size; only the box around it grows. Sized for the longest label the compact axis set produces.
const LABEL_PAD = 56;
const RINGS = [1, 0.66, 0.33];

function point(index: number, count: number, value: number, radius = RADIUS): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return [CENTER + radius * (value / 100) * Math.cos(angle), CENTER + radius * (value / 100) * Math.sin(angle)];
}

/** Hand-rolled SVG radar (no Recharts) — the compact Dashboard card only needs a handful of
 * polygons, and pulling in the 349 KB Recharts chunk onto the app's default route for that would
 * be a real first-paint regression. See features/roadmap/skill-radar.tsx for the full Recharts
 * version on the Roadmap page — both consume the same buildRadarSeries() so they can't disagree. */
export function SkillRadarCard({ nodes, onOpen }: { nodes: RoadmapNode[]; onOpen: () => void }) {
  const { t } = useTranslation(["dashboard", "roadmap"]);
  const axes = buildRadarSeries(nodes, RADAR_AXES_COMPACT);
  if (axes.length < RADAR_MIN_AXES) return null;
  const n = axes.length;
  const demandPoints = axes.map((a, i) => point(i, n, a.demandPct).join(",")).join(" ");
  const levelPoints = axes.map((a, i) => point(i, n, a.level).join(",")).join(" ");
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-ink">{t("skillRadar.heading")}</span>
        <button onClick={onOpen} className="text-sm text-ink-dim hover:text-signal hover:underline">
          {t("skillRadar.open")}
        </button>
      </div>
      <div role="img" aria-label={t("skillRadar.heading")} className="flex justify-center">
        <svg width={SIZE + LABEL_PAD * 2} height={SIZE} viewBox={`${-LABEL_PAD} 0 ${SIZE + LABEL_PAD * 2} ${SIZE}`} className="max-w-full">
          {RINGS.map((r) => (
            <circle key={r} cx={CENTER} cy={CENTER} r={RADIUS * r} className="stroke-grid fill-none" />
          ))}
          {axes.map((_, i) => {
            const [x, y] = point(i, n, 100);
            return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} className="stroke-grid" />;
          })}
          {/* chart2/chart1 (not alert/signal, which are the same value — see index.css's glossary
              note) so the two series are actually distinguishable, matching the full Recharts
              version (features/roadmap/skill-radar.tsx). */}
          <polygon points={demandPoints} className="stroke-chart2 fill-chart2/20" strokeWidth={1.5} />
          <polygon points={levelPoints} className="stroke-chart1 fill-chart1/30" strokeWidth={1.5} />
          {axes.map((a, i) => {
            const [x, y] = point(i, n, 100, RADIUS + 12);
            const anchor = Math.abs(x - CENTER) < 4 ? "middle" : x > CENTER ? "start" : "end";
            return (
              <text key={a.tech} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-ink-dim text-[10px]">
                {a.tech}
              </text>
            );
          })}
        </svg>
      </div>
      {/* Now that the two series have genuinely different colors (not one hue at two opacities),
          a legend is needed for identity to read without color alone — same two labels the full
          Recharts version's <Legend> shows (features/roadmap/skill-radar.tsx), reused via the
          "roadmap" namespace already loaded above. */}
      <div className="flex items-center justify-center gap-4 text-xs text-ink-dim mt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-chart1" aria-hidden="true" />
          {t("radar.you", { ns: "roadmap" })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-chart2" aria-hidden="true" />
          {t("radar.marketDemand", { ns: "roadmap" })}
        </span>
      </div>
      <p className="text-xs text-ink-dim text-center mt-1">{t("skillRadar.caption")}</p>
    </Card>
  );
}

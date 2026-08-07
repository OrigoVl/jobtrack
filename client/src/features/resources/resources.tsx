import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUi } from "../../shared/ui-state";
import { useResources } from "../../shared/queries";
import { Card, Chip, PageHeader, Segmented } from "../../shared/ui";
import { TargetIcon } from "../../shared/icons";
import type { ResourcesData } from "../../shared/types";

/* ---------- Resources ---------- */
export function Resources() {
  const { t } = useTranslation(["resources", "common"]);
  const { data: d } = useResources();
  const [sub, setSub] = useUi<"bp" | "plat" | "cheat" | "check">("resources.sub", "bp");
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("jt-check") || "{}");
    } catch {
      return {};
    }
  });
  const toggle = (i: number) => {
    const n = { ...done, [i]: !done[i] };
    setDone(n);
    localStorage.setItem("jt-check", JSON.stringify(n));
  };
  if (!d) return null;
  const checkN = Object.values(done).filter(Boolean).length;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      <Card className="!bg-signal/10 !border-signal/30">
        <div className="text-sm text-signal">
          <span className="font-semibold">{t("focus.heading")}</span> {d.focus}
        </div>
      </Card>

      {/* Shared `Segmented` (shared/ui.tsx) — this page used to hand-roll its own `T()` tab
          helper out of Btns, a third distinct look for the same "pick one view" control. */}
      <Segmented
        value={sub}
        onChange={setSub}
        options={[
          { value: "bp" as const, label: t("tabs.bestPractices") },
          { value: "plat" as const, label: t("tabs.platforms") },
          { value: "cheat" as const, label: t("tabs.cheatSheet") },
          { value: "check" as const, label: t("tabs.checklist", { done: checkN, total: d.checklist.length }) },
        ]}
      />

      {sub === "bp" && (
        <div className="grid md:grid-cols-2 gap-4">
          {d.bestPractices.map((g) => (
            <Card key={g.group}>
              <div className="font-semibold mb-2 text-ink flex items-center gap-2">
                {g.group}
                {g.gapTechs.length > 0 && <Chip tone="emerald">{t("relevantChip")}</Chip>}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.links.map((l) => (
                  <a
                    key={l.u}
                    href={l.u}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 text-ink-dim hover:text-signal hover:bg-grid"
                  >
                    {l.t} ↗
                  </a>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {sub === "plat" && (
        <div className="space-y-3">
          {Object.entries(
            d.platforms.reduce<Record<string, ResourcesData["platforms"]>>((acc, p) => {
              (acc[p.group] ||= []).push(p);
              return acc;
            }, {}),
          ).map(([grp, items]) => (
            <Card key={grp}>
              <div className="font-semibold mb-2 text-ink">{grp}</div>
              {items.map((p) => (
                <div key={p.url} className="flex justify-between gap-3 text-sm py-1.5 border-b border-surface-2 last:border-0">
                  <span className="flex items-center gap-2 shrink-0">
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-ink-dim hover:text-signal whitespace-nowrap">
                      {p.name} ↗
                    </a>
                    {p.gapTechs.length > 0 && <Chip tone="emerald">{t("relevantChip")}</Chip>}
                  </span>
                  <span className="text-ink-dim text-right">{p.note}</span>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {sub === "cheat" && (
        <div className="grid md:grid-cols-2 gap-4">
          {d.cheat.map((c) => (
            <Card key={c.title}>
              <div className="font-semibold mb-2 text-ink flex items-center gap-2">
                {c.title}
                {c.gapTechs.length > 0 && <Chip tone="emerald">{t("relevantChip")}</Chip>}
              </div>
              <ul className="list-disc pl-5 text-sm text-ink space-y-1">
                {c.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {sub === "check" && (
        <Card>
          <div className="space-y-1">
            {d.checklist.map((it, i) => (
              <label key={i} className="flex gap-2 items-start p-2 rounded-lg hover:bg-surface-2 cursor-pointer">
                <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} className="mt-1 accent-signal" />
                <span className={done[i] ? "line-through text-ink-dim" : it.relevant ? "text-ink font-medium" : "text-ink"}>
                  {it.relevant && !done[i] && (
                    <span title={t("relevantChip")} className="inline-block align-[-1px] mr-1">
                      <TargetIcon className="h-3 w-3 inline" />
                    </span>
                  )}
                  {it.text}
                </span>
              </label>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

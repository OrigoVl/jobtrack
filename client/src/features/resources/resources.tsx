import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { Btn, Card, PageHeader } from "../../shared/ui";
import type { ResourcesData } from "../../shared/types";

/* ---------- Resources ---------- */
export function Resources() {
  const [d, setD] = useUi<ResourcesData | null>("resources.data", null);
  const [sub, setSub] = useUi<"bp" | "plat" | "cheat" | "check">("resources.sub", "bp");
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("jt-check") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (!d) api.resources().then(setD);
  }, [d, setD]);
  const toggle = (i: number) => {
    const n = { ...done, [i]: !done[i] };
    setDone(n);
    localStorage.setItem("jt-check", JSON.stringify(n));
  };
  if (!d) return null;
  const checkN = Object.values(done).filter(Boolean).length;
  const T = (id: typeof sub, label: string) => (
    <Btn variant={sub === id ? "primary" : "ghost"} size="sm" onClick={() => setSub(id)}>
      {label}
    </Btn>
  );
  return (
    <div className="space-y-4">
      <PageHeader
        title="Resources & references"
        subtitle="The best guides, practice platforms, cheat sheets, and a prep checklist — all in one place."
      />
      <div className="flex gap-2 flex-wrap">
        {T("bp", "⭐ Best practices")}
        {T("plat", "💻 Platforms")}
        {T("cheat", "🗒 Cheat sheet")}
        {T("check", `✅ Checklist (${checkN}/${d.checklist.length})`)}
      </div>

      {sub === "bp" && (
        <div className="grid md:grid-cols-2 gap-4">
          {d.bestPractices.map((g) => (
            <Card key={g.group}>
              <div className="font-semibold mb-2 text-ink">{g.group}</div>
              <div className="flex flex-wrap gap-2">
                {g.links.map((l) => (
                  <a
                    key={l.u}
                    href={l.u}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 text-signal hover:bg-grid"
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
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-signal whitespace-nowrap">
                    {p.name} ↗
                  </a>
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
              <div className="font-semibold mb-2 text-signal">{c.title}</div>
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
                <span className={done[i] ? "line-through text-ink-dim" : "text-ink"}>{it}</span>
              </label>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

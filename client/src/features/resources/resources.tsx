import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUi } from "../../shared/ui-state";
import { useResources, useSetResourcesFocus } from "../../shared/queries";
import { Btn, Card, Chip, PageHeader, Segmented } from "../../shared/ui";
import { TargetIcon } from "../../shared/icons";
import type { ResourcesData } from "../../shared/types";

/** The focus note, with a manual override on top of the generated one. The suggestion chips are
 * the same gap techs the rest of the page is personalized against (`focusSuggestions`, top 5) —
 * they only PREFILL the field, so picking one is a shortcut, never a constraint: the user can
 * edit it afterwards or ignore them entirely and write their own. */
function FocusCard({ data }: { data: ResourcesData }) {
  const { t } = useTranslation(["resources", "common"]);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const save = useSetResourcesFocus();
  // A blank `text` is what clears the override, so "which button is spinning" can be told apart
  // by the submitted value itself — no second mutation hook or local flag needed.
  const clearing = save.isPending && save.variables === "";

  const open = () => {
    setText(data.focusCustom ? data.focus : "");
    setEditing(true);
  };
  const submit = (value: string) => save.mutate(value, { onSuccess: () => setEditing(false) });

  return (
    <Card className="!bg-signal/10 !border-signal/30">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            // Mirrors the server's FOCUS_OVERRIDE_MAX_LEN (resources.service.ts), which truncates
            // rather than rejects — this only stops the user typing text that would be cut silently.
            maxLength={300}
            aria-label={t("focus.editAriaLabel")}
            placeholder={t("focus.placeholder")}
            className="w-full h-20 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          {data.focusSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("focus.suggestions")}>
              <span className="text-xs text-ink-dim">{t("focus.suggestions")}</span>
              {data.focusSuggestions.map((tech) => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => setText(t("focus.suggestionText", { tech }))}
                  className="text-xs font-medium px-2 py-0.5 rounded-full border bg-surface-2 text-ink-dim border-grid hover:border-signal/50 hover:text-signal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
                >
                  {tech}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Btn size="sm" onClick={() => submit(text)} loading={save.isPending && !clearing} disabled={!text.trim()}>
              {t("common:actions.save")}
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}>
              {t("common:actions.cancel")}
            </Btn>
            {data.focusCustom && (
              <Btn size="sm" variant="subtle" onClick={() => submit("")} loading={clearing}>
                {t("focus.resetAuto")}
              </Btn>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1 text-sm text-signal">
            <span className="font-semibold">{t("focus.heading")}</span> {data.focus}
            {data.focusCustom && (
              <span className="ml-2 align-middle">
                <Chip tone="slate">{t("focus.customBadge")}</Chip>
              </span>
            )}
          </div>
          <Btn size="sm" variant="ghost" onClick={open}>
            {t("common:actions.edit")}
          </Btn>
        </div>
      )}
    </Card>
  );
}

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

      <FocusCard data={d} />

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

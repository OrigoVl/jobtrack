import { useTranslation } from "react-i18next";
import { Btn } from "../../../shared/ui";
import { SkillsInput } from "../../../shared/view-kit";
import type { CvSkillGroup } from "../../../shared/types";

/** How many groups the server keeps (CvSkillGroupsSchema) — offering a thirteenth here would
 * just let someone fill in a group that silently disappears on the next save. */
const MAX_GROUPS = 12;

/**
 * Editor for the optional categorized-skills overlay ("AI / LLM" → LangGraph, Langfuse, …),
 * rendered by the "Grouped" skills style.
 *
 * Groups are deliberately a SEPARATE list from the flat `skills` array rather than a
 * reorganisation of it — see CvSkillGroupsSchema on the server for why. The practical
 * consequence is that the two can disagree, so the one thing this editor owes the user is to say
 * which skills are in no group yet: that is the only way the drift is visible before it prints.
 */
export function SkillGroupsEditor({
  groups,
  skills,
  onChange,
}: {
  groups: CvSkillGroup[];
  /** The flat skill list, used only to report what isn't grouped yet. */
  skills: string[];
  onChange: (groups: CvSkillGroup[]) => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const grouped = new Set(groups.flatMap((g) => g.skills.map((s) => s.trim().toLowerCase())));
  const ungrouped = skills.filter((s) => s.trim() && !grouped.has(s.trim().toLowerCase()));
  const setGroup = (i: number, patch: Partial<CvSkillGroup>) => onChange(groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  return (
    <div className="space-y-2">
      {groups.length === 0 ? (
        <div className="text-[11px] text-ink-dim">{t("skillGroups.empty")}</div>
      ) : (
        groups.map((g, i) => (
          <div key={i} className="rounded-lg border border-grid p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <input
                value={g.name}
                onChange={(ev) => setGroup(i, { name: ev.target.value })}
                placeholder={t("skillGroups.namePlaceholder")}
                aria-label={t("skillGroups.nameAria")}
                maxLength={60}
                className="flex-1 min-w-0 bg-surface-2 border border-grid rounded-lg p-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-signal/50"
              />
              <Btn
                size="sm"
                variant="subtle"
                onClick={() => onChange(groups.map((x, idx) => (idx === i - 1 ? groups[i]! : idx === i ? groups[i - 1]! : x)))}
                disabled={i === 0}
                aria-label={t("skillGroups.moveUp")}
                title={t("skillGroups.moveUp")}
              >
                ↑
              </Btn>
              <Btn
                size="sm"
                variant="danger"
                onClick={() => onChange(groups.filter((_, idx) => idx !== i))}
                aria-label={t("skillGroups.removeAria")}
                title={t("skillGroups.removeAria")}
              >
                ✕
              </Btn>
            </div>
            {/* The same input the flat list uses, so a group gets the autocomplete and the
                drag-reordering for free — they print in exactly this order too. */}
            <SkillsInput
              label={t("skillGroups.skillsAria")}
              hideLabel
              skills={g.skills}
              onChange={(next) => setGroup(i, { skills: next })}
              placeholder={t("skillGroups.skillsPlaceholder")}
              reorderable
            />
          </div>
        ))
      )}
      <div className="flex items-center justify-between gap-2">
        {groups.length < MAX_GROUPS ? (
          <Btn size="sm" variant="ghost" onClick={() => onChange([...groups, { name: "", skills: [] }])}>
            {t("skillGroups.add")}
          </Btn>
        ) : (
          <span className="text-[11px] text-ink-dim">{t("skillGroups.maxReached", { max: MAX_GROUPS })}</span>
        )}
      </div>
      {groups.length > 0 && ungrouped.length > 0 && (
        <div className="text-[11px] text-ink-dim">{t("skillGroups.ungrouped", { skills: ungrouped.join(", ") })}</div>
      )}
    </div>
  );
}

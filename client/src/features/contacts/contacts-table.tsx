import { useTranslation } from "react-i18next";
import { Card, Chip, Spinner } from "../../shared/ui";
import type { Contact, Vacancy } from "../../shared/types";
import { isStale, silentDays } from "./stale-contacts";
import type { ContactSortKey } from "./contacts-filter";

/**
 * The dense counterpart to the card grid. Cards show one contact well; past a couple of dozen
 * rows the question stops being "what do I know about this person" and becomes "which row is the
 * N-iX one" — that's a table, one line per contact, sortable by the three columns worth scanning.
 * The outreach drafting buttons stay on the cards only: they expand a row into a message panel,
 * which is the opposite of what this view is for (the card is one click away via the row).
 */
export function ContactsTable({
  contacts,
  companyName,
  linkedVacancy,
  todayIso,
  sortBy,
  sortDir,
  onToggleSort,
  onEdit,
  onDelete,
  deletingId,
}: {
  contacts: Contact[];
  companyName: (id: number | null) => string;
  linkedVacancy: (id: number | null) => Vacancy | undefined;
  todayIso: string;
  sortBy: ContactSortKey;
  sortDir: "asc" | "desc";
  onToggleSort: (key: Exclude<ContactSortKey, "default">) => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  deletingId: number | null;
}) {
  const { t } = useTranslation(["contacts", "common"]);
  const sortArrow = (key: ContactSortKey) => (sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <Card className="!p-0 overflow-hidden">
      {/* `overflow-auto` + a capped height on THIS div, not the page, is what lets the sticky
          thead stick — see the same note in vacancies.tsx's table. */}
      <div className="overflow-auto max-h-[65vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="text-ink-dim text-xs text-left bg-surface-2 border-b border-grid">
              <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => onToggleSort("name")}>
                {t("table.name")}
                {sortArrow("name")}
              </th>
              <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => onToggleSort("company")}>
                {t("table.company")}
                {sortArrow("company")}
              </th>
              <th className="p-3">{t("table.vacancy")}</th>
              <th className="p-3">{t("table.reach")}</th>
              <th className="p-3 cursor-pointer select-none hover:text-ink" onClick={() => onToggleSort("lastContact")}>
                {t("table.lastContact")}
                {sortArrow("lastContact")}
              </th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const vacancy = linkedVacancy(c.vacancyId);
              const isDeleting = deletingId === c.id;
              return (
                <tr
                  key={c.id}
                  title={t("table.openTitle")}
                  // Clicking the row opens the edit modal — except on a real control (the mail/
                  // LinkedIn links, the row's own buttons), which needs the click for itself.
                  // Same pattern as the vacancies table.
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a")) return;
                    onEdit(c);
                  }}
                  className="border-t border-surface-2 align-top hover:bg-surface-2/60 cursor-pointer"
                >
                  <td className="p-3">
                    <div className="font-medium text-ink">{c.name}</div>
                    {c.role && <div className="text-xs text-ink-dim">{c.role}</div>}
                  </td>
                  <td className="p-3 text-ink-dim">{companyName(c.companyId)}</td>
                  <td className="p-3 text-ink-dim text-xs">
                    {vacancy ? `${vacancy.company}${vacancy.position ? ` — ${vacancy.position}` : ""}` : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-ink-dim hover:text-signal hover:underline">
                          {c.email}
                        </a>
                      )}
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-ink-dim hover:text-signal hover:underline">
                          {t("linkedin")}
                        </a>
                      )}
                      {!c.email && !c.linkedinUrl && <span className="text-ink-dim">—</span>}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col items-start gap-1 text-xs text-ink-dim">
                      <span>{c.lastContactAt || "—"}</span>
                      {isStale(c, todayIso) && <Chip tone="rose">{t("stale.silentFor", { count: silentDays(c, todayIso) ?? 0 })}</Chip>}
                    </div>
                  </td>
                  <td className="p-3">
                    {/* The row-wide click above isn't reachable by keyboard or a screen reader —
                        this button is the accessible way to the same action. */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(c)}
                        className="text-xs text-ink-dim hover:text-signal px-1.5 py-1"
                        aria-label={t("editAriaLabel", { name: c.name })}
                      >
                        {t("common:actions.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
                        disabled={isDeleting}
                        className="text-xs text-ink-dim hover:text-rose-600 px-1.5 py-1 disabled:opacity-50"
                        aria-label={t("deleteAriaLabel", { name: c.name })}
                      >
                        {isDeleting ? <Spinner className="h-3 w-3" /> : t("common:actions.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

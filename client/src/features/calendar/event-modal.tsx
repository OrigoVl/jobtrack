import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCompanies, useContacts, useVacancies } from "../../shared/queries";
import { Btn, Card, SearchSelect, Select } from "../../shared/ui";
import { DateTimeInput } from "../../shared/date-input";
import { CALENDAR_EVENT_TYPES, type CalendarEventInput, type CalendarEventType } from "../../shared/types";
import { fromLocalInput, toLocalInput } from "./calendar-date-utils";
import { contactLabel, TYPE_KEY } from "./calendar-shared";
import { buildIcs, googleCalendarUrl, icsFileName } from "./calendar-export";
import { normalizeMeetingUrl } from "./meeting-link";
import { JoinCallLink } from "./join-call-link";

/** The full create/edit form for a calendar event. Extracted from calendar.tsx, which now also
 * owns a grid, a day popover and an upcoming list — this is the one place a whole event (times,
 * type, linked vacancy, notes) is edited; the popover's quick-add only sets a title. */
export function EventModal({
  draft,
  editingId,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  draft: CalendarEventInput;
  editingId: number | null;
  onClose: () => void;
  onSave: (draft: CalendarEventInput) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const { t } = useTranslation(["calendar", "common"]);
  const [form, setForm] = useState(draft);
  const { data: vacancies = [] } = useVacancies();
  const { data: contacts = [] } = useContacts();
  const { data: companies = [] } = useCompanies();

  const set = <K extends keyof CalendarEventInput>(k: K, v: CalendarEventInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  // An unusable call link blocks Save rather than being silently dropped on the way out: the
  // server rejects anything that isn't http(s) (a 400 the user can't act on from here), and
  // quietly saving the event without the link someone just pasted is the worse failure of the two.
  const meetingUrlOk = form.meetingUrl.trim() === "" || normalizeMeetingUrl(form.meetingUrl) !== "";
  const canSave = form.title.trim().length > 0 && form.startAt.length > 0 && meetingUrlOk;

  // Export acts on what's currently IN the form, not on the last saved row: someone who just
  // changed the time and wants it in Google Calendar means the time they can see.
  const exportable = {
    id: editingId ?? 0,
    title: form.title,
    notes: form.notes,
    startAt: form.startAt,
    endAt: form.endAt,
    meetingUrl: form.meetingUrl,
  };
  const downloadIcs = () => {
    const url = URL.createObjectURL(new Blob([buildIcs(exportable)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(exportable);
    a.click();
    // Revoking immediately is safe — the click has already handed the blob to the download.
    URL.revokeObjectURL(url);
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label={t("common:actions.close")}
        onClick={onClose}
        className="fixed inset-0 bg-ink/45 backdrop-blur-sm cursor-default"
      />
      {/* role="dialog" like the vacancy detail modal: it's what makes this addressable as a
          dialog (assistive tech and e2e alike) rather than an anonymous div over the page. */}
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={editingId ? t("modal.editEvent") : t("modal.newEvent")}
        className="relative w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="font-display font-semibold text-ink">{editingId ? t("modal.editEvent") : t("modal.newEvent")}</div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.titleLabel")}</span>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={t("modal.titlePlaceholder")}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("modal.starts")}</span>
            <DateTimeInput
              value={toLocalInput(form.startAt)}
              onChange={(local) => set("startAt", fromLocalInput(local) ?? "")}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("modal.endsOptional")}</span>
            <DateTimeInput
              value={toLocalInput(form.endAt)}
              onChange={(local) => set("endAt", fromLocalInput(local))}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.type")}</span>
          <Select
            value={form.type}
            onChange={(e) => set("type", e.target.value as CalendarEventType)}
            className="w-full mt-0.5 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-signal/50"
          >
            {CALENDAR_EVENT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(TYPE_KEY[ty])}
              </option>
            ))}
          </Select>
        </label>
        <div className="block">
          {/* Not a <label>: SearchSelect is a text input whose own click opens the list, and
              wrapping it in a label makes a click on the label text re-fire onto the input, which
              reopens the list right after a pick. */}
          <span className="text-xs font-semibold text-ink-dim">{t("modal.linkedVacancy")}</span>
          <SearchSelect
            value={form.vacancyId ? String(form.vacancyId) : ""}
            onChange={(v) => set("vacancyId", v ? Number(v) : null)}
            aria-label={t("modal.linkedVacancy")}
            options={[
              { value: "", label: t("modal.none") },
              ...vacancies.map((v) => ({ value: String(v.id), label: `${v.company} — ${v.position || t("modal.position")}` })),
            ]}
            className="w-full mt-0.5 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </div>
        <div className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.linkedContact")}</span>
          <SearchSelect
            value={form.contactId ? String(form.contactId) : ""}
            onChange={(v) => set("contactId", v ? Number(v) : null)}
            aria-label={t("modal.linkedContact")}
            options={[
              { value: "", label: t("modal.none") },
              ...contacts.map((c) => ({ value: String(c.id), label: contactLabel(c, companies, vacancies) })),
            ]}
            className="w-full mt-0.5 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </div>
        {/* The call link is its own field rather than a line in Notes: it's the thing you need one
            click on when the interview starts in two minutes, and it has to survive into the .ics/
            Google export as a real location, which free text can't. `type="url"` only for the
            keyboard it brings up on mobile — the actual validation is normalizeMeetingUrl (and the
            server's toUrl), since the browser's own would reject the scheme-less form people paste. */}
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.meetingUrl")}</span>
          <input
            type="url"
            inputMode="url"
            value={form.meetingUrl}
            onChange={(e) => set("meetingUrl", e.target.value)}
            placeholder={t("modal.meetingUrlPlaceholder")}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        {/* Shown as soon as something joinable is typed — it doubles as the confirmation that what
            was pasted actually parsed, before Save. */}
        {form.meetingUrl.trim() !== "" &&
          (normalizeMeetingUrl(form.meetingUrl) ? (
            <JoinCallLink url={form.meetingUrl} />
          ) : (
            <div className="text-[11px] text-rose-600">{t("modal.meetingUrlInvalid")}</div>
          ))}
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("modal.notes")}</span>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full h-16 mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        {/* Export needs a title and a start, the same two fields Save needs — an .ics without
            them isn't importable anywhere. Offered for a new event too: "put this in my real
            calendar" is often the whole reason it's being typed. */}
        {canSave && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-grid">
            <span className="text-xs font-semibold text-ink-dim">{t("modal.exportLabel")}</span>
            <Btn variant="ghost" size="sm" onClick={downloadIcs}>
              {t("modal.exportIcs")}
            </Btn>
            <a
              href={googleCalendarUrl(exportable)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition px-2.5 py-1.5 text-xs bg-surface-2 text-ink border border-grid hover:bg-grid/50 hover:-translate-y-px"
            >
              {t("modal.exportGoogle")}
            </a>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          {editingId && (
            <Btn variant="danger" size="sm" onClick={onDelete} loading={deleting}>
              {t("common:actions.delete")}
            </Btn>
          )}
          <div className="ml-auto flex gap-2">
            <Btn variant="ghost" size="sm" onClick={onClose}>
              {t("common:actions.cancel")}
            </Btn>
            {/* Saves the NORMALIZED link ("meet.google.com/x" → "https://meet.google.com/x"), so
                what's stored is the same http(s) form the server validates and every reader here
                renders, rather than whatever shape it happened to be pasted in. */}
            <Btn
              size="sm"
              disabled={!canSave}
              loading={saving}
              onClick={() => onSave({ ...form, meetingUrl: normalizeMeetingUrl(form.meetingUrl) })}
            >
              {t("common:actions.save")}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

import express from "express";
import { HttpError, authed } from "../../core/http.js";
import { parseCalendarEventInput } from "../../shared/validation.js";
import { getVacancy } from "../vacancies/vacancies.repo.js";
import { listCalendarEvents, getCalendarEvent, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "./calendar.repo.js";
import { getCombinedCalendar } from "./calendar.service.js";
import type { UserId } from "../../db/user-id.js";

const r = express.Router();

function dateRangeFromQuery(query: unknown): { from?: string; to?: string } {
  const q = (query || {}) as Record<string, unknown>;
  const from = typeof q.from === "string" && q.from ? q.from : undefined;
  const to = typeof q.to === "string" && q.to ? q.to : undefined;
  return { from, to };
}

/** Confirms a vacancyId (if any) actually belongs to this user before it's allowed to be linked
 * — a clean 400 here instead of relying solely on the DB's composite FK, which would surface as
 * an opaque 500 on a bad id. The FK stays in place as the structural, defense-in-depth guarantee. */
async function assertOwnVacancyOrNull(userId: UserId, vacancyId: number | null | undefined): Promise<void> {
  if (vacancyId == null) return;
  const vacancy = await getVacancy(userId, vacancyId);
  if (!vacancy) throw new HttpError(400, `Unknown vacancy: ${vacancyId}`);
}

// ---------- calendar: manual events ----------
r.get(
  "/calendar/events",
  authed(async (userId, req, res) => {
    res.json(await listCalendarEvents(userId, dateRangeFromQuery(req.query)));
  }),
);

r.post(
  "/calendar/events",
  authed(async (userId, req, res) => {
    const b = parseCalendarEventInput(req.body, { partial: false });
    await assertOwnVacancyOrNull(userId, b.vacancyId);
    const event = await createCalendarEvent(userId, {
      title: b.title!,
      notes: b.notes!,
      startAt: b.startAt!,
      endAt: b.endAt ?? null,
      type: b.type!,
      vacancyId: b.vacancyId ?? null,
    });
    res.status(201).json(event);
  }),
);

r.put(
  "/calendar/events/:id",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    if (!(await getCalendarEvent(userId, id))) throw new HttpError(404, "Event not found");
    const b = parseCalendarEventInput(req.body, { partial: true });
    if (Object.prototype.hasOwnProperty.call(b, "vacancyId")) await assertOwnVacancyOrNull(userId, b.vacancyId);
    const event = await updateCalendarEvent(userId, id, b);
    res.json(event);
  }),
);

r.delete(
  "/calendar/events/:id",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    // Same convention as DELETE /vacancies/:id — reports how many rows a scoped delete actually
    // affected (0 when the id doesn't exist or belongs to another user) instead of a 404, so a
    // delete stays idempotent to call twice.
    const deleted = await deleteCalendarEvent(userId, id);
    res.json({ ok: true, deleted });
  }),
);

// ---------- calendar: combined read-only view (manual events + vacancy next-steps + SRS due) ----------
r.get(
  "/calendar/combined",
  authed(async (userId, req, res) => {
    res.json(await getCombinedCalendar(userId, dateRangeFromQuery(req.query)));
  }),
);

export default r;

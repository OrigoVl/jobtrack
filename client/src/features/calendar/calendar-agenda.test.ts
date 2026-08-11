import { describe, expect, it } from "vitest";
import { buildUpcoming, moveEventToDay, shiftDay } from "./calendar-agenda";
import { contactLabel } from "./calendar-shared";
import type { CalendarEvent, CalendarVacancyStep, Company, Contact, Vacancy } from "../../shared/types";

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 1,
  title: "Interview",
  notes: "",
  startAt: new Date(2026, 6, 15, 14, 0).toISOString(),
  endAt: null,
  type: "interview",
  vacancyId: null,
  meetingUrl: "",
  contactId: null,
  ...over,
});

const localIso = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

describe("moveEventToDay", () => {
  it("keeps the time of day when the event moves to another date", () => {
    const moved = moveEventToDay({ startAt: localIso(2026, 7, 15, 14, 30), endAt: null }, "2026-07-22");
    expect(moved).not.toBeNull();
    const start = new Date(moved!.startAt);
    expect([start.getFullYear(), start.getMonth() + 1, start.getDate()]).toEqual([2026, 7, 22]);
    expect([start.getHours(), start.getMinutes()]).toEqual([14, 30]);
  });

  it("moves the end by the same number of days, so the duration survives", () => {
    const moved = moveEventToDay({ startAt: localIso(2026, 7, 15, 14, 0), endAt: localIso(2026, 7, 15, 15, 30) }, "2026-08-03");
    const end = new Date(moved!.endAt!);
    expect([end.getFullYear(), end.getMonth() + 1, end.getDate()]).toEqual([2026, 8, 3]);
    expect([end.getHours(), end.getMinutes()]).toEqual([15, 30]);
  });

  it("keeps a multi-day event multi-day", () => {
    const moved = moveEventToDay({ startAt: localIso(2026, 7, 15, 9, 0), endAt: localIso(2026, 7, 17, 18, 0) }, "2026-07-20");
    const end = new Date(moved!.endAt!);
    expect([end.getMonth() + 1, end.getDate()]).toEqual([7, 22]);
  });

  it("reports a drop onto the day the event is already on as a no-op", () => {
    expect(moveEventToDay({ startAt: localIso(2026, 7, 15, 14, 0), endAt: null }, "2026-07-15")).toBeNull();
  });

  it("ignores an unparseable date instead of producing an Invalid Date", () => {
    expect(moveEventToDay({ startAt: "not-a-date", endAt: null }, "2026-07-15")).toBeNull();
    expect(moveEventToDay({ startAt: localIso(2026, 7, 15), endAt: null }, "nope")).toBeNull();
  });
});

describe("buildUpcoming", () => {
  const steps: CalendarVacancyStep[] = [
    { vacancyId: 7, company: "Acme", position: "Frontend dev", date: "2026-07-16" },
    { vacancyId: 8, company: "Globex", position: "QA", date: "2026-07-10" },
  ];

  it("merges events and vacancy steps in chronological order", () => {
    const items = buildUpcoming(
      [event({ id: 1, startAt: localIso(2026, 7, 17, 9, 0) }), event({ id: 2, startAt: localIso(2026, 7, 15, 14, 0) })],
      steps,
      "2026-07-15",
      10,
    );
    expect(items.map((i) => (i.kind === "event" ? `e${i.event.id}` : `s${i.step.vacancyId}`))).toEqual(["e2", "s7", "e1"]);
  });

  it("drops anything before the starting day", () => {
    const items = buildUpcoming([event({ id: 1, startAt: localIso(2026, 7, 1, 9, 0) })], steps, "2026-07-15", 10);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("step");
  });

  it("sorts a date-only vacancy step before the same day's timed events", () => {
    const items = buildUpcoming([event({ id: 1, startAt: localIso(2026, 7, 16, 8, 0) })], steps.slice(0, 1), "2026-07-16", 10);
    expect(items[0]!.kind).toBe("step");
  });

  it("caps the list at the requested limit", () => {
    const many = Array.from({ length: 9 }, (_, i) => event({ id: i + 1, startAt: localIso(2026, 7, 15 + i, 9, 0) }));
    expect(buildUpcoming(many, [], "2026-07-15", 5)).toHaveLength(5);
  });
});

describe("shiftDay", () => {
  it("moves by days and weeks, rolling over month and year boundaries", () => {
    expect(shiftDay("2026-07-15", 1)).toBe("2026-07-16");
    expect(shiftDay("2026-07-15", -7)).toBe("2026-07-08");
    expect(shiftDay("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("contactLabel", () => {
  const contact = (over: Partial<Contact> = {}): Contact => ({
    id: 1,
    name: "Viktoriia",
    role: "Recruiter",
    companyId: null,
    vacancyId: null,
    email: "",
    linkedinUrl: "",
    notes: "",
    lastContactAt: "",
    ...over,
  });
  const companies = [{ id: 5, name: "Acme", notes: "", questions: [], website: "" }] as Company[];
  const vacancies = [{ id: 9, company: "Globex", position: "QA" }] as Vacancy[];

  it("names the company the contact is linked to", () => {
    expect(contactLabel(contact({ companyId: 5 }), companies, vacancies)).toBe("Viktoriia — Recruiter · Acme");
  });

  it("falls back to the company on the contact's linked vacancy", () => {
    expect(contactLabel(contact({ vacancyId: 9 }), companies, vacancies)).toBe("Viktoriia — Recruiter · Globex");
  });

  it("leaves out parts it doesn't have instead of rendering empty separators", () => {
    expect(contactLabel(contact({ role: "" }), companies, vacancies)).toBe("Viktoriia");
  });
});

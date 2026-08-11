import { describe, expect, it } from "vitest";
import { STALE_AFTER_DAYS, daysBetween, isStale, silentDays, staleContacts } from "./stale-contacts";
import type { Contact } from "../../shared/types";

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 1,
    name: "Iryna Melnyk",
    role: "Recruiter",
    companyId: null,
    vacancyId: null,
    email: "",
    linkedinUrl: "",
    notes: "",
    source: "manual",
    lastContactAt: "2026-08-01",
    ...overrides,
  };
}

const TODAY = "2026-08-11";

describe("daysBetween()", () => {
  it("counts whole days, including across a month boundary", () => {
    expect(daysBetween("2026-08-01", "2026-08-11")).toBe(10);
    expect(daysBetween("2026-07-31", "2026-08-01")).toBe(1);
    expect(daysBetween("2026-08-11", "2026-08-11")).toBe(0);
  });

  it("returns null for anything that isn't an ISO date", () => {
    expect(daysBetween("", TODAY)).toBeNull();
    expect(daysBetween("11.08.2026", TODAY)).toBeNull();
  });
});

describe("silentDays()", () => {
  it("measures the silence since the last contact", () => {
    expect(silentDays(contact({ lastContactAt: "2026-08-04" }), TODAY)).toBe(7);
  });

  it("is null for someone never contacted — that's 'reach out', not 'follow up'", () => {
    expect(silentDays(contact({ lastContactAt: "" }), TODAY)).toBeNull();
  });

  it("is null for a future date, which describes a planned touch rather than a past one", () => {
    expect(silentDays(contact({ lastContactAt: "2026-09-01" }), TODAY)).toBeNull();
  });
});

describe("isStale()", () => {
  it("turns true exactly at the threshold, not before", () => {
    const dayBefore = `2026-08-${String(11 - STALE_AFTER_DAYS + 1).padStart(2, "0")}`;
    const atThreshold = `2026-08-${String(11 - STALE_AFTER_DAYS).padStart(2, "0")}`;

    expect(isStale(contact({ lastContactAt: dayBefore }), TODAY)).toBe(false);
    expect(isStale(contact({ lastContactAt: atThreshold }), TODAY)).toBe(true);
  });

  it("never flags a contact who was never written to", () => {
    expect(isStale(contact({ lastContactAt: "" }), TODAY)).toBe(false);
  });
});

describe("staleContacts()", () => {
  it("returns only stale ones, longest silence first", () => {
    const fresh = contact({ id: 1, lastContactAt: "2026-08-10" });
    const quiet = contact({ id: 2, lastContactAt: "2026-08-01" });
    const quietest = contact({ id: 3, lastContactAt: "2026-06-15" });
    const never = contact({ id: 4, lastContactAt: "" });

    expect(staleContacts([fresh, quiet, quietest, never], TODAY).map((c) => c.id)).toEqual([3, 2]);
  });
});

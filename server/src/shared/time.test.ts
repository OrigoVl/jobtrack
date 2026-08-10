// These wrap Intl rather than implementing date math, so the tests focus on the two things that
// are genuinely ours: the UTC fallback, and not throwing on a client-supplied zone string.
import { describe, expect, it } from "vitest";
import { isValidTimeZone, localDateIn, localHourIn } from "./time.js";

// 2026-03-10T23:30:00Z — late enough in the UTC day that zones on either side land on different
// calendar dates, which is the whole point of storing a zone at all.
const NOW = Date.parse("2026-03-10T23:30:00.000Z");

describe("localDateIn()", () => {
  it("formats as YYYY-MM-DD so it compares directly against stored date strings", () => {
    expect(localDateIn("UTC", NOW)).toBe("2026-03-10");
  });

  it("rolls the date forward for a zone that's already past midnight", () => {
    expect(localDateIn("Europe/Kyiv", NOW)).toBe("2026-03-11");
  });

  it("treats a missing zone as UTC", () => {
    expect(localDateIn(null, NOW)).toBe(localDateIn("UTC", NOW));
  });

  it("falls back to UTC instead of throwing on a junk zone", () => {
    // Intl throws a RangeError here; a scheduler iterating every user must not die on one bad row.
    expect(localDateIn("Not/AZone", NOW)).toBe("2026-03-10");
  });
});

describe("localHourIn()", () => {
  it("returns a 0-23 hour, with midnight as 0 rather than 24", () => {
    expect(localHourIn("UTC", Date.parse("2026-03-10T00:15:00.000Z"))).toBe(0);
    expect(localHourIn("UTC", NOW)).toBe(23);
  });

  it("shifts with the zone", () => {
    expect(localHourIn("Europe/Kyiv", NOW)).toBe(1);
  });

  it("falls back to UTC on a junk zone", () => {
    expect(localHourIn("Not/AZone", NOW)).toBe(23);
  });
});

describe("isValidTimeZone()", () => {
  it("accepts real IANA zones", () => {
    expect(isValidTimeZone("Europe/Kyiv")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects junk, so it never reaches the column", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

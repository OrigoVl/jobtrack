// The sparse-preferences rule is easy to state and easy to break: a missing key means ON, only
// explicit opt-outs are stored, and one kind is never opt-outable at all. Both the scheduler and
// the settings route depend on all three holding.
import { describe, expect, it } from "vitest";
import { isNotificationEnabled, sanitizeNotificationPrefs, OPT_OUTABLE_KINDS, NOTIFICATION_KINDS } from "./notifications.js";

describe("isNotificationEnabled()", () => {
  it("defaults a kind the user never touched to ON", () => {
    expect(isNotificationEnabled({}, "interview")).toBe(true);
    expect(isNotificationEnabled(null, "interview")).toBe(true);
    expect(isNotificationEnabled(undefined, "cvView")).toBe(true);
  });

  it("honors an explicit opt-out", () => {
    expect(isNotificationEnabled({ interview: false }, "interview")).toBe(false);
  });

  it("only affects the kind that was switched off", () => {
    const prefs = { interview: false };
    expect(isNotificationEnabled(prefs, "stale")).toBe(true);
  });

  it("keeps billing on even against a stored opt-out — it's transactional, not promotional", () => {
    expect(isNotificationEnabled({ billing: false }, "billing")).toBe(true);
  });
});

describe("sanitizeNotificationPrefs()", () => {
  it("drops unknown keys so a crafted body can't bloat the stored blob", () => {
    expect(sanitizeNotificationPrefs({ interview: false, madeUpKind: false })).toEqual({ interview: false });
  });

  it("refuses to store an opt-out for the one kind that isn't opt-outable", () => {
    expect(sanitizeNotificationPrefs({ billing: false })).toEqual({});
  });

  it("stores only explicit `false` — an explicit `true` equals the default and would just pin it", () => {
    expect(sanitizeNotificationPrefs({ interview: true, stale: false })).toEqual({ stale: false });
  });

  it("ignores non-boolean values instead of coercing them", () => {
    expect(sanitizeNotificationPrefs({ interview: "no", stale: 0, streak: null })).toEqual({});
  });

  it("returns an empty object for anything that isn't a plain object", () => {
    for (const input of [null, undefined, "x", 42, [1, 2]]) {
      expect(sanitizeNotificationPrefs(input)).toEqual({});
    }
  });
});

describe("OPT_OUTABLE_KINDS", () => {
  it("is every kind except billing", () => {
    expect(OPT_OUTABLE_KINDS).toEqual(NOTIFICATION_KINDS.filter((k) => k !== "billing"));
    expect(OPT_OUTABLE_KINDS).not.toContain("billing");
  });
});

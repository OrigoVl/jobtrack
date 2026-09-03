import { describe, expect, it } from "vitest";
import { STATUSES } from "./types";
import {
  DEFAULT_STATUS_BORDER_L_CLASS,
  DEFAULT_STATUS_DOT_CLASS,
  DEFAULT_STATUS_SELECT_CLASS,
  STATUS_BORDER_L_CLASS,
  STATUS_DOT_CLASS,
  STATUS_SELECT_CLASS,
} from "./status-tone";

/**
 * These are three parallel lookup tables keyed by the same union. TypeScript catches a missing
 * key when a status is added to `STATUSES`, but not the two things that actually go wrong in
 * practice: a light-mode-only Tailwind pair left without its `dark:` counterpart (renders as a
 * near-white block on the dark surface), and the dot/border pair drifting apart so a card's left
 * edge stops matching its own status dot.
 */
describe("status tone tables", () => {
  it.each([
    ["select", STATUS_SELECT_CLASS],
    ["dot", STATUS_DOT_CLASS],
    ["border", STATUS_BORDER_L_CLASS],
  ])("covers every status with a non-empty %s class", (_name, table) => {
    for (const status of STATUSES) {
      expect(table[status]?.trim()).toBeTruthy();
    }
    // No leftovers either — a renamed status that kept its old entry would quietly ship a class
    // nothing can ever look up.
    expect(Object.keys(table).sort()).toEqual([...STATUSES].sort());
  });

  it("keeps the Kanban card's left border the same colour as its status dot", () => {
    for (const status of STATUSES) {
      expect(STATUS_BORDER_L_CLASS[status]).toBe(`border-l-${STATUS_DOT_CLASS[status].replace(/^bg-/, "")}`);
    }
  });

  it("pairs every hard-coded light palette in the select table with a dark: variant", () => {
    for (const status of STATUSES) {
      const classes = STATUS_SELECT_CLASS[status];
      // Design-token classes (bg-surface-2, bg-signal/10, …) already adapt via CSS variables;
      // only the raw Tailwind palette colors need an explicit dark override.
      const usesRawPalette = /\bbg-(sky|purple|fuchsia|rose|zinc|amber)-\d{2,3}\b/.test(classes);
      if (usesRawPalette) expect(classes).toMatch(/\bdark:bg-/);
    }
  });

  it("exposes fallbacks for an unrecognised status, since the wire value is only typed as string", () => {
    for (const fallback of [DEFAULT_STATUS_SELECT_CLASS, DEFAULT_STATUS_DOT_CLASS, DEFAULT_STATUS_BORDER_L_CLASS]) {
      expect(fallback.trim()).toBeTruthy();
    }
    const unknown = "Ghosted" as (typeof STATUSES)[number];
    expect(STATUS_DOT_CLASS[unknown] ?? DEFAULT_STATUS_DOT_CLASS).toBe(DEFAULT_STATUS_DOT_CLASS);
  });
});

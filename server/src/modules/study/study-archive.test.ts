import { describe, expect, it } from "vitest";
import {
  appendDrillArchive,
  drillArchiveEntryFromDrill,
  removeDrillArchiveEntry,
  updateDrillArchiveEntry,
  MAX_DRILL_ARCHIVE,
  type DrillArchiveEntry,
} from "./study-archive.js";
import type { DrillItem } from "./content.js";

const drill: DrillItem = {
  id: "d1",
  cat: "JavaScript",
  lvl: "med",
  q: "Implement debounce",
  sol: "function debounce(fn, ms) { ... }",
  exp: "Delays execution until quiet period.",
  generated: true,
  tech: "JavaScript",
};

describe("drillArchiveEntryFromDrill()", () => {
  it("copies drill fields and assigns ids/timestamps", () => {
    const at = "2026-01-01T00:00:00.000Z";
    const entry = drillArchiveEntryFromDrill(drill, at);
    expect(entry.drillId).toBe("d1");
    expect(entry.q).toBe(drill.q);
    expect(entry.sol).toBe(drill.sol);
    expect(entry.generated).toBe(true);
    expect(entry.tech).toBe("JavaScript");
    expect(entry.solvedAt).toBe(at);
    expect(entry.id).toMatch(/^drill-arch-/);
  });
});

const entry = (drillId: string, solvedAt = "2026-01-01T00:00:00.000Z"): DrillArchiveEntry => ({
  id: `arch-${drillId}`,
  drillId,
  cat: "JavaScript",
  lvl: "easy",
  q: "Q",
  sol: "S",
  exp: "E",
  solvedAt,
});

describe("appendDrillArchive()", () => {
  it("prepends the new entry (newest first)", () => {
    const result = appendDrillArchive([entry("old")], entry("new"));
    expect(result.map((e) => e.drillId)).toEqual(["new", "old"]);
  });

  it("re-promotes an existing drillId instead of duplicating", () => {
    const first = entry("same", "2026-01-01T00:00:00.000Z");
    const updated = { ...entry("same", "2026-02-01T00:00:00.000Z"), q: "Updated Q" };
    const result = appendDrillArchive([entry("other"), first], updated);
    expect(result).toHaveLength(2);
    expect(result[0]!.drillId).toBe("same");
    expect(result[0]!.q).toBe("Updated Q");
    expect(result[0]!.solvedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("caps the list at MAX_DRILL_ARCHIVE", () => {
    const full = Array.from({ length: MAX_DRILL_ARCHIVE }, (_, i) => entry(`e${i}`));
    const result = appendDrillArchive(full, entry("newest"));
    expect(result.length).toBe(MAX_DRILL_ARCHIVE);
    expect(result[0]!.drillId).toBe("newest");
    expect(result.find((e) => e.drillId === `e${MAX_DRILL_ARCHIVE - 1}`)).toBeUndefined();
  });
});

describe("removeDrillArchiveEntry()", () => {
  it("removes the matching entry by id", () => {
    const result = removeDrillArchiveEntry([entry("a"), entry("b")], "arch-a");
    expect(result.map((e) => e.drillId)).toEqual(["b"]);
  });

  it("is a no-op when the id isn't found", () => {
    const history = [entry("a")];
    expect(removeDrillArchiveEntry(history, "nope")).toEqual(history);
  });
});

describe("updateDrillArchiveEntry()", () => {
  it("patches only the given fields, leaving id/drillId/solvedAt untouched", () => {
    const history = [entry("a")];
    const result = updateDrillArchiveEntry(history, "arch-a", { sol: "new solution" });
    expect(result).not.toBeNull();
    expect(result![0]!.sol).toBe("new solution");
    expect(result![0]!.q).toBe("Q");
    expect(result![0]!.drillId).toBe("a");
    expect(result![0]!.solvedAt).toBe(history[0]!.solvedAt);
  });

  it("returns null when the id isn't found", () => {
    expect(updateDrillArchiveEntry([entry("a")], "nope", { q: "x" })).toBeNull();
  });
});

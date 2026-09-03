// kbFor()'s fallback for techs OUTSIDE the curated KB — the long tail of specific libraries and
// architecture patterns vacancies actually name (e.g. "LiveKit", "Event-driven Architecture")
// that no fixed curated list can keep up with. Used to be a single static, English-only,
// unparametrized "roadmap.sh" homepage link regardless of locale or tech; now it's tech-
// parametrized search links plus a properly localized learn bullet.
import { describe, expect, it } from "vitest";
import { KB, kbFor } from "./knowledge-base.js";
import { runWithRequestContext } from "../../core/request-context.js";

describe("kbFor()", () => {
  it("returns the curated entry for a known technology", () => {
    const kb = kbFor("React");
    expect(kb.learn.length).toBeGreaterThan(0);
    expect(kb.resources.some((r) => r.u.includes("react.dev"))).toBe(true);
  });

  it("falls back to tech-parametrized generic resources for an unknown technology", () => {
    const kb = kbFor("LiveKit");
    expect(kb.learn[0]).toContain("LiveKit");
    // Every generic resource is a search/listing URL parametrized by the tech name — never a
    // guessed specific page, and never the old bare "roadmap.sh" homepage.
    expect(kb.resources.length).toBeGreaterThan(1);
    for (const r of kb.resources) {
      expect(r.u).toContain(encodeURIComponent("LiveKit"));
    }
  });

  it("localizes the generic fallback's learn text for uk, unlike before", async () => {
    const kb = await runWithRequestContext("req-1", "uk", () => Promise.resolve(kbFor("Event-driven Architecture")));
    expect(kb.learn[0]).toContain("Event-driven Architecture");
    expect(kb.learn[0]).toMatch(/[а-яіїєґ]/i);
  });

  it("has no drills/cards for an unknown technology (no shared practice category)", () => {
    const kb = kbFor("Some Made Up Tech Xyz");
    expect(kb.drills).toEqual([]);
    expect(kb.cards).toEqual([]);
  });
});

// Sanity check for the mechanical split of KB's literal into entries/<track>.ts (one file per
// shared/tracks.ts Track, merged back into one KB object here) — 319 is the exact count of
// top-level KB keys counted BEFORE that split, pinned as a literal rather than derived from
// entries/*.ts so this test would actually fail if the merge silently dropped or duplicated a key.
describe("KB (post entries/ split)", () => {
  it("still has exactly as many curated entries as before the split into entries/<track>.ts", () => {
    expect(Object.keys(KB).length).toBe(319);
  });
});

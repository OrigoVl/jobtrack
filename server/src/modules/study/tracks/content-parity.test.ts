// Guards against the exact silent-drift failure mode CLAUDE.md warns about for
// knowledge-base.ts's buildKbUk(): nothing enforces that a uk mirror actually stays in sync with
// its en source, or that every KB key has a uk counterpart — a missing entry just quietly falls
// back to English (or the generic entry) with no error anywhere. This test makes that structural
// guarantee explicit for every track, including "software" (content.ts's own CARDS/CARDS_UK)
// so a future edit to the existing pool is covered too, not just the new tracks.
import { describe, expect, it } from "vitest";
import { TRACKS } from "../../../shared/tracks.js";
import { getCards, getDrills } from "./index.js";
import { KB } from "../../knowledge/knowledge-base.js";
import { buildKbUk } from "../../knowledge/knowledge-base.uk.js";

describe("track content parity (en vs uk)", () => {
  for (const track of TRACKS) {
    describe(`track: ${track}`, () => {
      it("uk cards mirror en cards exactly by id, cat, and order", () => {
        const en = getCards("en", track);
        const uk = getCards("uk", track);
        expect(uk.map((c) => c.id)).toEqual(en.map((c) => c.id));
        expect(uk.map((c) => c.cat)).toEqual(en.map((c) => c.cat));
      });

      it("uk drills mirror en drills exactly by id, cat, lvl, and order", () => {
        const en = getDrills("en", track);
        const uk = getDrills("uk", track);
        expect(uk.map((d) => d.id)).toEqual(en.map((d) => d.id));
        expect(uk.map((d) => d.cat)).toEqual(en.map((d) => d.cat));
        expect(uk.map((d) => d.lvl)).toEqual(en.map((d) => d.lvl));
      });

      // `exp` (extra explanation beyond the solution) is intentionally blank on some existing
      // curated drills (see content.ts) — not checked here for that reason; `q`/`a`/`sol` are
      // never legitimately empty.
      it("every en card/drill has non-empty q/a (or q/sol) text", () => {
        for (const c of getCards("en", track)) {
          expect(c.q.trim().length).toBeGreaterThan(0);
          expect(c.a.trim().length).toBeGreaterThan(0);
        }
        for (const d of getDrills("en", track)) {
          expect(d.q.trim().length).toBeGreaterThan(0);
          expect(d.sol.trim().length).toBeGreaterThan(0);
        }
      });

      it("every uk card/drill has non-empty translated text (no untranslated placeholder)", () => {
        for (const c of getCards("uk", track)) {
          expect(c.q.trim().length).toBeGreaterThan(0);
          expect(c.a.trim().length).toBeGreaterThan(0);
        }
        for (const d of getDrills("uk", track)) {
          expect(d.q.trim().length).toBeGreaterThan(0);
          expect(d.sol.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe("knowledge base (KB) uk parity", () => {
  it("every KB key has a matching buildKbUk() entry", () => {
    const uk = buildKbUk();
    const missing = Object.keys(KB).filter((tech) => !(tech in uk));
    expect(missing).toEqual([]);
  });
});

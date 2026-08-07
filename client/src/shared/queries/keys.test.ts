import { describe, expect, it } from "vitest";
import { queryKeys } from "./keys";

/**
 * These keys are what every `invalidateQueries`/`setQueryData` call in the app matches on.
 * TanStack Query matches a key by PREFIX, so two entries that are equal — or where one is a
 * prefix of another — silently make one mutation invalidate an unrelated cache (or, worse, make
 * two different queries share one cache entry). Neither shows up as a type error.
 */
describe("queryKeys", () => {
  const entries = Object.entries(queryKeys) as [string, readonly string[]][];

  it("gives every key a single non-empty segment", () => {
    for (const [name, key] of entries) {
      expect(key, name).toHaveLength(1);
      expect(key[0]?.trim(), name).toBeTruthy();
    }
  });

  it("has no two entries sharing the same root segment", () => {
    const seen = new Map<string, string>();
    for (const [name, key] of entries) {
      const root = key[0]!;
      const previous = seen.get(root);
      // e.g. adding `cvDocs: ["cvDoc"]` next to `cvDoc: ["cvDoc"]` — the parameterized hooks that
      // spread an id onto these ([...queryKeys.cvDoc, id]) would then collide outright.
      expect(previous, `"${root}" is used by both ${previous} and ${name}`).toBeUndefined();
      seen.set(root, name);
    }
  });

  it("names each key after its own property, so a call site reads the same as the cache entry", () => {
    for (const [name, key] of entries) {
      expect(key[0], `queryKeys.${name}`).toBe(name);
    }
  });
});

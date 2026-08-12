import { test as base, expect, type Page } from "@playwright/test";

/**
 * Playwright's `test`, extended so that rows a spec creates on the shared e2e account are removed
 * again when it finishes. Import `test`/`expect` from here instead of `@playwright/test` in any
 * spec that adds a vacancy, CV profile, contact or saved search.
 *
 * The suite runs against a PERSISTENT database (playwright.config.ts's DATABASE_URL), and the
 * account is shared across spec files — so without this, every local run leaves its rows behind
 * for the next one to trip over. That failure is nastier than it sounds because it never looks
 * like state: a second run turns `getByRole("option", { name: /Frontend Developer/ })` into a
 * strict-mode violation over three identical options, and which spec draws the short straw
 * changes as specs are added. CI never sees it, since CI always starts from an empty database.
 *
 * Deliberately a before/after DIFF of the account's own rows rather than bookkeeping at each
 * creation site: specs create rows through the UI as often as through the API, and anything that
 * relies on remembering to track an id is something a future spec can forget. Rows that already
 * existed are left strictly alone, so the account's default CV profile survives.
 *
 * Two things this does NOT cover, both on purpose:
 *
 * - Edits to existing state rather than new rows — a roadmap status, a ticked plan/project item,
 *   a seeded CV doc. Nothing generic can know what the previous value was, so the specs that make
 *   those changes undo them themselves (see roadmap/projects/plan21).
 * - The throwaway accounts auth-flow.spec.ts and welcome.spec.ts register. Deletion is a
 *   deliberately email-confirmed flow (auth.ts's `deleteUser`), so a test cannot complete it.
 *   They accumulate at ~5 rows a run and are harmless: the emails carry a timestamp, so they
 *   never collide, and no spec asserts on a user count.
 */

/** Checked child-first, so deleting a row never runs into something still pointing at it. */
const COLLECTIONS = [
  { list: "/api/contacts", remove: (id: number) => `/api/contacts/${id}` },
  { list: "/api/saved-searches", remove: (id: number) => `/api/saved-searches/${id}` },
  // Before vacancies: an event may carry a vacancyId, and the composite FK behind it would
  // reject the parent's delete while the event is still there.
  { list: "/api/calendar/events", remove: (id: number) => `/api/calendar/events/${id}` },
  { list: "/api/vacancies", remove: (id: number) => `/api/vacancies/${id}` },
  { list: "/api/cv/profiles", remove: (id: number) => `/api/cv/profiles/${id}` },
] as const;

/** Ids currently in one collection. Returns nothing rather than throwing on a failed request:
 * teardown runs even when the test already failed, quite possibly BECAUSE the app was unhappy,
 * and a cleanup that throws would replace the real failure with its own. */
async function idsIn(page: Page, url: string): Promise<Set<number>> {
  try {
    const res = await page.request.get(url);
    if (!res.ok()) return new Set();
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return new Set();
    return new Set(rows.map((row) => (row as { id?: unknown }).id).filter((id): id is number => typeof id === "number"));
  } catch {
    return new Set();
  }
}

export const test = base.extend<{ removeRowsThisSpecCreated: void }>({
  removeRowsThisSpecCreated: [
    async ({ page }, use) => {
      const before = await Promise.all(COLLECTIONS.map((c) => idsIn(page, c.list)));
      await use();
      for (const [i, collection] of COLLECTIONS.entries()) {
        for (const id of await idsIn(page, collection.list)) {
          if (before[i]?.has(id)) continue;
          try {
            await page.request.delete(collection.remove(id));
          } catch {
            // Best effort: a row another spec's teardown already took, or an app that's down.
          }
        }
      }
    },
    { auto: true },
  ],
});

export { expect };

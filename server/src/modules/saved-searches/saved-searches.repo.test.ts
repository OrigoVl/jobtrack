// Integration test against a REAL (in-process, PGlite) Postgres — proves multi-tenant scoping
// for the authed CRUD, AND that listAllSavedSearches() (the scheduler's one deliberately
// unscoped query) correctly joins in every user's own email, never mixing users up.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let repo: typeof import("./saved-searches.repo.js");

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A, "alice@example.test");
  await insertTestUser(testDb, USER_B, "bob@example.test");
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./saved-searches.repo.js");
});

describe("saved-searches.repo (PGlite)", () => {
  it("createSavedSearch() + listSavedSearches() round-trips, scoped to that user", async () => {
    const search = await repo.createSavedSearch(USER_A, { query: "react developer", region: "remote", label: "React roles" });
    expect(search).toEqual(expect.objectContaining({ query: "react developer", region: "remote", label: "React roles" }));
    const rows = await repo.listSavedSearches(USER_A);
    expect(rows.some((r) => r.id === search.id)).toBe(true);
  });

  it("listSavedSearches() never returns another user's rows", async () => {
    const searchB = await repo.createSavedSearch(USER_B, { query: "designer", region: "all", label: "" });
    const rowsA = await repo.listSavedSearches(USER_A);
    const rowsB = await repo.listSavedSearches(USER_B);
    expect(rowsA.some((r) => r.id === searchB.id)).toBe(false);
    expect(rowsB.every((r) => r.query === "designer")).toBe(true);
  });

  it("deleteSavedSearch() scoped to the wrong user deletes nothing", async () => {
    const search = await repo.createSavedSearch(USER_A, { query: "sre", region: "ua", label: "" });
    const deletedByB = await repo.deleteSavedSearch(USER_B, search.id);
    expect(deletedByB).toBe(0);
    expect(await repo.listSavedSearches(USER_A)).toEqual(expect.arrayContaining([expect.objectContaining({ id: search.id })]));
  });

  it("listAllSavedSearches() (the scheduler's global query) joins in each row's OWN user's email", async () => {
    const searchA = await repo.createSavedSearch(USER_A, { query: "for alice", region: "all", label: "" });
    const searchB = await repo.createSavedSearch(USER_B, { query: "for bob", region: "all", label: "" });
    const all = await repo.listAllSavedSearches();
    const rowA = all.find((r) => r.id === searchA.id);
    const rowB = all.find((r) => r.id === searchB.id);
    expect(rowA?.userEmail).toBe("alice@example.test");
    expect(rowB?.userEmail).toBe("bob@example.test");
  });

  it("recordRunResult() advances lastSeenUrls always, but lastNotifiedAt only when notified=true", async () => {
    const search = await repo.createSavedSearch(USER_A, { query: "advance test", region: "all", label: "" });
    await repo.recordRunResult(search.id, ["https://a.test/1"], false);
    let all = await repo.listAllSavedSearches();
    let row = all.find((r) => r.id === search.id);
    expect(row?.lastSeenUrls).toEqual(["https://a.test/1"]);
    expect(row?.lastNotifiedAt).toBeNull();

    await repo.recordRunResult(search.id, ["https://a.test/1", "https://a.test/2"], true);
    all = await repo.listAllSavedSearches();
    row = all.find((r) => r.id === search.id);
    expect(row?.lastSeenUrls).toEqual(["https://a.test/1", "https://a.test/2"]);
    expect(row?.lastNotifiedAt).not.toBeNull();
  });
});

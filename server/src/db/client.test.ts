// Unit test for withAdvisoryLock() — the Postgres advisory-lock helper digest.scheduler.ts and
// saved-searches.scheduler.ts use so that with 2+ server replicas, only one replica's
// `setInterval` tick actually runs the job (see client.ts's own doc comment on the function).
//
// This can't use the usual "vi.doMock('.../client.js', () => ({ default: testDb }))" pattern
// every other db/*.ts and *.repo.ts test uses (see companies.repo.test.ts, kv.streak.test.ts,
// bootstrap.test.ts): withAdvisoryLock is defined IN client.ts itself, so mocking client.js
// before importing it would replace the very function under test. Instead we import the REAL
// client.ts (so we exercise the real function), but stub DB_MIGRATE_ON_BOOT=false first so its
// top-level `await migrate(db, ...)` (which runs against a real Postgres) doesn't fire — and pass
// a PGlite-backed AppDb in as withAdvisoryLock's `testDb` override, so the SQL itself still runs
// against a real (if in-process) Postgres, never against the module's own unreachable real pool.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./test-db.js";

let withAdvisoryLock: typeof import("./client.js").withAdvisoryLock;
let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  vi.stubEnv("DB_MIGRATE_ON_BOOT", "false");
  vi.resetModules();
  testDb = await createTestDb();
  withAdvisoryLock = (await import("./client.js")).withAdvisoryLock;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("withAdvisoryLock() (PGlite)", () => {
  it("acquires the lock, runs fn, and returns true", async () => {
    let ran = false;
    const result = await withAdvisoryLock(
      1,
      async () => {
        ran = true;
      },
      testDb,
    );
    expect(result).toBe(true);
    expect(ran).toBe(true);
  });

  it("does not run fn, and rolls back cleanly, when fn throws — the error still propagates", async () => {
    const err = new Error("boom");
    await expect(
      withAdvisoryLock(
        2,
        async () => {
          throw err;
        },
        testDb,
      ),
    ).rejects.toThrow("boom");
    // A subsequent call for the SAME key still succeeds — proves the failed transaction released
    // the lock (ROLLBACK) instead of leaving it stuck held.
    let ranAfter = false;
    const result = await withAdvisoryLock(
      2,
      async () => {
        ranAfter = true;
      },
      testDb,
    );
    expect(result).toBe(true);
    expect(ranAfter).toBe(true);
  });

  it("a second, later call for the same key still acquires it once the first call's transaction has committed", async () => {
    const first = await withAdvisoryLock(3, async () => {}, testDb);
    const second = await withAdvisoryLock(3, async () => {}, testDb);
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  // NOT reproducible against PGlite — see the big comment below. Left in (skipped, not deleted)
  // so this gap is visible in the test file itself, not just in a PR description someone can miss.
  it.skip("two CONCURRENT calls for the same key — only one should actually run fn (documents a real PGlite limitation, see comment)", async () => {
    // What this is supposed to prove: with 2+ replicas hitting a REAL Postgres, if replica A's
    // transaction is still open and holding the advisory lock, replica B's
    // pg_try_advisory_xact_lock() for the same key must return false (and therefore B's fn must
    // not run) until A commits/rolls back — that's the entire point of this helper.
    //
    // Empirically verified this does NOT hold against PGlite: PGlite is a single embedded
    // Postgres backend (one session/one connection, not a connection pool) — there is no way to
    // open two independent, truly concurrent sessions against the same PGlite instance the way
    // two real replicas each open their own connection to a real Postgres. Ran the exact
    // scenario below directly against a PGlite instance (BEGIN; SELECT
    // pg_try_advisory_xact_lock(1); <hold open 500ms>; COMMIT, racing two calls for the SAME
    // key via Promise.all): BOTH calls got locked=true. This isn't a fluke — Postgres advisory
    // locks are reentrant *within the same session* (the same backend can re-acquire a lock it
    // already holds), and since both "concurrent" calls run through PGlite's one single
    // session, the second call is indistinguishable, from Postgres's point of view, from the
    // FIRST call asking for the same lock again — so it trivially succeeds too. A naive version
    // of this test that asserted `ran.length === 1` would therefore pass or fail based on
    // PGlite's single-session behavior, not on whether withAdvisoryLock's actual SQL
    // (pg_try_advisory_xact_lock, transaction-scoped) is correct — a false signal either way.
    //
    // The three tests above DO genuinely exercise the real SQL (acquire/run/return true,
    // rollback-releases-the-lock-on-error, sequential re-acquisition after commit) against a
    // real (if in-process) Postgres — just not true cross-connection contention, which would
    // need a real multi-connection Postgres (e.g. the e2e job's pgvector/pgvector:pg16 service
    // container) to verify, not PGlite.
    const ran: string[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await Promise.all([
      withAdvisoryLock(
        4,
        async () => {
          ran.push("a");
          await sleep(50);
        },
        testDb,
      ),
      withAdvisoryLock(
        4,
        async () => {
          ran.push("b");
        },
        testDb,
      ),
    ]);
    expect(ran).toHaveLength(1);
  });
});

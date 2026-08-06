// Integration test against a REAL (in-process, PGlite) Postgres — same pattern as
// billing.repo.test.ts. db/client.js is mocked via vi.doMock BEFORE the dynamic imports below, so
// every module under test's static `import db from ".../client.js"` picks up the test instance.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { user } from "../../db/schema/index.js";
import { type UserId } from "../../db/user-id.js";

const REFERRER = "referrer-a" as UserId;

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./referrals.repo.js");
let service: typeof import("./referrals.service.js");
let vacanciesRepo: typeof import("../vacancies/vacancies.repo.js");

async function verifyEmail(id: UserId): Promise<void> {
  await testDb.update(user).set({ emailVerified: true }).where(eq(user.id, id));
}

const NEW_VACANCY = {
  company: "Acme",
  position: "Engineer",
  level: "mid",
  salary: "",
  url: "",
  status: "Want to apply",
  fit: "med",
  applied: "",
  next: "",
  notes: "",
  stack: [],
};

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, REFERRER);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./referrals.repo.js");
  service = await import("./referrals.service.js");
  vacanciesRepo = await import("../vacancies/vacancies.repo.js");
});

describe("claimReferral() (PGlite)", () => {
  it("creates a pending referral for a valid code + new referee", async () => {
    const referee = "referee-1" as UserId;
    await insertTestUser(testDb, referee);
    const claimed = await service.claimReferral(REFERRER, referee, { ip: "203.0.113.9", email: "referee1@example.com" });
    expect(claimed).toBe(true);
    const row = await repo.getReferralForReferee(referee);
    expect(row).toMatchObject({ referrerUserId: REFERRER, refereeUserId: referee, status: "pending" });
  });

  it("rejects a self-referral", async () => {
    const claimed = await service.claimReferral(REFERRER, REFERRER, { ip: null, email: "self@example.com" });
    expect(claimed).toBe(false);
  });

  it("rejects an unknown/garbage code", async () => {
    const referee = "referee-2" as UserId;
    await insertTestUser(testDb, referee);
    const claimed = await service.claimReferral("not-a-real-user-id", referee, { ip: null, email: "referee2@example.com" });
    expect(claimed).toBe(false);
    expect(await repo.getReferralForReferee(referee)).toBeNull();
  });

  it("is idempotent — a referee who already has a referral row can't claim a second one", async () => {
    const referee = "referee-3" as UserId;
    const otherReferrer = "referrer-b" as UserId;
    await insertTestUser(testDb, referee);
    await insertTestUser(testDb, otherReferrer);
    expect(await service.claimReferral(REFERRER, referee, { ip: null, email: "referee3@example.com" })).toBe(true);
    expect(await service.claimReferral(otherReferrer, referee, { ip: null, email: "referee3@example.com" })).toBe(false);
    expect((await repo.getReferralForReferee(referee))?.referrerUserId).toBe(REFERRER);
  });
});

describe("qualifyPendingReferrals() (PGlite)", () => {
  it("qualifies a pending referral whose referee is email-verified, active, and past the 72h delay", async () => {
    const referee = "referee-qualify" as UserId;
    await insertTestUser(testDb, referee);
    await verifyEmail(referee);
    await vacanciesRepo.createVacancy(referee, NEW_VACANCY);
    await service.claimReferral(REFERRER, referee, { ip: null, email: "qualify@example.com" });

    const past72h = Date.now() + 73 * 60 * 60 * 1000; // sweep runs as if 73h had elapsed
    const qualifiedCount = await service.qualifyPendingReferrals(past72h);
    expect(qualifiedCount).toBeGreaterThanOrEqual(1);
    expect((await repo.getReferralForReferee(referee))?.status).toBe("qualified");
  });

  it("does NOT qualify before the 72h delay has passed, even if otherwise eligible", async () => {
    const referee = "referee-too-soon" as UserId;
    await insertTestUser(testDb, referee);
    await verifyEmail(referee);
    await vacanciesRepo.createVacancy(referee, NEW_VACANCY);
    await service.claimReferral(REFERRER, referee, { ip: null, email: "toosoon@example.com" });

    await service.qualifyPendingReferrals(Date.now()); // no time elapsed
    expect((await repo.getReferralForReferee(referee))?.status).toBe("pending");
  });

  it("does NOT qualify an unverified email or a referee with no real activity, even after 72h", async () => {
    const unverified = "referee-unverified" as UserId;
    const inactive = "referee-inactive" as UserId;
    await insertTestUser(testDb, unverified);
    await insertTestUser(testDb, inactive);
    await vacanciesRepo.createVacancy(unverified, NEW_VACANCY); // active but never verified
    await verifyEmail(inactive); // verified but no vacancies
    await service.claimReferral(REFERRER, unverified, { ip: null, email: "unverified@example.com" });
    await service.claimReferral(REFERRER, inactive, { ip: null, email: "inactive@example.com" });

    const past72h = Date.now() + 73 * 60 * 60 * 1000;
    await service.qualifyPendingReferrals(past72h);
    expect((await repo.getReferralForReferee(unverified))?.status).toBe("pending");
    expect((await repo.getReferralForReferee(inactive))?.status).toBe("pending");
  });
});

describe("getReferralBonusCalls() (PGlite)", () => {
  it("is 0 for a referrer with no qualified referrals", async () => {
    const soloReferrer = "referrer-solo" as UserId;
    await insertTestUser(testDb, soloReferrer);
    expect(await service.getReferralBonusCalls(soloReferrer)).toBe(0);
  });

  it("caps the bonus at REFERRAL_MAX_BONUS_REFERRALS even with more qualified referrals than that", async () => {
    const bigReferrer = "referrer-big" as UserId;
    await insertTestUser(testDb, bigReferrer);
    const extraReferrals = service.REFERRAL_MAX_BONUS_REFERRALS + 2;
    for (let i = 0; i < extraReferrals; i++) {
      const referee = `referee-big-${i}` as UserId;
      await insertTestUser(testDb, referee);
      await verifyEmail(referee);
      await vacanciesRepo.createVacancy(referee, NEW_VACANCY);
      await service.claimReferral(bigReferrer, referee, { ip: null, email: `big${i}@example.com` });
    }
    await service.qualifyPendingReferrals(Date.now() + 73 * 60 * 60 * 1000);

    expect(await service.getReferralBonusCalls(bigReferrer)).toBe(
      service.REFERRAL_MAX_BONUS_REFERRALS * service.REFERRAL_BONUS_PER_REFERRAL,
    );
  });
});

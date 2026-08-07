import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storeReferralCode, takeStoredReferralCode } from "./referral-storage";

/**
 * The referral code has to survive a gap the app has no session across: email+password signup
 * waits on email verification, and Google OAuth navigates away and back. Both of the guarantees
 * that makes it work are behavioural, not typed — the code is handed over exactly once, and
 * nothing here ever throws when storage is unavailable.
 */
describe("referral storage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("hands the stored code back and clears it, so a later signup can't re-claim it", () => {
    storeReferralCode("42");
    expect(takeStoredReferralCode()).toBe("42");
    expect(takeStoredReferralCode()).toBeNull();
  });

  it("returns null when no code was ever stored", () => {
    expect(takeStoredReferralCode()).toBeNull();
  });

  it("keeps the most recent code when a visitor lands on a second referral link", () => {
    storeReferralCode("1");
    storeReferralCode("2");
    expect(takeStoredReferralCode()).toBe("2");
  });

  it("never throws when writing is unavailable (private browsing, quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // A referral bonus is a nice-to-have; blowing up here would break the register page itself.
    expect(() => storeReferralCode("42")).not.toThrow();
  });

  it("degrades to null when reading is unavailable, rather than propagating the error", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(takeStoredReferralCode()).toBeNull();
  });
});

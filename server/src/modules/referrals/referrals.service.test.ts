import { describe, expect, it, vi } from "vitest";

// The functions under test are pure, but referrals.service.ts statically imports
// referrals.repo.ts/vacancies.repo.ts, which import db/client.ts — importing THAT for real opens
// a live pg Pool and runs migrate-on-boot as a top-level await (see vacancy-history.test.ts's
// identical comment for why). This mock only exists to satisfy module resolution.
vi.mock("../../db/client.js", () => ({ default: {} }));

import { isEligibleForQualification, ipPrefix, emailDomain } from "./referrals.service.js";

describe("isEligibleForQualification()", () => {
  it("requires BOTH a verified email and real activity", () => {
    expect(isEligibleForQualification(true, true)).toBe(true);
    expect(isEligibleForQualification(true, false)).toBe(false);
    expect(isEligibleForQualification(false, true)).toBe(false);
    expect(isEligibleForQualification(false, false)).toBe(false);
  });
});

describe("ipPrefix()", () => {
  it("truncates an IPv4 address to its /24", () => {
    expect(ipPrefix("203.0.113.42")).toBe("203.0.113.0/24");
  });

  it("truncates an IPv6-ish address to its first 3 hextets", () => {
    expect(ipPrefix("2001:db8:85a3:0:0:8a2e:370:7334")).toBe("2001:db8:85a3::/48");
  });

  it("returns null for null/unparseable input", () => {
    expect(ipPrefix(null)).toBeNull();
    expect(ipPrefix("not-an-ip")).toBeNull();
  });
});

describe("emailDomain()", () => {
  it("extracts and lowercases the domain", () => {
    expect(emailDomain("Person@Example.COM")).toBe("example.com");
  });

  it("returns null for a string with no @", () => {
    expect(emailDomain("not-an-email")).toBeNull();
  });
});

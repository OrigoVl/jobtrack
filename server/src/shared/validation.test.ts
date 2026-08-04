import { describe, expect, it } from "vitest";
import {
  parseVacancyInput,
  parseJsonVacancyItem,
  parseProfileInput,
  parseCompanyInput,
  parseContactInput,
  parsePagination,
  assertSafeVacancyUrl,
  STATUSES,
  FITS,
} from "./validation.js";
import { HttpError } from "../core/http.js";

describe("parseVacancyInput", () => {
  it("fills defaults for a full (non-partial) payload", () => {
    const out = parseVacancyInput({ position: "Backend Developer" });
    expect(out.company).toBe("New");
    expect(out.status).toBe(STATUSES[0]);
    expect(out.fit).toBe("med");
    expect(out.stack).toEqual([]);
  });

  it("trims, dedupes and caps the stack array", () => {
    const out = parseVacancyInput({ stack: ["React", " React ", "Node", ""] });
    expect(out.stack).toEqual(["React", "Node"]);
  });

  it("rejects an invalid status", () => {
    expect(() => parseVacancyInput({ status: "not-a-status" })).toThrow(HttpError);
  });

  it("rejects an invalid fit", () => {
    expect(() => parseVacancyInput({ fit: "ultra" })).toThrow(HttpError);
    expect(FITS).not.toContain("ultra");
  });

  it("rejects a non-http(s) url", () => {
    expect(() => parseVacancyInput({ url: "javascript:alert(1)" })).toThrow(HttpError);
  });

  it("accepts an empty or ISO-formatted date for applied/next", () => {
    expect(parseVacancyInput({ applied: "", next: "2026-08-15" }).next).toBe("2026-08-15");
    expect(parseVacancyInput({ applied: "2026-01-02" }).applied).toBe("2026-01-02");
  });

  it("rejects a non-ISO date for applied/next (analytics compares these as strings)", () => {
    // server/src/modules/analytics/analytics.routes.ts and client/dashboard.tsx compare
    // these fields as strings (e.g. v.next < today) — free text would silently break that logic.
    expect(() => parseVacancyInput({ next: "tomorrow" })).toThrow(HttpError);
    expect(() => parseVacancyInput({ applied: "15.08.2026" })).toThrow(HttpError);
  });

  it("in partial mode only touches provided fields", () => {
    const out = parseVacancyInput({ notes: "update" }, { partial: true });
    expect(out).toEqual({ notes: "update" });
  });

  it("accepts a freeform salary string, defaulting to '' and trimming/capping like level", () => {
    expect(parseVacancyInput({}).salary).toBe("");
    expect(parseVacancyInput({ salary: "  $90k-110k  " }).salary).toBe("$90k-110k");
    expect(parseVacancyInput({ salary: "x".repeat(100) }).salary).toHaveLength(60);
  });
});

describe("parseJsonVacancyItem", () => {
  const validItem = {
    company: "Zone3000",
    pos: "Full-Stack Engineer (Node.js, JS) (#1114)",
    level: "Middle/Senior",
    fit: "med",
    status: "Want to apply",
    applied: "2026-07-26",
    next: "",
    notes: "",
    url: "https://jobs.dou.ua/companies/zone3000/vacancies/345691/",
  };

  it("parses a job-tracker.json-shaped item, mapping 'pos' to 'position'", () => {
    const out = parseJsonVacancyItem(validItem);
    expect(out.position).toBe(validItem.pos);
    expect(out.company).toBe("Zone3000");
    expect(out.status).toBe("Want to apply");
    expect(out.fit).toBe("med");
  });

  it("accepts a freeform salary string and trims/truncates it, defaulting to '' when absent", () => {
    expect(parseJsonVacancyItem(validItem).salary).toBe("");
    expect(parseJsonVacancyItem({ ...validItem, salary: "  $90k-110k  " }).salary).toBe("$90k-110k");
    expect(parseJsonVacancyItem({ ...validItem, salary: "x".repeat(100) }).salary).toHaveLength(60);
  });

  it("accepts 'position' as a fallback key (own export round-trip)", () => {
    const { pos, ...rest } = validItem;
    void pos;
    const out = parseJsonVacancyItem({ ...rest, position: "Backend Developer" });
    expect(out.position).toBe("Backend Developer");
  });

  it("rejects an unknown status or fit", () => {
    expect(() => parseJsonVacancyItem({ ...validItem, status: "not-a-status" })).toThrow(HttpError);
    expect(() => parseJsonVacancyItem({ ...validItem, fit: "ultra" })).toThrow(HttpError);
  });

  it("normalizes common Ukrainian status labels to the canonical wire value", () => {
    expect(parseJsonVacancyItem({ ...validItem, status: "Хочу подати" }).status).toBe("Want to apply");
    expect(parseJsonVacancyItem({ ...validItem, status: "Відправив CV" }).status).toBe("Applied");
    expect(parseJsonVacancyItem({ ...validItem, status: "Скринінг" }).status).toBe("Screening");
    expect(parseJsonVacancyItem({ ...validItem, status: "Відмова" }).status).toBe("Rejected");
    // case/whitespace-insensitive
    expect(parseJsonVacancyItem({ ...validItem, status: "  скринінг  " }).status).toBe("Screening");
  });

  it("rejects a non-ISO applied/next date", () => {
    expect(() => parseJsonVacancyItem({ ...validItem, applied: "26.07.2026" })).toThrow(HttpError);
  });

  it("rejects a non-http(s) url", () => {
    expect(() => parseJsonVacancyItem({ ...validItem, url: "javascript:alert(1)" })).toThrow(HttpError);
  });
});

describe("parseProfileInput", () => {
  it("normalizes skills into a deduped string array", () => {
    const out = parseProfileInput({ skills: ["Vue", "Vue", " React "], cvText: "text" });
    expect(out.skills).toEqual(["Vue", "React"]);
  });

  it("rejects a non-array skills field", () => {
    expect(() => parseProfileInput({ skills: "Vue,React" })).toThrow(HttpError);
  });
});

describe("parseCompanyInput", () => {
  it("requires a non-empty name", () => {
    expect(() => parseCompanyInput({ name: "  " })).toThrow(HttpError);
  });

  it("accepts a valid company payload", () => {
    const out = parseCompanyInput({ name: "Acme", notes: "n", questions: ["Q1"] });
    expect(out).toEqual({ name: "Acme", notes: "n", questions: ["Q1"] });
  });
});

describe("parseContactInput", () => {
  it("defaults vacancyId to null when omitted", () => {
    const out = parseContactInput({ name: "Ada" });
    expect(out.vacancyId).toBeNull();
  });

  it("accepts a positive integer vacancyId", () => {
    const out = parseContactInput({ name: "Ada", vacancyId: 5 });
    expect(out.vacancyId).toBe(5);
  });

  it("treats null/empty vacancyId as unlinked", () => {
    expect(parseContactInput({ name: "Ada", vacancyId: null }).vacancyId).toBeNull();
    expect(parseContactInput({ name: "Ada", vacancyId: "" }).vacancyId).toBeNull();
  });

  it("rejects a non-positive or non-integer vacancyId", () => {
    expect(() => parseContactInput({ name: "Ada", vacancyId: 0 })).toThrow(HttpError);
    expect(() => parseContactInput({ name: "Ada", vacancyId: -1 })).toThrow(HttpError);
    expect(() => parseContactInput({ name: "Ada", vacancyId: 1.5 })).toThrow(HttpError);
  });

  it("partial update only touches vacancyId when the field is present", () => {
    const out = parseContactInput({ vacancyId: 3 }, { partial: true });
    expect(out).toEqual({ vacancyId: 3 });
  });
});

describe("parsePagination", () => {
  it("returns undefined limit and zero offset when no query params given", () => {
    expect(parsePagination({})).toEqual({ limit: undefined, offset: 0 });
    expect(parsePagination(undefined)).toEqual({ limit: undefined, offset: 0 });
  });

  it("parses valid limit/offset", () => {
    expect(parsePagination({ limit: "20", offset: "10" })).toEqual({ limit: 20, offset: 10 });
  });

  it("caps limit at 500", () => {
    expect(parsePagination({ limit: "10000" })).toEqual({ limit: 500, offset: 0 });
  });

  it("rejects a non-positive limit", () => {
    expect(() => parsePagination({ limit: "0" })).toThrow(HttpError);
    expect(() => parsePagination({ limit: "-5" })).toThrow(HttpError);
    expect(() => parsePagination({ limit: "abc" })).toThrow(HttpError);
  });

  it("rejects a negative offset", () => {
    expect(() => parsePagination({ offset: "-1" })).toThrow(HttpError);
  });
});

describe("assertSafeVacancyUrl (SSRF guard)", () => {
  it("allows a valid jobs.dou.ua https url", () => {
    expect(assertSafeVacancyUrl("https://jobs.dou.ua/companies/acme/vacancies/1/")).toContain("jobs.dou.ua");
  });

  // This used to have a hard allowlist of just dou.ua — now any public https host is allowed
  // (the user decides which site to pull vacancies from: LinkedIn, Djinni, robota.ua, Indeed,
  // etc.), only internal/local targets are blocked (tests below).
  it("allows an arbitrary public https host (no longer restricted to dou.ua)", () => {
    expect(assertSafeVacancyUrl("https://www.linkedin.com/jobs/view/123/")).toContain("linkedin.com");
    expect(assertSafeVacancyUrl("https://djinni.co/jobs/123-backend-developer/")).toContain("djinni.co");
  });

  it("rejects non-https protocols", () => {
    expect(() => assertSafeVacancyUrl("http://jobs.dou.ua/vacancies/1/")).toThrow(HttpError);
  });

  it("rejects localhost and *.local/*.internal hostnames", () => {
    expect(() => assertSafeVacancyUrl("https://localhost/admin")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://router.local/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://api.internal/")).toThrow(HttpError);
  });

  it("rejects loopback/private/link-local IPv4 literals, including the cloud-metadata address", () => {
    expect(() => assertSafeVacancyUrl("https://127.0.0.1/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://10.0.0.5/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://192.168.1.1/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://172.16.0.1/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://169.254.169.254/latest/meta-data/")).toThrow(HttpError);
  });

  it("rejects the IPv6 loopback literal", () => {
    expect(() => assertSafeVacancyUrl("https://[::1]/")).toThrow(HttpError);
  });

  it("allows a public IPv4 literal (not private/reserved)", () => {
    expect(assertSafeVacancyUrl("https://93.184.216.34/")).toContain("93.184.216.34");
  });
});

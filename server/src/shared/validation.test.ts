import { describe, expect, it } from "vitest";
import {
  parseVacancyInput,
  parseJsonVacancyItem,
  parseProfileInput,
  parseCompanyInput,
  parsePagination,
  assertSafeVacancyUrl,
  STATUSES,
  FITS,
} from "./validation.js";
import { HttpError } from "../core/http.js";

describe("parseVacancyInput", () => {
  it("fills defaults for a full (non-partial) payload", () => {
    const out = parseVacancyInput({ position: "Backend Developer" });
    expect(out.company).toBe("Нова");
    expect(out.status).toBe(STATUSES[0]);
    expect(out.fit).toBe("med");
    expect(out.stack).toEqual([]);
  });

  it("trims, dedupes and caps the stack array", () => {
    const out = parseVacancyInput({ stack: ["React", " React ", "Node", ""] });
    expect(out.stack).toEqual(["React", "Node"]);
  });

  it("rejects an invalid status", () => {
    expect(() => parseVacancyInput({ status: "не-статус" })).toThrow(HttpError);
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
    // server/src/modules/analytics/analytics.routes.ts і client/dashboard.tsx порівнюють
    // ці поля як рядки (напр. v.next < today) — вільний текст тихо ламає цю логіку.
    expect(() => parseVacancyInput({ next: "завтра" })).toThrow(HttpError);
    expect(() => parseVacancyInput({ applied: "15.08.2026" })).toThrow(HttpError);
  });

  it("in partial mode only touches provided fields", () => {
    const out = parseVacancyInput({ notes: "оновлення" }, { partial: true });
    expect(out).toEqual({ notes: "оновлення" });
  });
});

describe("parseJsonVacancyItem", () => {
  const validItem = {
    company: "Zone3000",
    pos: "Full-Stack Engineer (Node.js, JS) (#1114)",
    level: "Middle/Senior",
    fit: "med",
    status: "Хочу подати",
    applied: "2026-07-26",
    next: "",
    notes: "",
    url: "https://jobs.dou.ua/companies/zone3000/vacancies/345691/",
  };

  it("parses a job-tracker.json-shaped item, mapping 'pos' to 'position'", () => {
    const out = parseJsonVacancyItem(validItem);
    expect(out.position).toBe(validItem.pos);
    expect(out.company).toBe("Zone3000");
    expect(out.status).toBe("Хочу подати");
    expect(out.fit).toBe("med");
  });

  it("accepts 'position' as a fallback key (own export round-trip)", () => {
    const { pos, ...rest } = validItem;
    void pos;
    const out = parseJsonVacancyItem({ ...rest, position: "Backend Developer" });
    expect(out.position).toBe("Backend Developer");
  });

  it("rejects an unknown status or fit", () => {
    expect(() => parseJsonVacancyItem({ ...validItem, status: "не-статус" })).toThrow(HttpError);
    expect(() => parseJsonVacancyItem({ ...validItem, fit: "ultra" })).toThrow(HttpError);
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

  it("rejects non-https protocols", () => {
    expect(() => assertSafeVacancyUrl("http://jobs.dou.ua/vacancies/1/")).toThrow(HttpError);
  });

  it("rejects hosts other than dou.ua", () => {
    expect(() => assertSafeVacancyUrl("https://evil.example.com/")).toThrow(HttpError);
  });
});

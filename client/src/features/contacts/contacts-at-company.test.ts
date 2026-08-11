import { describe, expect, it } from "vitest";
import { contactsAtCompany, normalizeCompanyName } from "./contacts-at-company";
import type { Company, Contact, Vacancy } from "../../shared/types";

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 1,
    name: "Iryna Melnyk",
    role: "Recruiter",
    companyId: 10,
    vacancyId: null,
    email: "",
    linkedinUrl: "",
    notes: "",
    lastContactAt: "",
    ...overrides,
  };
}

function vacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 100,
    company: "Acme",
    companyId: 10,
    position: "Node.js Developer",
    level: "",
    salary: "",
    url: "",
    status: "Want to apply",
    fit: "med",
    applied: "",
    next: "",
    notes: "",
    stack: [],
    favorite: false,
    coverLetter: "",
    coverLetterDetails: "",
    ...overrides,
  };
}

const COMPANIES: Company[] = [
  { id: 10, name: "Acme", notes: "", questions: [], website: "" },
  { id: 20, name: "Globex", notes: "", questions: [], website: "" },
];

describe("normalizeCompanyName()", () => {
  it("ignores case, padding and a trailing legal suffix", () => {
    expect(normalizeCompanyName("  ACME  LLC ")).toBe("acme");
    expect(normalizeCompanyName("Acme, Ltd.")).toBe("acme");
    expect(normalizeCompanyName("ТОВ")).toBe("тов"); // a bare suffix is the whole name, not noise
  });

  it("does not merge genuinely different names", () => {
    expect(normalizeCompanyName("Acme")).not.toBe(normalizeCompanyName("Acme Labs"));
  });
});

describe("contactsAtCompany()", () => {
  it("finds a contact sharing the vacancy's linked company row", () => {
    const found = contactsAtCompany([contact()], vacancy(), COMPANIES);
    expect(found.map((c) => c.id)).toEqual([1]);
  });

  it("keeps a contact linked to a DIFFERENT vacancy at the same company", () => {
    // The whole point of the feature: the recruiter from a previous application there.
    const found = contactsAtCompany([contact({ vacancyId: 999 })], vacancy(), COMPANIES);
    expect(found).toHaveLength(1);
  });

  it("excludes contacts already linked to THIS vacancy", () => {
    const found = contactsAtCompany([contact({ vacancyId: 100 })], vacancy(), COMPANIES);
    expect(found).toEqual([]);
  });

  it("excludes a contact at another company", () => {
    const found = contactsAtCompany([contact({ companyId: 20 })], vacancy(), COMPANIES);
    expect(found).toEqual([]);
  });

  it("falls back to comparing names when the vacancy has no linked company row", () => {
    const found = contactsAtCompany([contact({ companyId: 10 })], vacancy({ companyId: null, company: "  acme llc " }), COMPANIES);
    expect(found).toHaveLength(1);
  });

  it("never matches a contact with no company of its own", () => {
    const found = contactsAtCompany([contact({ companyId: null })], vacancy({ companyId: null, company: "Acme" }), COMPANIES);
    expect(found).toEqual([]);
  });

  it("matches nothing when an unlinked vacancy has no company name either", () => {
    const found = contactsAtCompany([contact()], vacancy({ companyId: null, company: "" }), COMPANIES);
    expect(found).toEqual([]);
  });
});

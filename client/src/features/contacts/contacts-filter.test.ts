import { describe, expect, it } from "vitest";
import { contactHaystack, filterAndSortContacts, type ContactLookups } from "./contacts-filter";
import type { Contact } from "../../shared/types";

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 1,
    name: "Iryna Melnyk",
    role: "Recruiter",
    companyId: null,
    vacancyId: null,
    email: "",
    linkedinUrl: "",
    notes: "",
    source: "manual",
    lastContactAt: "",
    ...overrides,
  };
}

const COMPANIES: Record<number, string> = { 1: "N-iX", 2: "EvoPlay" };
const VACANCIES: Record<number, string> = { 10: "N-iX — Senior Full-Stack Engineer", 20: "EvoPlay — Tech Lead Frontend" };
const lookups: ContactLookups = {
  companyName: (id) => (id ? (COMPANIES[id] ?? "") : ""),
  vacancyLabel: (id) => (id ? (VACANCIES[id] ?? "") : ""),
};

const sorted = (contacts: Contact[], search = "") =>
  filterAndSortContacts(contacts, { search, sortBy: "default", sortDir: "asc" }, lookups);

describe("contactHaystack()", () => {
  it("includes the company and vacancy the row only stores as ids", () => {
    const h = contactHaystack(contact({ companyId: 1, vacancyId: 10 }), lookups);
    expect(h).toContain("n-ix");
    expect(h).toContain("senior full-stack engineer");
  });

  it("covers name, role, email and notes", () => {
    const h = contactHaystack(contact({ email: "iryna@n-ix.com", notes: "Met at JSFest" }), lookups);
    expect(h).toContain("iryna melnyk");
    expect(h).toContain("recruiter");
    expect(h).toContain("iryna@n-ix.com");
    expect(h).toContain("met at jsfest");
  });
});

describe("filterAndSortContacts()", () => {
  const list = [
    contact({ id: 1, name: "Iryna Melnyk", companyId: 1, vacancyId: 10, lastContactAt: "2026-08-10" }),
    contact({ id: 2, name: "Andrii Koval", companyId: 2, vacancyId: 20, lastContactAt: "2026-08-01" }),
    contact({ id: 3, name: "Olena Bondar", companyId: null, vacancyId: null }),
  ];

  it("returns everything, in server order, without a query", () => {
    expect(sorted(list).map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("matches by company and by vacancy, not just by name", () => {
    expect(sorted(list, "evoplay").map((c) => c.id)).toEqual([2]);
    expect(sorted(list, "full-stack").map((c) => c.id)).toEqual([1]);
    expect(sorted(list, "olena").map((c) => c.id)).toEqual([3]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(sorted(list, "  N-IX  ").map((c) => c.id)).toEqual([1]);
  });

  it("sorts by name in both directions", () => {
    expect(filterAndSortContacts(list, { search: "", sortBy: "name", sortDir: "asc" }, lookups).map((c) => c.id)).toEqual([2, 1, 3]);
    expect(filterAndSortContacts(list, { search: "", sortBy: "name", sortDir: "desc" }, lookups).map((c) => c.id)).toEqual([3, 1, 2]);
  });

  it("sorts by company, with an unassigned contact treated as an empty name", () => {
    expect(filterAndSortContacts(list, { search: "", sortBy: "company", sortDir: "asc" }, lookups).map((c) => c.id)).toEqual([3, 2, 1]);
  });

  it("keeps never-contacted rows last whichever way the date column is sorted", () => {
    expect(filterAndSortContacts(list, { search: "", sortBy: "lastContact", sortDir: "asc" }, lookups).map((c) => c.id)).toEqual([2, 1, 3]);
    expect(filterAndSortContacts(list, { search: "", sortBy: "lastContact", sortDir: "desc" }, lookups).map((c) => c.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("does not mutate the input list", () => {
    const input = [...list];
    filterAndSortContacts(input, { search: "", sortBy: "name", sortDir: "asc" }, lookups);
    expect(input.map((c) => c.id)).toEqual([1, 2, 3]);
  });
});

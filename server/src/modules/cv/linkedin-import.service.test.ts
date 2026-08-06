// This hand-rolled CSV parser (no dependency, no schema validation) had no test coverage at
// all — a regression here would silently corrupt every CV imported from a LinkedIn export.
// parseCsv() is tested directly for the quoting edge cases; parseLinkedInArchive() (the real
// public entry point) is tested end-to-end against a real in-memory ZIP archive built with the
// same `adm-zip` library the app itself uses to read one.
import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { parseCsv, parseLinkedInArchive } from "./linkedin-import.service.js";

describe("parseCsv()", () => {
  it("parses a simple comma-separated file into rows of fields", () => {
    expect(parseCsv("First Name,Last Name\nAda,Lovelace\n")).toEqual([
      ["First Name", "Last Name"],
      ["Ada", "Lovelace"],
    ]);
  });

  it("keeps a comma inside a quoted field as part of that field, not a column separator", () => {
    expect(parseCsv('Name,Bio\nAda,"Mathematician, programmer"\n')).toEqual([
      ["Name", "Bio"],
      ["Ada", "Mathematician, programmer"],
    ]);
  });

  it('un-escapes a doubled quote ("") inside a quoted field into a single literal quote', () => {
    expect(parseCsv('Name,Quote\nAda,"She said ""hello"" to me"\n')).toEqual([
      ["Name", "Quote"],
      ["Ada", 'She said "hello" to me'],
    ]);
  });

  it("keeps an embedded newline inside a quoted field as part of that field, not a new row", () => {
    expect(parseCsv('Name,Bio\nAda,"Line one\nLine two"\n')).toEqual([
      ["Name", "Bio"],
      ["Ada", "Line one\nLine two"],
    ]);
  });

  it("strips carriage returns (CRLF line endings) without corrupting field content", () => {
    expect(parseCsv("Name,Role\r\nAda,Engineer\r\n")).toEqual([
      ["Name", "Role"],
      ["Ada", "Engineer"],
    ]);
  });

  it("includes a final row even without a trailing newline", () => {
    expect(parseCsv("Name,Role\nAda,Engineer")).toEqual([
      ["Name", "Role"],
      ["Ada", "Engineer"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

/** Builds an in-memory ZIP with the given CSV files, matching LinkedIn's real "Get a copy of
 * your data" export layout (flat CSV files at the archive root). */
function buildLinkedInZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content, "utf8"));
  return zip.toBuffer();
}

describe("parseLinkedInArchive()", () => {
  it("parses profile, positions, skills, education, projects, certifications, and languages into a CV doc", () => {
    const zip = buildLinkedInZip({
      "Profile.csv":
        'First Name,Last Name,Headline,Summary,Geo Location,Websites\nAda,Lovelace,Engineer,"Builds things",Kyiv,https://ada.dev\n',
      "Positions.csv":
        "Company Name,Title,Description,Started On,Finished On\n" +
        'Acme,Backend Engineer,"Built APIs\nShipped features",Jan 2020,Dec 2022\n',
      "Skills.csv": "Name\nTypeScript\nPostgreSQL\n",
      "Education.csv": "School Name,Degree Name,Start Date,End Date\nKyiv Polytechnic,BSc Computer Science,2016,2020\n",
      "Projects.csv": "Title,Description\nSide Project,A thing I built\n",
      "Certifications.csv": "Name,Authority,Started On,Finished On\nAWS Certified Developer,Amazon,2023\n",
      "Languages.csv": "Name,Proficiency\nUkrainian,Native\nEnglish,Professional\n",
      "Email Addresses.csv": "Email Address,Primary\nold@example.com,No\nnew@example.com,Yes\n",
    });

    const doc = parseLinkedInArchive(zip);

    expect(doc.name).toBe("Ada Lovelace");
    expect(doc.title).toBe("Engineer");
    expect(doc.summary).toBe("Builds things");
    expect(doc.contact).toBe("new@example.com · Kyiv"); // the Primary=Yes email wins, not the first row
    expect(doc.links).toEqual([{ label: "Website", url: "https://ada.dev" }]); // not joined into contact
    expect(doc.skills).toEqual(["TypeScript", "PostgreSQL"]);
    expect(doc.experience).toEqual([
      { role: "Backend Engineer", company: "Acme", period: "Jan 2020 – Dec 2022", bullets: ["Built APIs", "Shipped features"] },
    ]);
    expect(doc.education).toEqual([{ school: "Kyiv Polytechnic", degree: "BSc Computer Science", period: "2016 – 2020" }]);
    expect(doc.projects).toEqual([{ title: "Side Project", description: "A thing I built", tech: [], link: "" }]);
    expect(doc.certifications).toEqual([{ name: "AWS Certified Developer", issuer: "Amazon", date: "2023" }]);
    expect(doc.languages).toEqual([
      { name: "Ukrainian", level: "Native" },
      { name: "English", level: "Professional" },
    ]);
  });

  it("falls back to the only email present when none is marked Primary", () => {
    const zip = buildLinkedInZip({
      "Profile.csv": "First Name,Last Name\nAda,Lovelace\n",
      "Email Addresses.csv": "Email Address,Primary\nonly@example.com,No\n",
    });

    expect(parseLinkedInArchive(zip).contact).toBe("only@example.com");
  });

  it("returns empty sections (not a crash) when optional CSVs are missing from the archive", () => {
    const zip = buildLinkedInZip({ "Profile.csv": "First Name,Last Name\nAda,Lovelace\n" });

    const doc = parseLinkedInArchive(zip);

    expect(doc.name).toBe("Ada Lovelace");
    expect(doc.skills).toEqual([]);
    expect(doc.experience).toEqual([]);
    expect(doc.education).toEqual([]);
    expect(doc.projects).toEqual([]);
    expect(doc.certifications).toEqual([]);
    expect(doc.links).toEqual([]);
    expect(doc.languages).toEqual([]);
    expect(doc.contact).toBe("");
  });

  it("finds CSV files regardless of which folder they're nested under in the archive", () => {
    // LinkedIn's real export sometimes nests these under a date-stamped subfolder.
    const zip = new AdmZip();
    zip.addFile("Basic_LinkedInDataExport_01-01-2026/Profile.csv", Buffer.from("First Name,Last Name\nAda,Lovelace\n", "utf8"));

    expect(parseLinkedInArchive(zip.toBuffer()).name).toBe("Ada Lovelace");
  });

  it("skips (not crashes on) a CSV entry whose declared uncompressed size exceeds the 20MB cap", () => {
    // Highly compressible content (a single repeated byte) keeps the zip itself tiny while its
    // declared uncompressed size is huge — the same shape a malicious high-ratio zip-bomb entry
    // would have. This proves the cap is checked against entry.header.size BEFORE any inflate,
    // not by actually decompressing 21MB in a test.
    const zip = new AdmZip();
    zip.addFile("Profile.csv", Buffer.from("First Name,Last Name\nAda,Lovelace\n", "utf8"));
    zip.addFile("Skills.csv", Buffer.alloc(21 * 1024 * 1024, "a"));

    const doc = parseLinkedInArchive(zip.toBuffer());

    expect(doc.name).toBe("Ada Lovelace"); // unaffected sibling entry still parses fine
    expect(doc.skills).toEqual([]); // oversized entry is skipped, not decompressed
  });
});

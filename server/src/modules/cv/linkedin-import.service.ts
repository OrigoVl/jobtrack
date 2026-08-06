import AdmZip from "adm-zip";
import type { CvDoc } from "./cv.schemas.js";

// Exported (only) so linkedin-import.service.test.ts can exercise the quoting edge cases
// directly (embedded commas/quotes/newlines inside a quoted field) without having to build a
// whole in-memory ZIP archive for every case — parseLinkedInArchive() itself, the real public
// entry point, still gets its own end-to-end test against a real archive.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text).filter((r) => !(r.length === 1 && (r[0] ?? "").trim() === ""));
  if (rows.length < 2) return [];
  const headers = (rows[0] ?? []).map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])));
}

function formatPeriod(start: string | undefined, end: string | undefined): string {
  const from = (start || "").trim();
  const to = (end || "").trim();
  if (!from && !to) return "";
  return `${from || "?"} – ${to || "present"}`;
}

function toBullets(description: string | undefined): string[] {
  return (description || "")
    .split(/\r?\n+/)
    .map((s) => s.replace(/^[-•*·]\s*/, "").trim())
    .filter(Boolean);
}

export type ParsedLinkedInCv = Omit<CvDoc, "theme">;

// A real LinkedIn export CSV (Profile/Positions/Skills/...) is a few KB to a few hundred KB at
// most. 20MB is already generous headroom — its real job is capping a maliciously-crafted entry
// with an extreme compression ratio (a few KB compressed inflating to gigabytes) before
// `entry.getData()` actually decompresses it. `entry.header.size` is read from the zip's central
// directory metadata, so this check costs nothing extra — it happens before any inflate work.
const MAX_CSV_ENTRY_BYTES = 20 * 1024 * 1024;

/**
 * Parse a LinkedIn "Get a copy of your data" ZIP archive into a structured CV document.
 */
export function parseLinkedInArchive(buffer: Buffer): ParsedLinkedInCv {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const readCsv = (name: string): Record<string, string>[] => {
    const entry = entries.find((e) => e.entryName.split("/").pop()?.toLowerCase() === name.toLowerCase());
    if (!entry) return [];
    if (entry.header.size > MAX_CSV_ENTRY_BYTES) return [];
    return csvToObjects(entry.getData().toString("utf8"));
  };
  const profile = readCsv("Profile.csv")[0] || {};
  const positions = readCsv("Positions.csv");
  const skillRows = readCsv("Skills.csv");
  const eduRows = readCsv("Education.csv");
  const projectRows = readCsv("Projects.csv");
  const certRows = readCsv("Certifications.csv");
  const languageRows = readCsv("Languages.csv");
  const emailRows = readCsv("Email Addresses.csv");
  const email =
    emailRows.find((r) => (r.Primary || "").toLowerCase() === "yes")?.["Email Address"] || emailRows[0]?.["Email Address"] || "";
  const contact = [email, profile["Geo Location"]].filter(Boolean).join(" · ");
  return {
    name: [profile["First Name"], profile["Last Name"]].filter(Boolean).join(" "),
    title: profile.Headline || "",
    contact,
    // LinkedIn's own profile "Websites" column is a real URL — a structured link, not a plain
    // contact line, so it goes to `links` instead of getting joined into `contact` like the rest
    // (it used to be, before this field existed).
    links: profile.Websites ? [{ label: "Website", url: profile.Websites }] : [],
    summary: profile.Summary || "",
    photo: "",
    skills: skillRows.map((s) => s.Name).filter((n): n is string => Boolean(n)),
    experience: positions.map((p) => ({
      role: p.Title || "",
      company: p["Company Name"] || "",
      period: formatPeriod(p["Started On"], p["Finished On"]),
      bullets: toBullets(p.Description),
    })),
    education: eduRows
      .map((e) => ({
        school: e["School Name"] || "",
        degree: e["Degree Name"] || "",
        period: formatPeriod(e["Start Date"], e["End Date"]),
      }))
      .filter((e) => e.school || e.degree || e.period),
    projects: projectRows
      .map((p) => ({ title: p.Title || "", description: p.Description || "", tech: [], link: "" }))
      .filter((p) => p.title || p.description),
    // LinkedIn's export has a start/end date pair here too, but a certification's own real-world
    // convention is just "issued <date>", not a range (most never end, and the handful that do
    // expire don't read as "2023 – present" the way a job or degree would) — the start date alone.
    certifications: certRows
      .map((c) => ({ name: c.Name || "", issuer: c.Authority || "", date: (c["Started On"] || "").trim() }))
      .filter((c) => c.name || c.issuer),
    languages: languageRows.map((l) => ({ name: (l.Name || "").trim(), level: (l.Proficiency || "").trim() })).filter((l) => l.name),
    // LinkedIn's data export has no equivalent CSV for these — nothing to map in from the archive.
    awards: [],
    publications: [],
    volunteer: [],
    references: [],
  };
}

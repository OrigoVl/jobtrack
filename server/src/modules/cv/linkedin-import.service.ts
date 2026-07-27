import AdmZip from "adm-zip";
import type { CvDoc } from "./cv.schemas.js";

function parseCsv(text: string): string[][] {
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
  const rows = parseCsv(text).filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])));
}

function formatPeriod(start: string | undefined, end: string | undefined): string {
  const from = (start || "").trim();
  const to = (end || "").trim();
  if (!from && !to) return "";
  return `${from || "?"} – ${to || "дотепер"}`;
}

function toBullets(description: string | undefined): string[] {
  return (description || "")
    .split(/\r?\n+/)
    .map((s) => s.replace(/^[-•*·]\s*/, "").trim())
    .filter(Boolean);
}

export type ParsedLinkedInCv = Omit<CvDoc, "theme">;

/**
 * Parse a LinkedIn "Get a copy of your data" ZIP archive into a structured CV document.
 */
export function parseLinkedInArchive(buffer: Buffer): ParsedLinkedInCv {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const readCsv = (name: string): Record<string, string>[] => {
    const entry = entries.find((e) => e.entryName.split("/").pop()?.toLowerCase() === name.toLowerCase());
    return entry ? csvToObjects(entry.getData().toString("utf8")) : [];
  };
  const profile = readCsv("Profile.csv")[0] || {};
  const positions = readCsv("Positions.csv");
  const skillRows = readCsv("Skills.csv");
  const eduRows = readCsv("Education.csv");
  const projectRows = readCsv("Projects.csv");
  const languageRows = readCsv("Languages.csv");
  const emailRows = readCsv("Email Addresses.csv");
  const email =
    emailRows.find((r) => (r.Primary || "").toLowerCase() === "yes")?.["Email Address"] || emailRows[0]?.["Email Address"] || "";
  const contact = [email, profile["Geo Location"], profile.Websites].filter(Boolean).join(" · ");
  return {
    name: [profile["First Name"], profile["Last Name"]].filter(Boolean).join(" "),
    title: profile.Headline || "",
    contact,
    summary: profile.Summary || "",
    photo: "",
    skills: skillRows.map((s) => s.Name).filter(Boolean),
    experience: positions.map((p) => ({
      role: p.Title || "",
      company: p["Company Name"] || "",
      period: formatPeriod(p["Started On"], p["Finished On"]),
      bullets: toBullets(p.Description),
    })),
    education: eduRows
      .map((e) => [e["Degree Name"], e["School Name"], formatPeriod(e["Start Date"], e["End Date"])].filter(Boolean).join(", "))
      .filter(Boolean),
    projects: projectRows.map((p) => [p.Title, p.Description].filter(Boolean).join(" — ")).filter(Boolean),
    languages: languageRows.map((l) => ({ name: (l.Name || "").trim(), level: (l.Proficiency || "").trim() })).filter((l) => l.name),
  };
}

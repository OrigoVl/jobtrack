import type { CvDoc, CvSection, CvTheme } from "../../../shared/types";

export const SECTION_LABELS: [CvSection, string][] = [
  ["summary", "Profile"],
  ["skills", "Skills"],
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["education", "Education"],
  ["certifications", "Certifications"],
  ["languages", "Languages"],
  ["awards", "Awards"],
  ["publications", "Publications"],
  ["volunteer", "Volunteer Experience"],
  ["references", "References"],
];
export const DEFAULT_ORDER: CvSection[] = SECTION_LABELS.map(([k]) => k);
const EN_SECTION_LABELS: Record<CvSection, string> = Object.fromEntries(SECTION_LABELS) as Record<CvSection, string>;
// Section headings ("Profile"/"Skills"/...) must follow the CV's OWN language, never the app UI's
// (same convention as CLAUDE.md's i18n(server) rule for CV export/cover letters) — a resume
// written entirely in Ukrainian shouldn't get English section headers. There's no explicit
// language field on CvDoc to read instead, so this is a cheap, dependency-free heuristic (no LLM
// call — every export must still work offline): sample the doc's own free-text fields and check
// whether Cyrillic letters are the majority of the alphabetic characters actually typed.
const UK_SECTION_LABELS: Record<CvSection, string> = {
  summary: "Про мене",
  skills: "Навички",
  experience: "Досвід",
  projects: "Проєкти",
  education: "Освіта",
  certifications: "Сертифікати",
  languages: "Мови",
  awards: "Нагороди",
  publications: "Публікації",
  volunteer: "Волонтерство",
  references: "Рекомендації",
};
function isCyrillicDoc(doc: CvDoc): boolean {
  const sample = [doc.title, doc.summary, ...doc.experience.flatMap((e) => [e.role, e.company, ...e.bullets]), ...doc.skills].join(" ");
  const cyrillic = sample.match(/[Ѐ-ӿ]/g)?.length ?? 0;
  const latin = sample.match(/[a-zA-Z]/g)?.length ?? 0;
  const total = cyrillic + latin;
  return total > 0 && cyrillic / total > 0.5;
}
export const DEFAULT_THEME: CvTheme = {
  template: "classic",
  accent: "#4f46e5",
  font: "sans",
  scale: 1,
  order: DEFAULT_ORDER,
  showPhoto: true,
  photoShape: "circle",
  photoPos: "left",
};

export function themeOf(doc: CvDoc): CvTheme {
  return { ...DEFAULT_THEME, ...(doc.theme || {}) };
}

export function buildCvHtml(doc: CvDoc): string {
  const t = themeOf(doc);
  const esc = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const list = (arr: string[]) =>
    arr
      .filter(Boolean)
      .map((x) => `<li>${esc(x)}</li>`)
      .join("");
  const isUk = isCyrillicDoc(doc);
  const label = (key: CvSection) => (isUk ? UK_SECTION_LABELS[key] : EN_SECTION_LABELS[key]);
  const H = (key: CvSection) => `<h2>${esc(label(key))}</h2>`;
  // Every top-level block and every individual experience entry carries a `data-section` —
  // the preview iframe attaches a plain click listener (from the parent, via
  // `contentDocument`, no injected <script>/CSP concerns) and reports it back so clicking
  // "Experience #2" in the live preview can open exactly that entry in the editor.
  const wrap = (key: string, html: string) => (html ? `<div class="sec-block" data-section="${key}">${html}</div>` : "");
  const exp = doc.experience
    .map(
      (e, i) =>
        `<div class="exp" data-section="experience-${i}"><div class="row"><span class="role">${esc(e.role)}</span><span class="period">${esc(e.period)}</span></div>` +
        `<div class="company">${esc(e.company)}</div>${e.bullets.filter(Boolean).length ? `<ul>${list(e.bullets)}</ul>` : ""}</div>`,
    )
    .join("");
  // Reuses the `.exp`/`.row`/`.period`/`.company` classes Experience entries already style —
  // same visual hierarchy (a bold headline + period, then a subdued second line) without new CSS.
  // `degree` is the headline when present; a pre-structuring entry that only ever had one line
  // (migrated into `school` alone, see cv.schemas.ts's CvEducationSchema) falls back to using
  // `school` as the headline instead of rendering an empty bold line above it.
  const eduEntries = doc.education
    .filter((e) => e.school.trim() || e.degree.trim() || e.period.trim())
    .map(
      (e) =>
        `<div class="exp"><div class="row"><span class="role">${esc(e.degree || e.school)}</span><span class="period">${esc(e.period)}</span></div>` +
        (e.degree && e.school ? `<div class="company">${esc(e.school)}</div>` : "") +
        `</div>`,
    )
    .join("");
  // Same reuse trick as eduEntries above: `.exp`/`.row`/`.role`/`.company` give title+meta+
  // description the same visual rhythm as an Experience entry, with no new CSS. `meta` combines
  // tech tags and the link into one subdued line (both optional) rather than two near-identical
  // secondary lines.
  const projEntries = doc.projects
    .filter((p) => p.title.trim() || p.description.trim() || p.tech.length || p.link.trim())
    .map((p) => {
      const meta = [p.tech.length ? p.tech.join(" · ") : "", p.link.trim()].filter(Boolean).join(" · ");
      return (
        `<div class="exp">` +
        (p.title ? `<div class="row"><span class="role">${esc(p.title)}</span></div>` : "") +
        (meta ? `<div class="company">${esc(meta)}</div>` : "") +
        (p.description ? `<p>${esc(p.description)}</p>` : "") +
        `</div>`
      );
    })
    .join("");
  // Same reuse trick again: `.role` for the cert name, `.company` for issuer+date combined (both
  // optional, so a cert with only a name still renders sensibly).
  const certEntries = (doc.certifications ?? [])
    .filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim())
    .map((c) => {
      const meta = [c.issuer.trim(), c.date.trim()].filter(Boolean).join(" · ");
      return (
        `<div class="exp">` +
        (c.name ? `<div class="row"><span class="role">${esc(c.name)}</span></div>` : "") +
        (meta ? `<div class="company">${esc(meta)}</div>` : "") +
        `</div>`
      );
    })
    .join("");
  // Same reuse trick as certEntries — `.role` for the award title, `.company` for issuer+date.
  const awardEntries = (doc.awards ?? [])
    .filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim())
    .map((a) => {
      const meta = [a.issuer.trim(), a.date.trim()].filter(Boolean).join(" · ");
      return (
        `<div class="exp">` +
        (a.title ? `<div class="row"><span class="role">${esc(a.title)}</span></div>` : "") +
        (meta ? `<div class="company">${esc(meta)}</div>` : "") +
        `</div>`
      );
    })
    .join("");
  // Same reuse trick as projEntries — `publisher`/`date`/`url` combine into one subdued meta line.
  const pubEntries = (doc.publications ?? [])
    .filter((p) => p.title.trim() || p.publisher.trim() || p.date.trim() || p.url.trim())
    .map((p) => {
      const meta = [p.publisher.trim(), p.date.trim(), p.url.trim()].filter(Boolean).join(" · ");
      return (
        `<div class="exp">` +
        (p.title ? `<div class="row"><span class="role">${esc(p.title)}</span></div>` : "") +
        (meta ? `<div class="company">${esc(meta)}</div>` : "") +
        `</div>`
      );
    })
    .join("");
  // Same reuse trick as exp — role/organization/period as the headline row, one description line
  // instead of a bullet list (volunteer entries are usually a single short blurb, not a full job).
  const volEntries = (doc.volunteer ?? [])
    .filter((v) => v.role.trim() || v.organization.trim() || v.period.trim() || v.description.trim())
    .map(
      (v) =>
        `<div class="exp"><div class="row"><span class="role">${esc(v.role)}</span><span class="period">${esc(v.period)}</span></div>` +
        (v.organization ? `<div class="company">${esc(v.organization)}</div>` : "") +
        (v.description ? `<p>${esc(v.description)}</p>` : "") +
        `</div>`,
    )
    .join("");
  // Deliberately a plain list, not `.exp` blocks — references are conventionally a short,
  // compact name/relation/contact list, not full entries with their own visual weight.
  const refEntries = (doc.references ?? [])
    .filter((r) => r.name.trim() || r.relation.trim() || r.contact.trim())
    .map((r) => [r.name.trim(), r.relation.trim(), r.contact.trim()].filter(Boolean).join(" — "))
    .filter(Boolean);
  // Structured links render as real, clickable anchors right in the same contact line (PDFs
  // preserve hyperlinks fine) — `.contact a` below just inherits the surrounding muted color
  // instead of the browser's default blue, so a link doesn't visually clash with the plain-text
  // contact info next to it. A bare domain (no scheme) gets `https://` prepended for the href
  // only — the visible label text is left exactly as typed.
  const linksLine = (doc.links ?? [])
    .filter((l) => l.label.trim() || l.url.trim())
    .map((l) => {
      const url = l.url.trim();
      const label = l.label.trim() || url;
      if (!url) return esc(label);
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
    })
    .join(" · ");
  const photoImg = doc.photo && t.showPhoto !== false ? `<img class="photo" src="${doc.photo}" alt="Photo"/>` : "";
  const hmeta = `<div class="hmeta" data-section="general"><h1>${esc(doc.name)}</h1><div class="title">${esc(doc.title)}</div><div class="contact">${esc(doc.contact)}${doc.contact.trim() && linksLine ? " · " : ""}${linksLine}</div></div>`;
  const langs = (doc.languages || []).filter((l) => l && l.name);
  const useInline = t.template === "compact" || t.template === "academic";
  const secSkillsChips = doc.skills.length
    ? `${H("skills")}<div class="chips">${doc.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>`
    : "";
  const secSkillsInline = doc.skills.length ? `${H("skills")}<p>${doc.skills.map(esc).join(" · ")}</p>` : "";
  const sec: Record<string, string> = {
    summary: wrap("summary", doc.summary ? `${H("summary")}<p>${esc(doc.summary)}</p>` : ""),
    skills: wrap("skills", useInline ? secSkillsInline : secSkillsChips),
    experience: doc.experience.length ? `${H("experience")}${exp}` : "",
    projects: wrap("projects", projEntries ? `${H("projects")}${projEntries}` : ""),
    education: wrap("education", eduEntries ? `${H("education")}${eduEntries}` : ""),
    certifications: wrap("certifications", certEntries ? `${H("certifications")}${certEntries}` : ""),
    languages: wrap(
      "languages",
      langs.length
        ? `${H("languages")}<ul>${langs.map((l) => `<li>${esc(l.name)}${l.level ? ` — <span class="lvl">${esc(l.level)}</span>` : ""}</li>`).join("")}</ul>`
        : "",
    ),
    awards: wrap("awards", awardEntries ? `${H("awards")}${awardEntries}` : ""),
    publications: wrap("publications", pubEntries ? `${H("publications")}${pubEntries}` : ""),
    volunteer: wrap("volunteer", volEntries ? `${H("volunteer")}${volEntries}` : ""),
    references: wrap(
      "references",
      refEntries.length ? `${H("references")}<ul>${refEntries.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "",
    ),
  };
  const order = (t.order && t.order.length ? t.order : DEFAULT_ORDER).filter((k) => k in sec);
  const pick = (keys: string[]) =>
    order
      .filter((k) => keys.includes(k))
      .map((k) => sec[k])
      .join("");
  const font = t.font === "serif" ? "Georgia, 'Times New Roman', serif" : "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const fs = 14 * t.scale;
  const compact = t.template === "compact";
  const gap = compact ? "9px" : "16px";
  const px = (n: number) => `${n.toFixed(1)}px`;
  let layout = "";
  let extraCss = "";
  const headerRow = `<header class="hrow" data-section="general">${photoImg}${hmeta}</header>`;
  if (t.template === "twocol") {
    const aside = `${photoImg}${pick(["skills", "languages", "education", "certifications", "references"])}`;
    const main = pick(["summary", "experience", "projects", "volunteer", "publications", "awards"]);
    layout = `<header class="hrow" data-section="general">${hmeta}</header><div class="cols"><aside>${aside}</aside><main>${main}</main></div>`;
    extraCss =
      ".cols{display:flex;gap:26px" +
      (t.photoPos === "right" ? ";flex-direction:row-reverse" : "") +
      "}aside{width:33%}main{flex:1;min-width:0}aside .photo{display:block;margin:0 auto 12px;width:" +
      px(fs * 7) +
      ";height:" +
      px(fs * 7) +
      "}";
  } else if (t.template === "sidebar") {
    // Unlike "twocol" (plain two columns, same white background), the aside here is a tinted
    // color block holding identity + skills/languages/education — a distinct, more visual
    // "modern resume" look rather than twocol's understated split.
    const aside =
      `${photoImg}<div class="s-name">${esc(doc.name)}</div>` +
      `${doc.title ? `<div class="s-title">${esc(doc.title)}</div>` : ""}` +
      `${doc.contact.trim() || linksLine ? `<div class="s-contact">${esc(doc.contact)}${doc.contact.trim() && linksLine ? " · " : ""}${linksLine}</div>` : ""}` +
      pick(["skills", "languages", "education", "certifications", "references"]);
    const main = pick(["summary", "experience", "projects", "volunteer", "publications", "awards"]);
    layout = `<div class="cols sidebar-layout"><aside class="side-panel" data-section="general">${aside}</aside><main>${main}</main></div>`;
    extraCss =
      `.sidebar-layout{display:flex;gap:22px${t.photoPos === "right" ? ";flex-direction:row-reverse" : ""}}` +
      `.side-panel{width:34%;background:${t.accent}0d;border-radius:14px;padding:20px 16px;box-sizing:border-box}` +
      `.side-panel h2{color:${t.accent};border-bottom-color:${t.accent}33}` +
      `.side-panel .photo{display:block;margin:0 auto 14px;width:${px(fs * 6)};height:${px(fs * 6)}}` +
      `.s-name{font-size:${px(fs * 1.4)};font-weight:800;color:#0f172a;text-align:center}` +
      `.s-title{color:${t.accent};font-weight:600;text-align:center;margin-top:2px;font-size:${px(fs * 0.95)}}` +
      `.s-contact{color:#64748b;font-size:${px(fs * 0.82)};text-align:center;margin:6px 0 18px;word-break:break-word}.s-contact a{color:inherit}` +
      `main{flex:1;min-width:0}`;
  } else if (t.template === "academic") {
    layout = `${headerRow}${pick(["summary", "experience", "projects", "education", "certifications", "skills", "languages", "awards", "publications", "volunteer", "references"])}`;
    extraCss =
      "header.hrow{flex-direction:column;text-align:center;border-bottom:2px solid " +
      t.accent +
      "22;padding-bottom:12px}header .photo{margin:0 auto 6px}";
  } else if (t.template === "minimal") {
    // Same single-column order as classic, just a much quieter palette — no accent color on
    // headings/chips, thin hairline instead of a bold colored underline, generous whitespace.
    layout = `${headerRow}${pick(order)}`;
    extraCss =
      `h1{font-weight:600}.title{color:#475569;font-weight:500}` +
      `h2{color:#94a3b8;border-bottom:1px solid #e2e8f0;font-weight:600;letter-spacing:.08em}` +
      `.chip{background:#f8fafc;color:#334155;border-color:#e2e8f0}` +
      `.photo{border-color:#e2e8f0}`;
  } else if (t.template === "timeline") {
    // Same layout as classic, but experience entries sit on a vertical rail with dot markers —
    // a more visual "career progression" read for the Experience section specifically.
    layout = `${headerRow}${pick(order)}`;
    extraCss =
      `.exp{position:relative;padding-left:16px;border-left:2px solid ${t.accent}40}` +
      `.exp::before{content:"";position:absolute;left:-5px;top:3px;width:8px;height:8px;border-radius:50%;background:${t.accent}}`;
  } else {
    layout = `${headerRow}${pick(order)}`;
  }
  const css =
    `*{box-sizing:border-box}` +
    `body{font-family:${font};font-size:${px(fs)};line-height:${compact ? 1.4 : 1.55};color:#1e293b;max-width:820px;margin:28px auto;padding:0 30px}` +
    `header{margin-bottom:${gap}}h1{font-size:${px(fs * 1.9)};margin:0;color:#0f172a}` +
    `.hrow{display:flex;align-items:center;gap:18px${t.photoPos === "right" ? ";flex-direction:row-reverse" : ""}}.hmeta{min-width:0}` +
    `.photo{width:${px(fs * 6.4)};height:${px(fs * 6.4)};border-radius:${t.photoShape === "square" ? px(fs * 0.85) : "50%"};object-fit:cover;border:3px solid ${t.accent}33;flex:0 0 auto}` +
    `.lvl{color:${t.accent}}` +
    `.title{color:${t.accent};font-weight:600;font-size:${px(fs * 1.15)};margin-top:2px}` +
    `.contact{color:#64748b;font-size:${px(fs * 0.9)};margin-top:4px}.contact a{color:inherit}` +
    `h2{font-size:${px(fs * 0.92)};text-transform:uppercase;letter-spacing:.06em;color:${t.accent};border-bottom:2px solid ${t.accent}22;padding-bottom:3px;margin:${gap} 0 8px}` +
    `p{margin:0 0 8px}.exp{margin-bottom:${compact ? "8px" : "12px"}}` +
    `.row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}` +
    `.role{font-weight:700;color:#0f172a}.period{color:#94a3b8;font-size:${px(fs * 0.85)};white-space:nowrap}` +
    `.company{color:#64748b;font-size:${px(fs * 0.9)}}ul{margin:4px 0;padding-left:18px}li{margin:2px 0}` +
    `.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{background:${t.accent}14;color:${t.accent};border:1px solid ${t.accent}33;border-radius:6px;padding:2px 8px;font-size:${px(fs * 0.85)}}` +
    // Clickable-in-preview affordance for the interactive preview → editor sync — cursor +
    // hover outline on anything carrying data-section (whole sections, or one experience
    // entry). @media print strips it back off so it never shows up in the exported PDF.
    `[data-section]{cursor:pointer}[data-section]:hover{outline:1px dashed ${t.accent}66;outline-offset:2px;border-radius:6px}` +
    `@media print{[data-section]:hover{outline:none}}` +
    extraCss +
    // `@page{margin:0}` — removes the browser's system header/footer (date, document title,
    // URL, page number) on every printed page: in Chrome/Edge they render in the page margins
    // reserved for printing, so with no margins there's simply no room for them. We set our own
    // spacing from the physical paper edge via padding on body (instead of a page margin),
    // otherwise the content would be pressed against the edge. This doesn't require the user to
    // manually uncheck "Headers and footers" in the print dialog — but in some browsers
    // (e.g. Safari) it may still show up, so that checkbox is worth checking if a date/title
    // still appears.
    `@page{margin:0}` +
    `@media print{body{margin:0;max-width:none;padding:14mm 12mm}}`;
  return `<!doctype html><html lang="${isUk ? "uk" : "en"}"><head><meta charset="utf-8"><title>${esc(doc.name || "CV")}</title><style>${css}</style></head><body>${layout}</body></html>`;
}

/** `onPopupBlocked` replaces the old native `alert()` — a plain utility function has no toast
 * context of its own, so the call site (which does) supplies how to surface the failure,
 * consistent with the rest of the app's toast-based error feedback instead of a jarring native
 * dialog. */
export function exportCvDoc(doc: CvDoc, onPopupBlocked: () => void): void {
  const w = window.open("", "_blank");
  if (!w) {
    onPopupBlocked();
    return;
  }
  w.document.write(buildCvHtml(doc));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

export function cvDocToText(doc: CvDoc): string {
  const lines: string[] = [];
  if (doc.name) lines.push(doc.name);
  if (doc.title) lines.push(doc.title);
  if (doc.contact) lines.push(doc.contact);
  const links = (doc.links ?? []).filter((l) => l.label.trim() || l.url.trim());
  if (links.length) lines.push(links.map((l) => [l.label, l.url].filter(Boolean).join(": ")).join(" · "));
  if (doc.summary) lines.push(`\nProfile:\n${doc.summary}`);
  if (doc.skills.length) lines.push(`\nSkills: ${doc.skills.join(", ")}`);
  if (doc.experience.length) {
    lines.push("\nExperience:");
    doc.experience.forEach((e) => {
      lines.push(`${e.role} — ${e.company} (${e.period})`);
      e.bullets.filter(Boolean).forEach((b) => lines.push(`- ${b}`));
    });
  }
  const projects = doc.projects
    .filter((p) => p.title.trim() || p.description.trim())
    .map((p) => [p.title, p.description, p.tech.join(", "), p.link].filter(Boolean).join(" — "));
  if (projects.length) lines.push(`\nProjects:\n${projects.join("\n")}`);
  const education = doc.education
    .filter((e) => e.school.trim() || e.degree.trim() || e.period.trim())
    .map((e) => [e.degree, e.school, e.period].filter(Boolean).join(", "));
  if (education.length) lines.push(`\nEducation:\n${education.join("\n")}`);
  const certifications = (doc.certifications ?? [])
    .filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim())
    .map((c) => [c.name, c.issuer, c.date].filter(Boolean).join(", "));
  if (certifications.length) lines.push(`\nCertifications:\n${certifications.join("\n")}`);
  const langs = (doc.languages || []).filter((l) => l.name);
  if (langs.length) lines.push(`\nLanguages: ${langs.map((l) => `${l.name} (${l.level})`).join(", ")}`);
  const awards = (doc.awards ?? [])
    .filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim())
    .map((a) => [a.title, a.issuer, a.date].filter(Boolean).join(", "));
  if (awards.length) lines.push(`\nAwards:\n${awards.join("\n")}`);
  const publications = (doc.publications ?? [])
    .filter((p) => p.title.trim() || p.publisher.trim() || p.date.trim() || p.url.trim())
    .map((p) => [p.title, p.publisher, p.date, p.url].filter(Boolean).join(", "));
  if (publications.length) lines.push(`\nPublications:\n${publications.join("\n")}`);
  const volunteer = (doc.volunteer ?? [])
    .filter((v) => v.role.trim() || v.organization.trim() || v.period.trim() || v.description.trim())
    .map((v) => [`${v.role} — ${v.organization} (${v.period})`, v.description].filter(Boolean).join("\n"));
  if (volunteer.length) lines.push(`\nVolunteer Experience:\n${volunteer.join("\n")}`);
  const references = (doc.references ?? [])
    .filter((r) => r.name.trim() || r.relation.trim() || r.contact.trim())
    .map((r) => [r.name, r.relation, r.contact].filter(Boolean).join(", "));
  if (references.length) lines.push(`\nReferences:\n${references.join("\n")}`);
  return lines.join("\n");
}

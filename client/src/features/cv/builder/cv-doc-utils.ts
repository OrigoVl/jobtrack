import type { CvDoc, CvSection, CvTheme } from "../../../shared/types";

export const SECTION_LABELS: [CvSection, string][] = [
  ["summary", "Profile"],
  ["skills", "Skills"],
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["education", "Education"],
  ["languages", "Languages"],
];
export const DEFAULT_ORDER: CvSection[] = SECTION_LABELS.map(([k]) => k);
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
  const H = (title: string) => `<h2>${esc(title)}</h2>`;
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
  const photoImg = doc.photo && t.showPhoto !== false ? `<img class="photo" src="${doc.photo}" alt="Photo"/>` : "";
  const hmeta = `<div class="hmeta" data-section="general"><h1>${esc(doc.name)}</h1><div class="title">${esc(doc.title)}</div><div class="contact">${esc(doc.contact)}</div></div>`;
  const langs = (doc.languages || []).filter((l) => l && l.name);
  const useInline = t.template === "compact" || t.template === "academic";
  const secSkillsChips = doc.skills.length
    ? `${H("Skills")}<div class="chips">${doc.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>`
    : "";
  const secSkillsInline = doc.skills.length ? `${H("Skills")}<p>${doc.skills.map(esc).join(" · ")}</p>` : "";
  const sec: Record<string, string> = {
    summary: wrap("summary", doc.summary ? `${H("Profile")}<p>${esc(doc.summary)}</p>` : ""),
    skills: wrap("skills", useInline ? secSkillsInline : secSkillsChips),
    experience: doc.experience.length ? `${H("Experience")}${exp}` : "",
    projects: wrap("projects", doc.projects.filter(Boolean).length ? `${H("Projects")}<ul>${list(doc.projects)}</ul>` : ""),
    education: wrap("education", doc.education.filter(Boolean).length ? `${H("Education")}<ul>${list(doc.education)}</ul>` : ""),
    languages: wrap(
      "languages",
      langs.length
        ? `${H("Languages")}<ul>${langs.map((l) => `<li>${esc(l.name)}${l.level ? ` — <span class="lvl">${esc(l.level)}</span>` : ""}</li>`).join("")}</ul>`
        : "",
    ),
  };
  const order = (t.order && t.order.length ? t.order : ["summary", "skills", "experience", "projects", "education", "languages"]).filter(
    (k) => k in sec,
  );
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
    const aside = `${photoImg}${pick(["skills", "languages", "education"])}`;
    const main = pick(["summary", "experience", "projects"]);
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
      `${doc.contact ? `<div class="s-contact">${esc(doc.contact)}</div>` : ""}` +
      pick(["skills", "languages", "education"]);
    const main = pick(["summary", "experience", "projects"]);
    layout = `<div class="cols sidebar-layout"><aside class="side-panel" data-section="general">${aside}</aside><main>${main}</main></div>`;
    extraCss =
      `.sidebar-layout{display:flex;gap:22px${t.photoPos === "right" ? ";flex-direction:row-reverse" : ""}}` +
      `.side-panel{width:34%;background:${t.accent}0d;border-radius:14px;padding:20px 16px;box-sizing:border-box}` +
      `.side-panel h2{color:${t.accent};border-bottom-color:${t.accent}33}` +
      `.side-panel .photo{display:block;margin:0 auto 14px;width:${px(fs * 6)};height:${px(fs * 6)}}` +
      `.s-name{font-size:${px(fs * 1.4)};font-weight:800;color:#0f172a;text-align:center}` +
      `.s-title{color:${t.accent};font-weight:600;text-align:center;margin-top:2px;font-size:${px(fs * 0.95)}}` +
      `.s-contact{color:#64748b;font-size:${px(fs * 0.82)};text-align:center;margin:6px 0 18px;word-break:break-word}` +
      `main{flex:1;min-width:0}`;
  } else if (t.template === "academic") {
    layout = `${headerRow}${pick(["summary", "experience", "projects", "education", "skills", "languages"])}`;
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
    `.contact{color:#64748b;font-size:${px(fs * 0.9)};margin-top:4px}` +
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(doc.name || "CV")}</title><style>${css}</style></head><body>${layout}</body></html>`;
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
  if (doc.summary) lines.push(`\nProfile:\n${doc.summary}`);
  if (doc.skills.length) lines.push(`\nSkills: ${doc.skills.join(", ")}`);
  if (doc.experience.length) {
    lines.push("\nExperience:");
    doc.experience.forEach((e) => {
      lines.push(`${e.role} — ${e.company} (${e.period})`);
      e.bullets.filter(Boolean).forEach((b) => lines.push(`- ${b}`));
    });
  }
  const projects = doc.projects.filter(Boolean);
  if (projects.length) lines.push(`\nProjects:\n${projects.join("\n")}`);
  const education = doc.education.filter(Boolean);
  if (education.length) lines.push(`\nEducation:\n${education.join("\n")}`);
  const langs = (doc.languages || []).filter((l) => l.name);
  if (langs.length) lines.push(`\nLanguages: ${langs.map((l) => `${l.name} (${l.level})`).join(", ")}`);
  return lines.join("\n");
}

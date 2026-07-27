import type { CvDoc, CvSection, CvTheme } from "../../../shared/types";

export const SECTION_LABELS: [CvSection, string][] = [
  ["summary", "Профіль"],
  ["skills", "Навички"],
  ["experience", "Досвід"],
  ["projects", "Проєкти"],
  ["education", "Освіта"],
  ["languages", "Мови"],
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
  const exp = doc.experience
    .map(
      (e) =>
        `<div class="exp"><div class="row"><span class="role">${esc(e.role)}</span><span class="period">${esc(e.period)}</span></div>` +
        `<div class="company">${esc(e.company)}</div>${e.bullets.filter(Boolean).length ? `<ul>${list(e.bullets)}</ul>` : ""}</div>`,
    )
    .join("");
  const photoImg = doc.photo && t.showPhoto !== false ? `<img class="photo" src="${doc.photo}" alt="Фото"/>` : "";
  const hmeta = `<div class="hmeta"><h1>${esc(doc.name)}</h1><div class="title">${esc(doc.title)}</div><div class="contact">${esc(doc.contact)}</div></div>`;
  const langs = (doc.languages || []).filter((l) => l && l.name);
  const useInline = t.template === "compact" || t.template === "academic";
  const secSkillsChips = doc.skills.length
    ? `${H("Навички")}<div class="chips">${doc.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>`
    : "";
  const secSkillsInline = doc.skills.length ? `${H("Навички")}<p>${doc.skills.map(esc).join(" · ")}</p>` : "";
  const sec: Record<string, string> = {
    summary: doc.summary ? `${H("Профіль")}<p>${esc(doc.summary)}</p>` : "",
    skills: useInline ? secSkillsInline : secSkillsChips,
    experience: doc.experience.length ? `${H("Досвід")}${exp}` : "",
    projects: doc.projects.filter(Boolean).length ? `${H("Проєкти")}<ul>${list(doc.projects)}</ul>` : "",
    education: doc.education.filter(Boolean).length ? `${H("Освіта")}<ul>${list(doc.education)}</ul>` : "",
    languages: langs.length
      ? `${H("Мови")}<ul>${langs.map((l) => `<li>${esc(l.name)}${l.level ? ` — <span class="lvl">${esc(l.level)}</span>` : ""}</li>`).join("")}</ul>`
      : "",
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
  let layout: string;
  let extraCss = "";
  const headerRow = `<header class="hrow">${photoImg}${hmeta}</header>`;
  if (t.template === "twocol") {
    const aside = `${photoImg}${pick(["skills", "languages", "education"])}`;
    const main = pick(["summary", "experience", "projects"]);
    layout = `<header class="hrow">${hmeta}</header><div class="cols"><aside>${aside}</aside><main>${main}</main></div>`;
    extraCss =
      ".cols{display:flex;gap:26px" +
      (t.photoPos === "right" ? ";flex-direction:row-reverse" : "") +
      "}aside{width:33%}main{flex:1;min-width:0}aside .photo{display:block;margin:0 auto 12px;width:" +
      px(fs * 7) +
      ";height:" +
      px(fs * 7) +
      "}";
  } else if (t.template === "academic") {
    layout = `${headerRow}${pick(["summary", "experience", "projects", "education", "skills", "languages"])}`;
    extraCss =
      "header.hrow{flex-direction:column;text-align:center;border-bottom:2px solid " +
      t.accent +
      "22;padding-bottom:12px}header .photo{margin:0 auto 6px}";
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
    extraCss +
    // `@page{margin:0}` — прибирає системний заголовок/підвал браузера (дата, назва
    // документа, URL, номер сторінки) на кожній сторінці друку: у Chrome/Edge вони
    // рендеряться саме в полях сторінки, зарезервованих під друк, тож без полів для них
    // просто немає місця. Власні відступи від фізичного краю паперу задаємо через
    // padding у body (замість поля сторінки), інакше контент притискався б до краю.
    // Це не потребує від користувача вручну знімати галочку "Заголовки та підвали" у
    // вікні друку — але в деяких браузерах (напр. Safari) вона все ж може лишатися,
    // тож галочку варто перевірити, якщо дата/назва все одно з'явиться.
    `@page{margin:0}` +
    `@media print{body{margin:0;max-width:none;padding:14mm 12mm}}`;
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${esc(doc.name || "CV")}</title><style>${css}</style></head><body>${layout}</body></html>`;
}

export function exportCvDoc(doc: CvDoc): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Дозволь спливаючі вікна, щоб експортувати PDF.");
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
  if (doc.summary) lines.push(`\nПрофіль:\n${doc.summary}`);
  if (doc.skills.length) lines.push(`\nНавички: ${doc.skills.join(", ")}`);
  if (doc.experience.length) {
    lines.push("\nДосвід:");
    doc.experience.forEach((e) => {
      lines.push(`${e.role} — ${e.company} (${e.period})`);
      e.bullets.filter(Boolean).forEach((b) => lines.push(`- ${b}`));
    });
  }
  const projects = doc.projects.filter(Boolean);
  if (projects.length) lines.push(`\nПроєкти:\n${projects.join("\n")}`);
  const education = doc.education.filter(Boolean);
  if (education.length) lines.push(`\nОсвіта:\n${education.join("\n")}`);
  const langs = (doc.languages || []).filter((l) => l.name);
  if (langs.length) lines.push(`\nМови: ${langs.map((l) => `${l.name} (${l.level})`).join(", ")}`);
  return lines.join("\n");
}

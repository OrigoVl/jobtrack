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

/** Used for the meta text under `metaFont: "mono"` and for `code` spans under `richText`. */
const MONO_STACK = `ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace`;

/**
 * Resolves `theme.skillsStyle`'s "auto" (the default, and what every CV saved before the setting
 * existed parses as) to what the Skills section actually renders as: the two text-dense templates
 * run the skills as one inline "A · B · C" line, everything else uses chips. Exported because the
 * Appearance panel needs the same answer — it only offers the chip-specific controls while chips
 * are what's on screen, and duplicating the rule there would let the two drift apart.
 */
export function effectiveSkillsStyle(theme: CvTheme): "chips" | "inline" | "list" | "grouped" {
  if (theme.skillsStyle && theme.skillsStyle !== "auto") return theme.skillsStyle;
  if (theme.template === "technical") return "grouped";
  return theme.template === "compact" || theme.template === "academic" ? "inline" : "chips";
}

/** What the Skills section falls back to when "grouped" is asked for but the doc has no groups —
 * the answer "auto" would have given on this template, never "grouped" again. */
function flatSkillsStyle(theme: CvTheme): "chips" | "inline" | "list" {
  const style = effectiveSkillsStyle(theme);
  if (style !== "grouped") return style;
  return theme.template === "compact" || theme.template === "academic" ? "inline" : "chips";
}

/**
 * Renders a CV document as markup + its stylesheet, deliberately kept as TWO separate strings
 * instead of one HTML string with an inline `<style>` in its `<head>`.
 *
 * Every consumer of this (the preview iframe, the public share iframe, the print popup) is a
 * `srcdoc`/`about:blank` document, and those INHERIT the app's CSP — whose `style-src-elem` has
 * no `'unsafe-inline'` on purpose (see server/src/app.ts). An inline `<style>` inside them is
 * therefore silently dropped in production and the CV renders as unstyled Times New Roman. The
 * CSS goes in via `applyCvCss()` (CSSOM, not a `<style>` element) at each call site instead —
 * see the comment there.
 */
/**
 * Turns whatever a candidate types for Telegram into a display handle plus a working link.
 *
 * Accepts `@name`, a bare `name`, `t.me/name`, `telegram.me/name` and a full `https://` URL — all
 * four are what people actually paste. This exists because a handle is NOT a URL: typed into a
 * link row (the only place it could go before), `@name` was turned into `https://@name`, which is
 * a dead link in the exported PDF. Returns null for empty/garbage input so the caller can leave
 * the separator out rather than printing a stray `·`.
 */
export function telegramContact(raw: string): { label: string; href: string } | null {
  const handle = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?t(elegram)?\.me\//i, "")
    .replace(/^@/, "")
    // A pasted link can carry a query/fragment ("t.me/name?start=x"); the handle is the first path
    // segment, everything after it is noise for display purposes.
    .split(/[/?#]/)[0]!
    .trim();
  // Telegram usernames are letters/digits/underscore. Anything else is a typo or a phone-style
  // "+380…" invite link, neither of which should be presented as a @handle.
  if (!/^\w+$/.test(handle)) return null;
  return { label: `@${handle}`, href: `https://t.me/${handle}` };
}

export function buildCvDocument(doc: CvDoc): { html: string; css: string } {
  const t = themeOf(doc);
  const esc = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  /**
   * `**bold**` and `` `code` `` inside prose, opt-in via `theme.richText`.
   *
   * Runs strictly AFTER esc(), never instead of it — and that ordering is the entire safety
   * argument. By the time this sees the string, every `<`, `>` and `&` the user typed is already
   * an entity, so the only tags in the result are the two produced here; there is no input that
   * can smuggle a third one through. That matters more than usual because this exact string is
   * rendered into the preview iframe, the print popup AND the public share page, which serves
   * one user's document to anonymous visitors.
   *
   * The character classes exclude the delimiter itself, so an unpaired `**` is left alone rather
   * than swallowing the rest of the line.
   */
  const rich = (escaped: string) =>
    t.richText ? escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>") : escaped;
  const escRich = (s: string) => rich(esc(s));
  // `.trim()`, not `filter(Boolean)`: a bullet the user cleared down to spaces is still truthy,
  // and would print as a visible empty bullet point on the exported PDF. ResumeCompleteness
  // already judges "has this entry got any content" the same way.
  const list = (arr: string[]) =>
    arr
      .filter((x) => x.trim())
      .map((x) => `<li>${escRich(x)}</li>`)
      .join("");
  const isUk = isCyrillicDoc(doc);
  const label = (key: CvSection) => (isUk ? UK_SECTION_LABELS[key] : EN_SECTION_LABELS[key]);
  const H = (key: CvSection) => `<h2>${esc(label(key))}</h2>`;
  // Every top-level block and every individual experience entry carries a `data-section` —
  // the preview iframe attaches a plain click listener (from the parent, via
  // `contentDocument`, no injected <script>/CSP concerns) and reports it back so clicking
  // "Experience #2" in the live preview can open exactly that entry in the editor.
  const wrap = (key: string, html: string) => (html ? `<div class="sec-block" data-section="${key}">${html}</div>` : "");
  // Optional per-entry extras (see CvExperience in shared/types.ts). Both render nothing at all
  // when absent, which is every entry saved before they existed — so adding them leaves the
  // markup of an existing CV byte-identical rather than merely visually similar.
  const jobNote = (e: CvDoc["experience"][number]) => (e.note?.trim() ? `<div class="job-note">${escRich(e.note)}</div>` : "");
  // grid-auto-flow:column (in the CSS below) rather than a fixed column count, so two metrics
  // split the width in half and four split it in quarters without the markup knowing how many
  // there are.
  const metricStrip = (e: CvDoc["experience"][number]) => {
    const ms = (e.metrics ?? []).filter((m) => m.value.trim() || m.label.trim());
    if (!ms.length) return "";
    const cells = ms
      .map(
        (m) => `<div class="metric"><div class="metric-value">${esc(m.value)}</div><div class="metric-label">${esc(m.label)}</div></div>`,
      )
      .join("");
    return `<div class="metrics">${cells}</div>`;
  };
  // "technical" states the employer first and puts the ROLE in the accent colour, on one line —
  // the reading order that template is built around. Every other template keeps the original
  // markup exactly (bold role + period, then the company on its own muted line).
  const techHead = t.template === "technical";
  const expHead = (e: CvDoc["experience"][number]) =>
    techHead
      ? `<div class="row"><span class="role">${esc(e.company)}${e.company.trim() && e.role.trim() ? " — " : ""}<span class="co">${esc(e.role)}</span></span><span class="period">${esc(e.period)}</span></div>`
      : `<div class="row"><span class="role">${esc(e.role)}</span><span class="period">${esc(e.period)}</span></div><div class="company">${esc(e.company)}</div>`;
  const exp = doc.experience
    .map(
      (e, i) =>
        `<div class="exp" data-section="experience-${i}">${expHead(e)}` +
        `${jobNote(e)}${metricStrip(e)}${e.bullets.some((b) => b.trim()) ? `<ul>${list(e.bullets)}</ul>` : ""}</div>`,
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
  // One assembled line reused by every layout below, rather than each one re-deciding where the
  // separators go — that logic used to be inlined twice and would now have to know about four
  // parts instead of two. The phone is deliberately plain text, not a `tel:` anchor: anchors here
  // print underlined (see the LinkedIn link), and underlining a phone number on a résumé buys
  // nothing.
  const tg = telegramContact(doc.telegram ?? "");
  const contactLine = [
    esc(doc.contact.trim()),
    esc((doc.phone ?? "").trim()),
    tg ? `<a href="${esc(tg.href)}" target="_blank" rel="noopener">${esc(tg.label)}</a>` : "",
    linksLine,
  ]
    .filter(Boolean)
    .join(" · ");
  const photoImg = doc.photo && t.showPhoto !== false ? `<img class="photo" src="${doc.photo}" alt="Photo"/>` : "";
  const hmeta = `<div class="hmeta" data-section="general"><h1>${esc(doc.name)}</h1><div class="title">${esc(doc.title)}</div><div class="contact">${contactLine}</div></div>`;
  const langs = (doc.languages || []).filter((l) => l && l.name);
  const skillGroups = (doc.skillGroups ?? []).filter((g) => g.skills.some((s) => s.trim()) || g.name.trim());
  // "grouped" degrades to the flat list rather than to nothing when the doc has no groups yet:
  // the style is choosable before any group has been created, and a Skills section that vanishes
  // on selecting it would read as a bug rather than as "there is nothing to group".
  const skillsStyle = effectiveSkillsStyle(t) === "grouped" && skillGroups.length ? "grouped" : flatSkillsStyle(t);
  const secSkills =
    skillsStyle === "grouped"
      ? `${H("skills")}<dl class="skill-groups">${skillGroups
          .map(
            (g) =>
              `<dt>${esc(g.name)}</dt><dd>${g.skills
                .filter((s) => s.trim())
                .map(esc)
                .join(", ")}</dd>`,
          )
          .join("")}</dl>`
      : !doc.skills.length
        ? ""
        : skillsStyle === "inline"
          ? `${H("skills")}<p>${doc.skills.map(esc).join(" · ")}</p>`
          : skillsStyle === "list"
            ? `${H("skills")}<ul class="skill-list">${doc.skills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
            : `${H("skills")}<div class="chips">${doc.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>`;
  const sec: Record<string, string> = {
    summary: wrap("summary", doc.summary ? `${H("summary")}<p>${escRich(doc.summary)}</p>` : ""),
    skills: wrap("skills", secSkills),
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
  // "auto" — what every doc saved before the setting existed parses as — means "whatever the
  // template wants", and only `technical` wants a monospace. Every other template resolves to
  // "body", and the declarations below are then omitted entirely rather than emitted as a
  // redundant `font-family: <the body font>`, so an untouched CV keeps byte-identical CSS.
  const metaMono = (t.metaFont && t.metaFont !== "auto" ? t.metaFont : t.template === "technical" ? "mono" : "body") === "mono";
  const metaCss = metaMono
    ? `.contact,h2,.period,.metric-value,.skill-groups dt{font-family:${MONO_STACK}}.period,.metric-value{font-variant-numeric:tabular-nums}`
    : "";
  // CSS for the optional blocks is emitted only when the document actually contains one, for the
  // same reason: a CV that uses none of them is styled by exactly the rules it was before.
  const anyNotes = doc.experience.some((e) => e.note?.trim());
  const anyMetrics = doc.experience.some((e) => (e.metrics ?? []).some((m) => m.value.trim() || m.label.trim()));
  const optionalCss =
    (anyNotes
      ? `.job-note{color:#64748b;font-size:${px(fs * 0.88)};margin:1px 0 6px}` +
        // Sits between the entry's title row and its bullets, so it takes the same "don't get
        // stranded at the foot of a page" treatment the row itself has.
        `@media print{.job-note{break-after:avoid}}`
      : "") +
    (anyMetrics
      ? // grid-auto-flow:column divides the row evenly however many cells there are; the 1px gap
        // over a tinted background is what draws the hairlines between them.
        `.metrics{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:1px;background:#e2e8f0;border:1px solid #e2e8f0;margin:8px 0}` +
        `.metric{background:#fff;padding:7px 9px}` +
        `.metric-value{font-weight:700;color:${t.accent};font-size:${px(fs * 1.05)};letter-spacing:-.02em}` +
        `.metric-label{color:#94a3b8;font-size:${px(fs * 0.72)};line-height:1.35}` +
        `@media print{.metrics{break-inside:avoid;break-after:avoid}}`
      : "") +
    (skillsStyle === "grouped"
      ? `.skill-groups{display:grid;grid-template-columns:minmax(7em,9em) 1fr;gap:7px 16px;align-items:baseline;margin:0}` +
        `.skill-groups dt{font-weight:700;color:${t.accent};font-size:${px(fs * 0.8)};text-transform:uppercase;letter-spacing:.05em}` +
        `.skill-groups dd{margin:0;color:#64748b;font-size:${px(fs * 0.92)}}` +
        // One column inside the narrow aside of twocol/sidebar, where a 9em label column would
        // leave the skills themselves a few characters wide.
        `aside .skill-groups,.side-panel .skill-groups{grid-template-columns:1fr;gap:0}` +
        `aside .skill-groups dd,.side-panel .skill-groups dd{margin-bottom:6px}`
      : "") +
    (t.richText
      ? `code{font-family:${MONO_STACK};font-size:.88em;background:#f1f5f9;padding:.05em .32em;border-radius:3px}strong{color:#0f172a}`
      : "");
  // Chip looks. The defaults reproduce exactly what chips looked like before they were
  // configurable (6px corners, accent-tinted), so an existing CV renders unchanged.
  const chipFill = t.skillChipFill ?? "tint";
  const chipRadius = t.skillChipShape === "pill" ? "999px" : t.skillChipShape === "square" ? "0" : "6px";
  const chipSkin =
    chipFill === "solid"
      ? `background:${t.accent};color:#fff;border:1px solid ${t.accent}`
      : chipFill === "outline"
        ? `background:transparent;color:${t.accent};border:1px solid ${t.accent}66`
        : `background:${t.accent}14;color:${t.accent};border:1px solid ${t.accent}33`;
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
      `${contactLine ? `<div class="s-contact">${contactLine}</div>` : ""}` +
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
      // Only while the chips are on their default tint: this quiets the accent down to greys to
      // fit the template, but an explicitly chosen outline/solid fill is a deliberate decision
      // and shouldn't be silently overridden by picking this template.
      (chipFill === "tint" ? `.chip{background:#f8fafc;color:#334155;border-color:#e2e8f0}` : "") +
      `.photo{border-color:#e2e8f0}`;
  } else if (t.template === "technical") {
    // An engineering-résumé look built entirely out of typography: a rule under the masthead
    // instead of a coloured heading bar, section labels reduced to small tracked-out capitals
    // with a hairline running out to the margin, the employer stated before the role, and dot
    // markers drawn by CSS. Single-column on purpose — nothing here splits the page into
    // regions, so unlike twocol/sidebar it stays safe for text extraction (ATS_RISK_TEMPLATES).
    layout = `${headerRow}${pick(order)}`;
    extraCss =
      `header.hrow{border-bottom:2px solid #15171c;padding-bottom:${gap}}` +
      `h1{font-weight:650;letter-spacing:-.028em}` +
      `.title{font-weight:500;font-size:${px(fs * 1.02)}}` +
      // The rule fills whatever width the label leaves instead of underlining it — the device
      // that gives this template its editorial feel.
      `h2{display:flex;align-items:center;gap:12px;border-bottom:none;padding-bottom:0;color:#878d9b;font-weight:600;letter-spacing:.14em;font-size:${px(fs * 0.76)}}` +
      `h2::after{content:"";flex:1;height:1px;background:#e2e3df}` +
      `.role{font-weight:600;color:#15171c}.role .co{color:${t.accent}}` +
      // Accent-coloured dot against muted text: what makes a dense bullet list scannable.
      `ul{list-style:none;padding-left:0;margin:6px 0}` +
      `li{position:relative;padding-left:15px;color:#5c6373}` +
      `li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;border-radius:50%;background:${t.accent}99}` +
      `.sec-block p{color:#5c6373}`;
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
    `.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{${chipSkin};border-radius:${chipRadius};padding:2px 8px;font-size:${px(fs * 0.85)}}` +
    // Two columns so a 25-skill list doesn't eat half a page — but back to one inside the narrow
    // aside of the two-column/sidebar templates, where two columns would be a few characters wide.
    `.skill-list{columns:2;column-gap:22px}aside .skill-list,.side-panel .skill-list{columns:1}` +
    // Clickable-in-preview affordance for the interactive preview → editor sync — cursor +
    // hover outline on anything carrying data-section (whole sections, or one experience
    // entry). @media print strips it back off so it never shows up in the exported PDF.
    `[data-section]{cursor:pointer}[data-section]:hover{outline:1px dashed ${t.accent}66;outline-offset:2px;border-radius:6px}` +
    `@media print{[data-section]:hover{outline:none}}` +
    // Page-break behaviour, deliberately "keep things TOGETHER at the seam" rather than "never
    // split this block". The technical template used to carry `.exp{break-inside:avoid}`, which
    // reads as sensible and isn't: a job with a dozen bullets is taller than whatever space is
    // left at the bottom of a page, so the whole entry jumps to the next one and leaves a
    // half-page of white behind it — the exact "huge gaps" this is fixing. An entry may split;
    // what must never happen is a heading, or an entry's title line, stranded alone at the foot
    // of a page away from the content it introduces.
    `@media print{` +
    `h2{break-after:avoid}` +
    // An entry's title line belongs with the first bullet under it. (The optional note/metric
    // strip gets the same treatment, but only where those rules are already emitted — see
    // optionalCss, which deliberately says nothing about a block the markup never renders.)
    `.exp .row{break-after:avoid}` +
    // A single bullet splitting across two pages is never worth it; a list of them is.
    `li{break-inside:avoid}` +
    // No lone first/last line of a paragraph left behind at a page boundary.
    `p,li{orphans:2;widows:2}` +
    // Chrome/Edge drop every background when "Background graphics" is unchecked, which is the
    // DEFAULT in the print dialog — and several things here are drawn as backgrounds rather than
    // text or borders: the technical template's bullet dots and the hairline beside its section
    // headings, the timeline template's rail dots, the skill chips' tint, and the metric strip
    // (whose separators are a tinted parent showing through 1px gaps). Without this the exported
    // PDF silently loses all of them while the on-screen preview keeps them — reported as
    // "the preview has bullet points, the PDF doesn't". `exact` opts back in; it's inherited, so
    // declaring it on body covers descendants and their pseudo-elements.
    `body{-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `}` +
    optionalCss +
    metaCss +
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
  return {
    html: `<!doctype html><html lang="${isUk ? "uk" : "en"}"><head><meta charset="utf-8"><title>${esc(doc.name || "CV")}</title></head><body>${layout}</body></html>`,
    css,
  };
}

/**
 * Applies a generated stylesheet to a CV document (preview iframe / public share iframe / print
 * popup) via CSSOM rather than by appending a `<style>` element.
 *
 * That's the whole point: those documents inherit the app's CSP, and `style-src-elem` has no
 * `'unsafe-inline'` (server/src/app.ts) — a `<style>` element there is blocked outright, which is
 * exactly how the preview and the exported PDF ended up as unstyled Times New Roman in
 * production. A constructed stylesheet isn't governed by `style-src` (the script building it
 * already had to pass `script-src`), so the CV gets its styles back without relaxing the policy.
 *
 * The sheet MUST be constructed from the TARGET document's own window — a stylesheet constructed
 * in a different document can't be adopted ("Sheet constructed in a different document cannot be
 * adopted"), so `new CSSStyleSheet()` from the parent frame would throw.
 */
export function applyCvCss(target: Document, css: string): void {
  const win = target.defaultView;
  if (win && "adoptedStyleSheets" in target) {
    const sheet = new win.CSSStyleSheet();
    sheet.replaceSync(css);
    target.adoptedStyleSheets = [sheet];
    return;
  }
  // Fallback for environments without constructable stylesheets (jsdom in unit tests, browsers
  // predating Safari 16.4) — no CSP applies in those, so a plain <style> element is fine there.
  // Reused per document rather than appended afresh: the live preview re-applies on every theme
  // edit (see cv-preview-panel.tsx), which would otherwise pile up a <style> per keystroke of the
  // accent/scale controls. Keyed by document, so a reloaded srcdoc iframe (a NEW Document object,
  // whose old element is gone with the old document) correctly gets its own element again.
  const existing = FALLBACK_STYLE_EL.get(target);
  if (existing) {
    existing.textContent = css;
    return;
  }
  const el = target.createElement("style");
  el.textContent = css;
  target.head.appendChild(el);
  FALLBACK_STYLE_EL.set(target, el);
}
const FALLBACK_STYLE_EL = new WeakMap<Document, HTMLStyleElement>();

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
  const { html, css } = buildCvDocument(doc);
  w.document.write(html);
  w.document.close();
  // After close(), so the document is fully parsed and `head` exists for the fallback path. The
  // popup inherits this page's CSP (it's an about:blank document opened by us), which is why the
  // CSS can't just ride along inside `html` — see applyCvCss.
  applyCvCss(w.document, css);
  w.focus();
  setTimeout(() => w.print(), 350);
}

export function cvDocToText(doc: CvDoc): string {
  const lines: string[] = [];
  if (doc.name) lines.push(doc.name);
  if (doc.title) lines.push(doc.title);
  if (doc.contact) lines.push(doc.contact);
  // Same line as the rendered CV puts them on — this text is what the AI review/match features
  // read, so a phone or Telegram handle held only in its own field shouldn't look missing to them.
  const reach = [(doc.phone ?? "").trim(), telegramContact(doc.telegram ?? "")?.label ?? ""].filter(Boolean);
  if (reach.length) lines.push(reach.join(" · "));
  const links = (doc.links ?? []).filter((l) => l.label.trim() || l.url.trim());
  if (links.length) lines.push(links.map((l) => [l.label, l.url].filter(Boolean).join(": ")).join(" · "));
  if (doc.summary) lines.push(`\nProfile:\n${doc.summary}`);
  if (doc.skills.length) lines.push(`\nSkills: ${doc.skills.join(", ")}`);
  // Categories are additive to the flat list above, so they're stated as their own line rather
  // than replacing it — the grouping itself is signal about how the candidate frames their stack.
  const skillGroups = (doc.skillGroups ?? []).filter((g) => g.name.trim() && g.skills.some((s) => s.trim()));
  if (skillGroups.length) {
    lines.push(`\nSkills by category:\n${skillGroups.map((g) => `${g.name}: ${g.skills.filter((s) => s.trim()).join(", ")}`).join("\n")}`);
  }
  if (doc.experience.length) {
    lines.push("\nExperience:");
    doc.experience.forEach((e) => {
      lines.push(`${e.role} — ${e.company} (${e.period})`);
      if (e.note?.trim()) lines.push(e.note.trim());
      // Real, quantified achievements — the single most useful thing a rewrite/match prompt can
      // see about this job, so they'd be a strange omission from the text handed to the model.
      const metrics = (e.metrics ?? []).filter((m) => m.value.trim() || m.label.trim());
      if (metrics.length) lines.push(metrics.map((m) => [m.value.trim(), m.label.trim()].filter(Boolean).join(" ")).join(" · "));
      // Whitespace-only bullets would otherwise reach the LLM as an empty "- " line.
      e.bullets.filter((b) => b.trim()).forEach((b) => lines.push(`- ${b}`));
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

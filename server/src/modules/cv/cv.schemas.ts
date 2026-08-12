// Zod schemas for the structured CV (builder). Unlike shared/validation.ts
// (which throws 400 on invalid input), the semantics here differ: input is NEVER rejected —
// any garbage is silently coerced to safe default values.
import { z } from "zod";

export const CV_TEMPLATES = ["classic", "compact", "academic", "twocol", "minimal", "sidebar", "timeline", "technical"] as const;
export const CV_FONTS = ["sans", "serif"] as const;
export const CV_SECTIONS = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
  "languages",
  "awards",
  "publications",
  "volunteer",
  "references",
] as const;
export type CvSection = (typeof CV_SECTIONS)[number];

// Zod v4: `.any()`/`.unknown()`, when it's a REQUIRED field in `z.object({...})`, no longer
// silently accepts a missing key/undefined (throws ZodError "expected nonoptional") — unlike
// v3. We add `.optional()` right after `.any()` so .transform() still runs on undefined and
// returns a safe default (the file's semantics don't change).
const str = (max: number) =>
  z
    .any()
    .optional()
    .transform((v) => (typeof v === "string" ? v.slice(0, max) : ""));
const strArr = (max: number, itemMax = 300) =>
  z
    .any()
    .optional()
    .transform((v) =>
      Array.isArray(v)
        ? v
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.slice(0, itemMax))
            .slice(0, max)
        : [],
    );

const CvOrderSchema = z
  .any()
  .optional()
  .transform((v): CvSection[] => {
    const seen = new Set<string>();
    const order: CvSection[] = [];
    if (Array.isArray(v)) {
      for (const k of v) {
        if ((CV_SECTIONS as readonly string[]).includes(k) && !seen.has(k)) {
          seen.add(k);
          order.push(k as CvSection);
        }
      }
    }
    for (const k of CV_SECTIONS) if (!seen.has(k)) order.push(k);
    return order;
  });

const asObject = (v: unknown): object => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export const CvThemeSchema = z.preprocess(
  asObject,
  z.object({
    template: z.enum(CV_TEMPLATES).catch("classic"),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .catch("#4f46e5"),
    font: z.enum(CV_FONTS).catch("sans"),
    scale: z.coerce
      .number()
      .finite()
      .catch(1)
      .transform((n) => Math.min(1.3, Math.max(0.8, n))),
    order: CvOrderSchema,
    showPhoto: z
      .any()
      .optional()
      .transform((v) => v !== false),
    photoShape: z.enum(["circle", "square"]).catch("circle"),
    photoPos: z.enum(["left", "right"]).catch("left"),
    // Skills rendering. "auto" is what a doc saved before these existed parses as (the key is
    // simply missing, so `.catch` supplies it), and it means "whatever this template does by
    // default" — so adding these three can't change how any existing CV looks.
    // "grouped" renders doc.skillGroups as a category/list grid and falls back to the flat list
    // when the doc has no groups yet, so choosing it can never blank the section out.
    skillsStyle: z.enum(["auto", "chips", "inline", "list", "grouped"]).catch("auto"),
    // "rounded" (6px), not "pill": these defaults are what a doc saved before the setting existed
    // parses as, so they have to be the look chips ALREADY had — anything else silently restyles
    // every CV in the database the first time it's saved again.
    skillChipShape: z.enum(["pill", "rounded", "square"]).catch("rounded"),
    skillChipFill: z.enum(["tint", "outline", "solid"]).catch("tint"),
    // Typeface for the small meta text (contact line, section labels, dates, metric figures).
    // "auto" means "whatever the template picked", which is a monospace only on `technical` —
    // every other template resolves it to "body", i.e. exactly what it renders today. "body"
    // rather than "sans" because it follows whatever `font` is, serif included.
    metaFont: z.enum(["auto", "body", "mono"]).catch("auto"),
    // Opt-in `**bold**` / `` `code` `` inside bullets and the summary. Off unless explicitly
    // enabled: a CV whose text happens to contain ** must keep printing those asterisks
    // literally rather than silently reflowing the moment this shipped.
    richText: z
      .any()
      .optional()
      .transform((v) => v === true),
  }),
);
export type CvTheme = z.infer<typeof CvThemeSchema>;

export const CvPhotoSchema = z
  .any()
  .optional()
  .transform((v) =>
    typeof v === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(v) && v.length <= 700000 ? v : "",
  );

export interface CvLanguage {
  name: string;
  level: string;
}

export const CvLanguagesSchema = z
  .any()
  .optional()
  .transform((v): CvLanguage[] =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x.name === "string" && x.name.trim())
          .slice(0, 12)
          .map((x) => ({ name: x.name.trim().slice(0, 60), level: typeof x.level === "string" ? x.level.trim().slice(0, 40) : "" }))
      : [],
  );

export interface CvMetric {
  value: string;
  label: string;
}

// Capped at four because that is what fits one printed row of the strip at any text scale — a
// fifth wraps onto a second row of one and reads as a mistake rather than as a figure.
const CvMetricsSchema = z.any().transform((v): CvMetric[] =>
  Array.isArray(v)
    ? v
        .slice(0, 4)
        .map((m) => ({
          value: typeof m?.value === "string" ? m.value.slice(0, 20) : "",
          label: typeof m?.label === "string" ? m.label.slice(0, 60) : "",
        }))
        .filter((m) => m.value || m.label)
    : [],
);

export interface CvExperienceItem {
  role: string;
  company: string;
  period: string;
  /** One line of context under the job head — what the product or team actually was. Empty on
   * every entry saved before this existed, and an empty note renders nothing at all. */
  note: string;
  bullets: string[];
  /** Headline figures for this job, rendered as a small strip above the bullets. Same story as
   * `note`: absent on existing entries, and an empty list renders nothing. */
  metrics: CvMetric[];
}

const CvExperienceItemSchema = z.any().transform((e): CvExperienceItem => ({
  role: typeof e?.role === "string" ? e.role.slice(0, 160) : "",
  company: typeof e?.company === "string" ? e.company.slice(0, 160) : "",
  period: typeof e?.period === "string" ? e.period.slice(0, 60) : "",
  note: typeof e?.note === "string" ? e.note.slice(0, 300) : "",
  bullets: strArr(12).parse(e?.bullets),
  metrics: CvMetricsSchema.parse(e?.metrics),
}));

export const CvExperienceSchema = z
  .any()
  .optional()
  .transform((v): CvExperienceItem[] => (Array.isArray(v) ? v.slice(0, 20).map((e) => CvExperienceItemSchema.parse(e)) : []));

export interface CvEducationEntry {
  school: string;
  degree: string;
  period: string;
}

// Coerces EITHER shape into the structured one: a plain string (every education entry stored
// before this field was structured — this file's "never reject, coerce to a safe default"
// philosophy applies to old persisted data too, not just malformed input) becomes `{ school:
// <that string>, degree: "", period: "" }` — non-lossy, the user can split it into degree/period
// afterward — while an already-structured entry just gets its fields trimmed/capped.
const CvEducationEntrySchema = z.any().transform((e): CvEducationEntry =>
  typeof e === "string"
    ? { school: e.slice(0, 200), degree: "", period: "" }
    : {
        school: typeof e?.school === "string" ? e.school.slice(0, 200) : "",
        degree: typeof e?.degree === "string" ? e.degree.slice(0, 160) : "",
        period: typeof e?.period === "string" ? e.period.slice(0, 60) : "",
      },
);

export const CvEducationSchema = z
  .any()
  .optional()
  .transform((v): CvEducationEntry[] =>
    Array.isArray(v)
      ? v
          .slice(0, 20)
          .map((e) => CvEducationEntrySchema.parse(e))
          .filter((e) => e.school || e.degree || e.period)
      : [],
  );

export interface CvProjectEntry {
  title: string;
  description: string;
  tech: string[];
  link: string;
}

// Same backward-compat trick as CvEducationEntrySchema above: a plain string (every project
// entry stored before this field became structured) becomes `{ title: <that string>, ... }` —
// non-lossy, the one existing line just becomes the project's headline.
const CvProjectEntrySchema = z.any().transform((e): CvProjectEntry =>
  typeof e === "string"
    ? { title: e.slice(0, 200), description: "", tech: [], link: "" }
    : {
        title: typeof e?.title === "string" ? e.title.slice(0, 200) : "",
        description: typeof e?.description === "string" ? e.description.slice(0, 500) : "",
        tech: strArr(20, 60).parse(e?.tech),
        link: typeof e?.link === "string" ? e.link.slice(0, 300) : "",
      },
);

export const CvProjectsSchema = z
  .any()
  .optional()
  .transform((v): CvProjectEntry[] =>
    Array.isArray(v)
      ? v
          .slice(0, 20)
          .map((e) => CvProjectEntrySchema.parse(e))
          .filter((e) => e.title || e.description || e.tech.length || e.link)
      : [],
  );

export interface CvCertificationEntry {
  name: string;
  issuer: string;
  date: string;
}

// No backward-compat coercion needed here (unlike education/projects) — certifications is a
// brand new field, no account has ever had this stored as a flat string.
const CvCertificationEntrySchema = z.any().transform((e): CvCertificationEntry => ({
  name: typeof e?.name === "string" ? e.name.slice(0, 200) : "",
  issuer: typeof e?.issuer === "string" ? e.issuer.slice(0, 160) : "",
  date: typeof e?.date === "string" ? e.date.slice(0, 60) : "",
}));

export const CvCertificationsSchema = z
  .any()
  .optional()
  .transform((v): CvCertificationEntry[] =>
    Array.isArray(v)
      ? v
          .slice(0, 20)
          .map((e) => CvCertificationEntrySchema.parse(e))
          .filter((e) => e.name || e.issuer || e.date)
      : [],
  );

export interface CvAwardEntry {
  title: string;
  issuer: string;
  date: string;
}

// Same shape/conventions as CvCertificationEntrySchema — a distinct section from certifications
// (an award/honor isn't a credential), but the entry itself needs nothing extra.
const CvAwardEntrySchema = z.any().transform((e): CvAwardEntry => ({
  title: typeof e?.title === "string" ? e.title.slice(0, 200) : "",
  issuer: typeof e?.issuer === "string" ? e.issuer.slice(0, 160) : "",
  date: typeof e?.date === "string" ? e.date.slice(0, 60) : "",
}));

export const CvAwardsSchema = z
  .any()
  .optional()
  .transform((v): CvAwardEntry[] =>
    Array.isArray(v)
      ? v
          .slice(0, 20)
          .map((e) => CvAwardEntrySchema.parse(e))
          .filter((e) => e.title || e.issuer || e.date)
      : [],
  );

export interface CvPublicationEntry {
  title: string;
  publisher: string;
  date: string;
  url: string;
}

const CvPublicationEntrySchema = z.any().transform((e): CvPublicationEntry => ({
  title: typeof e?.title === "string" ? e.title.slice(0, 200) : "",
  publisher: typeof e?.publisher === "string" ? e.publisher.slice(0, 160) : "",
  date: typeof e?.date === "string" ? e.date.slice(0, 60) : "",
  url: typeof e?.url === "string" ? e.url.slice(0, 300) : "",
}));

export const CvPublicationsSchema = z
  .any()
  .optional()
  .transform((v): CvPublicationEntry[] =>
    Array.isArray(v)
      ? v
          .slice(0, 20)
          .map((e) => CvPublicationEntrySchema.parse(e))
          .filter((e) => e.title || e.publisher || e.date || e.url)
      : [],
  );

export interface CvVolunteerEntry {
  role: string;
  organization: string;
  period: string;
  description: string;
}

// Lighter than CvExperienceItem (no `bullets` array) — volunteer entries are usually a single
// role/org/period plus one short blurb, not a multi-bullet job history.
const CvVolunteerEntrySchema = z.any().transform((e): CvVolunteerEntry => ({
  role: typeof e?.role === "string" ? e.role.slice(0, 160) : "",
  organization: typeof e?.organization === "string" ? e.organization.slice(0, 160) : "",
  period: typeof e?.period === "string" ? e.period.slice(0, 60) : "",
  description: typeof e?.description === "string" ? e.description.slice(0, 500) : "",
}));

export const CvVolunteerSchema = z
  .any()
  .optional()
  .transform((v): CvVolunteerEntry[] =>
    Array.isArray(v)
      ? v
          .slice(0, 20)
          .map((e) => CvVolunteerEntrySchema.parse(e))
          .filter((e) => e.role || e.organization || e.period || e.description)
      : [],
  );

export interface CvReferenceEntry {
  name: string;
  relation: string;
  contact: string;
}

const CvReferenceEntrySchema = z.any().transform((e): CvReferenceEntry => ({
  name: typeof e?.name === "string" ? e.name.slice(0, 160) : "",
  relation: typeof e?.relation === "string" ? e.relation.slice(0, 160) : "",
  contact: typeof e?.contact === "string" ? e.contact.slice(0, 200) : "",
}));

// Capped at 10 (not 20 like the other list sections) — references are conventionally a short
// list (2-4 names), not something anyone accumulates dozens of.
export const CvReferencesSchema = z
  .any()
  .optional()
  .transform((v): CvReferenceEntry[] =>
    Array.isArray(v)
      ? v
          .slice(0, 10)
          .map((e) => CvReferenceEntrySchema.parse(e))
          .filter((e) => e.name || e.relation || e.contact)
      : [],
  );

export interface CvContactLink {
  label: string;
  url: string;
}

// Additive alongside the freeform `contact` string, not a replacement for it — see the client's
// CvDoc.links doc comment for why there's no coercion from an old `contact` blob into this shape.
const CvContactLinkSchema = z.any().transform((e): CvContactLink => ({
  label: typeof e?.label === "string" ? e.label.slice(0, 60) : "",
  url: typeof e?.url === "string" ? e.url.slice(0, 300) : "",
}));

export const CvContactLinksSchema = z
  .any()
  .optional()
  .transform((v): CvContactLink[] =>
    Array.isArray(v)
      ? v
          .slice(0, 10)
          .map((e) => CvContactLinkSchema.parse(e))
          .filter((e) => e.label || e.url)
      : [],
  );

export interface CvSkillGroup {
  name: string;
  skills: string[];
}

/**
 * Categorized skills ("AI / LLM", "Frontend", …), rendered by `skillsStyle: "grouped"`.
 *
 * Deliberately ADDITIVE to the flat `skills` array rather than a replacement for it. `skills`
 * stays the single canonical list that everything non-visual reads — cvDocToText and so every
 * LLM prompt, the tailor/match reports, the ATS-facing plain text — while groups only ever
 * affect how the section is laid out. Collapsing the two would mean either losing the ordering
 * "Tailor CV" produces or teaching every consumer about a second shape, for a purely
 * presentational feature.
 */
export const CvSkillGroupsSchema = z
  .any()
  .optional()
  .transform((v): CvSkillGroup[] =>
    Array.isArray(v)
      ? v
          .slice(0, 12)
          .map((g) => ({
            name: typeof g?.name === "string" ? g.name.slice(0, 60) : "",
            skills: strArr(40, 60).parse(g?.skills),
          }))
          .filter((g) => g.name || g.skills.length)
      : [],
  );

export const CvDocSchema = z.preprocess(
  asObject,
  z.object({
    name: str(120),
    title: str(160),
    contact: str(400),
    links: CvContactLinksSchema,
    summary: str(1500),
    photo: CvPhotoSchema,
    skills: strArr(60),
    skillGroups: CvSkillGroupsSchema,
    experience: CvExperienceSchema,
    education: CvEducationSchema,
    projects: CvProjectsSchema,
    certifications: CvCertificationsSchema,
    languages: CvLanguagesSchema,
    awards: CvAwardsSchema,
    publications: CvPublicationsSchema,
    volunteer: CvVolunteerSchema,
    references: CvReferencesSchema,
    theme: CvThemeSchema,
  }),
);
export type CvDoc = z.infer<typeof CvDocSchema>;

export interface CvPreset {
  name: string;
  theme: CvTheme;
}

export const CvPresetsSchema = z.any().transform((v): CvPreset[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: CvPreset[] = [];
  for (const p of v) {
    const name = typeof p?.name === "string" ? p.name.trim().slice(0, 40) : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, theme: CvThemeSchema.parse(p?.theme) });
    if (out.length >= 20) break;
  }
  return out;
});

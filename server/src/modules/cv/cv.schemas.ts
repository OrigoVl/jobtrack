// Zod schemas for the structured CV (builder). Unlike shared/validation.ts
// (which throws 400 on invalid input), the semantics here differ: input is NEVER rejected —
// any garbage is silently coerced to safe default values.
import { z } from "zod";

export const CV_TEMPLATES = ["classic", "compact", "academic", "twocol", "minimal", "sidebar", "timeline"] as const;
export const CV_FONTS = ["sans", "serif"] as const;
export const CV_SECTIONS = ["summary", "skills", "experience", "projects", "education", "certifications", "languages"] as const;
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

export interface CvExperienceItem {
  role: string;
  company: string;
  period: string;
  bullets: string[];
}

const CvExperienceItemSchema = z.any().transform((e): CvExperienceItem => ({
  role: typeof e?.role === "string" ? e.role.slice(0, 160) : "",
  company: typeof e?.company === "string" ? e.company.slice(0, 160) : "",
  period: typeof e?.period === "string" ? e.period.slice(0, 60) : "",
  bullets: strArr(12).parse(e?.bullets),
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
    experience: CvExperienceSchema,
    education: CvEducationSchema,
    projects: CvProjectsSchema,
    certifications: CvCertificationsSchema,
    languages: CvLanguagesSchema,
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

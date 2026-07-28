// Zod schemas for the structured CV (builder). Unlike shared/validation.ts
// (which throws 400 on invalid input), the semantics here differ: input is NEVER rejected —
// any garbage is silently coerced to safe default values.
import { z } from "zod";

export const CV_TEMPLATES = ["classic", "compact", "academic", "twocol", "minimal", "sidebar", "timeline"] as const;
export const CV_FONTS = ["sans", "serif"] as const;
export const CV_SECTIONS = ["summary", "skills", "experience", "projects", "education", "languages"] as const;
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

export const CvDocSchema = z.preprocess(
  asObject,
  z.object({
    name: str(120),
    title: str(160),
    contact: str(400),
    summary: str(1500),
    photo: CvPhotoSchema,
    skills: strArr(60),
    experience: CvExperienceSchema,
    education: strArr(20),
    projects: strArr(20),
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

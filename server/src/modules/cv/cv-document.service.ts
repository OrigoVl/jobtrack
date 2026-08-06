// Building a structured CV document (builder): an empty template and
// LLM parsing of arbitrary resume text into the CvDocSchema structure.
import { getProfile } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { chatJson } from "../../llm/index.js";
import { CvDocSchema, CvThemeSchema, type CvDoc, type CvTheme } from "./cv.schemas.js";

export async function emptyCvDoc(userId: UserId): Promise<CvDoc> {
  const p = await getProfile(userId);
  return {
    name: "",
    title: p.domain || "",
    contact: "",
    links: [],
    summary: "",
    photo: "",
    skills: p.skills || [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    publications: [],
    volunteer: [],
    references: [],
    theme: CvThemeSchema.parse(undefined),
  };
}

// `previousTheme` — the target profile's own current theme, carried over onto the freshly parsed
// doc (a parse otherwise resets it to the schema default, discarding the user's chosen
// template/accent/section order). Passed in by the caller rather than read from storage here:
// now that a doc lives in a specific `cv_profiles` row (not a single per-user KV key), the caller
// already has that row in hand and is the only one who knows which profile is being parsed into.
// Returns `null` (never an empty-but-valid CvDoc) when `chatJson` itself failed — no API key,
// quota/cost cap, provider error, or twice-failed JSON validation — so the caller can fall back to
// the previously-saved doc instead of mistaking "the LLM call failed" for "the resume parsed as
// empty" and overwriting real content with a blank document. Same failure-signaling shape as
// `reviewCv`'s own `if (!out)` guard in cv-analysis.service.ts.
export async function parseCvDocFromText(userId: UserId, cvText: string, previousTheme?: CvTheme): Promise<CvDoc | null> {
  const out = await chatJson(
    userId,
    "You parse a resume into a structure. Respond with ONLY valid JSON. Keep the original language.",
    `Break the resume down into a structure. Resume:\n${cvText}\n\n` +
      `Format strictly: {"name":"","title":"","contact":"email/phone","links":[{"label":"LinkedIn|GitHub|Portfolio","url":""}],"summary":"2-4 sentences","skills":["..."],` +
      `"experience":[{"role":"","company":"","period":"","bullets":["result-oriented bullet points"]}],` +
      `"education":[{"school":"","degree":"","period":""}],` +
      `"projects":[{"title":"","description":"","tech":["..."],"link":""}],` +
      `"certifications":[{"name":"","issuer":"","date":""}],` +
      `"languages":[{"name":"English","level":"B2|C1|Native etc."}]}`,
    CvDocSchema,
    // A full resume (several jobs × several bullets + education/projects/languages) — 1500
    // tokens genuinely wasn't enough for a rich CV (the same class of JSON truncation as in
    // reviewCv/matchCv), and generation was silently cut off by maxTokens before the JSON closed.
    { maxTokens: 2600, temperature: 0.3, cache: true, tier: "smart", feature: "cv-doc-parse" },
  );
  if (!out) return null;
  const doc = CvDocSchema.parse(out);
  if (previousTheme) doc.theme = CvThemeSchema.parse(previousTheme);
  return doc;
}

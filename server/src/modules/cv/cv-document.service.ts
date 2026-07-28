// Building a structured CV document (builder): an empty template and
// LLM parsing of arbitrary resume text into the CvDocSchema structure.
import { getProfile, getKvJson } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { chat } from "../../llm/index.js";
import { CvDocSchema, CvThemeSchema, type CvDoc } from "./cv.schemas.js";

export async function emptyCvDoc(userId: UserId): Promise<CvDoc> {
  const p = await getProfile(userId);
  return {
    name: "",
    title: p.domain || "",
    contact: "",
    summary: "",
    photo: "",
    skills: p.skills || [],
    experience: [],
    education: [],
    projects: [],
    languages: [],
    theme: CvThemeSchema.parse(undefined),
  };
}

export async function parseCvDocFromText(userId: UserId, cvText: string): Promise<CvDoc> {
  const out = await chat(
    userId,
    "You parse a resume into a structure. Respond with ONLY valid JSON. Keep the original language.",
    `Break the resume down into a structure. Resume:\n${cvText}\n\n` +
      `Format strictly: {"name":"","title":"","contact":"email/links","summary":"2-4 sentences","skills":["..."],` +
      `"experience":[{"role":"","company":"","period":"","bullets":["result-oriented bullet points"]}],"education":["..."],"projects":["..."],` +
      `"languages":[{"name":"English","level":"B2|C1|Native etc."}]}`,
    // A full resume (several jobs × several bullets + education/projects/languages) — 1500
    // tokens genuinely wasn't enough for a rich CV (the same class of JSON truncation as in
    // reviewCv/matchCv), and generation was silently cut off by maxTokens before the JSON closed.
    { json: true, maxTokens: 2600, temperature: 0.3, cache: true, tier: "smart" },
  );
  const doc = CvDocSchema.parse(out || {});
  const prev = await getKvJson<CvDoc>(userId, "cvDoc");
  if (prev?.theme) doc.theme = CvThemeSchema.parse(prev.theme);
  return doc;
}

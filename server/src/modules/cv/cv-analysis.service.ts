// Analysis, in-depth review, and comparison of a CV against a vacancy — business logic
// extracted from the controllers so the /cv/* routes stay thin (parse → delegate → respond).
import { z } from "zod";
import { getProfile } from "../../db/index.js";
import { extractTechs } from "../../shared/tech-dict.js";
import { chat, chatJson, llmAvailable } from "../../llm/index.js";
import { demandMap } from "../../shared/demand.js";

export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === "string");

// {title, fix} — the same shape used for issues (reviewCv) and suggestions (matchCv) below.
const TitleFixSchema = z.object({ title: z.string(), fix: z.string().catch("") });
const CvReviewSchema = z.object({
  score: z.number(),
  summary: z.string().catch(""),
  strengths: z.array(z.string()).catch([]),
  issues: z.array(TitleFixSchema).catch([]),
  keywords: z.array(z.string()).catch([]),
  rewrites: z.array(z.object({ before: z.string(), after: z.string() })).catch([]),
});
const CvMatchSchema = z.object({
  score: z.number(),
  verdict: z.string().catch(""),
  matched: z.array(z.string()).catch([]),
  missing: z.array(z.string()).catch([]),
  suggestions: z.array(TitleFixSchema).catch([]),
  tailoredSummary: z.string().catch(""),
});

// ---------- /cv/analyze ----------
export interface CvAnalysis {
  demand: Record<string, number>;
  gaps: [string, number][];
  strengths: [string, number][];
  advice: string;
}

export async function cvAnalysis(cvText: string): Promise<CvAnalysis> {
  const profile = getProfile();
  const demand = demandMap();
  const cvTechs = cvText ? extractTechs(cvText).map((t) => t.name) : [];
  const skills = new Set([...profile.skills, ...cvTechs]);
  const gaps = Object.entries(demand)
    .filter(([t]) => !skills.has(t))
    .sort((a, b) => b[1] - a[1]);
  const strengths = Object.entries(demand)
    .filter(([t]) => skills.has(t))
    .sort((a, b) => b[1] - a[1]);
  const role = profile.domain || "specialist";
  let advice = `Strengths in demand: ${strengths
    .slice(0, 6)
    .map((s) => s[0])
    .join(", ")}. Priority gaps: ${gaps
    .slice(0, 5)
    .map((g) => `${g[0]} (${g[1]} jobs)`)
    .join(", ")}.`;
  if (llmAvailable() && cvText) {
    const llm = await chat(
      `You are a career coach for the role "${role}". Be specific.`,
      `Candidate's CV:\n${cvText.slice(0, 5000)}\n\nMarket demand (number of vacancies per skill): ${JSON.stringify(demand)}.\nGive 4-6 concrete recommendations: what to improve and what to emphasize in the resume.`,
      // "fast" is enough: turning structured gaps/strengths into recommendations is a
      // formatting/summarization task, not deep analysis (that's what reviewCv/matchCv are
      // for, where "smart" is kept). Called often (every /cv/analyze and /cv/upload) — savings
      // without a noticeable drop in advice quality.
      { maxTokens: 600, cache: true, tier: "fast" },
    );
    if (llm) advice = llm;
  }
  return { demand, gaps, strengths, advice };
}

// ---------- /cv/review: in-depth CV review (structured, actionable advice) ----------
export interface CvIssue {
  title: string;
  fix: string;
}
export interface CvReview {
  score: number;
  summary: string;
  strengths: string[];
  issues: CvIssue[];
  keywords: string[];
  rewrites: { before: string; after: string }[];
}

// "no-key" — the LLM isn't configured at all (llmAvailable()===false). "llm-failed" — a key
// IS present, but THIS particular request didn't return a valid response (timeout/provider
// error/JSON cut off by maxTokens). Both cases used to show the SAME text "Enable the LLM in
// server/.env" — which was misleading when the LLM was actually enabled and just this one
// request failed (this is exactly what the user reported: the LLM is set in .env, yet the
// message says to enable it).
type FallbackReason = "no-key" | "llm-failed";

function fallbackSummary(reason: FallbackReason): string {
  return reason === "no-key"
    ? "Basic offline check. Enable the LLM in server/.env for an in-depth personal review."
    : "The AI didn't respond in time, so a basic dictionary-based check is shown instead. Try again in a minute.";
}

function heuristicReview(cvText: string, reason: FallbackReason = "no-key"): CvReview {
  const text = cvText || "";
  const issues: CvIssue[] = [];
  if (!/\d/.test(text))
    issues.push({ title: "No numbers or results", fix: 'Add metrics: "sped up X by 40%", "cut build time from 8 to 2 min".' });
  if (!/\b(ai|llm|gpt|ml|rag|prompt|openai|anthropic)\b/i.test(text))
    issues.push({
      title: "AI experience is underdeveloped",
      fix: "Describe exactly which AI tools/features you used and what impact they had.",
    });
  if (text.length < 800)
    issues.push({ title: "Not enough detail", fix: 'Expand on your experience with bullets: "action → technology → result".' });
  if (!/\b(led|built|shipped|reduced|improved|designed|launched)\b/i.test(text)) {
    issues.push({
      title: "Few action/result verbs",
      fix: "Start bullets with strong verbs and focus on the result, not the process.",
    });
  }
  return {
    score: Math.max(30, 80 - issues.length * 12),
    summary: fallbackSummary(reason),
    strengths: [],
    issues,
    keywords: [],
    rewrites: [],
  };
}

export async function reviewCv(cvText: string): Promise<CvReview & { offline: boolean }> {
  const profile = getProfile();
  const role = profile.domain || "specialist";
  const demand = demandMap();
  if (!llmAvailable()) return { offline: true, ...heuristicReview(cvText) };
  const out = await chatJson(
    `You are an experienced technical recruiter and career coach for the role "${role}". You give honest, actionable feedback on resumes. Respond with ONLY valid JSON, in English.`,
    `Candidate's resume:\n${cvText}\n\n` +
      `Market demand (skills from job postings): ${JSON.stringify(demand)}.\n` +
      `Evaluate the resume on these principles: focus on RESULTS (not process), quantitative metrics, strong verbs, ATS keywords matching demand, specifics on AI/tools (exactly what and what impact).\n` +
      `Return JSON strictly: {"score":<0-100>,"summary":"1-2 sentence overall impression",` +
      `"strengths":["3-5 strengths"],` +
      `"issues":[{"title":"problem","fix":"how to fix it concretely"}],` +
      `"keywords":["6-12 keywords/skills worth adding to match demand and ATS"],` +
      `"rewrites":[{"before":"weak phrasing from the resume","after":"rewritten, with result and metric"}]}`,
    CvReviewSchema,
    // maxTokens 2200 (not 1200) — a review with score+summary+3-5 strengths+several issues+6-12
    // keywords+several rewrites (each: a full "before" AND "after" sentence) easily runs longer
    // than 1200 tokens; when generation is cut off by the limit the JSON stays syntactically
    // invalid and silently (HTTP 200, so the r.ok check above didn't catch it) falls back to the
    // offline heuristic — this is exactly what the reported bug looked like ("I click Advice
    // and get generic text").
    { maxTokens: 2200, temperature: 0.4, cache: true, tier: "smart" },
  );
  // offline:true (NOT false) — what follows is the same offline heuristic used when the LLM is
  // disabled (llmAvailable()===false above). A false "offline:false" here meant the client (and
  // the user) couldn't tell a genuine in-depth AI review apart from the default offline
  // fallback — this is exactly what the user's report looked like ("I click Advice and get
  // generic text, offline:false").
  if (!out) return { offline: true, ...heuristicReview(cvText, "llm-failed") };
  return { offline: false, ...out, score: Math.max(0, Math.min(100, Math.round(out.score))) };
}

// ---------- /cv/match: comparing a CV against a specific vacancy ----------
function tokenizeSkills(text: string): string[] {
  const stop = new Set(["and", "the", "for", "with", "you", "our", "der", "die", "und", "та", "і", "в", "на", "до", "з", "що", "як"]);
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .match(/[a-zа-яїєґ0-9+#.]{2,}/gi) || [],
    ),
  ).filter((t) => t.length > 2 && !stop.has(t));
}
export interface CvMatch {
  score: number;
  verdict: string;
  matched: string[];
  missing: string[];
  suggestions: { title: string; fix: string }[];
  tailoredSummary: string;
}
function heuristicMatch(cvText: string, jobText: string, reason: FallbackReason = "no-key"): CvMatch {
  const cv = new Set(tokenizeSkills(cvText));
  const jobTokens = tokenizeSkills(jobText);
  const matched = jobTokens.filter((t) => cv.has(t));
  const missing = jobTokens.filter((t) => !cv.has(t));
  const score = jobTokens.length ? Math.round((matched.length / jobTokens.length) * 100) : 0;
  return {
    score,
    verdict:
      reason === "no-key"
        ? "Basic offline keyword-based comparison. Enable the LLM for a precise gap analysis."
        : "The AI didn't respond in time, so a basic keyword-based comparison is shown instead. Try again in a minute.",
    matched: matched.slice(0, 20),
    missing: missing.slice(0, 20),
    suggestions: [],
    tailoredSummary: "",
  };
}

export async function matchCv(cvText: string, jobTitle: string, jobText: string): Promise<CvMatch & { offline: boolean }> {
  const combined = `${jobTitle}\n${jobText}`;
  if (!llmAvailable()) return { offline: true, ...heuristicMatch(cvText, combined) };
  const out = await chatJson(
    "You are a technical recruiter. You compare a candidate's resume against the requirements of a SPECIFIC vacancy and give a targeted gap analysis. Respond with ONLY valid JSON, in English. Don't invent experience that isn't in the resume.",
    `Vacancy: ${jobTitle}\nRequirements/description/stack:\n${jobText}\n\nCandidate's resume:\n${cvText}\n\n` +
      `Return JSON strictly: {"score":<0-100 how well the CV fits this vacancy>,` +
      `"verdict":"1-2 sentence verdict",` +
      `"matched":["requirements/skills the candidate already covers"],` +
      `"missing":["what's missing specifically for this vacancy (skills/keywords)"],` +
      `"suggestions":[{"title":"what to do","fix":"a concrete action for this vacancy"}],` +
      `"tailoredSummary":"a summary tailored to this vacancy, 2-3 sentences, based only on the candidate's real experience"}`,
    CvMatchSchema,
    // maxTokens 1800 (not 1000) — the same risk of generation being cut off as in reviewCv above.
    { maxTokens: 1800, temperature: 0.4, cache: true, tier: "smart" },
  );
  // Same fix as in reviewCv above: this is the offline heuristic, not an LLM result.
  if (!out) return { offline: true, ...heuristicMatch(cvText, combined, "llm-failed") };
  return { offline: false, ...out, score: Math.max(0, Math.min(100, Math.round(out.score))) };
}

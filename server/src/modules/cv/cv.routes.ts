import express from "express";
import { getProfile, setProfile, getKvJson, setKvJson } from "../../db/index.js";
import { parseLinkedInArchive } from "./linkedin-import.service.js";
import { extractSkills, detectDomain } from "../../shared/skill-extraction.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { extractText } from "./cv-extract.service.js";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { parseProfileInput } from "../../shared/validation.js";
import { uploadSingle } from "../../shared/upload.js";
import { CvDocSchema, CvPresetsSchema } from "./cv.schemas.js";
import { cvAnalysis, reviewCv, matchCv, strs } from "./cv-analysis.service.js";
import { tailorCv } from "./cv-tailor.service.js";
import { emptyCvDoc, parseCvDocFromText } from "./cv-document.service.js";

const r = express.Router();

// ---------- profile ----------
r.get(
  "/profile",
  authed(async (userId, _req, res) => res.json(await getProfile(userId))),
);
r.put(
  "/profile",
  authed(async (userId, req, res) => {
    await setProfile(userId, { ...(await getProfile(userId)), ...parseProfileInput(req.body) });
    res.json(await getProfile(userId));
  }),
);

// ---------- CV analysis against market demand ----------
r.post(
  "/cv/analyze",
  aiLimiter,
  authed(async (userId, req, res) => {
    res.json(await cvAnalysis(userId, req.body?.cvText || (await getProfile(userId)).cvText));
  }),
);

r.post(
  "/cv/upload",
  aiLimiter,
  uploadSingle("file"),
  authed(async (userId, req, res) => {
    if (!req.file) throw new HttpError(400, "No file received");
    const text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!text || text.trim().length < 20) {
      throw new HttpError(422, "Couldn't extract text from the file (it might be a scan or image).");
    }
    const profile = await getProfile(userId);
    // extractSkills and detectDomain are independent LLM calls over the same text (neither
    // reads the other's result), so we run them in parallel instead of waiting sequentially —
    // almost twice as fast for the user when uploading a CV.
    const [cvTechs, domain] = await Promise.all([extractSkills(userId, text), detectDomain(userId, text)]);
    profile.cvText = text.slice(0, 8000);
    profile.skills = Array.from(new Set([...profile.skills, ...cvTechs]));
    if (domain) profile.domain = domain;
    await setProfile(userId, profile);
    // cvAnalysis (advice based on market demand) and parseCvDocFromText (parsing into the
    // builder structure) are also independent of each other — both only read the already
    // saved profile.cvText.
    const [analysis, cvDoc] = await Promise.all([
      cvAnalysis(userId, text),
      llmAvailable() ? parseCvDocFromText(userId, profile.cvText) : Promise.resolve(null),
    ]);
    if (cvDoc) await setKvJson(userId, "cvDoc", cvDoc);
    res.json({ text: profile.cvText, skills: profile.skills, detected: cvTechs, domain: profile.domain, cvDoc, ...analysis });
  }),
);

r.post(
  "/cv/skills-update",
  aiLimiter,
  authed(async (userId, req, res) => {
    const done = strs(req.body?.completed);
    const profile = await getProfile(userId);
    const merged = Array.from(new Set([...profile.skills, ...done]));
    const role = profile.domain || "specialist";
    let text = `Skills: ${merged.join(", ")}`;
    if (llmAvailable()) {
      const llm = await chat(
        userId,
        "You write an ATS-friendly skills section for a resume.",
        `Generate a key skills section, grouped by logical topics, for the role "${role}" with skills: ${merged.join(", ")}. Concise, bullet points, in the resume's language.`,
        { maxTokens: 400, cache: true },
      );
      if (llm) text = llm;
    }
    res.json({ skills: merged, text });
  }),
);

// ---------- in-depth CV review (structured, actionable advice) ----------
r.post(
  "/cv/review",
  aiLimiter,
  authed(async (userId, req, res) => {
    const cvText = String(req.body?.cvText || (await getProfile(userId)).cvText || "").slice(0, 8000);
    if (cvText.trim().length < 30) throw new HttpError(400, "Not enough CV text to review");
    res.json(await reviewCv(userId, cvText));
  }),
);

// ---------- comparing a CV against a specific vacancy ----------
r.post(
  "/cv/match",
  aiLimiter,
  authed(async (userId, req, res) => {
    const cvText = String(req.body?.cvText || (await getProfile(userId)).cvText || "").slice(0, 8000);
    const jobTitle = String(req.body?.jobTitle || "").slice(0, 200);
    const jobText = String(req.body?.jobText || "").slice(0, 4000);
    if (cvText.trim().length < 30) throw new HttpError(400, "Not enough CV text to compare");
    if (!jobTitle.trim() && !jobText.trim()) throw new HttpError(400, "No vacancy data to compare against");
    res.json(await matchCv(userId, cvText, jobTitle, jobText));
  }),
);

// ---------- adapting the structured CV Builder doc to one specific vacancy ----------
r.post(
  "/cv/tailor",
  aiLimiter,
  authed(async (userId, req, res) => {
    const doc = CvDocSchema.parse(req.body?.doc);
    const jobTitle = String(req.body?.jobTitle || "").slice(0, 200);
    const jobText = String(req.body?.jobText || "").slice(0, 4000);
    if (!jobTitle.trim() && !jobText.trim()) throw new HttpError(400, "No vacancy data to tailor for");
    if (!doc.skills.length && !doc.experience.length && !doc.summary.trim()) throw new HttpError(400, "Fill in the CV first");
    res.json(await tailorCv(userId, doc, jobTitle, jobText));
  }),
);

// ---------- CV builder (structured resume) ----------
r.get(
  "/cv/doc",
  authed(async (userId, _req, res) => {
    const stored = await getKvJson(userId, "cvDoc");
    res.json(stored ? CvDocSchema.parse(stored) : await emptyCvDoc(userId));
  }),
);
r.put(
  "/cv/doc",
  authed(async (userId, req, res) => {
    const doc = CvDocSchema.parse(req.body);
    await setKvJson(userId, "cvDoc", doc);
    res.json(doc);
  }),
);
r.get(
  "/cv/presets",
  authed(async (userId, _req, res) => {
    res.json({ presets: CvPresetsSchema.parse(await getKvJson(userId, "cvPresets")) });
  }),
);
r.put(
  "/cv/presets",
  authed(async (userId, req, res) => {
    const presets = CvPresetsSchema.parse(req.body?.presets);
    await setKvJson(userId, "cvPresets", presets);
    res.json({ presets });
  }),
);
r.post(
  "/cv/linkedin-import",
  uploadSingle("file"),
  authed(async (userId, req, res) => {
    if (!req.file) throw new HttpError(400, "No file received");
    let parsed;
    try {
      parsed = parseLinkedInArchive(req.file.buffer);
    } catch {
      throw new HttpError(422, "Couldn't read the archive. It must be a .zip export from LinkedIn (Settings → Get a copy of your data).");
    }
    if (!parsed.name && !parsed.experience.length && !parsed.skills.length) {
      throw new HttpError(422, "No Profile.csv / Positions.csv / Skills.csv found in the archive.");
    }
    const doc = CvDocSchema.parse(parsed);
    await setKvJson(userId, "cvDoc", doc);
    const profile = await getProfile(userId);
    profile.skills = Array.from(new Set([...profile.skills, ...doc.skills]));
    if (!profile.domain && doc.title) profile.domain = doc.title.slice(0, 80);
    await setProfile(userId, profile);
    res.json({ doc });
  }),
);
r.post(
  "/cv/doc/generate",
  aiLimiter,
  authed(async (userId, req, res) => {
    const cvText = String(req.body?.cvText || (await getProfile(userId)).cvText || "").slice(0, 8000);
    if (!llmAvailable() || cvText.trim().length < 30)
      return res.json({ offline: !llmAvailable(), doc: (await getKvJson(userId, "cvDoc")) || (await emptyCvDoc(userId)) });
    const doc = await parseCvDocFromText(userId, cvText);
    await setKvJson(userId, "cvDoc", doc);
    res.json({ doc });
  }),
);
// Summary rewrite "flavors" for the AI action chips in the builder's General section — same
// endpoint/model, just a different instruction. Keys are also validated client-side but never
// trusted here: an unknown/missing style silently falls back to the plain "improve" guide.
const SUMMARY_STYLE_GUIDES: Record<string, string> = {
  improve: "Rewrite this resume summary (2-3 sentences): engaging, with a focus on results and key skills.",
  shorter: "Rewrite this resume summary in 1-2 concise sentences — cut all filler, keep only the strongest points.",
  ats: "Rewrite this resume summary to maximize ATS (resume-scanner) keyword match for the role — dense with relevant hard-skill keywords, still natural to read, 2-3 sentences.",
  technical:
    "Rewrite this resume summary with a stronger technical/engineering focus — name concrete technologies, architecture decisions, and scale (2-3 sentences).",
  leadership:
    "Rewrite this resume summary with a stronger leadership/ownership focus — mentoring, decision-making, cross-team impact (2-3 sentences).",
};
r.post(
  "/cv/improve",
  aiLimiter,
  authed(async (userId, req, res) => {
    const text = String(req.body?.text || "").trim();
    const kind = String(req.body?.kind || "bullet");
    const style = String(req.body?.style || "improve");
    if (text.length < 3) throw new HttpError(400, "Empty text");
    if (!llmAvailable()) return res.json({ text, offline: true });
    const role = (await getProfile(userId)).domain || "specialist";
    const guide =
      kind === "summary"
        ? (SUMMARY_STYLE_GUIDES[style] ?? SUMMARY_STYLE_GUIDES.improve)
        : 'Rewrite this experience bullet using the formula "strong verb → what you did → technology → measurable result". One sentence, no fluff.';
    const out = await chat(
      userId,
      `You are a resume editor for the role "${role}". Write concisely, with a focus on results, in the original language.`,
      `${guide}\n\nOriginal: ${text.slice(0, 600)}`,
      { maxTokens: 200, temperature: 0.5, cache: true, tier: "smart" },
    );
    res.json({ text: out || text });
  }),
);

export default r;

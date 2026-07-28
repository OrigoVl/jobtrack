import express from "express";
import { getProfile, setProfile, getKvJson, setKvJson } from "../../db/index.js";
import { parseLinkedInArchive } from "./linkedin-import.service.js";
import { extractSkills, detectDomain } from "../../shared/skill-extraction.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { extractText } from "./cv-extract.service.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { parseProfileInput } from "../../shared/validation.js";
import { uploadSingle } from "../../shared/upload.js";
import { CvDocSchema, CvPresetsSchema } from "./cv.schemas.js";
import { cvAnalysis, reviewCv, matchCv, strs } from "./cv-analysis.service.js";
import { emptyCvDoc, parseCvDocFromText } from "./cv-document.service.js";

const r = express.Router();

// ---------- profile ----------
r.get("/profile", (_q, res) => res.json(getProfile()));
r.put("/profile", (req, res) => {
  setProfile({ ...getProfile(), ...parseProfileInput(req.body) });
  res.json(getProfile());
});

// ---------- CV analysis against market demand ----------
r.post(
  "/cv/analyze",
  aiLimiter,
  asyncHandler(async (req, res) => {
    res.json(await cvAnalysis(req.body?.cvText || getProfile().cvText));
  }),
);

r.post(
  "/cv/upload",
  aiLimiter,
  uploadSingle("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "No file received");
    const text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!text || text.trim().length < 20) {
      throw new HttpError(422, "Couldn't extract text from the file (it might be a scan or image).");
    }
    const profile = getProfile();
    // extractSkills and detectDomain are independent LLM calls over the same text (neither
    // reads the other's result), so we run them in parallel instead of waiting sequentially —
    // almost twice as fast for the user when uploading a CV.
    const [cvTechs, domain] = await Promise.all([extractSkills(text), detectDomain(text)]);
    profile.cvText = text.slice(0, 8000);
    profile.skills = Array.from(new Set([...profile.skills, ...cvTechs]));
    if (domain) profile.domain = domain;
    setProfile(profile);
    // cvAnalysis (advice based on market demand) and parseCvDocFromText (parsing into the
    // builder structure) are also independent of each other — both only read the already
    // saved profile.cvText.
    const [analysis, cvDoc] = await Promise.all([
      cvAnalysis(text),
      llmAvailable() ? parseCvDocFromText(profile.cvText) : Promise.resolve(null),
    ]);
    if (cvDoc) setKvJson("cvDoc", cvDoc);
    res.json({ text: profile.cvText, skills: profile.skills, detected: cvTechs, domain: profile.domain, cvDoc, ...analysis });
  }),
);

r.post(
  "/cv/skills-update",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const done = strs(req.body?.completed);
    const profile = getProfile();
    const merged = Array.from(new Set([...profile.skills, ...done]));
    const role = profile.domain || "specialist";
    let text = `Skills: ${merged.join(", ")}`;
    if (llmAvailable()) {
      const llm = await chat(
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
  asyncHandler(async (req, res) => {
    const cvText = String(req.body?.cvText || getProfile().cvText || "").slice(0, 8000);
    if (cvText.trim().length < 30) throw new HttpError(400, "Not enough CV text to review");
    res.json(await reviewCv(cvText));
  }),
);

// ---------- comparing a CV against a specific vacancy ----------
r.post(
  "/cv/match",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const cvText = String(req.body?.cvText || getProfile().cvText || "").slice(0, 8000);
    const jobTitle = String(req.body?.jobTitle || "").slice(0, 200);
    const jobText = String(req.body?.jobText || "").slice(0, 4000);
    if (cvText.trim().length < 30) throw new HttpError(400, "Not enough CV text to compare");
    if (!jobTitle.trim() && !jobText.trim()) throw new HttpError(400, "No vacancy data to compare against");
    res.json(await matchCv(cvText, jobTitle, jobText));
  }),
);

// ---------- CV builder (structured resume) ----------
r.get("/cv/doc", (_q, res) => {
  const stored = getKvJson("cvDoc");
  res.json(stored ? CvDocSchema.parse(stored) : emptyCvDoc());
});
r.put("/cv/doc", (req, res) => {
  const doc = CvDocSchema.parse(req.body);
  setKvJson("cvDoc", doc);
  res.json(doc);
});
r.get("/cv/presets", (_q, res) => {
  res.json({ presets: CvPresetsSchema.parse(getKvJson("cvPresets")) });
});
r.put("/cv/presets", (req, res) => {
  const presets = CvPresetsSchema.parse(req.body?.presets);
  setKvJson("cvPresets", presets);
  res.json({ presets });
});
r.post(
  "/cv/linkedin-import",
  uploadSingle("file"),
  asyncHandler(async (req, res) => {
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
    setKvJson("cvDoc", doc);
    const profile = getProfile();
    profile.skills = Array.from(new Set([...profile.skills, ...doc.skills]));
    if (!profile.domain && doc.title) profile.domain = doc.title.slice(0, 80);
    setProfile(profile);
    res.json({ doc });
  }),
);
r.post(
  "/cv/doc/generate",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const cvText = String(req.body?.cvText || getProfile().cvText || "").slice(0, 8000);
    if (!llmAvailable() || cvText.trim().length < 30)
      return res.json({ offline: !llmAvailable(), doc: getKvJson("cvDoc") || emptyCvDoc() });
    const doc = await parseCvDocFromText(cvText);
    setKvJson("cvDoc", doc);
    res.json({ doc });
  }),
);
r.post(
  "/cv/improve",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const text = String(req.body?.text || "").trim();
    const kind = String(req.body?.kind || "bullet");
    if (text.length < 3) throw new HttpError(400, "Empty text");
    if (!llmAvailable()) return res.json({ text, offline: true });
    const role = getProfile().domain || "specialist";
    const guide =
      kind === "summary"
        ? "Rewrite this resume summary (2-3 sentences): engaging, with a focus on results and key skills."
        : 'Rewrite this experience bullet using the formula "strong verb → what you did → technology → measurable result". One sentence, no fluff.';
    const out = await chat(
      `You are a resume editor for the role "${role}". Write concisely, with a focus on results, in the original language.`,
      `${guide}\n\nOriginal: ${text.slice(0, 600)}`,
      { maxTokens: 200, temperature: 0.5, cache: true, tier: "smart" },
    );
    res.json({ text: out || text });
  }),
);

export default r;

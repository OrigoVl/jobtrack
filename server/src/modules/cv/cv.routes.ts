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

// ---------- аналіз CV відносно попиту ринку ----------
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
    if (!req.file) throw new HttpError(400, "Файл не отримано");
    const text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!text || text.trim().length < 20) {
      throw new HttpError(422, "Не вдалося витягти текст із файлу (можливо, це скан/зображення).");
    }
    const profile = getProfile();
    // extractSkills і detectDomain — незалежні LLM-виклики над тим самим текстом (жоден не
    // читає результат іншого), тож запускаємо їх паралельно замість послідовного очікування —
    // майже вдвічі швидше для юзера на завантаженні CV.
    const [cvTechs, domain] = await Promise.all([extractSkills(text), detectDomain(text)]);
    profile.cvText = text.slice(0, 8000);
    profile.skills = Array.from(new Set([...profile.skills, ...cvTechs]));
    if (domain) profile.domain = domain;
    setProfile(profile);
    // cvAnalysis (порада з попиту ринку) і parseCvDocFromText (парсинг у структуру конструктора)
    // теж незалежні одне від одного — обидва лише читають уже збережений profile.cvText.
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
    const role = profile.domain || "фахівець";
    let text = `Skills: ${merged.join(", ")}`;
    if (llmAvailable()) {
      const llm = await chat(
        "Ти пишеш ATS-friendly секцію навичок для резюме.",
        `Згенеруй секцію ключових навичок, згруповану за логічними темами, для ролі «${role}» з навичками: ${merged.join(", ")}. Стисло, буллети, мовою резюме.`,
        { maxTokens: 400, cache: true },
      );
      if (llm) text = llm;
    }
    res.json({ skills: merged, text });
  }),
);

// ---------- глибокий рев'ю CV (структуровані, дієві поради) ----------
r.post(
  "/cv/review",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const cvText = String(req.body?.cvText || getProfile().cvText || "").slice(0, 8000);
    if (cvText.trim().length < 30) throw new HttpError(400, "Замало тексту CV для рев'ю");
    res.json(await reviewCv(cvText));
  }),
);

// ---------- порівняння CV з конкретною вакансією ----------
r.post(
  "/cv/match",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const cvText = String(req.body?.cvText || getProfile().cvText || "").slice(0, 8000);
    const jobTitle = String(req.body?.jobTitle || "").slice(0, 200);
    const jobText = String(req.body?.jobText || "").slice(0, 4000);
    if (cvText.trim().length < 30) throw new HttpError(400, "Замало тексту CV для порівняння");
    if (!jobTitle.trim() && !jobText.trim()) throw new HttpError(400, "Немає даних вакансії для порівняння");
    res.json(await matchCv(cvText, jobTitle, jobText));
  }),
);

// ---------- конструктор CV (структуроване резюме) ----------
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
    if (!req.file) throw new HttpError(400, "Файл не отримано");
    let parsed;
    try {
      parsed = parseLinkedInArchive(req.file.buffer);
    } catch {
      throw new HttpError(422, "Не вдалося прочитати архів. Це має бути .zip експорт LinkedIn (Settings → Get a copy of your data).");
    }
    if (!parsed.name && !parsed.experience.length && !parsed.skills.length) {
      throw new HttpError(422, "У архіві не знайдено Profile.csv / Positions.csv / Skills.csv.");
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
    if (text.length < 3) throw new HttpError(400, "Порожній текст");
    if (!llmAvailable()) return res.json({ text, offline: true });
    const role = getProfile().domain || "фахівець";
    const guide =
      kind === "summary"
        ? "Перепиши це резюме-самарі (2-3 речення): чіпляюче, з фокусом на результатах і ключових навичках."
        : "Перепиши цей пункт досвіду за формулою «сильне дієслово → що зробив → технологія → вимірюваний результат». Одне речення, без води.";
    const out = await chat(
      `Ти редактор резюме для ролі «${role}». Пиши стисло, з фокусом на результат, мовою оригіналу.`,
      `${guide}\n\nОригінал: ${text.slice(0, 600)}`,
      { maxTokens: 200, temperature: 0.5, cache: true, tier: "smart" },
    );
    res.json({ text: out || text });
  }),
);

export default r;

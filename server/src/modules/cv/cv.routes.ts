import express from "express";
import { getKvJson, getProfile, setKvJson, setProfile } from "../../db/index.js";
import { parseLinkedInArchive } from "./linkedin-import.service.js";
import { extractSkills, detectDomain } from "../../shared/skill-extraction.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { extractText } from "./cv-extract.service.js";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { parseProfileInput } from "../../shared/validation.js";
import { uploadSingle } from "../../shared/upload.js";
import { CvDocSchema, CvPresetsSchema } from "./cv.schemas.js";
import { cvAnalysis, matchCv, strs } from "./cv-analysis.service.js";
import { startCvAuditJob, getCvAuditJob } from "./cv-audit-job.js";
import { tailorCv } from "./cv-tailor.service.js";
import { parseCvDocFromText } from "./cv-document.service.js";
import { LINKEDIN_SAVED_KEY, optimizeLinkedInProfile, parseSavedLinkedInProfile } from "./cv-linkedin.service.js";
import { isAppLocale } from "../../shared/locale.js";
import { getLocale } from "../../core/request-context.js";
import { getProfileFull, listProfiles, updateProfileDoc, updateProfilePresets } from "./cv-profiles.repo.js";
import { buildMarketContext } from "./linkedin-market.js";
import { computeDemand, demandMap, vacancyStackRows } from "../../shared/demand.js";
import { ensureProfiles, createNewProfile, duplicateProfile, renameProfileById, deleteProfileById } from "./cv-profiles.service.js";
import type { UserId } from "../../db/user-id.js";

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
  "/cv/profiles/:id/upload",
  aiLimiter,
  uploadSingle("file"),
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    const current = await requireProfile(userId, id);
    if (!req.file) throw new HttpError(400, "No file received");
    const text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!text || text.trim().length < 20) {
      throw new HttpError(422, "Couldn't extract text from the file (it might be a scan or image).", null, "CV_EXTRACT_FAILED");
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
      llmAvailable() ? parseCvDocFromText(userId, profile.cvText, current.doc.theme) : Promise.resolve(null),
    ]);
    if (cvDoc) await updateProfileDoc(userId, id, cvDoc);
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
      // No outputLocale here — this deliberately follows the RESUME's own language (already
      // instructed below), not the UI's. Same reasoning as cv-improve further down this file.
      const llm = await chat(
        userId,
        "You write an ATS-friendly skills section for a resume.",
        `Generate a key skills section, grouped by logical topics, for the role "${role}" with skills: ${merged.join(", ")}. Concise, bullet points, in the resume's language.`,
        { maxTokens: 400, cache: true, feature: "cv-skills-update" },
      );
      if (llm) text = llm;
    }
    res.json({ skills: merged, text });
  }),
);

// ---------- LinkedIn profile optimizer (headline + About — no LinkedIn API involved, just text
// the user copies themselves) ----------
r.post(
  "/cv/linkedin-optimize",
  aiLimiter,
  authed(async (userId, req, res) => {
    // Explicit target language, chosen in the UI — see optimizeLinkedInProfile's own comment for
    // why this isn't just the UI locale. That locale is only the DEFAULT (the best first guess)
    // for a caller that doesn't pass one.
    const requested = String(req.body?.language || "");
    const language = isAppLocale(requested) ? requested : getLocale();
    // The profile the candidate has on LinkedIn TODAY, pasted by hand. Optional: with it the
    // response carries an audit and the rewrite builds on what's already there; without it this
    // stays a from-scratch generator. Pasted rather than read from LinkedIn because there's no API
    // access here (see cv-linkedin.service.ts's header).
    const currentHeadline = String(req.body?.current?.headline || "").slice(0, 1000);
    const currentAbout = String(req.body?.current?.about || "").slice(0, 5000);
    const current = currentHeadline.trim() || currentAbout.trim() ? { headline: currentHeadline, about: currentAbout } : null;

    const profile = await getProfile(userId);
    const rows = await vacancyStackRows(userId);
    const context = buildMarketContext(
      profile.skills,
      computeDemand(rows),
      rows.map((r) => r.position),
    );
    // The CV Builder document is only a FALLBACK source of prose (see cvSourceText) — read it just
    // for the users whose résumé lives there instead of in profile.cvText. listProfiles (not
    // ensureProfiles) on purpose: this is a read path, it shouldn't create a CV profile as a side
    // effect. The first profile is the default one, same position ordering the Builder's tabs use.
    let doc = null;
    if (!profile.cvText.trim()) {
      const first = (await listProfiles(userId))[0];
      doc = first ? ((await getProfileFull(userId, first.id))?.doc ?? null) : null;
    }

    const result = await optimizeLinkedInProfile(userId, profile, language, context, { doc, current });
    // Persisted so the work survives navigating away — both the generated text and, more usefully,
    // the profile the user pasted in, which they'd otherwise have to fetch from LinkedIn and paste
    // again on every visit. The audit isn't stored: it's derived, and re-deriving it from a stale
    // market context would show a score that no longer matches the tracker.
    await setKvJson(userId, LINKEDIN_SAVED_KEY, {
      current: current ?? { headline: "", about: "" },
      headline: result.headline,
      about: result.about,
      savedAt: new Date().toISOString(),
    });
    res.json(result);
  }),
);

// The last generated/pasted profile, so the card comes back filled in rather than blank.
r.get(
  "/cv/linkedin-profile",
  authed(async (userId, _req, res) => {
    res.json(parseSavedLinkedInProfile(await getKvJson(userId, LINKEDIN_SAVED_KEY)));
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
    if (cvText.trim().length < 30) throw new HttpError(400, "Not enough CV text to compare", null, "CV_TEXT_TOO_SHORT");
    if (!jobTitle.trim() && !jobText.trim()) throw new HttpError(400, "No vacancy data to compare against", null, "CV_NO_VACANCY_DATA");
    res.json(await matchCv(userId, cvText, jobTitle, jobText));
  }),
);

// ---------- line-by-line audit of the structured CV Builder doc ----------
// Backgrounded (see cv-audit-job.ts): it's the longest structured LLM call in the app, so the
// route starts the job and returns immediately rather than holding the request open.
r.post(
  "/cv/audit/start",
  aiLimiter,
  authed(async (userId, req, res) => {
    const doc = CvDocSchema.parse(req.body?.doc);
    if (!doc.summary.trim() && !doc.experience.length) throw new HttpError(400, "Fill in the CV first", null, "CV_FILL_IN_FIRST");
    // The mechanical findings the client already computed and is already showing with a one-click
    // fix — passed in purely so the model doesn't spend its output repeating them. Capped and
    // truncated here rather than trusted: this is user-controllable text going into a prompt.
    const known = strs(req.body?.known)
      .slice(0, 30)
      .map((k) => k.slice(0, 200));
    // Same market context the CV analysis uses, so the audit's keyword suggestions are grounded in
    // the postings this user is actually tracking rather than in generic advice.
    const demand = await demandMap(userId);
    res.status(202).json(await startCvAuditJob(userId, doc, known, demand));
  }),
);
// Polled by the client (~every second) while an audit is running — deliberately NOT behind
// aiLimiter, same reasoning as GET /vacancies/fetch-all/status.
r.get(
  "/cv/audit/status",
  authed(async (userId, _req, res) => {
    res.json(await getCvAuditJob(userId));
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
    if (!jobTitle.trim() && !jobText.trim()) throw new HttpError(400, "No vacancy data to tailor for", null, "CV_NO_VACANCY_DATA");
    if (!doc.skills.length && !doc.experience.length && !doc.summary.trim())
      throw new HttpError(400, "Fill in the CV first", null, "CV_FILL_IN_FIRST");
    res.json(await tailorCv(userId, doc, jobTitle, jobText));
  }),
);

// ---------- CV builder (structured resume) — multiple named profiles per user ----------
async function requireProfile(userId: UserId, id: number) {
  const profile = await getProfileFull(userId, id);
  if (!profile) throw new HttpError(404, "CV profile not found", null, "CV_PROFILE_NOT_FOUND");
  return profile;
}

r.get(
  "/cv/profiles",
  authed(async (userId, _req, res) => res.json(await ensureProfiles(userId))),
);
r.post(
  "/cv/profiles",
  authed(async (userId, req, res) => res.status(201).json(await createNewProfile(userId, String(req.body?.name || "")))),
);
r.post(
  "/cv/profiles/:id/duplicate",
  authed(async (userId, req, res) => res.status(201).json(await duplicateProfile(userId, Number(req.params.id)))),
);
r.put(
  "/cv/profiles/:id",
  authed(async (userId, req, res) => res.json(await renameProfileById(userId, Number(req.params.id), String(req.body?.name || "")))),
);
r.delete(
  "/cv/profiles/:id",
  authed(async (userId, req, res) => {
    await deleteProfileById(userId, Number(req.params.id));
    res.json({ ok: true });
  }),
);
r.get(
  "/cv/profiles/:id/doc",
  authed(async (userId, req, res) => res.json((await requireProfile(userId, Number(req.params.id))).doc)),
);
r.put(
  "/cv/profiles/:id/doc",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    await requireProfile(userId, id);
    const doc = CvDocSchema.parse(req.body);
    res.json(await updateProfileDoc(userId, id, doc));
  }),
);
r.get(
  "/cv/profiles/:id/presets",
  authed(async (userId, req, res) => res.json({ presets: (await requireProfile(userId, Number(req.params.id))).presets })),
);
r.put(
  "/cv/profiles/:id/presets",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    await requireProfile(userId, id);
    const presets = CvPresetsSchema.parse(req.body?.presets);
    res.json({ presets: await updateProfilePresets(userId, id, presets) });
  }),
);
r.post(
  "/cv/profiles/:id/linkedin-import",
  uploadSingle("file"),
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    await requireProfile(userId, id);
    if (!req.file) throw new HttpError(400, "No file received");
    let parsed;
    try {
      parsed = parseLinkedInArchive(req.file.buffer);
    } catch {
      throw new HttpError(
        422,
        "Couldn't read the archive. It must be a .zip export from LinkedIn (Settings → Get a copy of your data).",
        null,
        "LINKEDIN_ARCHIVE_INVALID",
      );
    }
    if (!parsed.name && !parsed.experience.length && !parsed.skills.length) {
      throw new HttpError(422, "No Profile.csv / Positions.csv / Skills.csv found in the archive.", null, "LINKEDIN_ARCHIVE_MISSING_FILES");
    }
    const doc = CvDocSchema.parse(parsed);
    await updateProfileDoc(userId, id, doc);
    const profile = await getProfile(userId);
    profile.skills = Array.from(new Set([...profile.skills, ...doc.skills]));
    if (!profile.domain && doc.title) profile.domain = doc.title.slice(0, 80);
    await setProfile(userId, profile);
    res.json({ doc });
  }),
);
r.post(
  "/cv/profiles/:id/doc/generate",
  aiLimiter,
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    const current = await requireProfile(userId, id);
    const cvText = String(req.body?.cvText || (await getProfile(userId)).cvText || "").slice(0, 8000);
    if (!llmAvailable() || cvText.trim().length < 30) return res.json({ offline: !llmAvailable(), doc: current.doc });
    const doc = await parseCvDocFromText(userId, cvText, current.doc.theme);
    // `doc === null` means the LLM call itself failed (see parseCvDocFromText's own comment) —
    // fall back to the already-saved doc instead of persisting/returning an empty one, same as
    // the offline branch above.
    if (!doc) return res.json({ offline: true, doc: current.doc });
    await updateProfileDoc(userId, id, doc);
    res.json({ doc });
  }),
);
// Summary rewrite "flavors" for the AI action chips in the builder's General section — same
// endpoint/model, just a different instruction. Keys are also validated client-side but never
// trusted here: an unknown/missing style silently falls back to the plain "improve" guide.
// The banned openers are the ones that show up in every résumé template and carry no information —
// the first three words of a summary are the most valuable space on the page, and an external audit
// of this app's own output found "Results-driven" sitting in exactly that spot. The client's audit
// rule flags them after the fact; this stops the app from GENERATING one in the first place.
const NO_CLICHE =
  'Never open with "Results-driven", "Motivated", "Passionate", "Hard-working", "Detail-oriented", "Dynamic", "Self-starter" or any similar generic adjective. Open with the role itself.';

const SUMMARY_STYLE_GUIDES: Record<string, string> = {
  improve:
    "Rewrite this resume summary in 2-3 sentences. It must state, in this order: the role and seniority, years of experience, the primary stack, and the scope owned end-to-end. " +
    "Every sentence must carry a fact — no sentence may consist only of qualities or intentions. If the original contains a concrete, quantified achievement, keep it; never invent one.",
  shorter: "Rewrite this resume summary in 1-2 concise sentences — cut all filler, keep only the strongest points.",
  ats: "Rewrite this resume summary to maximize ATS (resume-scanner) keyword match for the role — dense with relevant hard-skill keywords, still natural to read, 2-3 sentences.",
  technical:
    "Rewrite this resume summary with a stronger technical/engineering focus — name concrete technologies, architecture decisions, and scale (2-3 sentences).",
  leadership:
    "Rewrite this resume summary with a stronger leadership/ownership focus — mentoring, decision-making, cross-team impact (2-3 sentences).",
  // Deliberately reframes rather than rewords. A CV whose strongest evidence sits in one specialty
  // gets classified as that specialist, which costs the candidate every broader role they apply
  // for — so this leads with the broad identity and presents the specialty as depth on top of it,
  // without dropping any of the specialist evidence that makes the CV strong.
  positioning:
    "Rewrite this resume summary to lead with the BROAD role the experience supports, presenting the candidate's strongest specialty as exceptional depth ON TOP of that foundation rather than as their identity. " +
    "Keep every concrete achievement; change the framing and the order, not the facts. 2-3 sentences.",
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
        ? `${SUMMARY_STYLE_GUIDES[style] ?? SUMMARY_STYLE_GUIDES.improve} ${NO_CLICHE}`
        : 'Rewrite this experience bullet using the formula "strong verb → what you did → technology → measurable result". One sentence, no fluff. ' +
          // Same anti-fabrication rule the audit prompt already carries. Without it the "measurable result"
          // instruction is an active invitation to invent a percentage, and a made-up number on a
          // résumé is worse than no number — it discredits the real ones next to it.
          "Never invent a number, a technology or an outcome that is not in the original. If the bullet would only be strong with a metric the candidate hasn't given, rewrite it without one rather than inventing it.";
    // No outputLocale here — deliberately follows the resume's OWN language (instructed below),
    // not the UI's, same as cv-skills-update above.
    const out = await chat(
      userId,
      `You are a resume editor for the role "${role}". Write concisely, with a focus on results, in the original language.`,
      `${guide}\n\nOriginal: ${text.slice(0, 600)}`,
      { maxTokens: 200, temperature: 0.5, cache: true, feature: "cv-improve" },
    );
    res.json({ text: out || text });
  }),
);

export default r;

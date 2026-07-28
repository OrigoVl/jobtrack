import express from "express";
import { getProfile } from "../../db/index.js";
import { extractTechs } from "../../shared/tech-dict.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";

const r = express.Router();

// ---------- LLM: cover letter ----------
r.post(
  "/llm/cover-letter",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const { vacancyText, company } = req.body || {};
    const profile = getProfile();
    if (!llmAvailable()) {
      return res.json({
        text: `Hello!\n\nI was interested in your vacancy${company ? " at " + company : ""}. I have 7 years of Full-Stack experience (Vue, Node.js, NestJS) and hands-on practice with AI integration. I'd be glad to discuss in more detail how I can help.\n\nBest regards, Michael`,
        offline: true,
      });
    }
    const vt = String(vacancyText || "");
    const techs = extractTechs(vt).map((t) => t.name);
    const matched = techs.filter((t) => profile.skills.includes(t));
    const text = await chat(
      "You write short, personalized cover letters in English. To the point, no cliches or filler, a warm professional tone. Don't invent facts that aren't in the resume.",
      // profile.cvText is already capped at 8000 characters on upload (/cv/upload), but we
      // add a defensive .slice here too — in case the profile was manually edited via PUT
      // /cv/profile without that cap, so we don't blow up token count/request cost.
      `Candidate's resume:\n${profile.cvText.slice(0, 8000)}\n\n` +
        `Vacancy${company ? ` (${company})` : ""}:\n${vt.slice(0, 3000)}\n\n` +
        `Vacancy technologies the candidate already has: ${matched.join(", ") || "—"}.\n` +
        `Write a cover letter (4-6 sentences): a hooking intro → 2-3 relevant experience matches against the requirements → a short closing offering to discuss further.`,
      { maxTokens: 500, temperature: 0.7, cache: true, tier: "smart" },
    );
    res.json({ text: text || "" });
  }),
);
export default r;

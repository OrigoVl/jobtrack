// LinkedIn profile optimizer (Phase 9) — generates a headline + "About" section from the
// candidate's own profile (skills/domain/CV text). No LinkedIn API integration (that needs
// OAuth/partner approval) — this only produces text the user copies into their own profile
// themselves. Same offline-fallback shape as every other AI feature in this app.
import { z } from "zod";
import { chatJson, llmAvailable } from "../../llm/index.js";
import type { UserId } from "../../db/user-id.js";
import type { Profile } from "../../db/types.js";

const LinkedInOptimizeSchema = z.object({
  headline: z.string().min(1).max(400),
  about: z.string().min(1).max(3000),
});

export interface LinkedInOptimizeResult {
  headline: string;
  about: string;
  offline: boolean;
}

/** Templated, deterministic — no LLM required. Mirrors the shape of other offline fallbacks in
 * this codebase (e.g. cv-analysis.service.ts, roadmap.routes.ts) rather than returning nothing. */
function offlineLinkedInOptimize(profile: Profile): LinkedInOptimizeResult {
  const role = profile.domain?.trim() || "Specialist";
  const topSkills = profile.skills.slice(0, 3);
  const headline = topSkills.length ? `${role} | ${topSkills.join(" · ")}` : role;
  const skillsList = profile.skills.slice(0, 6).join(", ");
  const about =
    `${role} with hands-on experience${skillsList ? ` in ${skillsList}` : ""}. ` +
    `Focused on delivering measurable results and continuously growing my skill set. ` +
    `Open to new opportunities where I can contribute and keep learning.`;
  return { headline, about, offline: true };
}

export async function optimizeLinkedInProfile(userId: UserId, profile: Profile): Promise<LinkedInOptimizeResult> {
  if (!llmAvailable()) return offlineLinkedInOptimize(profile);
  const role = profile.domain?.trim() || "specialist";
  // No outputLocale — a LinkedIn profile is written to match the candidate's OWN CV/target
  // market, same reasoning as cv.routes.ts's cv-skills-update/cv-improve (follows the resume's
  // language, not the UI's). Hardcoded to English for now, same caveat as writing.routes.ts's
  // cover letter — a real language-detection enhancement would be separate from this i18n rollout.
  const out = await chatJson(
    userId,
    "You are a career coach who writes concise, effective LinkedIn profiles. Respond ONLY with valid JSON in English.",
    `Role: ${role}. Skills: ${profile.skills.join(", ") || "—"}.\n` +
      `CV text (may be empty, use if present): ${(profile.cvText || "").slice(0, 3000)}\n\n` +
      `Write:\n` +
      `1. A LinkedIn headline (under 220 characters, no hashtags, no emoji spam) — role + top strengths.\n` +
      `2. A LinkedIn "About" section (3-5 short paragraphs, first-person, focused on impact/skills/what you're looking for — no buzzword filler).\n` +
      `Format strictly: {"headline":"...","about":"..."}`,
    LinkedInOptimizeSchema,
    { maxTokens: 700, temperature: 0.6, cache: true, tier: "smart", feature: "linkedin-optimize" },
  );
  if (!out) return offlineLinkedInOptimize(profile);
  return { ...out, offline: false };
}

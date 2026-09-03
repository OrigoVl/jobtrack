import { z } from "zod";
import { PROJECTS, type Project } from "./projects.data.js";
import { PROJECTS_UK } from "./projects.data.uk.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { getKvJson, setKvJson, type Profile } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { kbFor, catFor } from "../knowledge/knowledge-base.js";
import { hashString } from "../../shared/hash.js";
import { slugify } from "../../shared/slug.js";
import { topGapTechs } from "../../shared/demand.js";
import { ukPluralForm } from "../../shared/locale.js";
import { getLocale } from "../../core/request-context.js";
import type { AppLocale } from "../../shared/locale.js";

// Dynamic pet-project ladder: same "real gaps, not a fixed script" idea as plan21/knowledge —
// instead of the same 4 static projects for every candidate, each project is designed to bridge
// from the candidate's OWN known stack toward one of their actual top gaps (vacancy demand minus
// CV skills). Cached per user/tech/skillset (like knowledge.service.ts's kb: cache) so toggling a
// DoD checkbox afterward doesn't re-trigger generation. Falls back to the static ladder — the
// original hand-written 4-project plan — when the LLM is offline or there are no gaps to close.

const MAX_PERSONAL_PROJECTS = PROJECTS.length; // keeps the grid's card count stable either way

const PersonalProjectSchema = z.object({
  name: z.string(),
  subtitle: z.string(),
  goal: z.string(),
  tech: z.array(z.string()).min(1).max(8).catch([]),
  dod: z.array(z.string()).min(1).max(10).catch([]),
});

interface CachedProjectPayload {
  name: string;
  subtitle: string;
  goal: string;
  tech: string[];
  dod: string[];
}

const PHASE_COPY: Record<AppLocale, (tech: string, count: number) => string> = {
  en: (tech, count) => `${tech}${count ? ` · needed in ${count} ${count === 1 ? "vacancy" : "vacancies"}` : ""}`,
  uk: (tech, count) => `${tech}${count ? ` · потрібен у ${count} ${ukPluralForm(count, "вакансії", "вакансіях", "вакансіях")}` : ""}`,
};

function hashSkills(skills: string[]): string {
  return hashString([...skills].sort((a, b) => a.localeCompare(b)).join(","));
}

function buildPersonalProject(tech: string, count: number, payload: CachedProjectPayload): Project {
  const id = `p-${slugify(tech)}`;
  return {
    id,
    name: payload.name,
    subtitle: payload.subtitle,
    phase: PHASE_COPY[getLocale()](tech, count),
    tech: payload.tech,
    goal: payload.goal,
    personalized: true,
    dod: payload.dod.map((text, i) => ({ id: `${id}-dod-${i}`, text })),
  };
}

export interface DynamicProjects {
  projects: Project[];
  personalized: boolean;
}

export interface DynamicProjectsContext {
  profile: Pick<Profile, "skills" | "domain">;
  demand: Record<string, number>;
  /** gapPriorityMap()'s output — decides WHICH gaps get a project and in what order; `demand`
   * above is still used for each project's displayed vacancy count. */
  gapPriority: Record<string, number>;
}

/** Returns a pet-project ladder personalized to the candidate's real gaps, or the static ladder
 * when the LLM is offline / there's nothing left to close. */
export async function getDynamicProjects(
  userId: UserId,
  { profile, demand, gapPriority }: DynamicProjectsContext,
): Promise<DynamicProjects> {
  const staticProjects = getLocale() === "uk" ? PROJECTS_UK : PROJECTS;
  if (!llmAvailable()) return { projects: staticProjects, personalized: false };

  const skills = profile.skills || [];
  const gaps = topGapTechs(skills, gapPriority, MAX_PERSONAL_PROJECTS);
  if (gaps.length === 0) return { projects: staticProjects, personalized: false };

  const role = profile.domain || "professional";
  const projects = await Promise.all(
    gaps.map(async (tech, index): Promise<Project> => {
      const count = demand[tech] || 0;
      const cacheKey = `project:${slugify(tech)}:${hashSkills(skills)}`;
      const cached = await getKvJson<CachedProjectPayload>(userId, cacheKey);
      if (cached) return buildPersonalProject(tech, count, cached);

      // `.learn` doesn't depend on track (kbFor's track param only filters drills/cards), so
      // the default track is deliberate here — same reasoning as study.service.ts's scopeHints().
      // Skip the block entirely for an uncurated tech (catFor === null): kbFor()'s generic
      // fallback is a single "start with the docs" bullet, not real reference material.
      const scope = catFor(tech) !== null ? kbFor(tech).learn : [];
      const out = await chatJson(
        userId,
        `You design portfolio pet-project ideas for a candidate (${role}) preparing for job interviews.`,
        `The candidate already knows: ${skills.join(", ") || "—"}.\n` +
          `They need to demonstrate "${tech}"${count ? ` (required in ${count} vacancies from their tracked list)` : ""} to employers.\n` +
          `Design ONE portfolio pet-project that bridges from their familiar stack toward "${tech}" — reuse ` +
          `2-4 of their known technologies alongside it, don't propose an unrelated from-scratch stack.\n` +
          (scope.length > 0
            ? `Curated syllabus topics for "${tech}" — ground the project's goal/DoD in these where it demonstrably ` +
              `helps, don't invent unrelated facts:\n${scope.map((l) => `- ${l}`).join("\n")}\n`
            : "") +
          `Return JSON strictly in this format (no markdown):\n` +
          `{"name":"short catchy project name","subtitle":"one short tagline",` +
          `"goal":"1-2 sentences: what it proves and why it closes this specific gap",` +
          `"tech":["3-6 concrete technologies actually used, including \\"${tech}\\""],` +
          `"dod":["5-8 concrete, checkable definition-of-done items, from the core feature to deployment/README"]}`,
        PersonalProjectSchema,
        { maxTokens: 700, temperature: 0.5, tier: "smart", feature: "projects", outputLocale: "app" },
      );
      // A slot this generation couldn't fill (LLM down mid-request, malformed JSON that even
      // chatJson's repair-retry couldn't fix) still gets a real card — the matching static
      // project by position, same "never leave a blank" fallback spirit as plan21's per-day
      // fallbackTopic(). index < MAX_PERSONAL_PROJECTS === staticProjects.length, so this never
      // wraps around and duplicates a static project across two failed slots.
      // Non-null: index < MAX_PERSONAL_PROJECTS === staticProjects.length by construction.
      if (!out || out.dod.length === 0 || out.tech.length === 0) return staticProjects[index]!;

      const payload: CachedProjectPayload = { name: out.name, subtitle: out.subtitle, goal: out.goal, tech: out.tech, dod: out.dod };
      await setKvJson(userId, cacheKey, payload);
      return buildPersonalProject(tech, count, payload);
    }),
  );
  return { projects, personalized: projects.some((p) => p.personalized) };
}

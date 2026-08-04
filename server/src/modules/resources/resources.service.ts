// Turns the static guide (resources.data.ts) into a personalized view: sections that cover a
// technology actually in demand from the user's own vacancies — especially one missing from
// their profile (a "gap") — are ranked to the top and flagged, so the same static content reads
// differently for a Vue dev with a React gap than for a backend engineer missing AWS.
import { getProfile, getKvJson, setKvJson } from "../../db/index.js";
import { demandMap } from "../../shared/demand.js";
import { TECHS } from "../../shared/tech-dict.js";
import { kbFor } from "../knowledge/knowledge-base.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { hashString } from "../../shared/hash.js";
import { z } from "zod";
import type { UserId } from "../../db/user-id.js";
import { BEST_PRACTICES, PLATFORMS, CHEAT, CHECKLIST, type BestPracticeGroup, type Platform, type CheatSection } from "./resources.data.js";
import { BEST_PRACTICES_UK, PLATFORMS_UK, CHEAT_UK, CHECKLIST_UK } from "./resources.data.uk.js";

export interface Scored {
  relevance: number;
  matchedTechs: string[];
  gapTechs: string[];
}

export type RankedBestPracticeGroup = BestPracticeGroup & Scored;
export type RankedPlatform = Platform & Scored;
export type RankedCheatSection = CheatSection & Scored;
export interface ChecklistItem {
  text: string;
  relevant: boolean;
}

export interface DynamicResourcesData {
  bestPractices: RankedBestPracticeGroup[];
  platforms: RankedPlatform[];
  cheat: RankedCheatSection[];
  checklist: ChecklistItem[];
  focus: string;
}

// Reuses the SAME tech dictionary (with its aliases: "k8s"→Kubernetes, "js"→JavaScript, ...)
// that turns vacancy/CV text into `stack`/`skills` in the first place (shared/tech-dict.ts) —
// so a group titled "Node / Nest" matches "Node.js"/"NestJS" demand exactly as reliably as the
// vacancy analyzer would, instead of a second, looser keyword list drifting out of sync with it.
function matchedTechsIn(text: string): string[] {
  const found: string[] = [];
  for (const [name, def] of Object.entries(TECHS)) {
    if (def.re.test(text)) found.push(name);
  }
  return found;
}

function scoreTexts(texts: string[], demand: Record<string, number>, skillSet: Set<string>): Scored {
  const matchedSet = new Set<string>();
  for (const text of texts) for (const tech of matchedTechsIn(text)) matchedSet.add(tech);
  const matchedTechs = [...matchedSet];
  const relevance = matchedTechs.reduce((sum, tech) => sum + (demand[tech] || 0), 0);
  const gapTechs = matchedTechs.filter((tech) => (demand[tech] || 0) > 0 && !skillSet.has(tech.toLowerCase()));
  return { relevance, matchedTechs, gapTechs };
}

function rankBestPractices(groups: BestPracticeGroup[], demand: Record<string, number>, skillSet: Set<string>): RankedBestPracticeGroup[] {
  return groups
    .map((g) => ({ ...g, ...scoreTexts([g.group, ...g.links.map((l) => l.t)], demand, skillSet) }))
    .sort((a, b) => b.relevance - a.relevance); // stable (ES2019+): ties keep the guide's original order
}

function rankCheat(sections: CheatSection[], demand: Record<string, number>, skillSet: Set<string>): RankedCheatSection[] {
  return sections.map((c) => ({ ...c, ...scoreTexts([c.title, ...c.items], demand, skillSet) })).sort((a, b) => b.relevance - a.relevance);
}

// Unlike the two rankers above (which reorder the taxonomy itself — whole groups/sections),
// platform ENTRIES are reordered only WITHIN their existing group (LeetCode/Codewars/... stay
// under "Algorithms & Problems", just re-priced by relevance) — the three top-level groups
// (Algorithms, Mock Interviews, Online Editors) keep their original relative order so the page
// doesn't visually reshuffle its own section headings on every reload.
function rankPlatforms(items: Platform[], demand: Record<string, number>, skillSet: Set<string>): RankedPlatform[] {
  const groupOrder: string[] = [];
  const byGroup = new Map<string, Platform[]>();
  for (const p of items) {
    if (!byGroup.has(p.group)) {
      byGroup.set(p.group, []);
      groupOrder.push(p.group);
    }
    byGroup.get(p.group)!.push(p);
  }
  const out: RankedPlatform[] = [];
  for (const group of groupOrder) {
    const scored = byGroup
      .get(group)!
      .map((p) => ({ ...p, ...scoreTexts([p.group, p.name, p.note], demand, skillSet) }))
      .sort((a, b) => b.relevance - a.relevance);
    out.push(...scored);
  }
  return out;
}

function rankChecklist(items: string[], demand: Record<string, number>, skillSet: Set<string>): ChecklistItem[] {
  return items
    .map((text) => ({ text, ...scoreTexts([text], demand, skillSet) }))
    .sort((a, b) => b.relevance - a.relevance) // stable: gap items float up, narrative order preserved within ties
    .map(({ text, gapTechs }) => ({ text, relevant: gapTechs.length > 0 }));
}

// Real, freshly-synthesized content (not just reordering the static guide) for whichever
// technologies THIS user's own vacancies want but their profile doesn't have yet — reuses the
// roadmap's own curated knowledge base (knowledge-base.ts), so a "React" gap surfaces the exact
// same vetted links/learn bullets the Roadmap page would show for React, no LLM required (safe,
// always available offline) and no risk of a hallucinated URL.
function personalizedBestPracticeGroup(gaps: string[], isUk: boolean): RankedBestPracticeGroup | null {
  const links = gaps.flatMap((tech) =>
    kbFor(tech)
      .resources.slice(0, 2)
      .map((r) => ({ t: `${tech}: ${r.t}`, u: r.u })),
  );
  if (links.length === 0) return null;
  return {
    group: isUk ? `🎯 Для тебе: ${gaps.join(", ")}` : `🎯 For you: ${gaps.join(", ")}`,
    links,
    // Always prepended directly (see getDynamicResources), never re-sorted against the static
    // guide's relevance sums — this only needs to read as "maximally relevant", and unlike
    // Infinity, a finite number survives a JSON.stringify() round-trip to the client.
    relevance: Number.MAX_SAFE_INTEGER,
    matchedTechs: gaps,
    gapTechs: gaps,
  };
}

function personalizedCheatSection(gaps: string[], isUk: boolean): RankedCheatSection | null {
  const items = gaps.flatMap((tech) =>
    kbFor(tech)
      .learn.slice(0, 2)
      .map((l) => `${tech}: ${l}`),
  );
  if (items.length === 0) return null;
  return {
    title: isUk ? `🎯 Для тебе: ${gaps.join(", ")}` : `🎯 For you: ${gaps.join(", ")}`,
    items,
    // Always prepended directly (see getDynamicResources), never re-sorted against the static
    // guide's relevance sums — this only needs to read as "maximally relevant", and unlike
    // Infinity, a finite number survives a JSON.stringify() round-trip to the client.
    relevance: Number.MAX_SAFE_INTEGER,
    matchedTechs: gaps,
    gapTechs: gaps,
  };
}

function topGaps(demand: Record<string, number>, skillSet: Set<string>, limit = 3): string[] {
  return Object.entries(demand)
    .filter(([tech, count]) => count > 0 && !skillSet.has(tech.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tech]) => tech);
}

function staticFocus(hasDemand: boolean, gaps: string[], isUk: boolean): string {
  if (!hasDemand) {
    return isUk
      ? "Додай вакансії зі стеком технологій — тут з'явиться персональний фокус на основі реального попиту ринку."
      : "Add vacancies with a tech stack — a personal focus based on real market demand will show up here.";
  }
  if (gaps.length === 0) {
    return isUk
      ? "Прогалин проти вимог вакансій не видно — зосередься на практиці алгоритмів і мок-інтерв'ю."
      : "No major gaps detected against your vacancies — focus on algorithm practice and mock interviews.";
  }
  return isUk
    ? `Пріоритет: ${gaps.join(", ")} — ці навички часто трапляються у твоїх вакансіях, але їх ще немає в профілі.`
    : `Priority: ${gaps.join(", ")} — these show up often in your vacancies but aren't in your profile yet.`;
}

const FocusSchema = z.object({ focus: z.string().min(1) });

/** One short, LLM-personalized sentence on top of the deterministic staticFocus() fallback —
 * same shape as knowledge.service.ts's per-tech `focus`: always works offline, the LLM only
 * adds a warmer, more specific phrasing when available. Cached per-user (keyed on the exact
 * skills+gaps that produced it) so a page reload doesn't re-spend a call for the same input. */
async function getFocusNote(userId: UserId, skills: string[], domain: string | undefined, gaps: string[], isUk: boolean): Promise<string> {
  const fallback = staticFocus(gaps.length > 0 || skills.length > 0, gaps, isUk);
  if (!llmAvailable() || gaps.length === 0) return fallback;
  const cacheKey = `resources-focus:${hashString(`${[...skills].sort().join(",")}|${gaps.join(",")}`)}`;
  const cached = await getKvJson<string>(userId, cacheKey);
  if (cached) return cached;
  const out = await chatJson(
    userId,
    `You are a concise career mentor for the role "${domain || "professional"}". Respond with ONLY valid JSON.`,
    `The candidate already knows: ${skills.join(", ") || "—"}.\n` +
      `Their own vacancies most often require, but they don't have yet: ${gaps.join(", ")}.\n` +
      `Write ONE short, encouraging, concrete sentence (max 30 words) on what to prioritize studying this week and why.\n` +
      `Return JSON: {"focus":"..."}`,
    FocusSchema,
    { maxTokens: 150, temperature: 0.4, tier: "fast", feature: "resources-focus", outputLocale: "app" },
  );
  if (!out) return fallback;
  await setKvJson(userId, cacheKey, out.focus);
  return out.focus;
}

const ActionsSchema = z.object({ actions: z.array(z.string().min(1)) });

/** One short, concrete action per top gap tech (same order as `gaps`) — "build/practice this
 * week" items that don't exist in the static checklist at all, prepended to it. Deterministic
 * fallback pulls straight from the same curated `learn` bullets as the personalized sections
 * above; the LLM (when available) only makes the phrasing more specific/actionable, batched
 * into a single call for all gaps rather than one call per tech. */
async function getPersonalizedActions(
  userId: UserId,
  skills: string[],
  domain: string | undefined,
  gaps: string[],
  isUk: boolean,
): Promise<string[]> {
  const fallback = gaps.map((tech) => `${tech}: ${kbFor(tech).learn[0] ?? (isUk ? "повтори основи" : "review the fundamentals")}`);
  if (!llmAvailable() || gaps.length === 0) return fallback;
  const cacheKey = `resources-actions:${hashString(`${[...skills].sort().join(",")}|${gaps.join(",")}`)}`;
  const cached = await getKvJson<string[]>(userId, cacheKey);
  if (cached && cached.length === gaps.length) return cached;
  const out = await chatJson(
    userId,
    `You are a concise career mentor for the role "${domain || "professional"}". Respond with ONLY valid JSON.`,
    `The candidate needs to close these skill gaps, in this priority order: ${gaps.join(", ")}.\n` +
      `For EACH gap, in the SAME order, write ONE short, concrete, checklist-style action (max 18 words) — ` +
      `something specific to build or practice this week, not generic advice.\n` +
      `Return JSON: {"actions": ["...", ...]} with exactly ${gaps.length} item(s), one per gap, in order.`,
    ActionsSchema,
    { maxTokens: 250, temperature: 0.5, tier: "fast", feature: "resources-actions", outputLocale: "app" },
  );
  if (!out || out.actions.length !== gaps.length) return fallback;
  await setKvJson(userId, cacheKey, out.actions);
  return out.actions;
}

export async function getDynamicResources(userId: UserId, isUk: boolean): Promise<DynamicResourcesData> {
  const [profile, demand] = await Promise.all([getProfile(userId), demandMap(userId)]);
  const skills = profile.skills || [];
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));
  const gaps = topGaps(demand, skillSet);

  const bestPractices = rankBestPractices(isUk ? BEST_PRACTICES_UK : BEST_PRACTICES, demand, skillSet);
  const platforms = rankPlatforms(isUk ? PLATFORMS_UK : PLATFORMS, demand, skillSet);
  const cheat = rankCheat(isUk ? CHEAT_UK : CHEAT, demand, skillSet);
  const checklist = rankChecklist(isUk ? CHECKLIST_UK : CHECKLIST, demand, skillSet);
  const focus = await getFocusNote(userId, skills, profile.domain, gaps, isUk);
  const actions = await getPersonalizedActions(userId, skills, profile.domain, gaps, isUk);

  const personalizedGroup = personalizedBestPracticeGroup(gaps, isUk);
  const personalizedCheat = personalizedCheatSection(gaps, isUk);
  const personalizedChecklist: ChecklistItem[] = actions.map((text) => ({ text, relevant: true }));

  return {
    bestPractices: personalizedGroup ? [personalizedGroup, ...bestPractices] : bestPractices,
    platforms,
    cheat: personalizedCheat ? [personalizedCheat, ...cheat] : cheat,
    checklist: [...personalizedChecklist, ...checklist],
    focus,
  };
}

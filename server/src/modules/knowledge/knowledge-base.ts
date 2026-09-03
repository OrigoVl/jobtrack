import { getCards, getDrills } from "../study/tracks/index.js";
import { getLocale } from "../../core/request-context.js";
import { buildKbUk } from "./knowledge-base.uk.js";
import { DEFAULT_TRACK, type Track } from "../../shared/tracks.js";
import { SOFTWARE_KB } from "./entries/software.js";
import { DATA_KB } from "./entries/data.js";
import { DEVOPS_KB } from "./entries/devops.js";
import { QA_KB } from "./entries/qa.js";
import { PRODUCT_KB } from "./entries/product.js";
import { SYSADMIN_KB } from "./entries/sysadmin.js";
import { DESIGN_KB } from "./entries/design.js";
import { SECURITY_KB } from "./entries/security.js";
import { PM_KB } from "./entries/pm.js";
import { BA_KB } from "./entries/ba.js";

// Lazily built (not a top-level constant) — see buildKbUk()'s doc comment for why: it reads `KB`,
// defined further down in this very module, so it can only run once this module has finished
// loading. Memoized since the translated data never changes across requests.
let kbUkCache: ReturnType<typeof buildKbUk> | undefined;
function getKbUk(): ReturnType<typeof buildKbUk> {
  return (kbUkCache ??= buildKbUk());
}

export interface Resource {
  t: string;
  u: string;
  /** Marks links generated and validated by an LLM (as opposed to curated static ones). */
  ai?: boolean;
}

export interface KbEntry {
  cat: string | null;
  learn: string[];
  resources: Resource[];
}

// Knowledge base: technology -> what to learn + resources, plus a mapping to card/drill categories.
const R = (t: string, u: string): Resource => ({ t, u });
export const KB: Record<string, KbEntry> = {
  ...SOFTWARE_KB,
  ...DATA_KB,
  ...DEVOPS_KB,
  ...QA_KB,
  ...PRODUCT_KB,
  ...SYSADMIN_KB,
  ...DESIGN_KB,
  ...SECURITY_KB,
  ...PM_KB,
  ...BA_KB,
};

// Fallback for any tech OUTSIDE the ~35 curated entries above — vacancies name a much longer
// tail (specific libraries, architecture patterns, niche tools) than any hand-curated list can
// keep up with. Used to be one static, English-only, unparametrized link ("roadmap.sh" — its
// homepage, not even a search) regardless of the actual tech; every one of these three is
// parametrized by `tech` and verified to resolve without a lookup (search/listing pages, so
// there's no risk of linking a made-up specific article that 404s) — genuinely more useful for a
// pattern like "Event-driven Architecture" or a niche library like "LiveKit" than a single
// homepage link ever was. If the LLM IS available, getDynamicKnowledge (knowledge.service.ts)
// still tries to generate and validate real, specific resources first — this is only the offline/
// LLM-failed floor underneath that.
function genericEntry(tech: string, isUk: boolean): KbEntry {
  const q = encodeURIComponent(tech);
  return {
    cat: null,
    learn: [
      isUk
        ? `Основи «${tech}» — почни з офіційної документації та ресурсів нижче`
        : `${tech} fundamentals — start with the official docs and the resources below`,
    ],
    resources: [
      R(`"${tech}" — curated lists on GitHub`, `https://github.com/search?q=awesome+${q}&type=repositories`),
      R(`"${tech}" — tutorials on freeCodeCamp`, `https://www.freecodecamp.org/news/search/?query=${q}`),
      R(`"${tech}" — API/reference search on DevDocs`, `https://devdocs.io/#q=${q}`),
    ],
  };
}

export function catFor(tech: string): string | null {
  return KB[tech]?.cat ?? null;
}

// Memoized: KB is a static module-level constant, so the share count per category never changes
// at runtime — it must NOT be derived from the caller's roadmap universe, or a tech's "shared
// practice track" flag would change depending on which vacancies a given user happened to add.
let catShareCountCache: Record<string, number> | undefined;

/** How many KB technologies share this drill/card category — practice stats (drills/cards/SRS)
 * are only as specific as the category ("System Design" covers 8 technologies), so a tech's level
 * derived from a shared category needs to be flagged as such (see roadmap RoadmapNode.practiceShared). */
export function catShareCount(cat: string | null): number {
  if (!cat) return 0;
  if (!catShareCountCache) {
    const counts: Record<string, number> = {};
    for (const entry of Object.values(KB)) {
      if (!entry.cat) continue;
      counts[entry.cat] = (counts[entry.cat] || 0) + 1;
    }
    catShareCountCache = counts;
  }
  return catShareCountCache[cat] || 0;
}

export interface KnowledgeBase {
  learn: string[];
  resources: Resource[];
  drills: { q: string; lvl: string }[];
  cards: { q: string }[];
}

export function kbFor(tech: string, track: Track = DEFAULT_TRACK): KnowledgeBase {
  const locale = getLocale();
  const isUk = locale === "uk";
  const kb = isUk ? getKbUk() : KB;
  const base = kb[tech] || genericEntry(tech, isUk);
  const cat = base.cat;
  const drills = cat
    ? getDrills(locale, track)
        .filter((d) => d.cat === cat)
        .map((d) => ({ q: d.q, lvl: d.lvl }))
    : [];
  const cards = cat
    ? getCards(locale, track)
        .filter((c) => c.cat === cat)
        .map((c) => ({ q: c.q }))
    : [];
  return { learn: base.learn, resources: base.resources, drills, cards };
}

// Track-aware study content registry. The "software" track keeps using content.ts's own
// getCards/getDrills untouched (today's exact behavior for every existing profile); every other
// track is a self-contained pool here — no cross-track filtering, since a QA drill and a PM drill
// have nothing in common to share beyond the Card/DrillItem shape.
import type { AppLocale } from "../../../shared/locale.js";
import type { Track } from "../../../shared/tracks.js";
import { type Card, type DrillItem, getCards as getSoftwareCards, getDrills as getSoftwareDrills } from "../content.js";
import { QA_CARDS, QA_DRILLS } from "./qa.js";
import { QA_CARDS_UK, QA_DRILLS_UK } from "./qa.uk.js";
import { DEVOPS_CARDS, DEVOPS_DRILLS } from "./devops.js";
import { DEVOPS_CARDS_UK, DEVOPS_DRILLS_UK } from "./devops.uk.js";
import { DATA_CARDS, DATA_DRILLS } from "./data.js";
import { DATA_CARDS_UK, DATA_DRILLS_UK } from "./data.uk.js";
import { DESIGN_CARDS, DESIGN_DRILLS } from "./design.js";
import { DESIGN_CARDS_UK, DESIGN_DRILLS_UK } from "./design.uk.js";
import { PRODUCT_CARDS, PRODUCT_DRILLS } from "./product.js";
import { PRODUCT_CARDS_UK, PRODUCT_DRILLS_UK } from "./product.uk.js";
import { SECURITY_CARDS, SECURITY_DRILLS } from "./security.js";
import { SECURITY_CARDS_UK, SECURITY_DRILLS_UK } from "./security.uk.js";
import { SYSADMIN_CARDS, SYSADMIN_DRILLS } from "./sysadmin.js";
import { SYSADMIN_CARDS_UK, SYSADMIN_DRILLS_UK } from "./sysadmin.uk.js";

interface TrackPool {
  cards: Card[];
  cardsUk: Card[];
  drills: DrillItem[];
  drillsUk: DrillItem[];
}

// "software" is deliberately absent here — it's served straight from content.ts below, not from
// this registry, so it can never regress by going through a new indirection layer.
const REGISTRY: Record<Exclude<Track, "software">, TrackPool> = {
  qa: { cards: QA_CARDS, cardsUk: QA_CARDS_UK, drills: QA_DRILLS, drillsUk: QA_DRILLS_UK },
  devops: { cards: DEVOPS_CARDS, cardsUk: DEVOPS_CARDS_UK, drills: DEVOPS_DRILLS, drillsUk: DEVOPS_DRILLS_UK },
  data: { cards: DATA_CARDS, cardsUk: DATA_CARDS_UK, drills: DATA_DRILLS, drillsUk: DATA_DRILLS_UK },
  design: { cards: DESIGN_CARDS, cardsUk: DESIGN_CARDS_UK, drills: DESIGN_DRILLS, drillsUk: DESIGN_DRILLS_UK },
  product: { cards: PRODUCT_CARDS, cardsUk: PRODUCT_CARDS_UK, drills: PRODUCT_DRILLS, drillsUk: PRODUCT_DRILLS_UK },
  security: { cards: SECURITY_CARDS, cardsUk: SECURITY_CARDS_UK, drills: SECURITY_DRILLS, drillsUk: SECURITY_DRILLS_UK },
  sysadmin: { cards: SYSADMIN_CARDS, cardsUk: SYSADMIN_CARDS_UK, drills: SYSADMIN_DRILLS, drillsUk: SYSADMIN_DRILLS_UK },
};

export function getCards(locale: AppLocale, track: Track): Card[] {
  if (track === "software") return getSoftwareCards(locale);
  const pool = REGISTRY[track];
  return locale === "uk" ? pool.cardsUk : pool.cards;
}

export function getDrills(locale: AppLocale, track: Track): DrillItem[] {
  if (track === "software") return getSoftwareDrills(locale);
  const pool = REGISTRY[track];
  return locale === "uk" ? pool.drillsUk : pool.drills;
}

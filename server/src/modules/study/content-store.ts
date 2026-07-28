// Static pool of drills/cards + LLM-generated additions (stored in the kv store).
import { getKvJson } from "../../db/index.js";
import { CARDS, DRILLS, type Card, type DrillItem } from "./content.js";

export const genDrills = (): DrillItem[] => getKvJson<DrillItem[]>("genDrills") || [];
export const allDrills = (): DrillItem[] => [...DRILLS, ...genDrills()];
export const genCards = (): Card[] => getKvJson<Card[]>("genCards") || [];
export const allCards = (): Card[] => [...CARDS, ...genCards()];

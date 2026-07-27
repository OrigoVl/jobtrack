// Статичний пул drills/cards + LLM-згенеровані доповнення (зберігаються в kv-сховищі).
import { getKvJson } from "../../db/index.js";
import { CARDS, DRILLS, type Card, type DrillItem } from "./content.js";

export const genDrills = (): DrillItem[] => getKvJson<DrillItem[]>("genDrills") || [];
export const allDrills = (): DrillItem[] => [...DRILLS, ...genDrills()];
export const genCards = (): Card[] => getKvJson<Card[]>("genCards") || [];
export const allCards = (): Card[] => [...CARDS, ...genCards()];

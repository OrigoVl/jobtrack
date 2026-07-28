// Static pool of drills/cards + LLM-generated additions (stored in the kv store).
import { getKvJson } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { CARDS, DRILLS, type Card, type DrillItem } from "./content.js";

export const genDrills = async (userId: UserId): Promise<DrillItem[]> => (await getKvJson<DrillItem[]>(userId, "genDrills")) || [];
export const allDrills = async (userId: UserId): Promise<DrillItem[]> => [...DRILLS, ...(await genDrills(userId))];
export const genCards = async (userId: UserId): Promise<Card[]> => (await getKvJson<Card[]>(userId, "genCards")) || [];
export const allCards = async (userId: UserId): Promise<Card[]> => [...CARDS, ...(await genCards(userId))];

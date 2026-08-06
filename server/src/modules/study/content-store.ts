// Static pool of drills/cards + LLM-generated additions (stored in the kv store).
import { getKvJson, getProfile } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { getLocale } from "../../core/request-context.js";
import type { Card, DrillItem } from "./content.js";
import { getCards, getDrills } from "./tracks/index.js";
import { effectiveTrack, type Track } from "../../shared/tracks.js";

export const genDrills = async (userId: UserId): Promise<DrillItem[]> => (await getKvJson<DrillItem[]>(userId, "genDrills")) || [];
export const genCards = async (userId: UserId): Promise<Card[]> => (await getKvJson<Card[]>(userId, "genCards")) || [];

/** Resolves the user's effective content track from their profile — call sites that need
 * allDrills/allCards more than once per request should resolve this once and reuse it, rather
 * than re-reading the profile per call. */
export async function trackFor(userId: UserId): Promise<Track> {
  return effectiveTrack(await getProfile(userId));
}

export const allDrills = async (userId: UserId, track: Track): Promise<DrillItem[]> => [
  ...getDrills(getLocale(), track),
  ...(await genDrills(userId)),
];
export const allCards = async (userId: UserId, track: Track): Promise<Card[]> => [
  ...getCards(getLocale(), track),
  ...(await genCards(userId)),
];

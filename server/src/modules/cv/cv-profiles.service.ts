// Business logic for the CV Builder's multiple-profiles feature: bootstrapping a first profile
// for accounts that don't have one yet, and the create/duplicate/rename/delete rules (cap,
// "can't delete your only profile") that don't belong in the thin routes layer.
import { HttpError } from "../../core/http.js";
import type { UserId } from "../../db/user-id.js";
import { emptyCvDoc } from "./cv-document.service.js";
import {
  countProfiles,
  createProfile,
  deleteProfile,
  getProfileFull,
  listProfiles,
  renameProfile,
  type CvProfileFull,
  type CvProfileSummary,
} from "./cv-profiles.repo.js";

// Not a DB constraint (see cv_profiles' schema comment for why the table itself is uncapped) —
// an app-level limit, same "cap enforced in code, not a check constraint" choice already made for
// e.g. CvContactLinksSchema's array sizes.
export const MAX_CV_PROFILES = 5;

/** Every profile-scoped route calls this first — bootstraps a first, empty profile for accounts
 * that have never had one (brand new users, or accounts that never opened CV Builder before this
 * feature shipped). Existing single-profile users were already migrated into their own
 * `cv_profiles` row by a one-off script (see server/scripts/migrate-cv-profiles.ts), so this
 * never needs to look at the old user_kv "cvDoc" key. */
export async function ensureProfiles(userId: UserId): Promise<CvProfileSummary[]> {
  const profiles = await listProfiles(userId);
  if (profiles.length > 0) return profiles;
  await createProfile(userId, { name: "CV 1", doc: await emptyCvDoc(userId), presets: [], position: 0 });
  return listProfiles(userId);
}

export async function createNewProfile(userId: UserId, name: string): Promise<CvProfileFull> {
  const count = await countProfiles(userId);
  if (count >= MAX_CV_PROFILES) throw new HttpError(400, `You can have up to ${MAX_CV_PROFILES} CV profiles`, null, "CV_PROFILE_LIMIT");
  const trimmed = name.trim().slice(0, 60) || `CV ${count + 1}`;
  return createProfile(userId, { name: trimmed, doc: await emptyCvDoc(userId), presets: [], position: count });
}

export async function duplicateProfile(userId: UserId, id: number): Promise<CvProfileFull> {
  const count = await countProfiles(userId);
  if (count >= MAX_CV_PROFILES) throw new HttpError(400, `You can have up to ${MAX_CV_PROFILES} CV profiles`, null, "CV_PROFILE_LIMIT");
  const src = await getProfileFull(userId, id);
  if (!src) throw new HttpError(404, "CV profile not found", null, "CV_PROFILE_NOT_FOUND");
  return createProfile(userId, { name: `${src.name} copy`.slice(0, 60), doc: src.doc, presets: src.presets, position: count });
}

export async function renameProfileById(userId: UserId, id: number, name: string): Promise<CvProfileSummary> {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new HttpError(400, "Name can't be empty", null, "CV_PROFILE_NAME_EMPTY");
  const row = await renameProfile(userId, id, trimmed);
  if (!row) throw new HttpError(404, "CV profile not found", null, "CV_PROFILE_NOT_FOUND");
  return row;
}

export async function deleteProfileById(userId: UserId, id: number): Promise<void> {
  const count = await countProfiles(userId);
  if (count <= 1) throw new HttpError(400, "Can't delete your only CV profile", null, "CV_PROFILE_LAST_ONE");
  const deleted = await deleteProfile(userId, id);
  if (!deleted) throw new HttpError(404, "CV profile not found", null, "CV_PROFILE_NOT_FOUND");
}

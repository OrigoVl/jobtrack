// Unit tests for the business rules around CV profiles (cap enforcement, "can't delete your only
// profile", name trimming/fallback) — the repo itself is mocked, its own scoping guarantees are
// proven separately in cv-profiles.repo.test.ts (PGlite).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./cv-document.service.js", () => ({ emptyCvDoc: vi.fn(async () => ({ name: "" }) as never) }));
vi.mock("./cv-profiles.repo.js", () => ({
  listProfiles: vi.fn(),
  countProfiles: vi.fn(),
  createProfile: vi.fn(),
  getProfileFull: vi.fn(),
  renameProfile: vi.fn(),
  deleteProfile: vi.fn(),
}));

import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import { listProfiles, countProfiles, createProfile, getProfileFull, renameProfile, deleteProfile } from "./cv-profiles.repo.js";
import {
  MAX_CV_PROFILES,
  createNewProfile,
  deleteProfileById,
  duplicateProfile,
  ensureProfiles,
  renameProfileById,
} from "./cv-profiles.service.js";

const userId = BOOTSTRAP_USER_ID;

describe("cv-profiles.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("ensureProfiles()", () => {
    it("returns existing profiles as-is when the user already has some", async () => {
      const existing = [{ id: 1, name: "CV 1", position: 0, updatedAt: "x" }];
      vi.mocked(listProfiles).mockResolvedValue(existing);
      expect(await ensureProfiles(userId)).toBe(existing);
      expect(createProfile).not.toHaveBeenCalled();
    });

    it("bootstraps one empty default profile when the user has none yet", async () => {
      vi.mocked(listProfiles)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 5, name: "CV 1", position: 0, updatedAt: "x" }]);
      const result = await ensureProfiles(userId);
      expect(createProfile).toHaveBeenCalledWith(userId, expect.objectContaining({ name: "CV 1", position: 0 }));
      expect(result).toEqual([{ id: 5, name: "CV 1", position: 0, updatedAt: "x" }]);
    });
  });

  describe("createNewProfile()", () => {
    it("creates a profile at the next position with the given name", async () => {
      vi.mocked(countProfiles).mockResolvedValue(2);
      vi.mocked(createProfile).mockResolvedValue({ id: 9, name: "Backend", position: 2, updatedAt: "x", doc: {} as never, presets: [] });
      const result = await createNewProfile(userId, "Backend");
      expect(createProfile).toHaveBeenCalledWith(userId, expect.objectContaining({ name: "Backend", position: 2 }));
      expect(result.id).toBe(9);
    });

    it("falls back to a numbered name when none is given", async () => {
      vi.mocked(countProfiles).mockResolvedValue(1);
      vi.mocked(createProfile).mockResolvedValue({ id: 2, name: "CV 2", position: 1, updatedAt: "x", doc: {} as never, presets: [] });
      await createNewProfile(userId, "   ");
      expect(createProfile).toHaveBeenCalledWith(userId, expect.objectContaining({ name: "CV 2" }));
    });

    it("throws CV_PROFILE_LIMIT once the user is already at the cap, without creating anything", async () => {
      vi.mocked(countProfiles).mockResolvedValue(MAX_CV_PROFILES);
      await expect(createNewProfile(userId, "One more")).rejects.toMatchObject({ code: "CV_PROFILE_LIMIT" });
      expect(createProfile).not.toHaveBeenCalled();
    });
  });

  describe("duplicateProfile()", () => {
    it("copies the source profile's doc/presets under a 'copy' name at the next position", async () => {
      vi.mocked(countProfiles).mockResolvedValue(1);
      vi.mocked(getProfileFull).mockResolvedValue({
        id: 1,
        name: "Backend",
        position: 0,
        updatedAt: "x",
        doc: { name: "Ada" } as never,
        presets: [],
      });
      vi.mocked(createProfile).mockResolvedValue({
        id: 2,
        name: "Backend copy",
        position: 1,
        updatedAt: "x",
        doc: { name: "Ada" } as never,
        presets: [],
      });
      const result = await duplicateProfile(userId, 1);
      expect(createProfile).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ name: "Backend copy", doc: { name: "Ada" }, position: 1 }),
      );
      expect(result.name).toBe("Backend copy");
    });

    it("404s when the source profile doesn't exist / isn't this user's", async () => {
      vi.mocked(countProfiles).mockResolvedValue(1);
      vi.mocked(getProfileFull).mockResolvedValue(undefined);
      await expect(duplicateProfile(userId, 999)).rejects.toMatchObject({ code: "CV_PROFILE_NOT_FOUND" });
    });

    it("throws CV_PROFILE_LIMIT at the cap without even reading the source profile", async () => {
      vi.mocked(countProfiles).mockResolvedValue(MAX_CV_PROFILES);
      await expect(duplicateProfile(userId, 1)).rejects.toMatchObject({ code: "CV_PROFILE_LIMIT" });
      expect(getProfileFull).not.toHaveBeenCalled();
    });
  });

  describe("renameProfileById()", () => {
    it("trims and caps the name before saving", async () => {
      vi.mocked(renameProfile).mockResolvedValue({ id: 1, name: "Trimmed", position: 0, updatedAt: "x" });
      await renameProfileById(userId, 1, "  Trimmed  ");
      expect(renameProfile).toHaveBeenCalledWith(userId, 1, "Trimmed");
    });

    it("rejects an empty/whitespace-only name", async () => {
      await expect(renameProfileById(userId, 1, "   ")).rejects.toMatchObject({ code: "CV_PROFILE_NAME_EMPTY" });
      expect(renameProfile).not.toHaveBeenCalled();
    });

    it("404s when the profile doesn't exist / isn't this user's", async () => {
      vi.mocked(renameProfile).mockResolvedValue(undefined);
      await expect(renameProfileById(userId, 999, "New name")).rejects.toMatchObject({ code: "CV_PROFILE_NOT_FOUND" });
    });
  });

  describe("deleteProfileById()", () => {
    it("deletes when the user has more than one profile", async () => {
      vi.mocked(countProfiles).mockResolvedValue(2);
      vi.mocked(deleteProfile).mockResolvedValue(1);
      await expect(deleteProfileById(userId, 1)).resolves.toBeUndefined();
      expect(deleteProfile).toHaveBeenCalledWith(userId, 1);
    });

    it("refuses to delete the user's only profile", async () => {
      vi.mocked(countProfiles).mockResolvedValue(1);
      await expect(deleteProfileById(userId, 1)).rejects.toMatchObject({ code: "CV_PROFILE_LAST_ONE" });
      expect(deleteProfile).not.toHaveBeenCalled();
    });

    it("404s when the profile doesn't exist / isn't this user's", async () => {
      vi.mocked(countProfiles).mockResolvedValue(2);
      vi.mocked(deleteProfile).mockResolvedValue(0);
      await expect(deleteProfileById(userId, 999)).rejects.toMatchObject({ code: "CV_PROFILE_NOT_FOUND" });
    });
  });
});

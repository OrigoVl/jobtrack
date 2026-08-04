import { afterEach, describe, expect, it } from "vitest";
import { statusKey, statusLabel } from "./status-labels";
import { STATUSES } from "./types";
import i18n from "../i18n";
import en from "../i18n/locales/en/common.json";
import uk from "../i18n/locales/uk/common.json";

describe("statusKey", () => {
  it("maps every persisted VacancyStatus to a key present in both locale files", () => {
    for (const status of STATUSES) {
      const key = statusKey(status);
      expect(en.vacancyStatus).toHaveProperty(key);
      expect(uk.vacancyStatus).toHaveProperty(key);
    }
  });

  it("falls back to the raw value for an unrecognized status instead of throwing", () => {
    expect(statusKey("Some Future Status")).toBe("Some Future Status");
  });
});

describe("statusLabel", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates every persisted VacancyStatus in both locales, matching the JSON files exactly", async () => {
    for (const status of STATUSES) {
      const key = statusKey(status);
      await i18n.changeLanguage("en");
      expect(statusLabel(status)).toBe((en.vacancyStatus as Record<string, string>)[key]);
      await i18n.changeLanguage("uk");
      expect(statusLabel(status)).toBe((uk.vacancyStatus as Record<string, string>)[key]);
    }
  });

  it("falls back to the raw status string for an unrecognized value instead of a literal i18next key", () => {
    expect(statusLabel("Some Future Status")).toBe("Some Future Status");
  });
});

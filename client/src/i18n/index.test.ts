import { afterEach, describe, expect, it } from "vitest";
import i18n from "./index";

describe("i18n bootstrap", () => {
  afterEach(async () => {
    // This module is a singleton (imported once by test/setup.ts for the whole suite) — reset it
    // back to the default so a language change in one test can't leak into another test file.
    await i18n.changeLanguage("en");
  });

  it("defaults to English and resolves a key from the common namespace", () => {
    expect(i18n.language).toBe("en");
    expect(i18n.t("actions.save")).toBe("Save");
  });

  it("switches every already-loaded namespace when the language changes", async () => {
    await i18n.changeLanguage("uk");
    expect(i18n.t("actions.save")).toBe("Зберегти");
  });

  it("updates <html lang> when the language changes", async () => {
    await i18n.changeLanguage("uk");
    expect(document.documentElement.lang).toBe("uk");
  });
});

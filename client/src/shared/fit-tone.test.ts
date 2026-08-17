import { afterEach, describe, expect, it } from "vitest";
import { fitLabel, fitText, fitTone } from "./fit-tone";
import i18n from "../i18n";
import en from "../i18n/locales/en/common.json";
import uk from "../i18n/locales/uk/common.json";

// "med" was moved off the brand indigo onto the shared stoplight-amber "progress" token so it
// reads consistently with resume-completeness's own mid-tier and roadmap.tsx's mid-state — this
// pins that mapping so a future rebrand can't silently reintroduce two different "medium" colors.
describe("fitTone", () => {
  it("maps med to the shared 'progress' tone, not the brand accent", () => {
    expect(fitTone.med).toBe("progress");
  });

  it("maps high to good and low to rose", () => {
    expect(fitTone.high).toBe("good");
    expect(fitTone.low).toBe("rose");
  });
});

describe("fitText", () => {
  it("maps med to the progress text color, not the brand signal color", () => {
    expect(fitText.med).toBe("text-progress");
  });

  it("maps high to the good text color and low to the rose text color", () => {
    expect(fitText.high).toBe("text-good");
    expect(fitText.low).toBe("text-rose-600");
  });
});

describe("fitLabel", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates every Fit value in both locales, matching the JSON files exactly", async () => {
    for (const fit of ["high", "med", "low"] as const) {
      await i18n.changeLanguage("en");
      expect(fitLabel(fit)).toBe(en.fit[fit]);
      await i18n.changeLanguage("uk");
      expect(fitLabel(fit)).toBe(uk.fit[fit]);
    }
  });
});

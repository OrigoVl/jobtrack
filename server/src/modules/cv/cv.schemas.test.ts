import { describe, expect, it } from "vitest";
import { CvDocSchema, CvThemeSchema, CvPresetsSchema, CV_SECTIONS } from "./cv.schemas.js";

describe("CvThemeSchema", () => {
  it("fills every field with defaults when given nothing", () => {
    expect(CvThemeSchema.parse(undefined)).toEqual({
      template: "classic",
      accent: "#4f46e5",
      font: "sans",
      scale: 1,
      order: CV_SECTIONS,
      showPhoto: true,
      photoShape: "circle",
      photoPos: "left",
    });
  });

  it("keeps valid values untouched", () => {
    const out = CvThemeSchema.parse({
      template: "twocol",
      accent: "#00FF00",
      font: "serif",
      scale: 1.2,
      photoShape: "square",
      photoPos: "right",
    });
    expect(out.template).toBe("twocol");
    expect(out.accent).toBe("#00FF00");
    expect(out.font).toBe("serif");
    expect(out.scale).toBe(1.2);
    expect(out.photoShape).toBe("square");
    expect(out.photoPos).toBe("right");
  });

  it("falls back to defaults for garbage enum/color values", () => {
    const out = CvThemeSchema.parse({ template: "hax", accent: "not-a-color", font: "comic-sans", photoShape: "triangle", photoPos: "up" });
    expect(out.template).toBe("classic");
    expect(out.accent).toBe("#4f46e5");
    expect(out.font).toBe("sans");
    expect(out.photoShape).toBe("circle");
    expect(out.photoPos).toBe("left");
  });

  it("clamps scale into [0.8, 1.3] and rejects non-finite values", () => {
    expect(CvThemeSchema.parse({ scale: 5 }).scale).toBe(1.3);
    expect(CvThemeSchema.parse({ scale: 0.1 }).scale).toBe(0.8);
    expect(CvThemeSchema.parse({ scale: "not-a-number" }).scale).toBe(1);
    expect(CvThemeSchema.parse({ scale: Infinity }).scale).toBe(1);
  });

  it("treats showPhoto as true unless explicitly false", () => {
    expect(CvThemeSchema.parse({}).showPhoto).toBe(true);
    expect(CvThemeSchema.parse({ showPhoto: false }).showPhoto).toBe(false);
    expect(CvThemeSchema.parse({ showPhoto: "false" }).showPhoto).toBe(true);
  });

  it("dedupes order and appends missing sections in default order", () => {
    const out = CvThemeSchema.parse({ order: ["skills", "skills", "bogus", "summary"] });
    expect(out.order).toEqual(["skills", "summary", "experience", "projects", "education", "languages"]);
  });
});

describe("CvDocSchema", () => {
  it("produces an empty-but-safe doc from an empty object", () => {
    const doc = CvDocSchema.parse({});
    expect(doc).toMatchObject({
      name: "",
      title: "",
      contact: "",
      summary: "",
      photo: "",
      skills: [],
      experience: [],
      education: [],
      projects: [],
      languages: [],
    });
  });

  it("truncates long strings and caps array sizes", () => {
    const doc = CvDocSchema.parse({ name: "x".repeat(200), skills: Array.from({ length: 100 }, (_, i) => `skill${i}`) });
    expect(doc.name).toHaveLength(120);
    expect(doc.skills).toHaveLength(60);
  });

  it("caps experience entries at 20 and sanitizes nested fields", () => {
    const experience = Array.from({ length: 25 }, (_, i) => ({
      role: `role${i}`,
      company: `co${i}`,
      period: "2020",
      bullets: [1, "ok", null],
    }));
    const doc = CvDocSchema.parse({ experience });
    expect(doc.experience).toHaveLength(20);
    expect(doc.experience[0].bullets).toEqual(["ok"]);
  });

  it("rejects a malformed photo data URL but keeps a valid one", () => {
    expect(CvDocSchema.parse({ photo: "not-a-data-url" }).photo).toBe("");
    const valid = "data:image/png;base64,aGVsbG8=";
    expect(CvDocSchema.parse({ photo: valid }).photo).toBe(valid);
  });

  it("sanitizes languages: trims, requires a name, caps at 12", () => {
    const languages: Array<{ name?: string; level: string }> = Array.from({ length: 15 }, (_, i) => ({
      name: `  Lang${i}  `,
      level: "B2",
    }));
    languages.push({ level: "C1" }); // no name -> dropped
    const doc = CvDocSchema.parse({ languages });
    expect(doc.languages).toHaveLength(12);
    expect(doc.languages[0]).toEqual({ name: "Lang0", level: "B2" });
  });

  it("never throws on garbage input", () => {
    expect(() => CvDocSchema.parse(null)).not.toThrow();
    expect(() => CvDocSchema.parse("not-an-object")).not.toThrow();
    expect(() => CvDocSchema.parse(42)).not.toThrow();
  });
});

describe("CvPresetsSchema", () => {
  it("returns an empty array for non-array input", () => {
    expect(CvPresetsSchema.parse(null)).toEqual([]);
    expect(CvPresetsSchema.parse("nope")).toEqual([]);
  });

  it("dedupes preset names case-insensitively and caps at 20", () => {
    const presets = [
      { name: "Blue", theme: { accent: "#0000ff" } },
      { name: "blue", theme: { accent: "#123456" } },
      { name: "  ", theme: {} },
    ];
    const out = CvPresetsSchema.parse(presets);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Blue");
    expect(out[0].theme.accent).toBe("#0000ff");
  });
});

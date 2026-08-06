import { describe, expect, it } from "vitest";
import {
  CvAwardsSchema,
  CvCertificationsSchema,
  CvContactLinksSchema,
  CvDocSchema,
  CvEducationSchema,
  CvProjectsSchema,
  CvPublicationsSchema,
  CvReferencesSchema,
  CvThemeSchema,
  CvPresetsSchema,
  CvVolunteerSchema,
  CV_SECTIONS,
} from "./cv.schemas.js";

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
    expect(out.order).toEqual([
      "skills",
      "summary",
      "experience",
      "projects",
      "education",
      "certifications",
      "languages",
      "awards",
      "publications",
      "volunteer",
      "references",
    ]);
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
      awards: [],
      publications: [],
      volunteer: [],
      references: [],
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
    expect(doc.experience[0]?.bullets).toEqual(["ok"]);
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

describe("CvEducationSchema", () => {
  it("coerces pre-existing plain-string entries into { school, degree: '', period: '' }", () => {
    // Every education entry saved before this field became structured is a bare string in
    // user_kv — GET /cv/doc re-validates stored data through this schema on every read, so this
    // is the actual backward-compat path for old accounts, not just a defensive edge case.
    expect(CvEducationSchema.parse(["BSc Computer Science, MIT, 2016 – 2020"])).toEqual([
      { school: "BSc Computer Science, MIT, 2016 – 2020", degree: "", period: "" },
    ]);
  });

  it("passes already-structured entries through, trimming/capping fields", () => {
    const entries = [{ school: "x".repeat(300), degree: "y".repeat(300), period: "z".repeat(100) }];
    const out = CvEducationSchema.parse(entries);
    expect(out[0]?.school).toHaveLength(200);
    expect(out[0]?.degree).toHaveLength(160);
    expect(out[0]?.period).toHaveLength(60);
  });

  it("drops entries with every field blank, caps at 20, and never throws on garbage", () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({ school: `School ${i}`, degree: "", period: "" }));
    expect(CvEducationSchema.parse(entries)).toHaveLength(20);
    expect(CvEducationSchema.parse([{ school: "", degree: "", period: "" }, "   "])).toEqual([{ school: "   ", degree: "", period: "" }]);
    expect(() => CvEducationSchema.parse(null)).not.toThrow();
    expect(CvEducationSchema.parse(null)).toEqual([]);
  });
});

describe("CvProjectsSchema", () => {
  it("coerces pre-existing plain-string entries into { title, description: '', tech: [], link: '' }", () => {
    expect(CvProjectsSchema.parse(["Side Project — a thing I built"])).toEqual([
      { title: "Side Project — a thing I built", description: "", tech: [], link: "" },
    ]);
  });

  it("passes already-structured entries through, trimming/capping fields", () => {
    const out = CvProjectsSchema.parse([
      { title: "x".repeat(300), description: "y".repeat(600), tech: ["React", "Node", 42, null], link: "z".repeat(400) },
    ]);
    expect(out[0]?.title).toHaveLength(200);
    expect(out[0]?.description).toHaveLength(500);
    expect(out[0]?.tech).toEqual(["React", "Node"]);
    expect(out[0]?.link).toHaveLength(300);
  });

  it("drops entries with every field blank and never throws on garbage", () => {
    expect(CvProjectsSchema.parse([{ title: "", description: "", tech: [], link: "" }])).toEqual([]);
    expect(() => CvProjectsSchema.parse(null)).not.toThrow();
    expect(CvProjectsSchema.parse(null)).toEqual([]);
  });
});

describe("CvCertificationsSchema", () => {
  it("sanitizes fields, caps at 20, drops all-blank entries, and never throws on garbage", () => {
    const out = CvCertificationsSchema.parse([
      { name: "AWS Certified Developer", issuer: "Amazon", date: "2023" },
      { name: "", issuer: "", date: "" },
    ]);
    expect(out).toEqual([{ name: "AWS Certified Developer", issuer: "Amazon", date: "2023" }]);
    expect(() => CvCertificationsSchema.parse(null)).not.toThrow();
    expect(CvCertificationsSchema.parse(null)).toEqual([]);
    expect(CvCertificationsSchema.parse(Array.from({ length: 25 }, (_, i) => ({ name: `Cert ${i}` })))).toHaveLength(20);
  });
});

describe("CvAwardsSchema", () => {
  it("sanitizes fields, caps at 20, drops all-blank entries, and never throws on garbage", () => {
    const out = CvAwardsSchema.parse([
      { title: "Employee of the Year", issuer: "Acme Corp", date: "2023" },
      { title: "", issuer: "", date: "" },
    ]);
    expect(out).toEqual([{ title: "Employee of the Year", issuer: "Acme Corp", date: "2023" }]);
    expect(() => CvAwardsSchema.parse(null)).not.toThrow();
    expect(CvAwardsSchema.parse(null)).toEqual([]);
    expect(CvAwardsSchema.parse(Array.from({ length: 25 }, (_, i) => ({ title: `Award ${i}` })))).toHaveLength(20);
  });
});

describe("CvPublicationsSchema", () => {
  it("sanitizes fields, caps at 20, drops all-blank entries, and never throws on garbage", () => {
    const out = CvPublicationsSchema.parse([
      { title: "Scaling Postgres", publisher: "Acme Blog", date: "2024", url: "acme.com/blog/scaling" },
      { title: "", publisher: "", date: "", url: "" },
    ]);
    expect(out).toEqual([{ title: "Scaling Postgres", publisher: "Acme Blog", date: "2024", url: "acme.com/blog/scaling" }]);
    expect(() => CvPublicationsSchema.parse(null)).not.toThrow();
    expect(CvPublicationsSchema.parse(null)).toEqual([]);
    expect(CvPublicationsSchema.parse(Array.from({ length: 25 }, (_, i) => ({ title: `Paper ${i}` })))).toHaveLength(20);
  });
});

describe("CvVolunteerSchema", () => {
  it("sanitizes fields, caps at 20, drops all-blank entries, and never throws on garbage", () => {
    const out = CvVolunteerSchema.parse([
      { role: "Mentor", organization: "Code Club", period: "2021 – 2022", description: "Taught JS basics." },
      { role: "", organization: "", period: "", description: "" },
    ]);
    expect(out).toEqual([{ role: "Mentor", organization: "Code Club", period: "2021 – 2022", description: "Taught JS basics." }]);
    expect(() => CvVolunteerSchema.parse(null)).not.toThrow();
    expect(CvVolunteerSchema.parse(null)).toEqual([]);
    expect(CvVolunteerSchema.parse(Array.from({ length: 25 }, (_, i) => ({ role: `Role ${i}` })))).toHaveLength(20);
  });
});

describe("CvReferencesSchema", () => {
  it("sanitizes fields, caps at 10 (not 20 — references are a short list), drops all-blank entries, and never throws on garbage", () => {
    const out = CvReferencesSchema.parse([
      { name: "Jane Smith", relation: "Manager at Acme", contact: "jane@acme.com" },
      { name: "", relation: "", contact: "" },
    ]);
    expect(out).toEqual([{ name: "Jane Smith", relation: "Manager at Acme", contact: "jane@acme.com" }]);
    expect(() => CvReferencesSchema.parse(null)).not.toThrow();
    expect(CvReferencesSchema.parse(null)).toEqual([]);
    expect(CvReferencesSchema.parse(Array.from({ length: 15 }, (_, i) => ({ name: `Person ${i}` })))).toHaveLength(10);
  });
});

describe("CvContactLinksSchema", () => {
  it("sanitizes fields, caps at 10, drops all-blank entries, and never throws on garbage", () => {
    const out = CvContactLinksSchema.parse([
      { label: "LinkedIn", url: "linkedin.com/in/me" },
      { label: "", url: "" },
    ]);
    expect(out).toEqual([{ label: "LinkedIn", url: "linkedin.com/in/me" }]);
    expect(() => CvContactLinksSchema.parse(null)).not.toThrow();
    expect(CvContactLinksSchema.parse(null)).toEqual([]);
    expect(CvContactLinksSchema.parse(Array.from({ length: 15 }, (_, i) => ({ label: `Link ${i}`, url: "x" })))).toHaveLength(10);
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
    expect(out[0]?.name).toBe("Blue");
    expect(out[0]?.theme.accent).toBe("#0000ff");
  });
});

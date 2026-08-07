import { describe, expect, it } from "vitest";
import {
  parseVacancyInput,
  parseJsonVacancyItem,
  parseProfileInput,
  parseSkillLevelInput,
  parseWeeklyApplyGoalInput,
  parseInterviewTurnInput,
  parseCompanyInput,
  parseContactInput,
  parseEnrichmentQuery,
  parsePagination,
  parseDesignGenerateTaskInput,
  parseDesignGradeInput,
  parseDesignHelpInput,
  assertSafeVacancyUrl,
  STATUSES,
  FITS,
} from "./validation.js";
import { HttpError } from "../core/http.js";

describe("parseVacancyInput", () => {
  it("fills defaults for a full (non-partial) payload", () => {
    const out = parseVacancyInput({ position: "Backend Developer" });
    expect(out.company).toBe("New");
    expect(out.status).toBe(STATUSES[0]);
    expect(out.fit).toBe("med");
    expect(out.stack).toEqual([]);
  });

  it("trims, dedupes and caps the stack array", () => {
    const out = parseVacancyInput({ stack: ["React", " React ", "Node", ""] });
    expect(out.stack).toEqual(["React", "Node"]);
  });

  it("rejects an invalid status", () => {
    expect(() => parseVacancyInput({ status: "not-a-status" })).toThrow(HttpError);
  });

  it("rejects an invalid fit", () => {
    expect(() => parseVacancyInput({ fit: "ultra" })).toThrow(HttpError);
    expect(FITS).not.toContain("ultra");
  });

  it("rejects a non-http(s) url", () => {
    expect(() => parseVacancyInput({ url: "javascript:alert(1)" })).toThrow(HttpError);
  });

  it("accepts an empty or ISO-formatted date for applied/next", () => {
    expect(parseVacancyInput({ applied: "", next: "2026-08-15" }).next).toBe("2026-08-15");
    expect(parseVacancyInput({ applied: "2026-01-02" }).applied).toBe("2026-01-02");
  });

  it("rejects a non-ISO date for applied/next (analytics compares these as strings)", () => {
    // server/src/modules/analytics/analytics.routes.ts and client/dashboard.tsx compare
    // these fields as strings (e.g. v.next < today) — free text would silently break that logic.
    expect(() => parseVacancyInput({ next: "tomorrow" })).toThrow(HttpError);
    expect(() => parseVacancyInput({ applied: "15.08.2026" })).toThrow(HttpError);
  });

  it("in partial mode only touches provided fields", () => {
    const out = parseVacancyInput({ notes: "update" }, { partial: true });
    expect(out).toEqual({ notes: "update" });
  });

  it("accepts a freeform salary string, defaulting to '' and trimming/capping like level", () => {
    expect(parseVacancyInput({}).salary).toBe("");
    expect(parseVacancyInput({ salary: "  $90k-110k  " }).salary).toBe("$90k-110k");
    expect(parseVacancyInput({ salary: "x".repeat(100) }).salary).toHaveLength(60);
  });
});

describe("parseJsonVacancyItem", () => {
  const validItem = {
    company: "Zone3000",
    pos: "Full-Stack Engineer (Node.js, JS) (#1114)",
    level: "Middle/Senior",
    fit: "med",
    status: "Want to apply",
    applied: "2026-07-26",
    next: "",
    notes: "",
    url: "https://jobs.dou.ua/companies/zone3000/vacancies/345691/",
  };

  it("parses a job-tracker.json-shaped item, mapping 'pos' to 'position'", () => {
    const out = parseJsonVacancyItem(validItem);
    expect(out.position).toBe(validItem.pos);
    expect(out.company).toBe("Zone3000");
    expect(out.status).toBe("Want to apply");
    expect(out.fit).toBe("med");
  });

  it("accepts a freeform salary string and trims/truncates it, defaulting to '' when absent", () => {
    expect(parseJsonVacancyItem(validItem).salary).toBe("");
    expect(parseJsonVacancyItem({ ...validItem, salary: "  $90k-110k  " }).salary).toBe("$90k-110k");
    expect(parseJsonVacancyItem({ ...validItem, salary: "x".repeat(100) }).salary).toHaveLength(60);
  });

  it("accepts 'position' as a fallback key (own export round-trip)", () => {
    const { pos, ...rest } = validItem;
    void pos;
    const out = parseJsonVacancyItem({ ...rest, position: "Backend Developer" });
    expect(out.position).toBe("Backend Developer");
  });

  it("rejects an unknown status or fit", () => {
    expect(() => parseJsonVacancyItem({ ...validItem, status: "not-a-status" })).toThrow(HttpError);
    expect(() => parseJsonVacancyItem({ ...validItem, fit: "ultra" })).toThrow(HttpError);
  });

  it("normalizes common Ukrainian status labels to the canonical wire value", () => {
    expect(parseJsonVacancyItem({ ...validItem, status: "Хочу подати" }).status).toBe("Want to apply");
    expect(parseJsonVacancyItem({ ...validItem, status: "Відправив CV" }).status).toBe("Applied");
    expect(parseJsonVacancyItem({ ...validItem, status: "Скринінг" }).status).toBe("Screening");
    expect(parseJsonVacancyItem({ ...validItem, status: "Відмова" }).status).toBe("Rejected");
    // case/whitespace-insensitive
    expect(parseJsonVacancyItem({ ...validItem, status: "  скринінг  " }).status).toBe("Screening");
  });

  it("rejects a non-ISO applied/next date", () => {
    expect(() => parseJsonVacancyItem({ ...validItem, applied: "26.07.2026" })).toThrow(HttpError);
  });

  it("rejects a non-http(s) url", () => {
    expect(() => parseJsonVacancyItem({ ...validItem, url: "javascript:alert(1)" })).toThrow(HttpError);
  });
});

describe("parseProfileInput", () => {
  it("normalizes skills into a deduped string array", () => {
    const out = parseProfileInput({ skills: ["Vue", "Vue", " React "], cvText: "text" });
    expect(out.skills).toEqual(["Vue", "React"]);
  });

  it("rejects a non-array skills field", () => {
    expect(() => parseProfileInput({ skills: "Vue,React" })).toThrow(HttpError);
  });
});

describe("parseSkillLevelInput", () => {
  it("parses a valid tech + level", () => {
    expect(parseSkillLevelInput({ tech: " React ", level: 72 })).toEqual({ tech: "React", level: 72 });
  });

  it("accepts level 0 (not the same as absent)", () => {
    expect(parseSkillLevelInput({ tech: "React", level: 0 })).toEqual({ tech: "React", level: 0 });
  });

  it("treats null/empty/absent level as clearing the override", () => {
    expect(parseSkillLevelInput({ tech: "React", level: null })).toEqual({ tech: "React", level: null });
    expect(parseSkillLevelInput({ tech: "React", level: "" })).toEqual({ tech: "React", level: null });
    expect(parseSkillLevelInput({ tech: "React" })).toEqual({ tech: "React", level: null });
  });

  it("rejects an out-of-range or non-integer level", () => {
    expect(() => parseSkillLevelInput({ tech: "React", level: 101 })).toThrow(HttpError);
    expect(() => parseSkillLevelInput({ tech: "React", level: -1 })).toThrow(HttpError);
    expect(() => parseSkillLevelInput({ tech: "React", level: 1.5 })).toThrow(HttpError);
    expect(() => parseSkillLevelInput({ tech: "React", level: "abc" })).toThrow(HttpError);
  });

  it("requires a non-empty tech", () => {
    expect(() => parseSkillLevelInput({ level: 50 })).toThrow(HttpError);
    expect(() => parseSkillLevelInput({ tech: "  ", level: 50 })).toThrow(HttpError);
  });

  it("trims and truncates tech at 80 chars", () => {
    const long = "x".repeat(100);
    expect(parseSkillLevelInput({ tech: long, level: 1 }).tech).toBe("x".repeat(80));
  });
});

describe("parseWeeklyApplyGoalInput", () => {
  it("parses a valid weekly goal", () => {
    expect(parseWeeklyApplyGoalInput({ weekly: 5 })).toBe(5);
  });

  it("accepts the boundaries 1 and 50", () => {
    expect(parseWeeklyApplyGoalInput({ weekly: 1 })).toBe(1);
    expect(parseWeeklyApplyGoalInput({ weekly: 50 })).toBe(50);
  });

  it("rejects out-of-range, non-integer, or non-numeric values", () => {
    expect(() => parseWeeklyApplyGoalInput({ weekly: 0 })).toThrow(HttpError);
    expect(() => parseWeeklyApplyGoalInput({ weekly: 51 })).toThrow(HttpError);
    expect(() => parseWeeklyApplyGoalInput({ weekly: 2.5 })).toThrow(HttpError);
    expect(() => parseWeeklyApplyGoalInput({ weekly: "abc" })).toThrow(HttpError);
    expect(() => parseWeeklyApplyGoalInput({})).toThrow(HttpError);
  });
});

describe("parseInterviewTurnInput", () => {
  it("parses a valid turn with a vacancy and transcript", () => {
    const out = parseInterviewTurnInput({
      vacancyId: 5,
      transcript: [{ q: "Tell me about yourself", a: "I am a developer." }],
      maxTurns: 6,
    });
    expect(out).toEqual({ vacancyId: 5, transcript: [{ q: "Tell me about yourself", a: "I am a developer." }], maxTurns: 6 });
  });

  it("treats vacancyId null/0/absent as no vacancy", () => {
    expect(parseInterviewTurnInput({ vacancyId: null, transcript: [] }).vacancyId).toBeNull();
    expect(parseInterviewTurnInput({ vacancyId: 0, transcript: [] }).vacancyId).toBeNull();
    expect(parseInterviewTurnInput({ transcript: [] }).vacancyId).toBeNull();
  });

  it("rejects a non-integer or non-positive vacancyId", () => {
    expect(() => parseInterviewTurnInput({ vacancyId: -1, transcript: [] })).toThrow(HttpError);
    expect(() => parseInterviewTurnInput({ vacancyId: 1.5, transcript: [] })).toThrow(HttpError);
    expect(() => parseInterviewTurnInput({ vacancyId: "abc", transcript: [] })).toThrow(HttpError);
  });

  it("defaults transcript to an empty array when absent", () => {
    expect(parseInterviewTurnInput({}).transcript).toEqual([]);
  });

  it("rejects a non-array transcript", () => {
    expect(() => parseInterviewTurnInput({ transcript: "not an array" })).toThrow(HttpError);
  });

  it("rejects a transcript entry missing string q/a", () => {
    expect(() => parseInterviewTurnInput({ transcript: [{ q: "question only" }] })).toThrow(HttpError);
    expect(() => parseInterviewTurnInput({ transcript: [{ q: 1, a: "answer" }] })).toThrow(HttpError);
  });

  it("caps transcript at 10 entries and trims/truncates q/a", () => {
    const transcript = Array.from({ length: 15 }, (_, i) => ({ q: `q${i}`, a: `a${i}` }));
    expect(parseInterviewTurnInput({ transcript }).transcript).toHaveLength(10);
    const long = "x".repeat(3000);
    const out = parseInterviewTurnInput({ transcript: [{ q: `  ${long}  `, a: long }] });
    expect(out.transcript[0]!.q).toBe("x".repeat(600));
    expect(out.transcript[0]!.a).toBe("x".repeat(2000));
  });

  it("defaults maxTurns to 6 when absent/invalid", () => {
    expect(parseInterviewTurnInput({}).maxTurns).toBe(6);
    expect(parseInterviewTurnInput({ maxTurns: 0 }).maxTurns).toBe(6);
  });

  it("passes through a valid maxTurns", () => {
    expect(parseInterviewTurnInput({ maxTurns: 8 }).maxTurns).toBe(8);
  });
});

describe("parseCompanyInput", () => {
  it("requires a non-empty name", () => {
    expect(() => parseCompanyInput({ name: "  " })).toThrow(HttpError);
  });

  it("accepts a valid company payload", () => {
    const out = parseCompanyInput({ name: "Acme", notes: "n", questions: ["Q1"] });
    expect(out).toEqual({ name: "Acme", notes: "n", questions: ["Q1"], website: "" });
  });

  it("normalizes a full URL website down to a bare domain", () => {
    const out = parseCompanyInput({ name: "Acme", notes: "", questions: [], website: "https://www.acme.com/careers" });
    expect(out.website).toBe("acme.com");
  });

  it("normalizes an already-bare domain website (no change)", () => {
    const out = parseCompanyInput({ name: "Acme", notes: "", questions: [], website: "acme.com" });
    expect(out.website).toBe("acme.com");
  });

  it("never throws for an unparseable website — falls back to ''", () => {
    const out = parseCompanyInput({ name: "Acme", notes: "", questions: [], website: "not a domain" });
    expect(out.website).toBe("");
  });
});

describe("parseEnrichmentQuery", () => {
  it("defaults titles to the recruiter/HR set when none are passed", () => {
    const out = parseEnrichmentQuery({ companyName: "Acme" });
    expect(out.titles).toEqual(["recruiter", "talent acquisition", "technical recruiter", "hr"]);
  });

  it("uses the caller's titles (capped at 5) when passed", () => {
    const out = parseEnrichmentQuery({ companyName: "Acme", titles: ["a", "b", "c", "d", "e", "f"] });
    expect(out.titles).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("normalizes domain via toDomain()", () => {
    const out = parseEnrichmentQuery({ domain: "https://www.acme.com/careers" });
    expect(out.domain).toBe("acme.com");
  });

  it("defaults limit to 10 and clamps to 1..25", () => {
    expect(parseEnrichmentQuery({}).limit).toBe(10);
    expect(parseEnrichmentQuery({ limit: 0 }).limit).toBe(1);
    expect(parseEnrichmentQuery({ limit: 999 }).limit).toBe(25);
    expect(parseEnrichmentQuery({ limit: 5 }).limit).toBe(5);
  });

  it("trims and caps companyName/personName", () => {
    const out = parseEnrichmentQuery({ companyName: "  Acme  ", personName: "  Jane Doe  " });
    expect(out.companyName).toBe("Acme");
    expect(out.personName).toBe("Jane Doe");
  });
});

describe("parseContactInput", () => {
  it("defaults vacancyId to null when omitted", () => {
    const out = parseContactInput({ name: "Ada" });
    expect(out.vacancyId).toBeNull();
  });

  it("accepts a positive integer vacancyId", () => {
    const out = parseContactInput({ name: "Ada", vacancyId: 5 });
    expect(out.vacancyId).toBe(5);
  });

  it("treats null/empty vacancyId as unlinked", () => {
    expect(parseContactInput({ name: "Ada", vacancyId: null }).vacancyId).toBeNull();
    expect(parseContactInput({ name: "Ada", vacancyId: "" }).vacancyId).toBeNull();
  });

  it("rejects a non-positive or non-integer vacancyId", () => {
    expect(() => parseContactInput({ name: "Ada", vacancyId: 0 })).toThrow(HttpError);
    expect(() => parseContactInput({ name: "Ada", vacancyId: -1 })).toThrow(HttpError);
    expect(() => parseContactInput({ name: "Ada", vacancyId: 1.5 })).toThrow(HttpError);
  });

  it("partial update only touches vacancyId when the field is present", () => {
    const out = parseContactInput({ vacancyId: 3 }, { partial: true });
    expect(out).toEqual({ vacancyId: 3 });
  });
});

describe("parsePagination", () => {
  it("returns undefined limit and zero offset when no query params given", () => {
    expect(parsePagination({})).toEqual({ limit: undefined, offset: 0 });
    expect(parsePagination(undefined)).toEqual({ limit: undefined, offset: 0 });
  });

  it("parses valid limit/offset", () => {
    expect(parsePagination({ limit: "20", offset: "10" })).toEqual({ limit: 20, offset: 10 });
  });

  it("caps limit at 500", () => {
    expect(parsePagination({ limit: "10000" })).toEqual({ limit: 500, offset: 0 });
  });

  it("rejects a non-positive limit", () => {
    expect(() => parsePagination({ limit: "0" })).toThrow(HttpError);
    expect(() => parsePagination({ limit: "-5" })).toThrow(HttpError);
    expect(() => parsePagination({ limit: "abc" })).toThrow(HttpError);
  });

  it("rejects a negative offset", () => {
    expect(() => parsePagination({ offset: "-1" })).toThrow(HttpError);
  });
});

describe("assertSafeVacancyUrl (SSRF guard)", () => {
  it("allows a valid jobs.dou.ua https url", () => {
    expect(assertSafeVacancyUrl("https://jobs.dou.ua/companies/acme/vacancies/1/")).toContain("jobs.dou.ua");
  });

  // This used to have a hard allowlist of just dou.ua — now any public https host is allowed
  // (the user decides which site to pull vacancies from: LinkedIn, Djinni, robota.ua, Indeed,
  // etc.), only internal/local targets are blocked (tests below).
  it("allows an arbitrary public https host (no longer restricted to dou.ua)", () => {
    expect(assertSafeVacancyUrl("https://www.linkedin.com/jobs/view/123/")).toContain("linkedin.com");
    expect(assertSafeVacancyUrl("https://djinni.co/jobs/123-backend-developer/")).toContain("djinni.co");
  });

  it("rejects non-https protocols", () => {
    expect(() => assertSafeVacancyUrl("http://jobs.dou.ua/vacancies/1/")).toThrow(HttpError);
  });

  it("rejects localhost and *.local/*.internal hostnames", () => {
    expect(() => assertSafeVacancyUrl("https://localhost/admin")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://router.local/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://api.internal/")).toThrow(HttpError);
  });

  it("rejects loopback/private/link-local IPv4 literals, including the cloud-metadata address", () => {
    expect(() => assertSafeVacancyUrl("https://127.0.0.1/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://10.0.0.5/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://192.168.1.1/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://172.16.0.1/")).toThrow(HttpError);
    expect(() => assertSafeVacancyUrl("https://169.254.169.254/latest/meta-data/")).toThrow(HttpError);
  });

  it("rejects the IPv6 loopback literal", () => {
    expect(() => assertSafeVacancyUrl("https://[::1]/")).toThrow(HttpError);
  });

  it("allows a public IPv4 literal (not private/reserved)", () => {
    expect(assertSafeVacancyUrl("https://93.184.216.34/")).toContain("93.184.216.34");
  });
});

const designTask = {
  title: "URL shortener",
  scenario: "Design a service that shortens long URLs.",
  requirements: ["Handle 1000 req/s"],
  constraints: ["2 weeks"],
  difficulty: "medium",
};
const designDiagram = {
  nodes: [{ id: "1", kind: "client", label: "Client", x: 0, y: 0 }],
  edges: [],
};

describe("parseDesignGenerateTaskInput", () => {
  it("treats absent/0 vacancyId as general (null)", () => {
    expect(parseDesignGenerateTaskInput({}).vacancyId).toBeNull();
    expect(parseDesignGenerateTaskInput({ vacancyId: 0 }).vacancyId).toBeNull();
  });

  it("accepts a positive integer vacancyId", () => {
    expect(parseDesignGenerateTaskInput({ vacancyId: 5 }).vacancyId).toBe(5);
  });

  it("rejects a negative/non-integer vacancyId", () => {
    expect(() => parseDesignGenerateTaskInput({ vacancyId: -1 })).toThrow(HttpError);
    expect(() => parseDesignGenerateTaskInput({ vacancyId: "abc" })).toThrow(HttpError);
  });
});

describe("parseDesignGradeInput", () => {
  it("parses a valid task + diagram", () => {
    const out = parseDesignGradeInput({ task: designTask, diagram: designDiagram });
    expect(out.task.title).toBe("URL shortener");
    expect(out.diagram.nodes).toEqual([{ id: "1", kind: "client", label: "Client", x: 0, y: 0 }]);
  });

  it("falls back to 'generic' for an unknown node kind", () => {
    const out = parseDesignGradeInput({
      task: designTask,
      diagram: { nodes: [{ id: "1", kind: "not-a-real-kind", label: "X", x: 0, y: 0 }], edges: [] },
    });
    expect(out.diagram.nodes[0]!.kind).toBe("generic");
  });

  it("falls back to 'medium' for an unknown difficulty", () => {
    const out = parseDesignGradeInput({ task: { ...designTask, difficulty: "extreme" }, diagram: designDiagram });
    expect(out.task.difficulty).toBe("medium");
  });

  it("rejects an edge referencing an unknown node id", () => {
    expect(() =>
      parseDesignGradeInput({
        task: designTask,
        diagram: { nodes: designDiagram.nodes, edges: [{ id: "e1", source: "1", target: "missing" }] },
      }),
    ).toThrow(HttpError);
  });

  it("caps node/edge counts defensively", () => {
    const manyNodes = Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, kind: "generic", label: "", x: 0, y: 0 }));
    const out = parseDesignGradeInput({ task: designTask, diagram: { nodes: manyNodes, edges: [] } });
    expect(out.diagram.nodes.length).toBe(40);
  });

  it("wraps an annotation's rotation into [0, 360) and omits it when it comes out zero", () => {
    const out = parseDesignGradeInput({
      task: designTask,
      diagram: {
        ...designDiagram,
        annotations: [
          { id: "r1", kind: "rectangle", color: "#dc2626", x: 0, y: 0, width: 10, height: 10, rotation: -90 },
          { id: "r2", kind: "rectangle", color: "#dc2626", x: 0, y: 0, width: 10, height: 10, rotation: "nonsense" },
        ],
      },
    });
    expect(out.diagram.annotations[0]).toMatchObject({ id: "r1", rotation: 270 });
    expect(out.diagram.annotations[1]).not.toHaveProperty("rotation");
  });

  it("keeps an arrow binding to a known node and silently drops one to an unknown node", () => {
    const out = parseDesignGradeInput({
      task: designTask,
      diagram: {
        ...designDiagram,
        annotations: [{ id: "a1", kind: "arrow", color: "#16a34a", x1: 0, y1: 0, x2: 5, y2: 5, startNodeId: "1", endNodeId: "missing" }],
      },
    });
    // Unlike a structural edge to an unknown node (which throws above), a stale decorative binding
    // just disappears — the arrow itself survives with its coordinates intact.
    expect(out.diagram.annotations[0]).toMatchObject({ id: "a1", startNodeId: "1", x1: 0, x2: 5 });
    expect(out.diagram.annotations[0]).not.toHaveProperty("endNodeId");
  });
});

describe("parseDesignHelpInput", () => {
  it("parses a valid question + task + diagram", () => {
    const out = parseDesignHelpInput({ task: designTask, diagram: designDiagram, question: "What should I cache?" });
    expect(out.question).toBe("What should I cache?");
  });

  it("rejects an empty question", () => {
    expect(() => parseDesignHelpInput({ task: designTask, diagram: designDiagram, question: "  " })).toThrow(HttpError);
  });

  it("caps an overly long question", () => {
    const out = parseDesignHelpInput({ task: designTask, diagram: designDiagram, question: "x".repeat(1000) });
    expect(out.question.length).toBe(500);
  });
});

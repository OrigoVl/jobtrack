// vacancy-import.service.ts's business logic, extracted from vacancies.routes.ts — see that
// file's own comment. extractImportLinks() is pure (no I/O) and tested directly; everything else
// touches the DB through vacancies.repo.js/companies.repo.js, so those are mocked here the same
// way vacancy-analysis.service.test.ts mocks db/index.js — this suite is about the
// dedupe/upsert/orchestration logic, not proving the repo layer's SQL (that's
// vacancies.repo.test.ts's job).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

const recordStatusChange = vi.fn(async () => undefined);
vi.mock("../../db/index.js", () => ({ recordStatusChange }));

const embed = vi.fn(async () => null);
const embeddingsAvailable = vi.fn(() => false);
vi.mock("../../llm/embeddings.js", () => ({ embed, embeddingsAvailable }));

const mockLog = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

interface MockCompany {
  id: number;
  name: string;
  notes: string;
  questions: string[];
  website: string;
}
const getCompanyById = vi.fn(async (): Promise<MockCompany | undefined> => undefined);
const upsertCompanyEnrichment = vi.fn(async (_userId: unknown, input: { name: string }) => ({
  id: 42,
  name: input.name,
  notes: "",
  questions: [],
  website: "",
}));
vi.mock("../companies/companies.repo.js", () => ({ getCompanyById, upsertCompanyEnrichment }));

interface MockVacancyFacts {
  company: string;
  position: string;
  level: string;
  salary: string;
  location: string;
  workMode: string;
  employmentType: string;
  companyWebsite: string;
}
interface MockDouLocationHint {
  location: string;
  workMode: "remote" | "hybrid" | "office";
}

const quickAnalyze = vi.fn(async () => ({ techs: ["React"], level: "Middle", match: [], gap: [], fit: "med" as const }));
const tryAutoEnrichStack = vi.fn(async () => null as { techs: string[]; level: string; fit: string } | null);
const safeFetchVacancyPage = vi.fn(async () => null as { text: string; rawHtml: string } | null);
const extractVacancyFacts = vi.fn(async () => null as MockVacancyFacts | null);
const extractDouLocationHint = vi.fn(() => null as MockDouLocationHint | null);
vi.mock("./vacancy-analysis.service.js", () => ({
  quickAnalyze,
  tryAutoEnrichStack,
  safeFetchVacancyPage,
  extractVacancyFacts,
  extractDouLocationHint,
  companyFromDouUrl: (url: string) => {
    const m = /^https:\/\/jobs\.dou\.ua\/companies\/([^/]+)\/vacancies\/\d+\/?$/.exec(url);
    return m ? (m[1] ?? "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  },
}));

const listVacancies = vi.fn(async () => [] as { id: number; company: string; position: string; status: string }[]);
const getVacancy = vi.fn(async () => undefined as unknown);
const findVacancyByUrl = vi.fn(async (_userId: unknown, _url: string) => undefined as { id: number; status: string } | undefined);
const findVacancyByCompanyPosition = vi.fn(async () => undefined as { id: number; status: string } | undefined);
const createVacancy = vi.fn(async () => 1);
const createVacancyMinimal = vi.fn(async () => 1);
const createVacancyFromJson = vi.fn(async () => 1);
const updateVacancyFromJson = vi.fn(async () => undefined);
const updateVacancyEnrichment = vi.fn(async () => undefined);
const updateVacancyImportedTitle = vi.fn(async () => undefined);
const updateVacancyEmbedding = vi.fn(async () => undefined);
vi.mock("./vacancies.repo.js", () => ({
  listVacancies,
  getVacancy,
  findVacancyByUrl,
  findVacancyByCompanyPosition,
  createVacancy,
  createVacancyMinimal,
  createVacancyFromJson,
  updateVacancyFromJson,
  updateVacancyEnrichment,
  updateVacancyImportedTitle,
  updateVacancyEmbedding,
}));

const {
  extractImportLinks,
  importVacanciesFromHtml,
  upsertJsonVacancy,
  importJsonVacancies,
  createVacancyWithDedupe,
  assertOwnCompanyOrNull,
} = await import("./vacancy-import.service.js");

const USER = BOOTSTRAP_USER_ID;

beforeEach(() => {
  vi.clearAllMocks();
  listVacancies.mockResolvedValue([]);
  getVacancy.mockResolvedValue(undefined);
  findVacancyByUrl.mockResolvedValue(undefined);
  findVacancyByCompanyPosition.mockResolvedValue(undefined);
  createVacancy.mockResolvedValue(1);
  createVacancyMinimal.mockResolvedValue(1);
  createVacancyFromJson.mockResolvedValue(1);
  safeFetchVacancyPage.mockResolvedValue(null);
  extractVacancyFacts.mockResolvedValue(null);
  extractDouLocationHint.mockReturnValue(null);
  tryAutoEnrichStack.mockResolvedValue(null);
  upsertCompanyEnrichment.mockImplementation(async (_userId: unknown, input: { name: string }) => ({
    id: 42,
    name: input.name,
    notes: "",
    questions: [],
    website: "",
  }));
});

describe("extractImportLinks()", () => {
  it("extracts a DOU vacancy link and derives the company from its slug", () => {
    const html = `<a href="https://jobs.dou.ua/companies/acme-corp/vacancies/12345/">Apply</a>`;
    const { douLinks, genericLinks } = extractImportLinks(html);
    expect(douLinks).toEqual([{ url: "https://jobs.dou.ua/companies/acme-corp/vacancies/12345/", company: "Acme Corp" }]);
    expect(genericLinks).toEqual([]);
  });

  it("dedupes the same DOU link appearing twice in the same paste", () => {
    const html = `
      https://jobs.dou.ua/companies/acme/vacancies/1/
      https://jobs.dou.ua/companies/acme/vacancies/1/
    `;
    const { douLinks } = extractImportLinks(html);
    expect(douLinks).toHaveLength(1);
  });

  it("captures a generic https link and strips trailing sentence/markdown punctuation", () => {
    const html = "Check this out: https://djinni.co/jobs/12345-backend-dev). Also (https://robota.ua/vacancy/55,";
    const { genericLinks } = extractImportLinks(html);
    expect(genericLinks).toEqual(["https://djinni.co/jobs/12345-backend-dev", "https://robota.ua/vacancy/55"]);
  });

  it("never puts a DOU link into genericLinks too (already `seen`)", () => {
    const html = `https://jobs.dou.ua/companies/acme/vacancies/1/`;
    const { douLinks, genericLinks } = extractImportLinks(html);
    expect(douLinks).toHaveLength(1);
    expect(genericLinks).toEqual([]);
  });

  it("silently drops a generic link blocked by the SSRF guard (private/internal host)", () => {
    const html = "https://169.254.169.254/latest/meta-data/ https://example.test/job/1";
    const { genericLinks } = extractImportLinks(html);
    expect(genericLinks).toEqual(["https://example.test/job/1"]);
  });

  it("returns nothing for text with no links", () => {
    expect(extractImportLinks("just some notes, no links here")).toEqual({ douLinks: [], genericLinks: [] });
  });
});

describe("upsertJsonVacancy()", () => {
  const ITEM = {
    company: "Acme",
    position: "Engineer",
    level: "",
    salary: "",
    url: "https://example.test/job/1",
    status: "Want to apply" as const,
    fit: "med" as const,
    applied: "",
    next: "",
    notes: "",
  };

  it("creates a new vacancy when no existing row matches by url or company+position", async () => {
    const result = await upsertJsonVacancy(USER, ITEM);
    expect(result).toEqual({ result: "added", id: 1 });
    expect(createVacancyFromJson).toHaveBeenCalledWith(USER, ITEM);
    expect(recordStatusChange).toHaveBeenCalledWith(USER, 1, "Want to apply");
  });

  it("updates the existing row found by url, without falling back to company+position", async () => {
    findVacancyByUrl.mockResolvedValue({ id: 9, status: "Applied" });
    const result = await upsertJsonVacancy(USER, ITEM);
    expect(result).toEqual({ result: "updated", id: 9 });
    expect(updateVacancyFromJson).toHaveBeenCalledWith(USER, 9, ITEM);
    expect(findVacancyByCompanyPosition).not.toHaveBeenCalled();
    // status changed (Applied -> Want to apply) so a history entry is recorded
    expect(recordStatusChange).toHaveBeenCalledWith(USER, 9, "Want to apply");
  });

  it("falls back to matching by company+position when there's no url match", async () => {
    findVacancyByUrl.mockResolvedValue(undefined);
    findVacancyByCompanyPosition.mockResolvedValue({ id: 5, status: "Want to apply" });
    const result = await upsertJsonVacancy(USER, ITEM);
    expect(result).toEqual({ result: "updated", id: 5 });
    // status unchanged -> no history entry recorded
    expect(recordStatusChange).not.toHaveBeenCalled();
  });

  it("skips the company+position fallback entirely when the item has no url and matches", async () => {
    const noUrlItem = { ...ITEM, url: "" };
    await upsertJsonVacancy(USER, noUrlItem);
    expect(findVacancyByUrl).not.toHaveBeenCalled();
    expect(findVacancyByCompanyPosition).toHaveBeenCalledWith(USER, "Acme", "Engineer");
  });
});

describe("importJsonVacancies()", () => {
  it("adds new items, updates matched ones, and records a possible duplicate for a new item near an existing one", async () => {
    listVacancies.mockResolvedValue([{ id: 100, company: "Acme", position: "Engineer", status: "Applied" }]);
    findVacancyByUrl.mockResolvedValue(undefined);
    findVacancyByCompanyPosition.mockResolvedValue(undefined);
    createVacancyFromJson.mockResolvedValue(2);

    const items = [{ company: "Acme", pos: "Engineer", status: "Want to apply" }];
    const result = await importJsonVacancies(USER, items);

    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.possibleDuplicates).toEqual([
      { index: 0, company: "Acme", position: "Engineer", of: { id: 100, company: "Acme", position: "Engineer" } },
    ]);
  });

  it("records a per-item error and keeps processing the rest of the batch", async () => {
    const items = [
      { company: "Acme", pos: "Engineer", status: "not-a-real-status" },
      { company: "Other", pos: "Dev", status: "Want to apply" },
    ];
    const result = await importJsonVacancies(USER, items);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.index).toBe(0);
    expect(result.added).toBe(1);
  });

  it("auto-enriches a newly added item that has a url, but never an updated one", async () => {
    tryAutoEnrichStack.mockResolvedValue({ techs: ["Go"], level: "Senior", fit: "high" });
    createVacancyFromJson.mockResolvedValue(3);
    const items = [{ company: "Acme", pos: "Engineer", status: "Want to apply", url: "https://example.test/1" }];
    await importJsonVacancies(USER, items);
    expect(tryAutoEnrichStack).toHaveBeenCalledWith(USER, "https://example.test/1");
    expect(updateVacancyEnrichment).toHaveBeenCalledWith(USER, 3, { stack: ["Go"], level: "Senior", fit: "high" });
  });
});

describe("createVacancyWithDedupe()", () => {
  const INPUT = {
    company: "Acme",
    position: "Engineer",
    level: "",
    salary: "",
    url: "",
    status: "Want to apply",
    fit: "med",
    applied: "",
    next: "",
    notes: "",
    stack: [] as string[],
  };

  it("creates the vacancy, records status history, and returns no possibleDuplicateOf when nothing similar exists", async () => {
    createVacancy.mockResolvedValue(7);
    getVacancy.mockResolvedValue({
      id: 7,
      ...INPUT,
      nextAction: "",
      created: "",
      companyId: null,
      favorite: false,
      coverLetter: "",
      coverLetterDetails: "",
    });
    const result = await createVacancyWithDedupe(USER, INPUT);
    expect(result.possibleDuplicateOf).toBeNull();
    expect(createVacancy).toHaveBeenCalledWith(USER, INPUT);
    expect(recordStatusChange).toHaveBeenCalledWith(USER, 7, "Want to apply");
  });

  it("flags a SimHash near-duplicate against the user's recent vacancies without blocking the create", async () => {
    listVacancies.mockResolvedValue([{ id: 3, company: "Acme", position: "Engineer", status: "Applied" }]);
    createVacancy.mockResolvedValue(8);
    getVacancy.mockResolvedValue({
      id: 8,
      ...INPUT,
      nextAction: "",
      created: "",
      companyId: null,
      favorite: false,
      coverLetter: "",
      coverLetterDetails: "",
    });
    const result = await createVacancyWithDedupe(USER, INPUT);
    expect(result.possibleDuplicateOf).toEqual({ id: 3, company: "Acme", position: "Engineer" });
    // advisory only -- still created
    expect(createVacancy).toHaveBeenCalled();
  });

  it("auto-enriches from the url when one is given with an empty stack, but not when a stack was already provided", async () => {
    tryAutoEnrichStack.mockResolvedValue({ techs: ["Rust"], level: "Middle", fit: "high" });
    createVacancy.mockResolvedValue(9);
    getVacancy.mockResolvedValue({
      id: 9,
      ...INPUT,
      nextAction: "",
      created: "",
      companyId: null,
      favorite: false,
      coverLetter: "",
      coverLetterDetails: "",
    });

    await createVacancyWithDedupe(USER, { ...INPUT, url: "https://example.test/job" });
    expect(tryAutoEnrichStack).toHaveBeenCalledWith(USER, "https://example.test/job");
    expect(updateVacancyEnrichment).toHaveBeenCalledWith(USER, 9, { stack: ["Rust"], level: "Middle", fit: "high" });

    tryAutoEnrichStack.mockClear();
    updateVacancyEnrichment.mockClear();
    await createVacancyWithDedupe(USER, { ...INPUT, url: "https://example.test/job", stack: ["React"] });
    expect(tryAutoEnrichStack).not.toHaveBeenCalled();
    expect(updateVacancyEnrichment).not.toHaveBeenCalled();
  });
});

describe("importVacanciesFromHtml()", () => {
  it("creates a DOU vacancy, links/creates its company, and skips one that's already tracked by url", async () => {
    findVacancyByUrl.mockImplementation(async (_userId: unknown, url: string) =>
      url.includes("already-tracked") ? { id: 1, status: "Applied" } : undefined,
    );
    createVacancyMinimal.mockResolvedValue(5);

    const html = `https://jobs.dou.ua/companies/acme/vacancies/1/ https://jobs.dou.ua/companies/already-tracked/vacancies/2/`;
    const result = await importVacanciesFromHtml(USER, html);

    expect(result.added).toBe(1);
    expect(result.items).toEqual([{ company: "Acme", url: "https://jobs.dou.ua/companies/acme/vacancies/1/" }]);
    expect(upsertCompanyEnrichment).toHaveBeenCalledWith(USER, { name: "Acme", notes: "", questions: [], website: "" });
    expect(updateVacancyImportedTitle).toHaveBeenCalledWith(USER, 5, { companyId: 42 });
  });

  it("surfaces a possible duplicate when a DOU import lands at a company the user already tracks", async () => {
    listVacancies.mockResolvedValue([{ id: 77, company: "Acme", position: "Backend Engineer", status: "Applied" }]);
    createVacancyMinimal.mockResolvedValue(6);
    const html = `https://jobs.dou.ua/companies/acme/vacancies/9/`;
    const result = await importVacanciesFromHtml(USER, html);
    expect(result.possibleDuplicates).toEqual([
      {
        company: "Acme",
        url: "https://jobs.dou.ua/companies/acme/vacancies/9/",
        of: { id: 77, company: "Acme", position: "Backend Engineer" },
      },
    ]);
  });

  it("auto-enriches a newly-imported generic link from its fetched text, filling company only when the link had none", async () => {
    createVacancyMinimal.mockResolvedValue(11);
    safeFetchVacancyPage.mockResolvedValue({ text: "some real vacancy text", rawHtml: "<html></html>" });
    extractVacancyFacts.mockResolvedValue({
      company: "Globex",
      position: "Backend Dev",
      level: "",
      salary: "",
      location: "",
      workMode: "",
      employmentType: "",
      companyWebsite: "",
    });
    const html = `https://djinni.co/jobs/999-backend`;
    await importVacanciesFromHtml(USER, html);
    expect(updateVacancyEnrichment).toHaveBeenCalledWith(USER, 11, { stack: ["React"], level: "Middle", fit: "med" });
    expect(upsertCompanyEnrichment).toHaveBeenCalledWith(USER, { name: "Globex", notes: "", questions: [], website: "" });
    expect(updateVacancyImportedTitle).toHaveBeenCalledWith(USER, 11, { company: "Globex", position: "Backend Dev", companyId: 42 });
    // A generic (non-DOU) link never triggers the DOU-specific deterministic extractor.
    expect(extractDouLocationHint).not.toHaveBeenCalled();
  });

  it("never lets a guessed company overwrite a DOU link's slug-derived company", async () => {
    createVacancyMinimal.mockResolvedValue(12);
    safeFetchVacancyPage.mockResolvedValue({ text: "some real vacancy text", rawHtml: "<html></html>" });
    extractVacancyFacts.mockResolvedValue({
      company: "Some Other Name",
      position: "Backend Dev",
      level: "",
      salary: "",
      location: "",
      workMode: "",
      employmentType: "",
      companyWebsite: "",
    });
    const html = `https://jobs.dou.ua/companies/acme/vacancies/1/`;
    await importVacanciesFromHtml(USER, html);
    // updateVacancyImportedTitle called once for the DOU companyId link, once for the position-only guess
    expect(updateVacancyImportedTitle).toHaveBeenCalledWith(USER, 12, { companyId: 42 });
    expect(updateVacancyImportedTitle).toHaveBeenCalledWith(USER, 12, { position: "Backend Dev" });
    expect(updateVacancyImportedTitle).not.toHaveBeenCalledWith(USER, 12, expect.objectContaining({ company: "Some Other Name" }));
  });

  it("fills salary/location/workMode/employmentType/companyWebsite on a generic-link import from extractVacancyFacts", async () => {
    createVacancyMinimal.mockResolvedValue(13);
    safeFetchVacancyPage.mockResolvedValue({ text: "some real vacancy text", rawHtml: "<html></html>" });
    extractVacancyFacts.mockResolvedValue({
      company: "Globex",
      position: "Backend Dev",
      level: "",
      salary: "$3000-4000",
      location: "Berlin, Germany",
      workMode: "hybrid",
      employmentType: "Full-time",
      companyWebsite: "globex.example",
    });
    const html = `https://djinni.co/jobs/1000-backend`;
    await importVacanciesFromHtml(USER, html);
    expect(upsertCompanyEnrichment).toHaveBeenCalledWith(USER, { name: "Globex", notes: "", questions: [], website: "globex.example" });
    expect(updateVacancyImportedTitle).toHaveBeenCalledWith(USER, 13, {
      company: "Globex",
      position: "Backend Dev",
      companyId: 42,
      salary: "$3000-4000",
      location: "Berlin, Germany",
      workMode: "hybrid",
      employmentType: "Full-time",
    });
  });

  it("fills location/workMode on a DOU import from the deterministic badge alone, fully offline (extractVacancyFacts null)", async () => {
    createVacancyMinimal.mockResolvedValue(14);
    safeFetchVacancyPage.mockResolvedValue({
      text: "some real vacancy text",
      rawHtml: '<span class="place bi bi-geo-alt-fill"> Київ, віддалено</span>',
    });
    extractVacancyFacts.mockResolvedValue(null); // offline: no LLM key configured
    extractDouLocationHint.mockReturnValue({ location: "Київ, віддалено", workMode: "remote" });
    const html = `https://jobs.dou.ua/companies/acme/vacancies/2/`;
    await importVacanciesFromHtml(USER, html);
    expect(extractDouLocationHint).toHaveBeenCalledWith('<span class="place bi bi-geo-alt-fill"> Київ, віддалено</span>');
    expect(updateVacancyImportedTitle).toHaveBeenCalledWith(USER, 14, { location: "Київ, віддалено", workMode: "remote" });
  });

  it("prefers the deterministic DOU location/workMode over extractVacancyFacts's own guess when both are present", async () => {
    createVacancyMinimal.mockResolvedValue(15);
    safeFetchVacancyPage.mockResolvedValue({ text: "some real vacancy text", rawHtml: "<html></html>" });
    extractVacancyFacts.mockResolvedValue({
      company: "",
      position: "",
      level: "",
      salary: "",
      location: "Remote (LLM guess)",
      workMode: "hybrid",
      employmentType: "",
      companyWebsite: "",
    });
    extractDouLocationHint.mockReturnValue({ location: "Київ", workMode: "office" });
    const html = `https://jobs.dou.ua/companies/acme/vacancies/3/`;
    await importVacanciesFromHtml(USER, html);
    expect(updateVacancyImportedTitle).toHaveBeenCalledWith(USER, 15, expect.objectContaining({ location: "Київ", workMode: "office" }));
  });
});

describe("assertOwnCompanyOrNull()", () => {
  it("passes silently for a null/undefined companyId", async () => {
    await expect(assertOwnCompanyOrNull(USER, null)).resolves.toBeUndefined();
    await expect(assertOwnCompanyOrNull(USER, undefined)).resolves.toBeUndefined();
    expect(getCompanyById).not.toHaveBeenCalled();
  });

  it("throws a 400 when the companyId doesn't belong to this user", async () => {
    getCompanyById.mockResolvedValue(undefined);
    await expect(assertOwnCompanyOrNull(USER, 5)).rejects.toMatchObject({ status: 400 });
  });

  it("passes when the company exists for this user", async () => {
    getCompanyById.mockResolvedValue({ id: 5, name: "Acme", notes: "", questions: [], website: "" });
    await expect(assertOwnCompanyOrNull(USER, 5)).resolves.toBeUndefined();
  });
});

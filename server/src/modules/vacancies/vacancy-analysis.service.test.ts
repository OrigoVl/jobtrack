// tryAutoEnrichStack() — best-effort автозбагачення стеку вакансії за посиланням (викликається
// автоматично при створенні/оновленні вакансії з URL і при імпорті — див. vacancies.routes.ts).
// Ключовий контракт: НІКОЛИ не кидає й не блокує виклик — заблокований SSRF-захистом хост,
// мережева помилка чи порожня сторінка мають тихо повертати null. SSRF-блок (внутрішні/локальні
// адреси) тестуємо тут окремо від assertSafeVacancyUrl (validation.test.ts), бо саме
// tryAutoEnrichStack гарантує "без мережі".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/index.js", () => ({
  getProfile: vi.fn(() => ({ skills: ["React"], cvText: "", domain: "" })),
  getKvJson: vi.fn(() => null),
  setKvJson: vi.fn(),
}));
vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chat: vi.fn(),
}));
const mockLog = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { tryAutoEnrichStack } from "./vacancy-analysis.service.js";

describe("tryAutoEnrichStack()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockLog.debug.mockReset();
    mockLog.warn.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for an empty url without any network call", async () => {
    expect(await tryAutoEnrichStack("")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null for a private/internal url without any network call (SSRF guard)", async () => {
    const result = await tryAutoEnrichStack("https://169.254.169.254/latest/meta-data/");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // SSRF-блок — очікуваний, "тихий" по духу випадок: лише debug, не warn/error (не шумимо).
    expect(mockLog.debug).toHaveBeenCalledOnce();
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it("fetches and analyzes the page text for a dou.ua vacancy url", async () => {
    const html = `<html><body>${"Шукаємо Senior React TypeScript розробника, Docker буде плюсом. ".repeat(5)}</body></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });

    const result = await tryAutoEnrichStack("https://jobs.dou.ua/companies/acme/vacancies/1/");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result?.techs).toEqual(expect.arrayContaining(["React", "TypeScript", "Docker"]));
    expect(result?.match).toContain("React");
  });

  // Найважливіший тест для цієї зміни: раніше НЕ-dou.ua хост блокувався allowlist'ом ще до
  // мережевого запиту (assertSafeVacancyUrl) — тепер довільний публічний хост (тут: умовний
  // LinkedIn) успішно проходить SSRF-перевірку й аналізується так само, як jobs.dou.ua.
  it("fetches and analyzes the page text for an arbitrary public (non-dou.ua) vacancy url", async () => {
    const html = `<html><body>${"Looking for a Senior React TypeScript engineer, Docker is a plus. ".repeat(5)}</body></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });

    const result = await tryAutoEnrichStack("https://www.linkedin.com/jobs/view/123456/");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result?.techs).toEqual(expect.arrayContaining(["React", "TypeScript", "Docker"]));
  });

  it("returns null (without throwing) when the page request fails — and logs a warning with the url/status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(tryAutoEnrichStack("https://jobs.dou.ua/companies/acme/vacancies/2/")).resolves.toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://jobs.dou.ua/companies/acme/vacancies/2/" }),
      expect.stringContaining("failed"),
    );
  });

  it("returns null (without throwing) when fetch rejects (network error/timeout) — and logs a warning", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    await expect(tryAutoEnrichStack("https://jobs.dou.ua/companies/acme/vacancies/3/")).resolves.toBeNull();
    expect(mockLog.warn).toHaveBeenCalledOnce();
  });

  it("returns null for a too-short/empty page — and logs a warning explaining why", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve("<html><body>404</body></html>") });
    expect(await tryAutoEnrichStack("https://jobs.dou.ua/companies/acme/vacancies/4/")).toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ textLength: expect.any(Number) }),
      expect.stringContaining("too short"),
    );
  });
});

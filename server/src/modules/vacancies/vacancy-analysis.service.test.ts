// tryAutoEnrichStack() — best-effort автозбагачення стеку вакансії за посиланням (викликається
// автоматично при створенні/оновленні вакансії з URL і при імпорті — див. vacancies.routes.ts).
// Ключовий контракт: НІКОЛИ не кидає й не блокує виклик — недоступний домен, мережева помилка чи
// порожня сторінка мають тихо повертати null. dou.ua-обмеження (SSRF-захист) тестуємо тут окремо
// від assertSafeVacancyUrl (validation.test.ts), бо саме tryAutoEnrichStack гарантує "без мережі".
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

import { tryAutoEnrichStack } from "./vacancy-analysis.service.js";

describe("tryAutoEnrichStack()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for an empty url without any network call", async () => {
    expect(await tryAutoEnrichStack("")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null for a non-dou.ua url without any network call (SSRF guard)", async () => {
    const result = await tryAutoEnrichStack("https://example.com/careers/1");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("returns null (without throwing) when the page request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(tryAutoEnrichStack("https://jobs.dou.ua/companies/acme/vacancies/2/")).resolves.toBeNull();
  });

  it("returns null (without throwing) when fetch rejects (network error/timeout)", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    await expect(tryAutoEnrichStack("https://jobs.dou.ua/companies/acme/vacancies/3/")).resolves.toBeNull();
  });

  it("returns null for a too-short/empty page", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve("<html><body>404</body></html>") });
    expect(await tryAutoEnrichStack("https://jobs.dou.ua/companies/acme/vacancies/4/")).toBeNull();
  });
});

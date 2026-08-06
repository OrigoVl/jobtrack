// fetch-all-job.ts's background job runner + state persistence — the core behavior worth testing
// directly (not through vacancies.routes.ts, which is thin by design): incremental progress
// writes after every item (the whole point of moving this out of the request/response cycle),
// match/gap wired through from quickAnalyze (previously discarded by the old synchronous route),
// an idempotent start (won't double-run while one's already in flight), the staleness guard that
// lets a fresh job start after a crash left an old one stuck at "running", and a top-level crash
// still resolving to a terminal "error" state instead of "running" forever.
//
// fetchVacancyText()/quickAnalyze() are mocked wholesale (not their internals) — this suite is
// about the JOB'S orchestration (progress writes, idempotency, staleness), not about skill
// extraction/fit scoring, which vacancy-analysis.service.test.ts and vacancy-text.test.ts already
// cover directly.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { UserId } from "../../db/user-id.js";
import type { VacancyRow } from "../../db/types.js";

const kvStore = new Map<string, unknown>();
vi.mock("../../db/index.js", () => ({
  getKvJson: vi.fn(async (userId: string, key: string) => kvStore.get(`${userId}:${key}`) ?? null),
  setKvJson: vi.fn(async (userId: string, key: string, value: unknown) => {
    kvStore.set(`${userId}:${key}`, value);
  }),
}));
vi.mock("./vacancies.repo.js", () => ({
  listVacanciesWithUrl: vi.fn(),
  updateVacancyEnrichment: vi.fn(async () => undefined),
}));
vi.mock("./vacancy-analysis.service.js", () => ({
  fetchVacancyText: vi.fn(),
  quickAnalyze: vi.fn(),
}));
const mockLog = { warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { getFetchAllJob, startFetchAllJob } from "./fetch-all-job.js";
import { listVacanciesWithUrl } from "./vacancies.repo.js";
import { fetchVacancyText, quickAnalyze } from "./vacancy-analysis.service.js";

function vacancyRow(id: number, company: string, url: string): VacancyRow {
  return {
    id,
    company,
    position: "",
    level: "",
    created: "2026-01-01",
    salary: "",
    url,
    status: "Applied",
    fit: "med",
    applied: "",
    next: "",
    notes: "",
    stack: [],
  };
}

const QUICK_ANALYSIS = { techs: ["React", "Node.js"], level: "Middle", match: ["React"], gap: ["Node.js"], fit: "med" as const };

describe("fetch-all-job", () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
    vi.mocked(fetchVacancyText).mockResolvedValue("a".repeat(300));
    vi.mocked(quickAnalyze).mockResolvedValue(QUICK_ANALYSIS);
  });

  it("with no vacancies to process, resolves straight to 'done' — no background loop started", async () => {
    vi.mocked(listVacanciesWithUrl).mockResolvedValue([]);

    const job = await startFetchAllJob(BOOTSTRAP_USER_ID);

    expect(job).toMatchObject({ status: "done", total: 0, processed: 0, results: [] });
    expect(fetchVacancyText).not.toHaveBeenCalled();
  });

  it("writes progress after EACH item (not just once at the end), and includes match/gap in the final result", async () => {
    vi.useFakeTimers();
    vi.mocked(listVacanciesWithUrl).mockResolvedValue([
      vacancyRow(1, "Acme", "https://jobs.dou.ua/1"),
      vacancyRow(2, "Beta", "https://jobs.dou.ua/2"),
      vacancyRow(3, "Gamma", "https://jobs.dou.ua/3"),
    ]);
    const { setKvJson } = await import("../../db/index.js");

    const initial = await startFetchAllJob(BOOTSTRAP_USER_ID);
    expect(initial).toMatchObject({ status: "running", total: 3, processed: 0 });

    await vi.advanceTimersByTimeAsync(400 * 3 + 100);
    const job = await getFetchAllJob(BOOTSTRAP_USER_ID);
    expect(job).toMatchObject({ status: "done", processed: 3, total: 3 });
    expect(job?.finishedAt).toBeTruthy();
    expect(job?.results.map((r) => r.company)).toEqual(["Acme", "Beta", "Gamma"]);
    // previously discarded by the synchronous route (vacancies.routes.ts only kept techs/level/fit) —
    // now wired through since it's already computed by quickAnalyze for free.
    expect(job?.results[0]).toMatchObject({ id: 1, company: "Acme", match: ["React"], gap: ["Node.js"], level: "Middle", fit: "med" });
    // 1 initial write (start) + 1 per item (3) + 1 final "done" write = 5 — proves progress is
    // persisted incrementally as the loop goes, not assembled in memory and written once at the end.
    expect(setKvJson).toHaveBeenCalledTimes(5);

    vi.useRealTimers();
  });

  it("a single vacancy's fetch/analyze failure is recorded per-item — the loop still finishes the rest", async () => {
    vi.useFakeTimers();
    vi.mocked(listVacanciesWithUrl).mockResolvedValue([
      vacancyRow(1, "Acme", "https://jobs.dou.ua/1"),
      vacancyRow(2, "Beta", "https://jobs.dou.ua/2"),
    ]);
    vi.mocked(fetchVacancyText).mockRejectedValueOnce(new Error("timeout"));

    await startFetchAllJob(BOOTSTRAP_USER_ID);
    await vi.advanceTimersByTimeAsync(450 * 2);

    const job = await getFetchAllJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("done");
    expect(job?.results[0]).toMatchObject({ id: 1, error: "timeout" });
    expect(job?.results[1]).toMatchObject({ id: 2, match: ["React"] });

    vi.useRealTimers();
  });

  it("does not start a second background loop while one is already running (idempotent)", async () => {
    vi.useFakeTimers();
    vi.mocked(listVacanciesWithUrl).mockResolvedValue([vacancyRow(1, "Acme", "https://jobs.dou.ua/1")]);

    const first = await startFetchAllJob(BOOTSTRAP_USER_ID);
    const second = await startFetchAllJob(BOOTSTRAP_USER_ID);

    expect(second).toEqual(first);
    expect(listVacanciesWithUrl).toHaveBeenCalledOnce(); // not called again for the second start attempt

    await vi.advanceTimersByTimeAsync(450);
    vi.useRealTimers();
  });

  it("allows a fresh start once a stuck 'running' job is older than the staleness window", async () => {
    const staleStartedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString(); // 11 min ago > 10 min guard
    kvStore.set(`${BOOTSTRAP_USER_ID}:fetchAllJob`, { status: "running", total: 1, processed: 0, results: [], startedAt: staleStartedAt });
    vi.mocked(listVacanciesWithUrl).mockResolvedValue([vacancyRow(9, "Zeta", "https://jobs.dou.ua/9")]);

    const job = await startFetchAllJob(BOOTSTRAP_USER_ID);

    expect(job.startedAt).not.toBe(staleStartedAt);
    expect(listVacanciesWithUrl).toHaveBeenCalledOnce();
  });

  it("a crash outside the per-item try/catch resolves to a terminal 'error' state, not stuck 'running'", async () => {
    vi.useFakeTimers();
    vi.mocked(listVacanciesWithUrl).mockResolvedValue([
      vacancyRow(1, "Acme", "https://jobs.dou.ua/1"),
      vacancyRow(2, "Beta", "https://jobs.dou.ua/2"),
    ]);
    const { setKvJson } = await import("../../db/index.js");
    // 1st call: the initial "running" write inside startFetchAllJob (must succeed so the job
    // actually starts) — 2nd call: the first per-item progress write inside the loop, simulating
    // e.g. the DB connection dropping mid-run.
    vi.mocked(setKvJson).mockImplementationOnce(async (userId: unknown, key: unknown, value: unknown) => {
      kvStore.set(`${userId as string}:${key as string}`, value);
    });
    vi.mocked(setKvJson).mockImplementationOnce(async () => {
      throw new Error("connection lost");
    });

    await startFetchAllJob(BOOTSTRAP_USER_ID as UserId);
    await vi.advanceTimersByTimeAsync(50);

    const job = await getFetchAllJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("error");
    expect(job?.error).toBe("connection lost");
    expect(mockLog.error).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });
});

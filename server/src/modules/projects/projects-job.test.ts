// projects-job.ts's background job runner + state persistence — the core behavior worth testing
// directly (not through projects.routes.ts, which is thin by design): idempotent start (won't
// double-run while one's already in flight), the staleness guard that lets a fresh job start
// after a crash left an old one stuck at "running", a top-level crash still resolving to a
// terminal "error" state instead of "running" forever, and — the piece unique to this job vs. its
// cv-audit-job.ts/fetch-all-job.ts siblings — the RESULT staying sticky across a fresh run and
// across a crash, so a background refresh never blanks out the last known-good personalized list.
//
// getDynamicProjects() is mocked wholesale (not its internals) — this suite is about the JOB'S
// orchestration, not about gap selection/prompt building, which projects.service.test.ts already
// covers directly.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { DynamicProjects } from "./projects.service.js";

const kvStore = new Map<string, unknown>();
vi.mock("../../db/index.js", () => ({
  getKvJson: vi.fn(async (userId: string, key: string) => kvStore.get(`${userId}:${key}`) ?? null),
  setKvJson: vi.fn(async (userId: string, key: string, value: unknown) => {
    kvStore.set(`${userId}:${key}`, value);
  }),
}));
vi.mock("./projects.service.js", () => ({ getDynamicProjects: vi.fn() }));
const mockLog = { warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { getProjectsJob, startProjectsJob } from "./projects-job.js";
import { getDynamicProjects } from "./projects.service.js";

const CONTEXT = { profile: { skills: [], cvText: "" }, demand: {}, gapPriority: {} };

const RESULT_A: DynamicProjects = { projects: [], personalized: true };
const RESULT_B: DynamicProjects = { projects: [], personalized: true };

/** Flushes the microtask/macrotask queue so the fire-and-forget runProjectsJob() (kicked off with
 * `void` inside startProjectsJob) gets a turn to run and persist its result, without needing fake
 * timers (there's no setTimeout in this job, unlike fetch-all-job.ts's per-item pause). */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("projects-job", () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
    vi.mocked(getDynamicProjects).mockResolvedValue(RESULT_A);
  });

  it("starts running, then resolves to 'done' with getDynamicProjects()'s result", async () => {
    const initial = await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);
    expect(initial).toMatchObject({ status: "running", result: undefined });

    await flush();
    const job = await getProjectsJob(BOOTSTRAP_USER_ID);
    expect(job).toMatchObject({ status: "done", result: RESULT_A });
    expect(job?.finishedAt).toBeTruthy();
  });

  it("does not start a second background run while one is already running (idempotent)", async () => {
    vi.mocked(getDynamicProjects).mockImplementation(() => new Promise(() => {})); // never resolves

    const first = await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);
    const second = await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);

    expect(second).toEqual(first);
    expect(getDynamicProjects).toHaveBeenCalledOnce();
  });

  it("allows a fresh start once a stuck 'running' job is older than the staleness window", async () => {
    const staleStartedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString(); // 4 min ago > 3 min guard
    kvStore.set(`${BOOTSTRAP_USER_ID}:projectsJob`, { status: "running", startedAt: staleStartedAt });

    const job = await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);

    expect(job.startedAt).not.toBe(staleStartedAt);
    expect(getDynamicProjects).toHaveBeenCalledOnce();
  });

  it("a crash resolves to a terminal 'error' state, not stuck 'running'", async () => {
    vi.mocked(getDynamicProjects).mockRejectedValue(new Error("llm down"));

    await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);
    await flush();

    const job = await getProjectsJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("error");
    expect(job?.error).toBe("llm down");
    expect(mockLog.error).toHaveBeenCalledOnce();
  });

  it("carries the previous done result forward into a fresh run's 'running' state (sticky)", async () => {
    kvStore.set(`${BOOTSTRAP_USER_ID}:projectsJob`, {
      status: "done",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      result: RESULT_A,
    });
    vi.mocked(getDynamicProjects).mockImplementation(() => new Promise(() => {})); // still running

    const job = await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);

    expect(job).toMatchObject({ status: "running", result: RESULT_A });
  });

  it("a crash during a refresh still preserves the last known-good result (sticky through failure)", async () => {
    kvStore.set(`${BOOTSTRAP_USER_ID}:projectsJob`, {
      status: "done",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      result: RESULT_A,
    });
    vi.mocked(getDynamicProjects).mockRejectedValue(new Error("llm down"));

    await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);
    await flush();

    const job = await getProjectsJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("error");
    expect(job?.result).toEqual(RESULT_A);
  });

  it("a fresh successful run replaces the sticky result with the new one", async () => {
    kvStore.set(`${BOOTSTRAP_USER_ID}:projectsJob`, {
      status: "done",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      result: RESULT_A,
    });
    vi.mocked(getDynamicProjects).mockResolvedValue(RESULT_B);

    await startProjectsJob(BOOTSTRAP_USER_ID, CONTEXT);
    await flush();

    const job = await getProjectsJob(BOOTSTRAP_USER_ID);
    expect(job?.result).toEqual(RESULT_B);
  });
});

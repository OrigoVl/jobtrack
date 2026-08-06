// cv-review-job.ts's background job runner + state persistence — same reasoning as
// vacancies/fetch-all-job.test.ts: the job's orchestration (step transitions, idempotency,
// staleness, crash handling) is worth testing directly, not through cv.routes.ts (thin by design).
// reviewCv() is mocked wholesale — this suite is about the JOB, not about CV review content
// (cv-analysis.service.ts has no direct tests of its own — see mock-interview.service.test.ts's
// sibling comment for the same "thin chatJson wrapper" reasoning).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { UserId } from "../../db/user-id.js";

const kvStore = new Map<string, unknown>();
vi.mock("../../db/index.js", () => ({
  getKvJson: vi.fn(async (userId: string, key: string) => kvStore.get(`${userId}:${key}`) ?? null),
  setKvJson: vi.fn(async (userId: string, key: string, value: unknown) => {
    kvStore.set(`${userId}:${key}`, value);
  }),
}));
vi.mock("./cv-analysis.service.js", () => ({ reviewCv: vi.fn() }));
const mockLog = { warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { getCvReviewJob, startCvReviewJob } from "./cv-review-job.js";
import { reviewCv } from "./cv-analysis.service.js";

const REVIEW_RESULT = {
  offline: false,
  score: 82,
  summary: "Solid resume.",
  strengths: ["Clear metrics"],
  issues: [],
  keywords: ["React"],
  rewrites: [],
};

describe("cv-review-job", () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  it("writes 'preparing' immediately, then 'generating_feedback' before the reviewCv() call resolves", async () => {
    let resolveReview: (v: typeof REVIEW_RESULT) => void = () => {};
    vi.mocked(reviewCv).mockReturnValue(new Promise((resolve) => (resolveReview = resolve)));

    const initial = await startCvReviewJob(BOOTSTRAP_USER_ID, "some resume text");
    expect(initial).toMatchObject({ status: "running", step: "preparing" });

    // Let the microtask queue flush so the job runner's first setKvJson (step -> generating_feedback) lands.
    await Promise.resolve();
    await Promise.resolve();
    const midway = await getCvReviewJob(BOOTSTRAP_USER_ID);
    expect(midway).toMatchObject({ status: "running", step: "generating_feedback" });

    resolveReview(REVIEW_RESULT);
    await new Promise((r) => setTimeout(r, 0));
    const final = await getCvReviewJob(BOOTSTRAP_USER_ID);
    expect(final).toMatchObject({ status: "done", result: REVIEW_RESULT });
    expect(final?.finishedAt).toBeTruthy();
  });

  it("passes through an offline review result as a normal 'done' job (not a job-level error)", async () => {
    vi.mocked(reviewCv).mockResolvedValue({ ...REVIEW_RESULT, offline: true, score: 0 });

    await startCvReviewJob(BOOTSTRAP_USER_ID, "some resume text");
    await new Promise((r) => setTimeout(r, 0));

    const job = await getCvReviewJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("done");
    expect(job?.result?.offline).toBe(true);
  });

  it("does not start a second background review while one is already running (idempotent)", async () => {
    vi.mocked(reviewCv).mockReturnValue(new Promise(() => {})); // never resolves during this test

    const first = await startCvReviewJob(BOOTSTRAP_USER_ID, "resume A");
    const second = await startCvReviewJob(BOOTSTRAP_USER_ID, "resume B");

    // Not a deep-equal check: the background job may have already advanced its step between the
    // two calls (a real race, not a bug) — what matters is it's still the SAME job (same
    // startedAt), not a second one, and reviewCv() was only invoked once.
    expect(second.startedAt).toBe(first.startedAt);
    expect(second.status).toBe("running");
    expect(reviewCv).toHaveBeenCalledOnce();
  });

  it("allows a fresh start once a stuck 'running' job is older than the staleness window", async () => {
    const staleStartedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString(); // 4 min ago > 3 min guard
    kvStore.set(`${BOOTSTRAP_USER_ID}:cvReviewJob`, { status: "running", step: "generating_feedback", startedAt: staleStartedAt });
    vi.mocked(reviewCv).mockResolvedValue(REVIEW_RESULT);

    const job = await startCvReviewJob(BOOTSTRAP_USER_ID, "resume text");

    expect(job.startedAt).not.toBe(staleStartedAt);
    expect(reviewCv).toHaveBeenCalledOnce();
  });

  it("a crash inside reviewCv() resolves to a terminal 'error' state, not stuck 'running'", async () => {
    vi.mocked(reviewCv).mockRejectedValue(new Error("provider timeout"));

    await startCvReviewJob(BOOTSTRAP_USER_ID as UserId, "resume text");
    await new Promise((r) => setTimeout(r, 0));

    const job = await getCvReviewJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("error");
    expect(job?.error).toBe("provider timeout");
    expect(mockLog.error).toHaveBeenCalledOnce();
  });
});

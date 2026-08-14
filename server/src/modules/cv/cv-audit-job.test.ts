// cv-audit-job.ts's background job runner + state persistence — same reasoning as
// vacancies/fetch-all-job.test.ts: the job's orchestration (step transitions, idempotency,
// staleness, crash handling) is worth testing directly, not through cv.routes.ts (thin by design).
// auditCv() is mocked wholesale — this suite is about the JOB, not about audit content
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
vi.mock("./cv-audit.service.js", () => ({ auditCv: vi.fn() }));
const mockLog = { warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { getCvAuditJob, startCvAuditJob } from "./cv-audit-job.js";
import { auditCv } from "./cv-audit.service.js";
import { CvDocSchema } from "./cv.schemas.js";

const DOC = CvDocSchema.parse({ name: "A", summary: "s", experience: [{ role: "R", company: "C", period: "P", bullets: ["b"] }] });

const AUDIT_RESULT = {
  offline: false,
  findings: [],
  positioning: { detectedRole: "Full Stack Developer", suggestedTitle: "Senior Full Stack Developer", rationale: "why" },
  score: 82,
  summary: "Solid resume.",
  strengths: ["Clear metrics"],
  keywords: ["React"],
};

describe("cv-audit-job", () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  it("writes 'preparing' immediately, then 'generating_feedback' before the auditCv() call resolves", async () => {
    let resolveAudit: (v: typeof AUDIT_RESULT) => void = () => {};
    vi.mocked(auditCv).mockReturnValue(new Promise((resolve) => (resolveAudit = resolve)));

    const initial = await startCvAuditJob(BOOTSTRAP_USER_ID, DOC);
    expect(initial).toMatchObject({ status: "running", step: "preparing" });

    // Let the microtask queue flush so the job runner's first setKvJson (step -> generating_feedback) lands.
    await Promise.resolve();
    await Promise.resolve();
    const midway = await getCvAuditJob(BOOTSTRAP_USER_ID);
    expect(midway).toMatchObject({ status: "running", step: "generating_feedback" });

    resolveAudit(AUDIT_RESULT);
    await new Promise((r) => setTimeout(r, 0));
    const final = await getCvAuditJob(BOOTSTRAP_USER_ID);
    expect(final).toMatchObject({ status: "done", result: AUDIT_RESULT });
    expect(final?.finishedAt).toBeTruthy();
  });

  it("passes through an offline audit result as a normal 'done' job (not a job-level error)", async () => {
    vi.mocked(auditCv).mockResolvedValue({ ...AUDIT_RESULT, offline: true, score: 0 });

    await startCvAuditJob(BOOTSTRAP_USER_ID, DOC);
    await new Promise((r) => setTimeout(r, 0));

    const job = await getCvAuditJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("done");
    expect(job?.result?.offline).toBe(true);
  });

  it("does not start a second background audit while one is already running (idempotent)", async () => {
    vi.mocked(auditCv).mockReturnValue(new Promise(() => {})); // never resolves during this test

    const first = await startCvAuditJob(BOOTSTRAP_USER_ID, DOC);
    const second = await startCvAuditJob(BOOTSTRAP_USER_ID, DOC);

    // Not a deep-equal check: the background job may have already advanced its step between the
    // two calls (a real race, not a bug) — what matters is it's still the SAME job (same
    // startedAt), not a second one, and auditCv() was only invoked once.
    expect(second.startedAt).toBe(first.startedAt);
    expect(second.status).toBe("running");
    expect(auditCv).toHaveBeenCalledOnce();
  });

  it("allows a fresh start once a stuck 'running' job is older than the staleness window", async () => {
    const staleStartedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString(); // 4 min ago > 3 min guard
    kvStore.set(`${BOOTSTRAP_USER_ID}:cvAuditJob`, { status: "running", step: "generating_feedback", startedAt: staleStartedAt });
    vi.mocked(auditCv).mockResolvedValue(AUDIT_RESULT);

    const job = await startCvAuditJob(BOOTSTRAP_USER_ID, DOC);

    expect(job.startedAt).not.toBe(staleStartedAt);
    expect(auditCv).toHaveBeenCalledOnce();
  });

  it("a crash inside auditCv() resolves to a terminal 'error' state, not stuck 'running'", async () => {
    vi.mocked(auditCv).mockRejectedValue(new Error("provider timeout"));

    await startCvAuditJob(BOOTSTRAP_USER_ID as UserId, DOC);
    await new Promise((r) => setTimeout(r, 0));

    const job = await getCvAuditJob(BOOTSTRAP_USER_ID);
    expect(job?.status).toBe("error");
    expect(job?.error).toBe("provider timeout");
    expect(mockLog.error).toHaveBeenCalledOnce();
  });
});

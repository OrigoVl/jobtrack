// Regression test for logging around external aggregators (Remotive/Arbeitnow/DOU): any
// non-2xx response, network error, or invalid JSON used to be silently turned into an empty
// result (fetchRemotive/fetchArbeitnow/fetchDou returned []), with no log of the cause.
// If a source starts blocking/failing, /jobs/search would just silently return fewer vacancies —
// these tests pin down the contract "always log the failure reason before returning null/[]".
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLog = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { fetchRemotive } from "./job-search.service.js";

describe("fetchRemotive() logs the reason before falling back to an empty list", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("logs a warning with the status when the aggregator responds with a non-2xx status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const jobs = await fetchRemotive("react");
    expect(jobs).toEqual([]);
    expect(mockLog.warn).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }), expect.stringContaining("non-2xx"));
  });

  it("logs a warning when the network request itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const jobs = await fetchRemotive("react");
    expect(jobs).toEqual([]);
    expect(mockLog.warn).toHaveBeenCalledOnce();
  });

  it("logs a warning when the response is 2xx but the body is not valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("Unexpected token <")),
    });
    const jobs = await fetchRemotive("react");
    expect(jobs).toEqual([]);
    expect(mockLog.warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("invalid JSON"));
  });

  it("returns parsed jobs without logging anything when the aggregator responds normally", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [{ company_name: "Acme", title: "Dev", url: "https://x", tags: ["React"] }] }),
    });
    const jobs = await fetchRemotive("react");
    expect(jobs).toHaveLength(1);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });
});

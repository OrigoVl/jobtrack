// These tests exist for the redirect case above all: it's the one that looks like it works when
// it doesn't, because the guard runs, passes, and then undici quietly follows a hop the guard
// never saw.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTextSafely } from "./safe-fetch.js";

const fetchMock = vi.fn();

function textResponse(body: string, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
  };
}

function redirect(location: string, status = 302) {
  return { status, ok: false, headers: new Headers({ location }), body: null };
}

describe("fetchTextSafely()", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the body of a plain 200", async () => {
    fetchMock.mockResolvedValue(textResponse("<html>hello</html>"));

    expect(await fetchTextSafely("https://acme.test/page")).toEqual({ text: "<html>hello</html>", status: 200 });
  });

  it("never sends the request when the url itself is blocked", async () => {
    expect(await fetchTextSafely("http://acme.test/page")).toEqual({ text: "", status: 0 }); // not https
    expect(await fetchTextSafely("https://localhost/page")).toEqual({ text: "", status: 0 });
    expect(await fetchTextSafely("https://169.254.169.254/")).toEqual({ text: "", status: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-checks each redirect hop and refuses one pointing at an internal address", async () => {
    fetchMock.mockResolvedValueOnce(redirect("http://169.254.169.254/latest/meta-data/"));

    expect(await fetchTextSafely("https://acme.test/page")).toEqual({ text: "", status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes("169.254"))).toBe(true);
  });

  it("passes redirect:'manual' so undici can't follow a hop behind the guard's back", async () => {
    fetchMock.mockResolvedValue(textResponse("ok"));
    await fetchTextSafely("https://acme.test/page");

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("follows a safe redirect, including a relative Location", async () => {
    fetchMock.mockResolvedValueOnce(redirect("/moved")).mockResolvedValueOnce(textResponse("arrived"));

    expect(await fetchTextSafely("https://acme.test/page")).toEqual({ text: "arrived", status: 200 });
    expect(String(fetchMock.mock.calls[1]![0])).toBe("https://acme.test/moved");
  });

  it("gives up on a redirect loop instead of following it forever", async () => {
    fetchMock.mockResolvedValue(redirect("https://acme.test/loop"));

    expect(await fetchTextSafely("https://acme.test/loop")).toEqual({ text: "", status: 0 });
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("reports the status of a remote error, with no body", async () => {
    fetchMock.mockResolvedValue(textResponse("nope", 503));

    expect(await fetchTextSafely("https://acme.test/page")).toEqual({ text: "", status: 503 });
  });

  it("stops reading past the byte cap rather than buffering the whole stream", async () => {
    let cancelled = false;
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new TextEncoder().encode("x".repeat(1024)));
        },
        cancel() {
          cancelled = true;
        },
      }),
    });

    const result = await fetchTextSafely("https://acme.test/huge", { maxBytes: 4096 });

    expect(cancelled).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(4096 + 1024);
  });

  it("treats a network failure as 'never reached', not as an error to throw", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(fetchTextSafely("https://acme.test/page")).resolves.toEqual({ text: "", status: 0 });
  });
});

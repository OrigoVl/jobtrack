// extractText() branches purely on filename extension / mimetype before handing the buffer to a
// parser (mammoth for docx, pdfjs for pdf) — this is what decides whether a CV upload works at
// all, so the branching itself (not just the happy path) needs coverage. In particular: a legacy
// binary .doc file currently routes into mammoth (it only understands modern OOXML .docx) and
// throws — see cv.routes.ts's try/catch around extractText() for how that's turned into a clean
// 400 instead of a raw 500, and upload.ts for why .doc was removed from the advertised formats.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { extractRawText } = vi.hoisted(() => ({ extractRawText: vi.fn() }));
const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));

vi.mock("mammoth", () => ({ default: { extractRawText } }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument }));

describe("extractText()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads a .txt file as plain UTF-8 text, without touching mammoth or pdfjs", async () => {
    const { extractText } = await import("./cv-extract.service.js");

    const out = await extractText(Buffer.from("hello world"), "cv.txt", "text/plain");

    expect(out).toBe("hello world");
    expect(extractRawText).not.toHaveBeenCalled();
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("extracts a .docx file's raw text via mammoth", async () => {
    extractRawText.mockResolvedValue({ value: "Senior Engineer" });
    const { extractText } = await import("./cv-extract.service.js");

    const out = await extractText(
      Buffer.from("fake docx bytes"),
      "cv.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(out).toBe("Senior Engineer");
    expect(extractRawText).toHaveBeenCalledTimes(1);
  });

  it("extracts a .pdf file's text page-by-page via pdfjs", async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn(async (n: number) => ({
          getTextContent: async () => ({ items: [{ str: `page ${n}` }] }),
        })),
      }),
    });
    const { extractText } = await import("./cv-extract.service.js");

    const out = await extractText(Buffer.from("fake pdf bytes"), "cv.pdf", "application/pdf");

    expect(out).toBe("page 1\npage 2");
  });

  it("falls back to reading the buffer as plain text for an unrecognized extension, without ever calling a parser", async () => {
    const { extractText } = await import("./cv-extract.service.js");

    const out = await extractText(Buffer.from("some raw content"), "cv.rtf", "application/octet-stream");

    expect(out).toBe("some raw content");
    expect(extractRawText).not.toHaveBeenCalled();
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("propagates the parser's failure for a legacy .doc file instead of silently returning empty text", async () => {
    // mammoth can't parse the old binary .doc format — this documents that today it still gets
    // routed there (name doesn't match .docx, but the msword mimetype does) and throws, which is
    // exactly the case cv.routes.ts's try/catch around extractText() exists to turn into a 400.
    extractRawText.mockRejectedValue(new Error("end of central directory record not found"));
    const { extractText } = await import("./cv-extract.service.js");

    await expect(extractText(Buffer.from("fake legacy doc bytes"), "cv.doc", "application/msword")).rejects.toThrow(
      "end of central directory record not found",
    );
  });
});

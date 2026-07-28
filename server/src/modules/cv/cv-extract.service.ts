import mammoth from "mammoth";

// Extracts text from a CV: PDF / DOCX / TXT.
export async function extractText(buffer: Buffer, filename = "", mimetype = ""): Promise<string> {
  const name = filename.toLowerCase();
  const mt = mimetype.toLowerCase();

  if (name.endsWith(".txt") || mt.includes("text/plain")) {
    return buffer.toString("utf8");
  }
  if (name.endsWith(".docx") || mt.includes("wordprocessingml") || mt.includes("msword")) {
    const r = await mammoth.extractRawText({ buffer });
    return r.value || "";
  }
  if (name.endsWith(".pdf") || mt.includes("pdf")) {
    return await extractPdf(buffer);
  }
  // try as plain text
  return buffer.toString("utf8");
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
  }
  return text.trim();
}

import { Fragment, type ReactNode } from "react";

type Block =
  | { type: "h"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; lines: string[] };

const BULLET_RE = /^\s*[-*•]\s+/;
const NUMBERED_RE = /^\s*\d+[.)]\s+/;
const HEADING_RE = /^(#{1,4})\s+(.*)$/;

/** Splits raw LLM/markdown-ish text into block-level nodes: headings, bulleted/numbered lists,
 * and paragraphs (a run of non-empty, non-list, non-heading lines — kept as separate `lines` so
 * the caller can render single newlines as `<br/>` instead of collapsing them). Exported alongside
 * the `Markdown` component purely so it's independently unit-testable — it's not itself a
 * component, hence the fast-refresh lint disable below. */
// eslint-disable-next-line react-refresh/only-export-components
export function parseMarkdownBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(HEADING_RE);
    if (h) {
      blocks.push({ type: "h", level: (h[1] ?? "#").length, text: (h[2] ?? "").trim() });
      i++;
      continue;
    }
    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(BULLET_RE, "").trim());
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (NUMBERED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBERED_RE.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(NUMBERED_RE, "").trim());
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !BULLET_RE.test(lines[i] ?? "") &&
      !NUMBERED_RE.test(lines[i] ?? "") &&
      !HEADING_RE.test(lines[i] ?? "")
    ) {
      para.push((lines[i] ?? "").trim());
      i++;
    }
    blocks.push({ type: "p", lines: para });
  }
  return blocks;
}

/** Renders `**bold**` inside a single line of text; everything else stays as plain text. */
function renderInlineText(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={`${keyPrefix}-${i}`}>{m[1]}</strong> : <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

const HEADING_SIZE: Record<number, string> = { 1: "text-base", 2: "text-base", 3: "text-sm", 4: "text-sm" };

/**
 * Minimal renderer for the free-text markdown that LLM calls in this app tend to produce
 * (`**bold**`, `#`/`##` headings, `-`/`*` and `1.` lists, paragraphs with line breaks) — used for
 * every place an LLM's plain-text response is shown to the user (CV advice/review, vacancy
 * analysis, cover letters, learning plan, focus-of-the-week, etc.), so `**Key Requirements:**`
 * renders as bold instead of literal asterisks. Deliberately not a full CommonMark parser (no
 * tables/links/code fences/nesting) — that's everything this app's LLM prompts actually produce,
 * and pulling in `react-markdown` for just this would be a lot of dependency weight.
 *
 * `inline` renders bold-only, no block wrappers — for embedding inside an existing `<span>`/`<p>`
 * (e.g. a one-line "Focus of the week" action or "personal focus" hint).
 */
export function Markdown({ text, className, inline = false }: { text: string; className?: string; inline?: boolean }) {
  if (!text || !text.trim()) return null;
  if (inline) return <>{renderInlineText(text, "i")}</>;
  const blocks = parseMarkdownBlocks(text);
  return (
    <div className={className ?? "text-sm text-ink space-y-2"}>
      {blocks.map((b, idx) => {
        if (b.type === "h") {
          return (
            <div key={idx} className={`font-semibold text-ink ${HEADING_SIZE[b.level] ?? "text-sm"}`}>
              {renderInlineText(b.text, `h${idx}`)}
            </div>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {b.items.map((it, i) => (
                <li key={i}>{renderInlineText(it, `ul${idx}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1">
              {b.items.map((it, i) => (
                <li key={i}>{renderInlineText(it, `ol${idx}-${i}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={idx}>
            {b.lines.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {renderInlineText(l, `p${idx}-${i}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown, parseMarkdownBlocks } from "./markdown";

describe("parseMarkdownBlocks", () => {
  it("parses a heading, a paragraph, and a bulleted list", () => {
    const blocks = parseMarkdownBlocks("**Key Requirements:**\n- React\n- Node.js\n\nGood fit overall.");
    expect(blocks).toEqual([
      { type: "p", lines: ["**Key Requirements:**"] },
      { type: "ul", items: ["React", "Node.js"] },
      { type: "p", lines: ["Good fit overall."] },
    ]);
  });

  it("parses a numbered list", () => {
    const blocks = parseMarkdownBlocks("1. First\n2. Second");
    expect(blocks).toEqual([{ type: "ol", items: ["First", "Second"] }]);
  });

  it("parses a markdown heading line (#/##)", () => {
    const blocks = parseMarkdownBlocks("## Summary\nSome text");
    expect(blocks[0]).toEqual({ type: "h", level: 2, text: "Summary" });
  });

  it("keeps consecutive non-list lines as one paragraph with separate lines", () => {
    const blocks = parseMarkdownBlocks("Line one\nLine two");
    expect(blocks).toEqual([{ type: "p", lines: ["Line one", "Line two"] }]);
  });
});

describe("Markdown component", () => {
  it("renders **bold** as a <strong> element, not literal asterisks", () => {
    render(<Markdown text="This is **important** context." />);
    const strong = screen.getByText("important");
    expect(strong.tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it("renders a bulleted list as <li> items", () => {
    render(<Markdown text={"- React\n- Node.js"} />);
    expect(screen.getByText("React").closest("li")).toBeInTheDocument();
    expect(screen.getByText("Node.js").closest("li")).toBeInTheDocument();
  });

  it("renders nothing for empty text", () => {
    const { container } = render(<Markdown text="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders inline mode without block wrappers, bold still works", () => {
    render(
      <span>
        <Markdown text="Follow up with **Acme Corp** today." inline />
      </span>,
    );
    const strong = screen.getByText("Acme Corp");
    expect(strong.tagName).toBe("STRONG");
  });
});

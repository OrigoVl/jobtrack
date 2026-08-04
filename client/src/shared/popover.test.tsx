import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { usePopover } from "./use-popover";
import { PopoverPanel } from "./popover";

/** Minimal harness: a button anchor + a portaled panel, mirroring how Dropdown/DateInput use
 * usePopover/PopoverPanel. */
function Harness({ onSelect }: { onSelect: (value: string) => void }) {
  const { open, setOpen, anchorRef, panelRef, coords } = usePopover((rect) => ({ top: rect.bottom, left: rect.left }));
  return (
    <div ref={anchorRef}>
      <button type="button" onClick={() => setOpen(!open)}>
        Toggle
      </button>
      <PopoverPanel open={open} panelRef={panelRef} coords={coords} onClose={() => setOpen(false)}>
        <button type="button" onClick={() => onSelect("picked")}>
          Pick me
        </button>
        <button type="button" data-keep-open onClick={() => onSelect("kept-open")}>
          Keep open
        </button>
      </PopoverPanel>
    </div>
  );
}

describe("usePopover / PopoverPanel", () => {
  it("renders nothing until opened", () => {
    render(<Harness onSelect={() => {}} />);
    expect(screen.queryByText("Pick me")).not.toBeInTheDocument();
  });

  it("opens the panel on toggle and closes it after picking an item", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Toggle"));
    expect(screen.getByText("Pick me")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Pick me"));
    expect(onSelect).toHaveBeenCalledWith("picked");
    expect(screen.queryByText("Pick me")).not.toBeInTheDocument();
  });

  it("stays open when clicking an item marked data-keep-open", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Toggle"));
    fireEvent.click(screen.getByText("Keep open"));
    expect(onSelect).toHaveBeenCalledWith("kept-open");
    expect(screen.getByText("Pick me")).toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <Harness onSelect={() => {}} />
        <button type="button">Elsewhere</button>
      </div>,
    );
    fireEvent.click(screen.getByText("Toggle"));
    expect(screen.getByText("Pick me")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("Elsewhere"));
    expect(screen.queryByText("Pick me")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<Harness onSelect={() => {}} />);
    fireEvent.click(screen.getByText("Toggle"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Pick me")).not.toBeInTheDocument();
  });

  it("caps the panel's height to the remaining viewport space and lets it scroll instead of overflowing off-screen", () => {
    // Regression: the Vacancies Kanban board's "Move ▾" menu (built on this same plumbing) opened
    // near the bottom of the window rendered past the viewport edge with no way to scroll to the
    // remaining items — usePopover must always bound the panel to what's actually visible.
    const bottom = window.innerHeight - 300; // anchor sits with ~300px of room below it
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: bottom - 20, bottom, left: 0, right: 100 } as DOMRect);
    render(<Harness onSelect={() => {}} />);
    fireEvent.click(screen.getByText("Toggle"));
    const panel = screen.getByText("Pick me").parentElement as HTMLElement;
    expect(panel.className).toContain("overflow-y-auto");
    const maxHeight = parseFloat(panel.style.maxHeight);
    // Roughly "the ~300px left below the anchor", and nowhere near the full window height.
    expect(maxHeight).toBeGreaterThan(100);
    expect(maxHeight).toBeLessThan(window.innerHeight - 100);
    rectSpy.mockRestore();
  });
});

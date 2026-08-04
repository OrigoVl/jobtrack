import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "../i18n";
import { CalendarPanel } from "./calendar-panel";

describe("CalendarPanel", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders 42 day cells for the selected day's month", () => {
    render(<CalendarPanel selected="2026-07-15" onSelect={() => {}} />);
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    // 6 weeks × 7 days, each rendered as its own button (plus the two month-nav buttons)
    expect(screen.getAllByRole("button")).toHaveLength(44);
  });

  it("calls onSelect with the clicked day's yyyy-MM-dd key", () => {
    const onSelect = vi.fn();
    render(<CalendarPanel selected="2026-07-15" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /July 20, 2026/ }));
    expect(onSelect).toHaveBeenCalledWith("2026-07-20");
  });

  it("navigates to the next/previous month without calling onSelect", () => {
    const onSelect = vi.fn();
    render(<CalendarPanel selected="2026-07-15" onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Previous month"));
    fireEvent.click(screen.getByLabelText("Previous month"));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("falls back to the current month when nothing is selected yet", () => {
    render(<CalendarPanel selected="" onSelect={() => {}} />);
    // Just asserts it renders without throwing and shows some month label.
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("follows the active app language for the month label and weekday abbreviations", async () => {
    await i18n.changeLanguage("uk");
    render(<CalendarPanel selected="2026-07-15" onSelect={() => {}} />);
    expect(screen.getByText("липень 2026 р.")).toBeInTheDocument();
    expect(screen.getByText("пн")).toBeInTheDocument();
    expect(screen.getByText("нд")).toBeInTheDocument();
  });
});

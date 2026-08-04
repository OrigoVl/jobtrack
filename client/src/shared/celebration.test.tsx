import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CelebrationOverlay } from "./celebration";
import { useFireCelebration } from "./use-celebration";

/** Minimal harness: a button that fires a celebration + the overlay that renders it, mirroring
 * how a real caller (useUpdateVacancy's onSuccess, dashboard.tsx's onboarding effect) and
 * <CelebrationOverlay> (mounted once in Shell()) are two independent components wired only
 * through the shared useUi store. */
function Harness() {
  const fire = useFireCelebration();
  return (
    <>
      <button type="button" onClick={() => fire("🎉", "Congrats!")}>
        Fire
      </button>
      <CelebrationOverlay />
    </>
  );
}

describe("CelebrationOverlay / useFireCelebration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing until a celebration is fired", () => {
    render(<Harness />);
    expect(screen.queryByText("Congrats!")).not.toBeInTheDocument();
  });

  it("shows the banner once fired", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Fire"));
    expect(screen.getByText("Congrats!")).toBeInTheDocument();
    expect(screen.getByText("🎉")).toBeInTheDocument();
  });

  it("auto-dismisses after a few seconds", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Fire"));
    expect(screen.getByText("Congrats!")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("Congrats!")).not.toBeInTheDocument();
  });

  it("firing again while one is already showing replaces the message", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Fire"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByText("Fire"));
    expect(screen.getAllByText("Congrats!")).toHaveLength(1);
  });
});

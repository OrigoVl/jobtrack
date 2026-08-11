import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillsInput } from "./view-kit";

/** SkillsInput is controlled — a local-state host is what makes a reorder actually stick, the
 * same way the CV Builder's `onChange={(skills) => set({ skills })}` does. */
function Host({ initial, reorderable = true }: { initial: string[]; reorderable?: boolean }) {
  const [skills, setSkills] = useState(initial);
  return <SkillsInput label="Skills" skills={skills} onChange={setSkills} reorderable={reorderable} />;
}

/** Chips in DOM order — the order the CV prints them in (see cv-doc-utils.ts). */
const chipOrder = () => screen.getAllByRole("button", { name: /position \d+ of/ }).map((el) => el.textContent);

describe("SkillsInput reordering", () => {
  it("moves a skill with the arrow keys", () => {
    render(<Host initial={["React", "Node.js", "SQL"]} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /^SQL — position 3 of 3/ }), { key: "ArrowLeft" });
    expect(chipOrder()).toEqual(["React", "SQL", "Node.js"]);
  });

  it("keeps focus on the skill that moved, so a second arrow press moves the SAME one again", () => {
    // Without the explicit refocus, focus stays on the position rather than the chip: the list
    // re-renders with index-keyed nodes, so the next press would grab whichever skill slid in.
    render(<Host initial={["React", "Node.js", "SQL"]} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /^SQL — position 3 of 3/ }), { key: "ArrowLeft" });
    expect(document.activeElement).toHaveTextContent("SQL");

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(chipOrder()).toEqual(["SQL", "React", "Node.js"]);
  });

  it("does nothing at either edge instead of wrapping around", () => {
    render(<Host initial={["React", "Node.js"]} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /^React — position 1 of 2/ }), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("button", { name: /^Node.js — position 2 of 2/ }), { key: "ArrowRight" });
    expect(chipOrder()).toEqual(["React", "Node.js"]);
  });

  it("drops a dragged skill at the position it was dropped on", () => {
    render(<Host initial={["React", "Node.js", "SQL"]} />);
    fireEvent.dragStart(screen.getByRole("button", { name: /^SQL — position 3 of 3/ }));
    fireEvent.drop(screen.getByRole("button", { name: /^React — position 1 of 3/ }));
    expect(chipOrder()).toEqual(["SQL", "React", "Node.js"]);
  });

  it("stays a plain chip list when not opted in — a vacancy's stack has no meaningful order", () => {
    render(<Host initial={["React", "Node.js"]} reorderable={false} />);
    expect(screen.queryAllByRole("button", { name: /position \d+ of/ })).toHaveLength(0);
    // The remove buttons are still there — this only turns off the reordering affordance.
    expect(screen.getByRole("button", { name: "Remove React" })).toBeInTheDocument();
  });

  it("removing a skill still works while reordering is on", () => {
    render(<Host initial={["React", "Node.js", "SQL"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Node.js" }));
    expect(chipOrder()).toEqual(["React", "SQL"]);
  });
});

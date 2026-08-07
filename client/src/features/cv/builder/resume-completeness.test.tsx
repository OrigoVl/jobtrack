import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CvDoc } from "../../../shared/types";
import { ResumeCompleteness } from "./resume-completeness";

const EMPTY_DOC: CvDoc = {
  name: "",
  title: "",
  contact: "",
  summary: "",
  skills: [],
  experience: [],
  education: [],
  projects: [],
};

const FULL_DOC: CvDoc = {
  ...EMPTY_DOC,
  name: "Michael Voloshyn",
  title: "Full-Stack Developer",
  contact: "michael@example.com",
  summary: "Summary",
  skills: ["TypeScript"],
  experience: [{ role: "Dev", company: "Acme", period: "2024", bullets: ["Shipped a thing"] }],
  education: [{ school: "KPI", degree: "MSc", period: "2020" }],
  projects: [{ title: "Zorya", description: "Job tracker", tech: [], link: "" }],
  certifications: [{ name: "AWS SAA", issuer: "", date: "" }],
  languages: [{ name: "English", level: "B2" }],
};

describe("ResumeCompleteness", () => {
  it("scores 0% on an empty doc and 100% once every tracked section has content", () => {
    const { rerender } = render(<ResumeCompleteness doc={EMPTY_DOC} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    rerender(<ResumeCompleteness doc={FULL_DOC} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("doesn't credit an experience entry that has no bullets", () => {
    // A bare role/company row gives an ATS nothing to match a posting against, so it shouldn't
    // count toward the score — the widget would otherwise say "done" for an unusable entry.
    const doc: CvDoc = { ...FULL_DOC, experience: [{ role: "Dev", company: "Acme", period: "2024", bullets: ["  "] }] };
    render(<ResumeCompleteness doc={doc} onJump={vi.fn()} />);
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to section: Experience" })).toBeInTheDocument();
  });

  it("turns each missing item into a button that opens the section it names", () => {
    const onJump = vi.fn();
    render(<ResumeCompleteness doc={EMPTY_DOC} onJump={onJump} />);

    fireEvent.click(screen.getByRole("button", { name: "Go to section: Projects" }));
    expect(onJump).toHaveBeenCalledWith("projects");

    // Both "General info" and "Summary" live in the same editor section, so both route there.
    fireEvent.click(screen.getByRole("button", { name: "Go to section: Summary" }));
    expect(onJump).toHaveBeenLastCalledWith("general");
  });

  it("gives each chip an accessible name distinct from the section's own accordion header", () => {
    // The visible label is just "Skills", identical to the accordion header further down the
    // column — without the aria-label the two are indistinguishable to assistive tech (and to
    // any by-role lookup).
    render(<ResumeCompleteness doc={EMPTY_DOC} onJump={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Skills" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to section: Skills" })).toBeInTheDocument();
  });

  it("renders the missing list as plain text when there's nowhere to jump to", () => {
    // The Dashboard's read-only card passes no onJump — offering buttons that do nothing there
    // would be worse than the sentence it had before.
    render(<ResumeCompleteness doc={EMPTY_DOC} bare />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Missing:/)).toBeInTheDocument();
  });

  it("says nothing about missing sections once the CV is complete", () => {
    render(<ResumeCompleteness doc={FULL_DOC} onJump={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Btn, Card, PageHeader, Section, Segmented } from "./ui";

describe("Btn", () => {
  it("renders children and handles click", () => {
    const onClick = vi.fn();
    render(<Btn onClick={onClick}>Save</Btn>);
    const btn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables interaction when disabled", () => {
    render(<Btn disabled>Unavailable</Btn>);
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });

  it("shows a spinner and disables the button while loading", () => {
    const onClick = vi.fn();
    render(
      <Btn loading onClick={onClick}>
        Save
      </Btn>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Card", () => {
  it("renders children inside a container", () => {
    render(<Card>card content</Card>);
    expect(screen.getByText("card content")).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders title, subtitle and actions", () => {
    render(<PageHeader title="Title" subtitle="Subtitle" actions={<Btn>Action</Btn>} />);
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("Subtitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });
});

describe("Section", () => {
  it("toggles open/closed on repeated header clicks, keeping content mounted (not unmounted) so a close animation is possible", () => {
    render(
      <Section title="General" defaultOpen={false}>
        <div>secret content</div>
      </Section>,
    );
    const header = screen.getByRole("button", { name: "General" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    // Content stays in the DOM even while collapsed — hidden via aria-hidden/zero-height on an
    // ancestor (Collapse), not an instant unmount, which is what makes the CLOSE transition
    // visible instead of the old "and it's just... gone" behavior.
    expect(screen.getByText("secret content")).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");

    // Clicking the header again while already open closes it — it used to be a no-op in the
    // CV Builder's exclusive accordion (clicking an open section's own header just re-set the
    // "active" key to itself).
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("in controlled mode, defers to onToggle's next-open boolean instead of managing its own state", () => {
    const onToggle = vi.fn();
    render(
      <Section title="Skills" open={true} onToggle={onToggle}>
        <div>skills body</div>
      </Section>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skills" }));
    // The parent owns `open` — clicking only reports the user's intent (close); Section itself
    // stays open here because the test doesn't feed the new value back in as a prop.
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Skills" })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("Segmented", () => {
  it("calls onChange with the selected value", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

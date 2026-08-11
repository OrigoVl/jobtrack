import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Btn, Card, PageHeader, SearchSelect, Section, Segmented } from "./ui";

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

describe("SearchSelect", () => {
  const OPTIONS = [
    { value: "", label: "— none —" },
    { value: "1", label: "Acme — Frontend dev" },
    { value: "2", label: "Globex — QA engineer" },
    { value: "3", label: "Initech — Frontend lead" },
  ];

  const renderSelect = (value = "", onChange = vi.fn()) => {
    render(<SearchSelect value={value} options={OPTIONS} onChange={onChange} aria-label="Linked vacancy" />);
    return { input: screen.getByRole("combobox", { name: "Linked vacancy" }), onChange };
  };

  it("shows the selected option's label, not its wire value", () => {
    const { input } = renderSelect("2");
    expect(input).toHaveValue("Globex — QA engineer");
  });

  it("opens the full list on click", () => {
    const { input } = renderSelect();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    fireEvent.click(input);
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("filters options by what is typed, case-insensitively", () => {
    const { input } = renderSelect();
    fireEvent.change(input, { target: { value: "front" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Acme — Frontend dev", "Initech — Frontend lead"]);
  });

  it("reports the picked option's value and shows its label", () => {
    const { input, onChange } = renderSelect();
    fireEvent.change(input, { target: { value: "globex" } });
    fireEvent.click(screen.getByRole("option", { name: "Globex — QA engineer" }));
    expect(onChange).toHaveBeenCalledWith("2");
    // The parent owns `value`, so the input keeps showing the (unchanged) empty selection here —
    // what matters is that the half-typed filter is gone, not left sitting in the field.
    expect(input).toHaveValue("— none —");
  });

  it("picks the active option with the keyboard", () => {
    const { input, onChange } = renderSelect();
    fireEvent.change(input, { target: { value: "front" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("3");
  });

  it("says so when nothing matches, instead of showing an empty panel", () => {
    const { input } = renderSelect();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("clears the field to an empty filter when focused, so the first keystroke isn't appended to the selected label", () => {
    const { input } = renderSelect("1");
    fireEvent.focus(input);
    expect(input).toHaveValue("");
    // The selection is still readable while filtering, just as the placeholder.
    expect(input).toHaveAttribute("placeholder", "Acme — Frontend dev");
  });

  it("keeps what has been typed when the already-open field is clicked again", () => {
    const { input } = renderSelect("1");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "glob" } });
    fireEvent.click(input);
    expect(input).toHaveValue("glob");
  });

  it("drops a half-typed filter when the field is left", () => {
    const { input, onChange } = renderSelect("1");
    fireEvent.change(input, { target: { value: "glob" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("Acme — Frontend dev");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes and restores the selected label on Escape", () => {
    const { input } = renderSelect("1");
    fireEvent.change(input, { target: { value: "glob" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(input).toHaveValue("Acme — Frontend dev");
  });
});

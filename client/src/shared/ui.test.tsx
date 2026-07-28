import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Btn, Card, PageHeader, Segmented } from "./ui";

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

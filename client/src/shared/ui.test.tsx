import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Btn, Card, PageHeader, Segmented } from "./ui";

describe("Btn", () => {
  it("renders children and handles click", () => {
    const onClick = vi.fn();
    render(<Btn onClick={onClick}>Зберегти</Btn>);
    const btn = screen.getByRole("button", { name: "Зберегти" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables interaction when disabled", () => {
    render(<Btn disabled>Недоступно</Btn>);
    expect(screen.getByRole("button", { name: "Недоступно" })).toBeDisabled();
  });
});

describe("Card", () => {
  it("renders children inside a container", () => {
    render(<Card>вміст картки</Card>);
    expect(screen.getByText("вміст картки")).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders title, subtitle and actions", () => {
    render(<PageHeader title="Заголовок" subtitle="Підзаголовок" actions={<Btn>Дія</Btn>} />);
    expect(screen.getByRole("heading", { name: "Заголовок" })).toBeInTheDocument();
    expect(screen.getByText("Підзаголовок")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Дія" })).toBeInTheDocument();
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

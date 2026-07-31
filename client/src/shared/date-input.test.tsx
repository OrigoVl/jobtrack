import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateInput } from "./date-input";

describe("DateInput", () => {
  it("displays an ISO value as mm/dd/yyyy regardless of OS/browser locale", () => {
    render(<DateInput value="2026-07-01" onChange={() => {}} aria-label="Applied date" />);
    expect(screen.getByLabelText("Applied date")).toHaveValue("07/01/2026");
  });

  it("shows an empty field (with placeholder) for an empty value", () => {
    render(<DateInput value="" onChange={() => {}} aria-label="Applied date" />);
    const input = screen.getByLabelText("Applied date") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("mm/dd/yyyy");
  });

  it("auto-inserts slashes as digits are typed and commits once the date is complete", () => {
    const onChange = vi.fn();
    render(<DateInput value="" onChange={onChange} aria-label="Next step date" />);
    const input = screen.getByLabelText("Next step date");
    fireEvent.change(input, { target: { value: "07012026" } });
    expect(input).toHaveValue("07/01/2026");
    expect(onChange).toHaveBeenCalledWith("2026-07-01");
  });

  it("does not call onChange while the date is still incomplete", () => {
    const onChange = vi.fn();
    render(<DateInput value="" onChange={onChange} aria-label="Next step date" />);
    fireEvent.change(screen.getByLabelText("Next step date"), { target: { value: "0701" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reverts an incomplete date back to the last saved value on blur", () => {
    const onChange = vi.fn();
    render(<DateInput value="2026-07-01" onChange={onChange} aria-label="Applied date" />);
    const input = screen.getByLabelText("Applied date");
    fireEvent.change(input, { target: { value: "0812" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("07/01/2026");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the value when the field is emptied", () => {
    const onChange = vi.fn();
    render(<DateInput value="2026-07-01" onChange={onChange} aria-label="Applied date" />);
    const input = screen.getByLabelText("Applied date");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateInput, DateTimeInput } from "./date-input";

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

  it("opens the calendar when the field itself is clicked, not only the icon", () => {
    const onChange = vi.fn();
    render(<DateInput value="2026-07-01" onChange={onChange} aria-label="Applied date" />);
    const input = screen.getByLabelText("Applied date");
    expect(screen.queryByLabelText("Previous month")).not.toBeInTheDocument();

    fireEvent.click(input);

    expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-07-15");
  });

  it("keeps the calendar open when the field is clicked again, so the caret can be moved", () => {
    // Toggling here would dismiss the panel the moment someone clicks into the text to fix a
    // digit — the icon stays the toggle, the field only ever opens.
    render(<DateInput value="2026-07-01" onChange={() => {}} aria-label="Applied date" />);
    const input = screen.getByLabelText("Applied date");
    fireEvent.click(input);
    fireEvent.click(input);
    expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
  });

  it("still lets the field be typed into while the calendar is open", () => {
    const onChange = vi.fn();
    render(<DateInput value="" onChange={onChange} aria-label="Applied date" />);
    const input = screen.getByLabelText("Applied date");
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "07012026" } });
    expect(onChange).toHaveBeenCalledWith("2026-07-01");
  });

  it("does not open on focus alone, so tabbing through a table doesn't spawn calendars", () => {
    render(<DateInput value="2026-07-01" onChange={() => {}} aria-label="Applied date" />);
    fireEvent.focus(screen.getByLabelText("Applied date"));
    expect(screen.queryByLabelText("Previous month")).not.toBeInTheDocument();
  });

  it("opens a calendar popover with the picker button and commits the clicked day", () => {
    const onChange = vi.fn();
    render(<DateInput value="2026-07-01" onChange={onChange} aria-label="Applied date" />);
    fireEvent.click(screen.getByLabelText("Open calendar"));
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-07-15");
    expect(screen.getByLabelText("Applied date")).toHaveValue("07/15/2026");
    // Picking a day closes the popover.
    expect(screen.queryByLabelText("Previous month")).not.toBeInTheDocument();
  });
});

describe("DateTimeInput", () => {
  it("displays a local datetime value as mm/dd/yyyy, HH:mm regardless of OS/browser locale", () => {
    render(<DateTimeInput value="2026-07-31T09:00" onChange={() => {}} aria-label="Event start" />);
    expect(screen.getByLabelText("Event start")).toHaveValue("07/31/2026, 09:00");
  });

  it("shows an empty field (with placeholder) for an empty value", () => {
    render(<DateTimeInput value="" onChange={() => {}} aria-label="Event start" />);
    const input = screen.getByLabelText("Event start") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("mm/dd/yyyy, HH:mm");
  });

  it("auto-inserts separators as digits are typed and commits once the datetime is complete", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="" onChange={onChange} aria-label="Event start" />);
    const input = screen.getByLabelText("Event start");
    fireEvent.change(input, { target: { value: "073120260900" } });
    expect(input).toHaveValue("07/31/2026, 09:00");
    expect(onChange).toHaveBeenCalledWith("2026-07-31T09:00");
  });

  it("does not call onChange while the datetime is still incomplete", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="" onChange={onChange} aria-label="Event start" />);
    fireEvent.change(screen.getByLabelText("Event start"), { target: { value: "0731202609" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reverts an incomplete datetime back to the last saved value on blur", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="2026-07-31T09:00" onChange={onChange} aria-label="Event start" />);
    const input = screen.getByLabelText("Event start");
    fireEvent.change(input, { target: { value: "081220261" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("07/31/2026, 09:00");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the value when the field is emptied", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="2026-07-31T09:00" onChange={onChange} aria-label="Event start" />);
    const input = screen.getByLabelText("Event start");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("rejects out-of-range hour/minute", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="" onChange={onChange} aria-label="Event start" />);
    fireEvent.change(screen.getByLabelText("Event start"), { target: { value: "073120262565" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens the calendar when the field itself is clicked, keeping the typed time of day", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="2026-07-31T14:30" onChange={onChange} aria-label="Event start" />);
    fireEvent.click(screen.getByLabelText("Event start"));
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-07-15T14:30");
  });

  it("picking a day from the calendar popover keeps the existing time of day", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="2026-07-31T14:30" onChange={onChange} aria-label="Event start" />);
    fireEvent.click(screen.getByLabelText("Open calendar"));
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-07-15T14:30");
  });

  it("picking a day on an empty field defaults the time to 09:00", () => {
    const onChange = vi.fn();
    render(<DateTimeInput value="" onChange={onChange} aria-label="Event start" />);
    fireEvent.click(screen.getByLabelText("Open calendar"));
    // No selected value yet → the popover falls back to the current month; click "today" (marked
    // via aria-current) rather than a hardcoded date so this doesn't rot as real time passes.
    fireEvent.click(screen.getByRole("button", { current: "date" }));
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/T09:00$/));
  });

  it("moves on to a time list after a day is picked, instead of closing", () => {
    render(<DateTimeInput value="2026-07-31T14:30" onChange={() => {}} aria-label="Event start" />);
    fireEvent.click(screen.getByLabelText("Event start"));
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));

    expect(screen.queryByLabelText("Previous month")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "14:30" })).toBeInTheDocument();
  });

  it("commits the day and the clicked time, then closes", () => {
    const onChange = vi.fn();
    const { rerender } = render(<DateTimeInput value="2026-07-31T14:30" onChange={onChange} aria-label="Event start" />);
    fireEvent.click(screen.getByLabelText("Open calendar"));
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));
    // The day commits immediately, keeping the old time — the parent echoes it back.
    expect(onChange).toHaveBeenCalledWith("2026-07-15T14:30");
    rerender(<DateTimeInput value="2026-07-15T14:30" onChange={onChange} aria-label="Event start" />);

    fireEvent.click(screen.getByRole("button", { name: "10:30" }));

    expect(onChange).toHaveBeenLastCalledWith("2026-07-15T10:30");
    expect(screen.getByLabelText("Event start")).toHaveValue("07/15/2026, 10:30");
    expect(screen.queryByRole("button", { name: "10:30" })).not.toBeInTheDocument();
  });

  it("goes back to the calendar from the time step without closing", () => {
    render(<DateTimeInput value="2026-07-31T14:30" onChange={() => {}} aria-label="Event start" />);
    fireEvent.click(screen.getByLabelText("Open calendar"));
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));

    fireEvent.click(screen.getByLabelText("Back to calendar"));

    expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "14:30" })).not.toBeInTheDocument();
  });

  it("reopens on the calendar step, not on the time step it was left at", () => {
    render(<DateTimeInput value="2026-07-31T14:30" onChange={() => {}} aria-label="Event start" />);
    fireEvent.click(screen.getByLabelText("Open calendar"));
    fireEvent.click(screen.getByRole("button", { name: /July 15, 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "09:00" }));

    fireEvent.click(screen.getByLabelText("Open calendar"));

    expect(screen.getByLabelText("Previous month")).toBeInTheDocument();
  });
});

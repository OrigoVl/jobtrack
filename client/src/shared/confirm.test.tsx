import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialogProvider } from "./confirm";
import { useConfirm } from "./use-confirm";

// Named distinctly from the dialog's own "Delete"/"Cancel" buttons so role queries below stay
// unambiguous once the dialog is open (it renders alongside this trigger, not instead of it).
function DeleteButton({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => {
        const ok = await confirm({ title: "Delete Acme — Engineer?", message: "This can't be undone." });
        onResult(ok);
      }}
    >
      Trigger delete
    </button>
  );
}

describe("ConfirmDialogProvider / useConfirm", () => {
  it("does not render a dialog until confirm() is called", () => {
    render(
      <ConfirmDialogProvider>
        <DeleteButton onResult={() => {}} />
      </ConfirmDialogProvider>,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the title/message and resolves true when the destructive action is confirmed", async () => {
    let result: boolean | null = null;
    render(
      <ConfirmDialogProvider>
        <DeleteButton onResult={(v) => (result = v)} />
      </ConfirmDialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger delete" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Acme — Engineer?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" })); // the dialog's own confirm button (confirmLabel defaults to actions.delete)
    await waitFor(() => expect(result).toBe(true));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("resolves false and dismisses when Cancel is clicked", async () => {
    let result: boolean | null = null;
    render(
      <ConfirmDialogProvider>
        <DeleteButton onResult={(v) => (result = v)} />
      </ConfirmDialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(result).toBe(false));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("resolves false when the backdrop (outside the dialog) is clicked", async () => {
    let result: boolean | null = null;
    render(
      <ConfirmDialogProvider>
        <DeleteButton onResult={(v) => (result = v)} />
      </ConfirmDialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger delete" }));
    const dialog = await screen.findByRole("alertdialog");
    // dialog.parentElement is the backdrop div (createPortal renders it as the dialog's parent)
    fireEvent.click(dialog.parentElement!);
    await waitFor(() => expect(result).toBe(false));
  });

  it("resolves false on Escape", async () => {
    let result: boolean | null = null;
    render(
      <ConfirmDialogProvider>
        <DeleteButton onResult={(v) => (result = v)} />
      </ConfirmDialogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger delete" }));
    await screen.findByRole("alertdialog");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(result).toBe(false));
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { PasteImportDialog } from "../../components/graph/GraphToolbar";
import { DIALOG_STRINGS } from "../../components/graph/strings";

afterEach(cleanup);

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  render(<PasteImportDialog onSubmit={onSubmit} onClose={onClose} />);
  const textarea = screen.getByPlaceholderText(DIALOG_STRINGS.pasteImportPlaceholder);
  const importBtn = screen.getByRole("button", { name: DIALOG_STRINGS.pasteImportSubmit });
  return { onSubmit, onClose, textarea, importBtn };
}

describe("PasteImportDialog", () => {
  it("renders title, textarea and buttons", () => {
    setup();
    expect(screen.getByText(DIALOG_STRINGS.pasteImportTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: DIALOG_STRINGS.cancel })).toBeTruthy();
  });

  it("disables Import while the textarea is empty or whitespace", () => {
    const { textarea, importBtn } = setup();
    expect((importBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: "   " } });
    expect((importBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: "{}" } });
    expect((importBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits the pasted text and closes on success", async () => {
    const { onSubmit, onClose, textarea, importBtn } = setup();
    fireEvent.change(textarea, { target: { value: '{"a":1}' } });
    fireEvent.click(importBtn);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith('{"a":1}');
  });

  it("shows the error inline and stays open when the import fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Not a Concerto metamodel"));
    const { onClose, textarea, importBtn } = setup(onSubmit);
    fireEvent.change(textarea, { target: { value: "{}" } });
    fireEvent.click(importBtn);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Not a Concerto metamodel");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without submitting on Cancel", () => {
    const { onSubmit, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: DIALOG_STRINGS.cancel }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "../../components/ErrorBoundary";

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("kaboom on line 3");
  return <div>panel content</div>;
}

// Deliberately thrown render errors are reported twice: by React through
// console.error and by jsdom through the window "error" event. Silence both
// so passing tests do not print stack traces.
const suppressJsdomError = (e: Event) => e.preventDefault();

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.addEventListener("error", suppressJsdomError);
  });

  afterEach(() => {
    window.removeEventListener("error", suppressJsdomError);
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary label="Text Editor">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("panel content")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a fallback with the panel label and error message when a child throws", () => {
    render(
      <ErrorBoundary label="Graph Canvas">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Graph Canvas");
    expect(alert.textContent).toContain("kaboom on line 3");
  });

  it("recovers via the Try again button", () => {
    let shouldThrow = true;
    function MaybeBomb() {
      if (shouldThrow) throw new Error("boom");
      return <div>recovered</div>;
    }
    render(
      <ErrorBoundary label="Form View">
        <MaybeBomb />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("recovered")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("recovers automatically when a resetKey changes", () => {
    const { rerender } = render(
      <ErrorBoundary label="Graph Canvas" resetKeys={["broken source"]}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <ErrorBoundary label="Graph Canvas" resetKeys={["fixed source"]}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("panel content")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stays on the fallback while resetKeys are unchanged", () => {
    const { rerender } = render(
      <ErrorBoundary label="Graph Canvas" resetKeys={["same source"]}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary label="Graph Canvas" resetKeys={["same source"]}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

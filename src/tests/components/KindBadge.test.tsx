// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { KindBadge } from "../../components/graph/KindBadge";

describe("KindBadge accessibility", () => {
  afterEach(cleanup);

  it("exposes the hint as a tooltip reachable from the keyboard", () => {
    const { container } = render(<KindBadge kind="concept" />);
    const anchor = container.querySelector<HTMLElement>(".concept-hint-anchor");
    expect(anchor).not.toBeNull();
    // Focusable trigger, so keyboard users can reach the explanation
    expect(anchor!.tabIndex).toBe(0);

    const tooltip = container.querySelector<HTMLElement>(".concept-hint-pop");
    expect(tooltip).not.toBeNull();
    expect(tooltip!.getAttribute("role")).toBe("tooltip");
    // The trigger is described by the panel, so assistive technology
    // announces the summary when the badge receives focus
    expect(tooltip!.id).not.toBe("");
    expect(anchor!.getAttribute("aria-describedby")).toBe(tooltip!.id);
    expect(tooltip!.textContent).toContain("general-purpose class of the metamodel");
  });

  it("renders a plain badge for kinds without a hint", () => {
    const { container } = render(<KindBadge kind="somethingUnknown" />);
    expect(container.querySelector(".concept-hint-pop")).toBeNull();
    expect(container.querySelector(".graph-node-kind")).not.toBeNull();
  });
});

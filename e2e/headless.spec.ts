import { expect, test } from "@playwright/test";
import LZString from "lz-string";

const EMBEDDED_MODEL = `namespace org.example.embedded@1.0.0

concept EmbeddedThing {
  o String name
}
`;

function hashForModel(model: string) {
  return LZString.compressToEncodedURIComponent(model);
}

test.describe("Headless embedded mode", () => {
  test("hides the header and fills the top of the viewport", async ({ page }) => {
    await page.goto("/?headless=true");

    await expect(page.locator("header")).toBeHidden({ timeout: 15000 });
    await expect(page.locator('button[title^="Hide CTO panel"]')).toBeHidden();
    await expect(page.locator('button[title="Hide CTO text"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "NDA" })).toBeHidden();

    const appPaddingTop = await page
      .locator("#root > div")
      .evaluate((element) => getComputedStyle(element).paddingTop);
    expect(appPaddingTop).toBe("0px");
  });

  test("preserves normal mode when headless is omitted", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("img", { name: "Accord Project" }).first()).toBeVisible();
  });

  test("hides the toolbar without headless mode when toolbar=false", async ({ page }) => {
    await page.goto("/?toolbar=false");

    await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button[title^="Hide CTO panel"]')).toBeHidden();
    await expect(page.locator('button[title="Hide CTO text"]')).toBeVisible();
  });

  test("hides the CTO pane on load when cto=false", async ({ page }) => {
    await page.goto("/?headless=true&view=diagram&cto=false");

    await expect(page.getByText("Concerto Schema")).toBeHidden({ timeout: 15000 });
    await expect(page.locator('button[title="Show CTO text"]')).toBeVisible();
  });

  test("keeps the CTO pane hidden in form view even when cto=true", async ({ page }) => {
    await page.goto("/?cto=true&view=form");

    await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Form" })).toBeVisible();
    await expect(page.getByText("Concerto Schema")).toBeHidden();
  });

  test("opens JSON AST in code mode without hiding the header", async ({ page }) => {
    await page.goto("/?view=json-ast");

    await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "JSON AST" })).toBeVisible();
    await expect(page.getByRole("button", { name: "TypeScript" })).toBeVisible();
  });

  test("opens overflow output targets in code mode", async ({ page }) => {
    await page.goto("/?view=openapi");

    await expect(page.getByRole("button", { name: /OpenAPI/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "TypeScript" })).toBeVisible();
  });

  test("loads hash model content in headless graph mode", async ({ page }) => {
    await page.goto(`/?headless=true&view=diagram#${hashForModel(EMBEDDED_MODEL)}`);

    await expect(page.locator("header")).toBeHidden({ timeout: 15000 });
    await expect(page.getByText("Concerto Schema")).toBeVisible();
    await expect(page.getByText("EmbeddedThing").first()).toBeVisible({ timeout: 15000 });
  });

  test("loads correctly inside an iframe", async ({ page }) => {
    await page.goto("/");
    const origin = new URL(page.url()).origin;
    const hash = hashForModel(EMBEDDED_MODEL);

    await page.setContent(`
      <iframe
        src="${origin}/?headless=true&view=json-ast#${hash}"
        width="100%"
        height="600"
        frameborder="0"
      ></iframe>
    `);

    const frame = page.frameLocator("iframe");
    await expect(frame.locator("header")).toBeHidden({ timeout: 15000 });
    await expect(frame.getByRole("button", { name: "JSON AST" })).toBeVisible();
    await expect(frame.getByText("EmbeddedThing").first()).toBeVisible({ timeout: 15000 });
  });
});

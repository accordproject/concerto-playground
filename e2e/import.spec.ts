import { test, expect, type Page } from "@playwright/test";
import { Parser } from "@accordproject/concerto-cto";

test("loads the editor without uncaught errors", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));

  await page.goto("/");
  await expect(page.getByText("Concerto Schema")).toBeVisible({ timeout: 15000 });

  expect(errors).toEqual([]);
});

async function openImportDialog(page: Page) {
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function importText(page: Page, source: string) {
  await openImportDialog(page);
  await page.locator("#import-source").fill(source);
  await page.getByRole("dialog").getByRole("button", { name: "Import", exact: true }).click();
}

test.describe("Import Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Concerto Schema")).toBeVisible({ timeout: 15000 });
  });

  test("imports a JSON object from the single import panel", async ({ page }) => {
    await page.locator('button[title="Hide CTO panel"]').click();
    await importText(page, JSON.stringify({ firstName: "Alice", address: { city: "London" } }));

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Concerto Schema")).toBeVisible();
    await expect(page.getByText("Root").first()).toBeVisible();
  });

  test("keeps focus inside the dialog and restores it on Escape", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Import" });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    const source = page.locator("#import-source");
    const close = page.getByRole("button", { name: "Close import dialog" });
    const submit = dialog.getByRole("button", { name: "Import", exact: true });
    await expect(source).toBeFocused();
    await expect(source).not.toHaveCSS("outline-style", "none");

    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(submit).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("imports a JSON Schema document", async ({ page }) => {
    await importText(page, JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://api.example.com/customer-data/v1",
      title: "Customer",
      type: "object",
      properties: { firstName: { type: "string" }, loyaltyNumber: { type: "string" } },
      required: ["firstName"],
    }));

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Customer").first()).toBeVisible();
  });

  test("imports pasted CTO", async ({ page }) => {
    await importText(
      page,
      "namespace org.example.pasted@1.0.0\n\nconcept PastedModel {\n  o String name\n}\n",
    );

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("PastedModel").first()).toBeVisible();
    await expect(page.getByText("org.example.pasted@1.0.0", { exact: true })).toBeVisible();
  });

  test("imports pasted Concerto JSON AST", async ({ page }) => {
    const ast = Parser.parse(
      "namespace org.example.ast@1.0.0\n\nconcept AstModel {\n  o String name\n}\n",
      undefined,
      { skipLocationNodes: true },
    );

    await importText(page, JSON.stringify(ast));

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("AstModel").first()).toBeVisible();
  });

  test("styles the file input and preserves partial file success", async ({ page }) => {
    await openImportDialog(page);
    await expect(page.getByText("Choose files", { exact: true })).toBeVisible();
    await expect(page.getByTestId("model-file-input")).toBeHidden();

    await page.getByTestId("model-file-input").setInputFiles([
      {
        name: "valid.cto",
        mimeType: "text/plain",
        buffer: Buffer.from("namespace org.example.file@1.0.0\n\nconcept FileModel {}\n"),
      },
      {
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from("{ invalid }"),
      },
      {
        name: "also-invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from("[ invalid ]"),
      },
    ]);

    const alert = page.getByRole("dialog").getByRole("alert");
    await expect(alert).toContainText("invalid.json: Invalid JSON or CTO:");
    await expect(alert).toContainText("also-invalid.json: Invalid JSON or CTO:");
    await expect(alert).toHaveCSS("white-space", "pre-wrap");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close import dialog" }).click();
    await expect(page.getByText("FileModel").first()).toBeVisible();
  });

  test("replaces the active model when importing an inferred JSON Schema file", async ({ page }) => {
    await openImportDialog(page);
    await page.getByTestId("model-file-input").setInputFiles({
      name: "customer.schema.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        $id: "https://example.com/imported/customer.schema.json",
        title: "FileCustomer",
        type: "object",
        properties: { name: { type: "string" } },
      })),
    });

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("customer", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("NDAData").first()).toBeHidden();
  });

  test("rejects invalid generated CTO without changing the current model", async ({ page }) => {
    await expect(page.getByText("NDAData").first()).toBeVisible();
    await importText(page, '{"bad-name":"value"}');

    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Unable to infer Concerto model from JSON sample",
    );
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close import dialog" }).click();
    await expect(page.getByText("NDAData").first()).toBeVisible();
  });
});

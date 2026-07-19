import { test, expect, type Page } from "@playwright/test";
import { Parser } from "@accordproject/concerto-cto";

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

  test("imports a JSON Schema document", async ({ page }) => {
    await importText(page, JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
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
    await expect(page.getByText("org.example.pasted@1.", { exact: false })).toBeVisible();
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
    ]);

    await expect(page.getByRole("alert")).toContainText("invalid.json: Invalid JSON or CTO:");
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

  test("shows invalid input without changing the current model", async ({ page }) => {
    await expect(page.getByText("NDAData").first()).toBeVisible();
    await importText(page, "{ this is not json }");

    await expect(page.getByRole("alert")).toContainText("Invalid JSON or CTO");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close import dialog" }).click();
    await expect(page.getByText("NDAData").first()).toBeVisible();
  });
});

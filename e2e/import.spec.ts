import { test, expect } from "@playwright/test";

test.describe("Import Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Concerto Schema")).toBeVisible({ timeout: 15000 });
  });

  test("should import CTO inferred from a JSON object and reveal the CTO panel after import", async ({ page }) => {
    await page.locator('button[title="Hide CTO panel"]').click();
    await expect(page.getByText("Concerto Schema")).toBeHidden({ timeout: 5000 });

    await page.getByRole("button", { name: "Import" }).click();
    await page.getByRole("button", { name: "JSON / JSON Schema" }).click();
    await page.locator("#json-import-source").fill(
      JSON.stringify(
        {
          firstName: "Alice",
          address: {
            city: "London",
          },
        },
        null,
        2,
      ),
    );
    await page.getByRole("button", { name: "Import JSON" }).click();

    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5000 });
    await expect(page.getByText("Concerto Schema")).toBeVisible();
    await expect(page.getByText("Root").first()).toBeVisible();
  });

  test("should import CTO inferred from a JSON Schema document", async ({ page }) => {
    await page.getByRole("button", { name: "Import" }).click();
    await page.getByRole("button", { name: "JSON / JSON Schema" }).click();
    await page.locator("#json-import-source").fill(
      JSON.stringify(
        {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          title: "Customer",
          type: "object",
          properties: {
            firstName: { type: "string" },
            loyaltyNumber: { type: "string" },
          },
          required: ["firstName"],
        },
        null,
        2,
      ),
    );
    await page.getByRole("button", { name: "Import JSON" }).click();

    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5000 });
    await expect(page.getByText("Customer").first()).toBeVisible();
  });

  test("should show an inline error for invalid JSON and keep the current model unchanged", async ({ page }) => {
    await expect(page.getByText("NDAData").first()).toBeVisible();

    await page.getByRole("button", { name: "Import" }).click();
    await page.getByRole("button", { name: "JSON / JSON Schema" }).click();
    await page.locator("#json-import-source").fill("{ this is not json }");
    await page.getByRole("button", { name: "Import JSON" }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid JSON");
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "Close import dialog" }).click();
    await expect(page.getByText("NDAData").first()).toBeVisible();
  });
});

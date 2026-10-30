import { test as setup, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

const secretFile = process.env.INVENTORY_QA_SECRET_FILE;
setup.skip(!secretFile, "Local synthetic QA secret is required");

setup("sign in synthetic admin and viewer once per test run", async ({ browser }) => {
  const output = "test-results/.auth";
  mkdirSync(output, { recursive: true });
  const password = readFileSync(secretFile!, "utf8").trim();
  for (const [username, email] of [
    ["admin", "inventory.qa@example.test"],
    ["viewer", "inventory.viewer@example.test"],
  ] as const) {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:5174/inventory/",
    });
    try {
      const page = await context.newPage();
      await page.goto("/inventory/");
      await expect(page.getByRole("heading", { name: "Вход в Inventory" })).toBeVisible();
      await page.getByLabel("Электронная почта").fill(email);
      await page.locator("#inventory-password").fill(password);
      await page.getByRole("button", { name: "Войти" }).click();
      await expect(page.getByRole("heading", { name: "Реестр активов" })).toBeVisible();
      await context.storageState({ path: output + "/" + username + ".json" });
    } finally {
      await context.close();
    }
  }
});
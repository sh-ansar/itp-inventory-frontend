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
      // Synthetic QA only: saved filters must not leak between independent
      // regression runs. Ordinary production user preferences are never reset.
      await page.evaluate(async () => {
        const response=await fetch("/inventory-api/api/v1/companies",{credentials:"same-origin"});
        if(!response.ok)throw new Error("Could not list QA companies for preference cleanup");
        const companies=await response.json() as Array<{id:string}>;
        const cookie=document.cookie.split("; ").find(value=>value.startsWith("INVENTORY-XSRF-TOKEN="));
        if(!cookie)throw new Error("QA CSRF cookie unavailable");
        const token=decodeURIComponent(cookie.split("=").slice(1).join("="));
        const views=["assets","stocktakes","disposals","warehouse_balances",
          "warehouse_items","warehouse_history","people"];
        for(const company of companies){
          for(const view of views){
            const result=await fetch("/inventory-api/api/v1/companies/"+encodeURIComponent(company.id)+
              "/preferences/"+view,{
              method:"DELETE",credentials:"same-origin",
              headers:{"Accept":"application/json","X-XSRF-TOKEN":token},
            });
            // A baseline Inventory release may not yet have the preference API.
            if(result.status!==204&&result.status!==404)
              throw new Error("QA preference reset failed: "+result.status);
          }
        }
      });
      await context.storageState({ path: output + "/" + username + ".json" });
    } finally {
      await context.close();
    }
  }
});
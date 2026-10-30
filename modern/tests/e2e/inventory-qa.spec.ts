import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const secretFile = process.env.INVENTORY_QA_SECRET_FILE;
test.skip(!secretFile, "Set INVENTORY_QA_SECRET_FILE to a private local-only QA secret path");

function password(): string {
  if (!secretFile) throw new Error("QA secret file not configured");
  return readFileSync(secretFile, "utf8").trim();
}

async function login(page: Page, asViewer = false): Promise<void> {
  await page.goto("http://127.0.0.1:5174/inventory/");
  await expect(page.getByRole("heading", { name: "Вход в Inventory" })).toBeVisible();
  await page.getByLabel("Электронная почта").fill(asViewer ? "inventory.viewer@example.test" : "inventory.qa@example.test");
  await page.locator("#inventory-password").fill(password());
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("heading", { name: "Реестр активов" })).toBeVisible();
}

test("session, server-side search, company switch, create/edit/history/archive", async ({ page }) => {
  await login(page);
  // Company order is not guaranteed by DB; select the target tenant explicitly.
  await page.locator('select[aria-label="Компания"]').selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByText("MIN-0001")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(25);

  await page.getByRole("searchbox", { name: "Поиск по всему реестру" }).fill("MIN-0051");
  await expect(page.getByText("MIN-0051")).toBeVisible();
  await expect(page.getByText("MIN-0001")).not.toBeVisible();
  await page.getByRole("searchbox", { name: "Поиск по всему реестру" }).fill("");
  await expect(page.getByText("MIN-0001")).toBeVisible();

  const number = "QA-E2E-" + Date.now();
  await page.getByRole("button", { name: "Добавить актив" }).click();
  const editor = page.getByRole("dialog", { name: "Новый актив" });
  await expect(editor).toBeVisible();
  await editor.getByLabel(/Инвентарный №/).fill(number);
  await editor.getByLabel(/Наименование/).fill("Playwright laptop QA");
  await editor.getByRole("button", { name: "Сохранить" }).click();
  await expect(editor).toBeHidden(); // Wait for API success and dialog teardown before searching.

  const search = page.getByRole("searchbox", { name: "Поиск по всему реестру" });
  await search.fill(number);
  const row = page.locator("tbody tr").filter({ hasText:number });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name:"Редактировать: " + number }).click();
  const edit = page.getByRole("dialog", { name: "Редактирование актива" });
  await edit.getByLabel(/Наименование/).fill("Playwright laptop QA updated");
  await edit.getByRole("button", { name:"Сохранить" }).click();
  await expect(row).toContainText("Playwright laptop QA updated");

  await row.getByRole("button", { name:"История: " + number }).click();
  const history = page.getByRole("dialog", { name:"История изменений" });
  await expect(history.getByText("Изменение")).toBeVisible();
  await history.getByRole("button", {name:"Закрыть диалог"}).click();
  await row.getByRole("button", { name:"Архивировать: " + number }).click();
  const archive = page.getByRole("dialog", {name:"Архивирование актива"});
  await archive.getByLabel(/Причина архивирования/).fill("QA проверка архива");
  await archive.getByRole("button", {name:"Архивировать актив"}).click();
  await expect(row).not.toBeVisible();

  await page.locator('select[aria-label="Компания"]').selectOption({label:"Inventory QA - Solutions"});
  await expect(page.getByText("SOL-0001")).toBeVisible();
  await expect(page.getByText("MIN-0001")).not.toBeVisible();
  await page.getByRole("link", {name:"Справочники"}).click();
  await expect(page.getByRole("heading", {name:"Справочники"}).first()).toBeVisible();
  await expect(page.getByText("IT equipment")).toBeVisible();
});

test("viewer cannot see mutation actions", async ({ page }) => {
  await login(page,true);
  await expect(page.getByRole("button",{name:"Добавить актив"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Редактировать:/})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Архивировать:/})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/История:/}).first()).toBeVisible();
});

test("mobile, tablet, desktop: no document overflow and accessible navigation", async ({ page }, testInfo) => {
  await login(page);
  for (const width of [360,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole("link",{name:"Основные средства"})).toBeVisible();
    await expect(page.getByRole("searchbox",{name:"Поиск по всему реестру"})).toBeVisible();
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      tableWidth: document.querySelector(".table-scroll")?.scrollWidth ?? 0,
      tableClient: document.querySelector(".table-scroll")?.clientWidth ?? 0,
    }));
    expect(geometry.scrollWidth, "document overflow at " + width + "px").toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.tableWidth).toBeGreaterThanOrEqual(geometry.tableClient);
    await page.screenshot({path:testInfo.outputPath("inventory-" + width + ".png"),fullPage:true});
  }
  await page.locator('select[aria-label="Язык / Language"]').selectOption("ka");
  await expect(page.getByRole("link",{name:"ძირითადი საშუალებები"})).toBeVisible();
  await page.getByRole("button",{name:"მუქი თემა"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.locator('select[aria-label="Язык / Language"]').selectOption("ru");
});
import { test, expect, type Page } from "@playwright/test";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Local-only synthetic QA session required");

async function openInventory(page: Page) {
  // auth.setup.ts signs in once per test run; individual cases reuse storageState.
  await page.goto("/inventory/");
  await expect(page.getByRole("heading", {name:"Реестр активов"})).toBeVisible();
  await page.locator('select[aria-label="Компания"]').selectOption({label:"Inventory QA - Mining"});
}

test("QR print + scan route + authorised physical movement + audit + cross-tenant", async ({page}, testInfo) => {
  await openInventory(page);
  const marker = String(Date.now());
  const number = "QR-QA-" + marker;
  const locationCode = "QR-OFF-" + marker;
  const locationName = "QA moved location " + marker;
  const reason = "Local QR and movement E2E QA check " + marker;

  await page.getByRole("link", {name:"Справочники"}).click();
  await page.getByRole("button", {name:/Фактические места/}).click();
  await page.getByRole("button", {name:"Добавить",exact:true}).click();
  const dictionary = page.getByRole("dialog", {name:"Фактические места"});
  await expect(dictionary).toBeVisible();
  await dictionary.getByLabel("Код").fill(locationCode);
  await dictionary.getByLabel("Наименование").fill(locationName);
  await dictionary.getByRole("button", {name:"Сохранить"}).click();
  await expect(dictionary).toBeHidden();
  await expect(page.getByText(locationName)).toBeVisible();

  await page.getByRole("link",{name:"Основные средства"}).click();
  await page.getByRole("button",{name:"Добавить актив"}).click();
  const editor = page.getByRole("dialog",{name:"Новый актив"});
  await editor.getByLabel(/Инвентарный №/).fill(number);
  await editor.getByLabel(/Наименование/).fill("Playwright QR laptop");
  await editor.getByRole("button",{name:"Сохранить"}).click();
  await expect(editor).toBeHidden();

  const search = page.getByRole("searchbox",{name:"Поиск по всему реестру"});
  await search.fill(number);
  const row = page.locator("tbody tr").filter({hasText:number});
  await expect(row).toBeVisible();

  await row.getByRole("button",{name:"QR-этикетка: "+number}).click();
  const qr = page.getByRole("dialog",{name:"QR-этикетка"});
  await expect(qr).toBeVisible();
  await expect(qr.locator("img.qr-image")).toBeVisible();
  await qr.screenshot({path:testInfo.outputPath("qr-label.png")});
  const image = await qr.locator("img.qr-image").getAttribute("src");
  expect(image?.startsWith("data:image/png;base64,")).toBe(true);
  const link = await qr.getByRole("textbox",{name:"Ссылка на актив"}).inputValue();
  expect(new URL(link).pathname).toMatch(/^\/inventory\/scan\/[0-9a-f-]{36}$/i);
  expect(link).not.toContain(number);
  await qr.getByRole("button",{name:"Закрыть диалог"}).click();
  await expect(qr).toBeHidden();

  await row.getByRole("button",{name:"Переместить: "+number}).click();
  const transfer = page.getByRole("dialog",{name:"Перемещение актива"});
  await expect(transfer).toBeVisible();
  await transfer.getByLabel("Новое местонахождение").selectOption({label:locationName});
  await transfer.getByLabel("Причина перемещения").fill(reason);
  await transfer.screenshot({path:testInfo.outputPath("movement-form.png")});
  await transfer.getByRole("button",{name:"Подтвердить перемещение"}).click();
  await expect(transfer).toBeHidden();
  await expect(row).toContainText(locationName);

  await row.getByRole("button",{name:"Перемещения: "+number}).click();
  const movements = page.getByRole("dialog",{name:"Перемещения"});
  await expect(movements.getByText(reason)).toBeVisible();
  await expect(movements.getByText(locationName)).toBeVisible();
  await movements.getByRole("button",{name:"Закрыть диалог"}).click();

  await page.goto(link);
  await expect(page.getByRole("heading",{name:"Актив по QR"}).first()).toBeVisible();
  await expect(page.getByText(number)).toBeVisible();
  await expect(page.getByText(locationName)).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("qr-scan-result.png"),fullPage:true});

  await page.locator('select[aria-label="Компания"]').selectOption({label:"Inventory QA - Solutions"});
  await expect(page.getByRole("alert")).toContainText("Актив не найден в выбранной компании");
  await page.locator('select[aria-label="Компания"]').selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByText(number)).toBeVisible();

  // Clean up created asset (soft archive); no test fixture may be deleted.
  await page.getByRole("navigation",{name:"Inventory"})
    .getByRole("link",{name:"Основные средства"}).click();
  await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).fill(number);
  const cleanRow = page.locator("tbody tr").filter({hasText:number});
  await expect(cleanRow).toBeVisible();
  await cleanRow.getByRole("button",{name:"Архивировать: "+number}).click();
  const archive = page.getByRole("dialog",{name:"Архивирование актива"});
  await archive.getByLabel("Причина архивирования").fill("Закрытие тестового QR-сценария");
  await archive.getByRole("button",{name:"Архивировать актив"}).click();
  await expect(cleanRow).toBeHidden();
  await page.goto(link);
  await expect(page.getByRole("alert")).toContainText("Актив не найден");
});

test.describe("viewer QR permissions", () => {
  test.use({ storageState: "test-results/.auth/viewer.json" });
  test("viewer can scan QR for own company but cannot transfer", async ({page}) => {
  await openInventory(page);
  const row = page.locator("tbody tr").filter({hasText:"MIN-0001"});
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:"QR-этикетка: MIN-0001"}).click();
  const qr = page.getByRole("dialog",{name:"QR-этикетка"});
  await expect(qr.locator("img.qr-image")).toBeVisible();
  const link = await qr.getByRole("textbox",{name:"Ссылка на актив"}).inputValue();
  await page.goto(link);
  await expect(page.getByText("MIN-0001")).toBeVisible();
  await expect(page.getByRole("button",{name:"Переместить"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Перемещения"})).toBeVisible();
  });
});
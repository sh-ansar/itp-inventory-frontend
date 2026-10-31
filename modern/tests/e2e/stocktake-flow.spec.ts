import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Synthetic-only local QA fixture required");

async function mining(page: Page) {
  await page.goto("/inventory/");
  await expect(page.getByRole("heading",{name:"Реестр активов"})).toBeVisible();
  await page.locator('select[aria-label="Компания"]')
    .selectOption({label:"Inventory QA - Mining"});
}
async function startStocktake(page: Page, name: string) {
  await page.getByRole("navigation",{name:"Inventory"})
    .getByRole("link",{name:"Инвентаризации"}).click();
  await expect(page.getByRole("heading",{name:"Инвентаризации"}).first()).toBeVisible();
  await page.getByRole("button",{name:"Создать проверку"}).click();
  const drawer=page.getByRole("dialog",{name:"Новая инвентаризация"});
  await expect(drawer).toBeVisible();
  await drawer.getByLabel(/Название проверки/).fill(name);
  await drawer.getByRole("button",{name:"Начать проверку"}).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading",{name})).toBeVisible();
}

test("stocktake end-to-end: snapshot, QR count, recount, complete, reopen, CSV, audit", async ({page},testInfo)=>{
  await mining(page);
  const name="Playwright stocktake "+Date.now();
  await startStocktake(page,name);
  const totalAssets=Number((await page.locator(".detail-kpis strong").first().innerText()).trim());
  expect(totalAssets).toBeGreaterThanOrEqual(52); // E2E runs can add synthetic QA assets to the same company.
  const first=page.locator("tbody tr").filter({hasText:"MIN-0001"});
  await expect(first).toBeVisible();
  await first.getByRole("button",{name:"Проверить: MIN-0001"}).click();
  const form=page.getByRole("dialog",{name:"Проверить"});
  await expect(form).toBeVisible();
  await form.getByLabel(/Фактическое местонахождение/).selectOption({label:"QA office"});
  await form.getByRole("button",{name:"Сохранить"}).click();
  await expect(form).toBeHidden();
  await expect(page.locator(".notice[role=status]")).toContainText("Наличие актива отмечено");
  const progress=page.getByRole("progressbar",{name:"Прогресс"});
  await expect(progress.first()).toHaveAttribute("value","1");

  // A second click is explicit recount, not silently duplicated; reason required.
  const after=page.locator("tbody tr").filter({hasText:"MIN-0001"});
  await after.getByRole("button",{name:"Исправить отметку: MIN-0001"}).click();
  const recount=page.getByRole("dialog",{name:"Исправить отметку"});
  await recount.getByLabel("Причина повторной проверки").fill("Подтверждено после повторной проверки");
  await recount.getByRole("button",{name:"Сохранить"}).click();
  await expect(recount).toBeHidden();
  await expect(page.locator(".notice[role=status]")).toContainText("Повторная проверка сохранена");

  const downloadEvent=page.waitForEvent("download");
  await page.getByRole("link",{name:"CSV-отчёт"}).click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^inventory-.*\.csv$/);

  await page.getByRole("button",{name:"Завершить проверку"}).click();
  const dialog=page.getByRole("dialog",{name:"Завершить проверку"});
  await expect(dialog.getByText(String(totalAssets-1),{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Завершить проверку"}).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".notice[role=status]")).toContainText("Инвентаризация завершена");
  await expect(page.getByRole("button",{name:"Проверить: MIN-0002"})).toHaveCount(0);

  await page.getByRole("button",{name:"Возобновить"}).click();
  const reopened=page.getByRole("dialog",{name:"Возобновить"});
  await reopened.getByLabel("Причина возобновления").fill("Дополнительная проверка по распоряжению руководителя");
  await reopened.getByRole("button",{name:"Возобновить"}).click();
  await expect(reopened).toBeHidden();
  await expect(page.locator(".notice[role=status]")).toContainText("Инвентаризация возобновлена");

  await page.getByRole("button",{name:"История"}).click();
  const history=page.getByRole("dialog",{name:"История"});
  await expect(history.getByText("Проверка создана")).toBeVisible();
  await expect(history.getByText("Отметка исправлена")).toBeVisible();
  await expect(history.getByText("Проверка возобновлена")).toBeVisible();
  await history.getByRole("button",{name:"Закрыть диалог"}).click();

  // Isolate the test company in the public interface, without exposing stocktake to another tenant.
  await page.locator('select[aria-label="Компания"]')
    .selectOption({label:"Inventory QA - Solutions"});
  await expect(page.getByRole("heading",{name:"Инвентаризации"}).first()).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);

  await page.screenshot({path:testInfo.outputPath("stocktake-complete.png"),fullPage:true});
});

test.describe("read-only stocktake viewer",()=>{
  test.use({storageState:"test-results/.auth/viewer.json"});
  test("viewer cannot create, count or complete stocktakes",async({page})=>{
    await mining(page);
    await page.getByRole("navigation",{name:"Inventory"})
      .getByRole("link",{name:"Инвентаризации"}).click();
    await expect(page.getByRole("button",{name:"Создать проверку"})).toHaveCount(0);
    await expect(page.getByRole("heading",{name:"Инвентаризации"}).first()).toBeVisible();
    const first=page.getByRole("link",{name:"Открыть"}).first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.getByRole("button",{name:"Завершить проверку"})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Проверить: MIN-0001"})).toHaveCount(0);
  });
});

test("stocktake layouts: 360/390 mobile, tablet and desktop without overflow",async({page},testInfo)=>{
  await mining(page);
  await page.getByRole("navigation",{name:"Inventory"})
    .getByRole("link",{name:"Инвентаризации"}).click();
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole("heading",{name:"Инвентаризации"}).first()).toBeVisible();
    const geometry=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,
      viewport:document.documentElement.clientWidth,
      table:document.querySelector(".table-scroll")?.scrollWidth??0,
      tableClient:document.querySelector(".table-scroll")?.clientWidth??0,
    }));
    expect(geometry.scroll,"page overflow "+width).toBeLessThanOrEqual(geometry.viewport+1);
    expect(geometry.table).toBeGreaterThanOrEqual(geometry.tableClient);
    await expect(page.getByRole("table",{name:"Инвентаризации"})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath("stocktake-list-"+width+".png"),fullPage:true});
  }
  await page.locator('select[aria-label="Язык / Language"]').selectOption("ka");
  await expect(page.getByRole("heading",{name:"ინვენტარიზაციები"}).first()).toBeVisible();
  await page.locator('select[aria-label="Язык / Language"]').selectOption("en");
  await expect(page.getByRole("heading",{name:"Stocktakes"}).first()).toBeVisible();
  await page.locator('select[aria-label="Язык / Language"]').selectOption("ru");
});


test("printed asset QR counts exactly once inside a stocktake",async({page})=>{
  await mining(page);
  const search=page.getByRole("searchbox",{name:"Поиск по всему реестру"});
  await search.fill("MIN-0002");
  const assetRow=page.locator("tbody tr").filter({hasText:"MIN-0002"});
  await expect(assetRow).toBeVisible();
  await assetRow.getByRole("button",{name:"QR-этикетка: MIN-0002"}).click();
  const label=page.getByRole("dialog",{name:"QR-этикетка"});
  await expect(label.locator("img.qr-image")).toBeVisible();
  const link=await label.getByRole("textbox",{name:"Ссылка на актив"}).inputValue();
  expect(link).toMatch(/\/inventory\/scan\/[0-9a-f-]{36}/i);
  await label.getByRole("button",{name:"Закрыть диалог"}).click();

  await startStocktake(page,"QR scan stocktake "+Date.now());
  await expect(page.getByRole("table",{name:"Состав проверки"})).toBeVisible();
  await page.getByRole("textbox",{name:"QR-ссылка или UUID"}).fill(link);
  await page.getByRole("combobox",{name:"Фактическое местонахождение"}).first()
    .selectOption({label:"QA office"});
  await page.getByRole("button",{name:"Отметить наличие"}).click();
  await expect(page.locator(".notice[role=status]")).toContainText("MIN-0002");
  const progress=page.getByRole("progressbar",{name:"Прогресс"});
  await expect(progress.first()).toHaveAttribute("value","1");

  await page.getByRole("textbox",{name:"QR-ссылка или UUID"}).fill(link);
  await page.getByRole("button",{name:"Отметить наличие"}).click();
  await expect(page.getByRole("alert").filter({hasText:"Актив уже проверен"})).toBeVisible();
  await expect(progress.first()).toHaveAttribute("value","1");
});

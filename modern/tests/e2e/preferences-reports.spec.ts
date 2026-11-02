import {expect,test} from "@playwright/test";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Synthetic Inventory QA login is required");

test("saved asset table filters, columns and tenant boundaries survive refresh",async({page})=>{
  await page.goto("/inventory/registry");
  await expect(page.locator("nav.main-navigation")).toBeVisible();
  const company=page.getByRole("combobox",{name:"Компания"});
  await company.selectOption({label:"Inventory QA - Mining"});
  const button=page.getByRole("button",{name:"Настройки таблицы"});
  await expect(button).toBeEnabled();

  // Start with a known local company/user baseline.
  await button.click();
  const drawer=page.getByRole("dialog",{name:"Настройки таблицы"});
  await drawer.getByRole("button",{name:"Сбросить настройки"}).click();
  await drawer.getByRole("button",{name:"Закрыть",exact:true}).click();
  await expect(button).toBeEnabled();
  const search=page.getByRole("searchbox",{name:"Поиск по всему реестру"});
  await search.fill("MIN-0001");
  await page.getByRole("combobox",{name:"Статус"}).selectOption("active");
  await button.click();
  await drawer.getByRole("checkbox",{name:"Категория"}).uncheck();
  await drawer.getByRole("button",{name:"Закрыть",exact:true}).click();
  const saved=page.waitForResponse(r=>
    r.url().includes("/preferences/assets") && r.request().method()==="PUT" && r.status()===200);
  await saved;

  await page.reload();
  await expect(button).toBeEnabled();
  await expect(search).toHaveValue("MIN-0001");
  await expect(page.getByRole("combobox",{name:"Статус"})).toHaveValue("active");
  await expect(page.locator("thead").first()).not.toContainText("Категория");

  await company.selectOption({label:"Inventory QA - Solutions"});
  await expect(button).toBeEnabled();
  await expect(search).not.toHaveValue("MIN-0001");
  await company.selectOption({label:"Inventory QA - Mining"});
  await expect(button).toBeEnabled();
  await expect(search).toHaveValue("MIN-0001");

  await button.click();
  await drawer.getByRole("button",{name:"Сбросить настройки"}).click();
  await drawer.getByRole("button",{name:"Закрыть",exact:true}).click();
  await expect(search).toHaveValue("");
});

test("reports are tenant-filtered, printable, downloadable and responsive",async({page})=>{
  await page.goto("/inventory/reports");
  await expect(page.locator("nav.main-navigation")).toBeVisible();
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByRole("heading",{name:"Отчёты",exact:true})).toBeVisible();
  await expect(page.locator(".report-panel")).toHaveCount(6);
  await expect(page.locator(".report-metrics strong").first()).not.toHaveText("0");
  await expect(page.locator(".report-panel").first()).toContainText("На учёте");
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.locator(".report-export").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/inventory-summary.*\.csv/i);

  const popupEvent=page.waitForEvent("popup");
  await page.getByRole("button",{name:"Печать / PDF"}).click();
  const popup=await popupEvent;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator("table")).toHaveCount(6);
  await expect(popup.locator("body")).toContainText("На учёте");
  expect(await popup.locator("script").count()).toBe(0);
  await popup.close();

  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

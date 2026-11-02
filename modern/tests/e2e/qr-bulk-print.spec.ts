import { test, expect } from "./fixtures";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Isolated synthetic QA login required");

test("selected asset produces a printable QR sheet, then clears selection after filtering", async ({page}) => {
  await page.goto("/inventory/");
  await expect(page.locator("nav.main-navigation")).toBeVisible();
  const company=page.getByRole("combobox",{name:"Компания"});
  await company.selectOption({label:"Inventory QA - Mining"});

  const search=page.getByRole("searchbox",{name:"Поиск по всему реестру"});
  await search.fill("MIN-0001");
  const row=page.locator("tbody tr").filter({hasText:"MIN-0001"});
  await expect(row).toHaveCount(1);
  await row.getByRole("checkbox").check();

  const bulk=page.getByRole("button",{name:/Печать QR-этикеток/});
  await expect(bulk).toBeVisible();
  await bulk.click();
  const dialog=page.getByRole("dialog",{name:"Печать выбранных QR-этикеток"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Выбрано этикеток:")).toBeVisible();
  const preview=dialog.locator('img[alt="QR"]');
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveAttribute("src",/^data:image\/png;base64,/);

  const popupEvent=page.waitForEvent("popup");
  await dialog.getByRole("button",{name:"Печать на A4"}).click();
  const popup=await popupEvent;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator(".qr-label")).toHaveCount(1);
  await expect(popup.locator(".qr-label")).toContainText("MIN-0001");
  expect(await popup.locator("script").count()).toBe(0);
  await popup.close();

  await dialog.getByRole("button",{name:"Закрыть",exact:true}).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({width:390,height:900});
  const overflow=await page.evaluate(() =>
    document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button",{name:"Статус",exact:true}).click();
  await page.getByRole("dialog",{name:"Статус"}).getByRole("checkbox",{name:"Списан"}).check();
  await page.keyboard.press("Escape");
  await expect(bulk).toHaveCount(0);
  await company.selectOption({label:"Inventory QA - Solutions"});
  await expect(bulk).toHaveCount(0);
});

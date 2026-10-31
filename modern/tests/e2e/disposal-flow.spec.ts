import { test, expect, type Page } from "@playwright/test";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Synthetic Inventory QA credentials required");

async function mining(page:Page){
  await page.goto("/inventory/");
  await expect(page.getByRole("heading",{name:"Реестр активов"})).toBeVisible();
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
}
async function createAsset(page:Page,number:string){
  await page.getByRole("navigation",{name:"Inventory"})
    .getByRole("link",{name:"Основные средства"}).click();
  await page.getByRole("button",{name:"Добавить актив"}).click();
  const form=page.getByRole("dialog",{name:"Новый актив"});
  await form.getByLabel(/Инвентарный №/).fill(number);
  await form.getByLabel(/Наименование/).fill("QA Disposal laptop "+number);
  await form.getByRole("button",{name:"Сохранить"}).click();
  await expect(form).toBeHidden();
  await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).fill(number);
  const row=page.locator("tbody tr").filter({hasText:number});
  await expect(row).toBeVisible();
  return row;
}
function fakePdf(name:string){
  return {
    name,mimeType:"application/pdf",
    buffer:Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n"),
  };
}
async function uploadFile(drawer:ReturnType<Page["getByRole"]>,name:string){
  await drawer.locator('input[type="file"]').setInputFiles(fakePdf(name));
  await drawer.getByRole("button",{name:"Прикрепить документ"}).click();
  await expect(drawer.getByText(name)).toBeVisible();
}

test("disposal case: draft, protected order, submit, approve, disposal act, immutable history",async({page,browser})=>{
  await mining(page);
  const number="QA-DISP-"+String(Date.now()).slice(-8);
  let row=await createAsset(page,number);
  await row.getByRole("button",{name:"Открыть заявку: "+number}).click();
  const drawer=page.getByRole("dialog",{name:"Списание и утилизация"});
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("По этому активу ещё нет заявки на списание.")).toBeVisible();
  await drawer.getByLabel("Причина списания").fill("Ноутбук неисправен и восстановление экономически нецелесообразно");
  await drawer.getByLabel("Номер приказа").fill("ORDER-"+number);
  await drawer.getByLabel("Дата приказа").fill("2026-10-30");
  await drawer.getByRole("button",{name:"Сохранить черновик"}).click();
  await expect(drawer.locator(".asset-heading .status-pill")).toContainText("Черновик");
  await expect(drawer.getByRole("button",{name:"Направить на согласование"})).toBeDisabled();

  await uploadFile(drawer,"order-"+number+".pdf");
  const downloadEvent=page.waitForEvent("download");
  await drawer.getByRole("link",{name:"Скачать: order-"+number+".pdf"}).click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toBe("order-"+number+".pdf");

  await drawer.getByRole("button",{name:"Направить на согласование"}).click();
  await expect(drawer.locator(".asset-heading .status-pill")).toContainText("На согласовании");
  await expect(drawer.getByRole("button",{name:"Утвердить списание"})).toBeEnabled();
  page.once("dialog",dialog=>dialog.accept());
  await drawer.getByRole("button",{name:"Утвердить списание"}).click();
  await expect(drawer.locator(".asset-heading .status-pill")).toContainText("Списано");
  await expect(drawer.getByText("Статус имущества")).toBeVisible();
  await expect(drawer.getByText("Прикрепите акт утилизации.")).toBeVisible();

  await drawer.locator('input[type="file"]').setInputFiles(fakePdf("disposal-act-"+number+".pdf"));
  await drawer.getByRole("button",{name:"Прикрепить документ"}).click();
  await expect(drawer.getByText("disposal-act-"+number+".pdf")).toBeVisible();

  await drawer.getByLabel("Номер акта утилизации").fill("ACT-"+number);
  await drawer.getByLabel("Дата утилизации").fill("2026-10-31");
  await drawer.getByLabel("Способ утилизации").selectOption("recycling");
  page.once("dialog",dialog=>dialog.accept());
  await drawer.getByRole("button",{name:"Подтвердить утилизацию"}).click();
  await expect(drawer.locator(".asset-heading .status-pill")).toContainText("Утилизировано");
  await expect(drawer.getByRole("button",{name:"Прикрепить документ"})).toHaveCount(0);
  await expect(drawer.getByRole("button",{name:"Подтвердить утилизацию"})).toHaveCount(0);

  await drawer.getByRole("button",{name:"История согласований"}).click();
  await expect(drawer.getByText("Заявка создана")).toBeVisible();
  await expect(drawer.getByText("Отправлено на согласование")).toBeVisible();
  await expect(drawer.getByText("Списание утверждено")).toBeVisible();
  await expect(drawer.getByText("Утилизация подтверждена")).toBeVisible();

  await drawer.locator(".drawer-footer").getByRole("button",{name:"Закрыть",exact:true}).click();
  await expect(drawer).toBeHidden();
  await page.getByRole("combobox",{name:"Статус"}).selectOption("disposed");
  await expect(page.locator("tbody tr").filter({hasText:number})).toBeVisible();

  // A company-scoped queue and an independent viewer session must see exactly the same final case.
  await page.getByRole("navigation",{name:"Inventory"})
    .getByRole("link",{name:"Списание и утилизация"}).click();
  await expect(page.getByRole("heading",{name:"Списание и утилизация"}).first()).toBeVisible();
  await page.getByRole("combobox",{name:"Этап"}).selectOption("disposed");
  await page.getByRole("searchbox",{name:"Поиск по наименованию или инвентарному номеру"}).fill(number);
  await expect(page.locator("tbody tr").filter({hasText:number})).toBeVisible();

  const viewer=await browser.newContext({
    baseURL:"http://127.0.0.1:5174/inventory/",
    storageState:"test-results/.auth/viewer.json",
  });
  try{
    const vp=await viewer.newPage();
    await vp.goto("/inventory/disposals");
    await expect(vp.getByRole("heading",{name:"Списание и утилизация"}).first()).toBeVisible();
    await vp.getByRole("searchbox",{name:"Поиск по наименованию или инвентарному номеру"}).fill(number);
    const item=vp.locator("tbody tr").filter({hasText:number});
    await expect(item).toBeVisible();
    await item.getByRole("button",{name:"Открыть заявку: "+number}).click();
    const d=vp.getByRole("dialog",{name:"Списание и утилизация"});
    await expect(d.getByText("order-"+number+".pdf")).toBeVisible();
    await expect(d.getByText("disposal-act-"+number+".pdf")).toBeVisible();
    await expect(d.getByRole("button",{name:"Прикрепить документ"})).toHaveCount(0);
    await expect(d.getByRole("button",{name:"Утвердить списание"})).toHaveCount(0);
    await expect(d.getByRole("button",{name:"Подтвердить утилизацию"})).toHaveCount(0);
    await expect(d.getByRole("link",{name:"Скачать: order-"+number+".pdf"})).toBeVisible();
  }finally{await viewer.close();}

  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Solutions"});
  await expect(page.getByText(number)).toHaveCount(0);
});

test("disposal request: administrator returns submitted case for correction",async({page})=>{
  await mining(page);
  const number="QA-RETURN-"+String(Date.now()).slice(-8);
  const row=await createAsset(page,number);
  await row.getByRole("button",{name:"Открыть заявку: "+number}).click();
  const drawer=page.getByRole("dialog",{name:"Списание и утилизация"});
  await drawer.getByLabel("Причина списания").fill("Первоначальный комплект документов требует уточнения");
  await drawer.getByLabel("Номер приказа").fill("ORDER-"+number);
  await drawer.getByLabel("Дата приказа").fill("2026-10-31");
  await drawer.getByRole("button",{name:"Сохранить черновик"}).click();
  await uploadFile(drawer,"return-order-"+number+".pdf");
  await drawer.getByRole("button",{name:"Направить на согласование"}).click();
  await drawer.getByLabel("Причина возврата").fill("Не приложено заключение технической комиссии");
  await drawer.getByRole("button",{name:"Вернуть заявку"}).click();
  await expect(drawer.locator(".asset-heading .status-pill")).toContainText("Черновик");
  await expect(drawer.getByRole("button",{name:"Сохранить изменения"})).toBeVisible();
  await drawer.getByLabel("Номер приказа").fill("ORDER-UPDATED-"+number);
  await drawer.getByRole("button",{name:"Сохранить изменения"}).click();
  await expect(drawer.getByRole("button",{name:"Сохранить изменения"})).toBeDisabled();
  await drawer.getByRole("button",{name:"История согласований"}).click();
  await expect(drawer.locator(".history-section .plain-button")).toHaveText("Закрыть");
  await expect(drawer.getByText("Возвращено на доработку")).toBeVisible();
  await expect(drawer.getByText("Не приложено заключение технической комиссии")).toBeVisible();
});

test("disposal queue and drawer fit phone, tablet and desktop without horizontal page overflow",async({page})=>{
  await mining(page);
  const number="QA-MOBILE-"+String(Date.now()).slice(-8);
  const row=await createAsset(page,number);
  await row.getByRole("button",{name:"Открыть заявку: "+number}).click();
  const drawer=page.getByRole("dialog",{name:"Списание и утилизация"});
  await drawer.getByLabel("Причина списания").fill("Замена технически устаревшего устройства");
  await drawer.getByRole("button",{name:"Сохранить черновик"}).click();
  await drawer.getByRole("button",{name:"Закрыть",exact:true}).click();
  await page.getByRole("navigation",{name:"Inventory"})
    .getByRole("link",{name:"Списание и утилизация"}).click();
  await page.getByRole("combobox",{name:"Этап"}).selectOption("draft");
  await page.getByRole("searchbox",{name:"Поиск по наименованию или инвентарному номеру"}).fill(number);
  await expect(page.locator("tbody tr").filter({hasText:number})).toBeVisible();
  for(const width of [360,390,768,1024,1440]){
    await page.setViewportSize({width,height:880});
    const size=await page.evaluate(()=>({
      actual:document.documentElement.scrollWidth,
      client:document.documentElement.clientWidth,
    }));
    expect(size.actual,"queue page width "+width).toBeLessThanOrEqual(size.client+1);
    const item=page.locator("tbody tr").filter({hasText:number});
    await item.getByRole("button",{name:"Открыть заявку: "+number}).click();
    await expect(page.getByRole("dialog",{name:"Списание и утилизация"})).toBeVisible();
    const sizeDialog=await page.evaluate(()=>({
      actual:document.documentElement.scrollWidth,
      client:document.documentElement.clientWidth,
    }));
    expect(sizeDialog.actual,"drawer page width "+width).toBeLessThanOrEqual(sizeDialog.client+1);
    await page.getByRole("dialog",{name:"Списание и утилизация"})
      .getByRole("button",{name:"Закрыть",exact:true}).click();
  }
});

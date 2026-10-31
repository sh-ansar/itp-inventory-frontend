import { test, expect, type Page } from "@playwright/test";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Synthetic local-only fixture required");

async function mining(page:Page){
  await page.goto("/inventory/");
  await expect(page.getByRole("heading",{name:"Реестр активов"})).toBeVisible();
  await page.locator('select[aria-label="Компания"]').selectOption({label:"Inventory QA - Mining"});
}
async function go(page:Page,name:string){
  await page.getByRole("navigation",{name:"Inventory"}).getByRole("link",{name}).click();
}
async function node(page:Page,name:string,code:string,type:string,inside=false){
  if(inside)await page.getByRole("button",{name:"Добавить внутрь"}).first().click();
  else await page.getByRole("button",{name:"Новый объект"}).click();
  const dialog=page.getByRole("dialog",{name:"Добавить помещение или объект"});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Наименование/).fill(name);
  await dialog.getByLabel(/Код/).fill(code);
  await dialog.getByLabel(/Тип объекта/).selectOption(type);
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(name).first()).toBeVisible();
}
test("facility tree, room assignment and a stocktake of nested assets",async({page})=>{
  await mining(page);
  const suffix=String(Date.now()).slice(-8);
  await go(page,"Ответственные");
  await page.getByRole("button",{name:"Добавить ответственное лицо"}).click();
  let dialog=page.getByRole("dialog",{name:"Добавить ответственное лицо"});
  await dialog.getByLabel(/Табельный номер/).fill("Q-"+suffix);
  await dialog.getByLabel(/ФИО/).fill("QA Custodian "+suffix);
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();

  await go(page,"Карта объектов");
  await node(page,"QA Site "+suffix,"ST-"+suffix,"site");
  await node(page,"QA Building "+suffix,"B-"+suffix,"building",true);
  await node(page,"QA Floor "+suffix,"FL-"+suffix,"floor",true);
  await node(page,"QA Room "+suffix,"RM-"+suffix,"room",true);

  await page.getByTitle("Таблица").click();
  await expect(page.getByRole("table",{name:"Объекты"})).toBeVisible();
  await page.getByTitle("Интерактивная схема").click();
  await expect(page.getByText("QA Room "+suffix).first()).toBeVisible();

  await go(page,"Основные средства");
  await page.getByRole("button",{name:"Добавить актив"}).click();
  dialog=page.getByRole("dialog",{name:"Новый актив"});
  await dialog.getByLabel(/Инвентарный №/).fill("IT-"+suffix);
  await dialog.getByLabel(/Наименование/).fill("QA Computer "+suffix);
  await dialog.getByLabel(/Объект \/ помещение/).selectOption({label:"Помещение · QA Room "+suffix});
  await dialog.getByLabel(/Ответственное лицо/).selectOption({label:"QA Custodian "+suffix+" · Q-"+suffix});
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();

  await go(page,"Карта объектов");
  await page.getByRole("textbox",{name:"Поиск по объектам"}).fill("QA Room "+suffix);
  await page.getByRole("treeitem",{name:new RegExp("QA Room "+suffix)}).click();
  await expect(page.getByText("QA Computer "+suffix)).toBeVisible();
  await page.getByRole("button",{name:"Инвентаризация объекта"}).click();
  await page.getByRole("button",{name:"Создать по выбранным"}).click();
  dialog=page.getByRole("dialog",{name:"Новая инвентаризация"});
  await dialog.getByLabel(/Название проверки/).fill("QA mapped stocktake "+suffix);
  await dialog.getByRole("button",{name:"Начать проверку"}).click();
  await expect(dialog).toBeHidden();
  const row=page.locator("tbody tr").filter({hasText:"IT-"+suffix});
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:/Проверить:/}).click();
  dialog=page.getByRole("dialog",{name:"Проверить"});
  await dialog.getByRole("combobox",{name:/Фактическое местонахождение.*Объект проверки/}).selectOption({label:"QA Room "+suffix});
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".notice[role=status]")).toContainText("Наличие актива отмечено");
});

test("warehouse receipt and stock balance",async({page})=>{
  await mining(page);
  const suffix=String(Date.now()).slice(-8);
  await go(page,"Карта объектов");
  await node(page,"QA Warehouse "+suffix,"WH-"+suffix,"warehouse");
  await go(page,"Склады");
  await expect(page.getByRole("heading",{name:"Склады и остатки"}).first()).toBeVisible();
  await page.getByRole("button",{name:"Добавить номенклатуру"}).click();
  let dialog=page.getByRole("dialog",{name:"Новая складская позиция"});
  await dialog.getByLabel(/Артикул \/ код/).fill("CAB-"+suffix);
  await dialog.getByLabel(/Наименование/).fill("QA Cables "+suffix);
  await dialog.getByLabel(/Ед. измерения/).selectOption("m");
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button",{name:"Оформить движение"}).first().click();
  dialog=page.getByRole("dialog",{name:"Складская операция"});
  await dialog.getByLabel(/Номенклатура/).selectOption({label:"CAB-"+suffix+" · QA Cables "+suffix});
  await dialog.getByLabel(/Операция/).selectOption("receipt");
  await dialog.getByLabel(/Склад/).selectOption({label:"QA Warehouse "+suffix});
  await dialog.getByLabel(/Количество/).fill("10.500");
  await dialog.getByLabel(/Основание/).fill("QA initial stock receipt");
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("combobox",{name:"Склад",exact:true}).selectOption({label:"QA Warehouse "+suffix});
  await expect(page.locator("tbody tr").filter({hasText:"CAB-"+suffix})).toContainText("10,5");
});

test("facilities, responsible persons and warehouses fit phone/tablet/desktop",async({page})=>{
  await mining(page);
  for(const section of ["Карта объектов","Ответственные","Склады"]){
    await go(page,section);
    for(const width of [360,390,768,1440]){
      await page.setViewportSize({width,height:850});
      const sizes=await page.evaluate(()=>({
        scroll:document.documentElement.scrollWidth,
        inner:document.documentElement.clientWidth,
      }));
      expect(sizes.scroll,section+" overflow at "+width).toBeLessThanOrEqual(sizes.inner+1);
    }
  }
});

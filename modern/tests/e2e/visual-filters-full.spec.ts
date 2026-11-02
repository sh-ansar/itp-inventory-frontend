import {test, expect} from "./fixtures";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Synthetic QA tenant required");

const companyName="Inventory QA - Mining";
async function openCompany(page:import("@playwright/test").Page,route:string){
  await page.goto("/inventory/"+route);
  await expect(page.locator("nav.main-navigation")).toBeVisible();
  const company=page.getByRole("combobox",{name:"Компания"});
  await company.selectOption({label:companyName});
  return company;
}
async function noPageOverflow(page:import("@playwright/test").Page){
  const width=await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(1);
}

test("asset search, status, location, custodian, sort, pagination and persistent columns",async({page})=>{
  await openCompany(page,"registry");
  const search=page.getByRole("searchbox",{name:"Поиск по всему реестру"});
  await search.fill("MIN-0001");
  await expect(page.locator("tbody tr").filter({hasText:"MIN-0001"})).toHaveCount(1);
  const status=page.getByRole("combobox",{name:"Статус"});
  await status.selectOption("active");
  await expect(page.locator("tbody tr").filter({hasText:"MIN-0001"})).toHaveCount(1);
  const filterNode=page.getByRole("combobox",{name:"Объект / помещение"});
  const options=await filterNode.locator("option").count();
  expect(options).toBeGreaterThan(1);
  const node=await filterNode.locator("option").nth(1).getAttribute("value");
  expect(node).toBeTruthy();
  const facilityResponse=page.waitForResponse(r=>r.url().includes("/assets?")&&r.url().includes("facility_node_id="+node)&&r.status()===200);
  await filterNode.selectOption(node!);
  await facilityResponse;
  await filterNode.selectOption("");
  const custodian=page.getByRole("combobox",{name:"Ответственное лицо"});
  const person=await custodian.locator("option").nth(1).getAttribute("value");
  expect(person).toBeTruthy();
  const custodianResponse=page.waitForResponse(r=>r.url().includes("/assets?")&&r.url().includes("responsible_person_id="+person)&&r.status()===200);
  await custodian.selectOption(person!);await custodianResponse;
  await custodian.selectOption("");
  await search.fill("");
  const size=page.getByRole("combobox",{name:"Записей на странице"});
  await size.selectOption("10");
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page.getByRole("button",{name:"Настройки таблицы"}).click();
  const drawer=page.getByRole("dialog",{name:"Настройки таблицы"});
  await drawer.getByRole("checkbox",{name:"Категория"}).uncheck();
  await drawer.getByRole("button",{name:"Закрыть",exact:true}).click();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(size).toHaveValue("10");
  await expect(page.locator("thead").first()).not.toContainText("Категория");
  const sortByName=page.getByRole("button",{name:"Сортировать: Наименование"});
  await sortByName.click();
  await expect(page.locator('th[aria-sort="ascending"]').filter({has:sortByName})).toBeVisible();
  await sortByName.click();
  await expect(page.locator('th[aria-sort="descending"]').filter({has:sortByName})).toBeVisible();
  const nextPage=page.getByRole("button",{name:"Следующая страница"});
  await expect(nextPage).toBeEnabled();
  await nextPage.click();
  await expect(page.getByRole("button",{name:"Страница 2"})).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:"Настройки таблицы"}).click();
  await drawer.getByRole("button",{name:"Сбросить настройки"}).click();
  await drawer.getByRole("button",{name:"Закрыть",exact:true}).click();
  await expect(size).toHaveValue("25");
});

test("disposal stages, search and pagination use same table controls",async({page})=>{
  await openCompany(page,"disposals");
  const stage=page.getByRole("combobox",{name:"Этап"});
  expect(await stage.locator("option").count()).toBeGreaterThan(2);
  await stage.selectOption("submitted");
  await expect(stage).toHaveValue("submitted");
  await page.getByRole("searchbox",{name:/Поиск/}).fill("QA-DISP");
  await page.waitForTimeout(550);
  await stage.selectOption("");
  await page.getByRole("searchbox",{name:/Поиск/}).fill("");
  const size=page.getByRole("combobox",{name:"Записей на странице"});
  await size.selectOption("10");
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page.getByRole("button",{name:"Настройки таблицы"}).click();
  await expect(page.getByRole("dialog",{name:"Настройки таблицы"})).toBeVisible();
  await noPageOverflow(page);
});

test("custodian active/inactive/all search and saved table size",async({page})=>{
  await openCompany(page,"people");
  const active=page.getByRole("combobox",{name:"Статус"});
  await active.selectOption("0");await expect(active).toHaveValue("0");
  await active.selectOption("1");await expect(active).toHaveValue("1");
  await page.getByRole("searchbox",{name:/Поиск/}).fill("QA Custodian");
  await expect(page.locator("tbody tr").first()).toContainText("QA Custodian");
  await page.getByRole("searchbox",{name:/Поиск/}).fill("");
  await active.selectOption("");
  await expect(active).toHaveValue("");
  await page.getByRole("button",{name:"Настройки таблицы"}).click();
  const dialog=page.getByRole("dialog",{name:"Настройки таблицы"});
  expect(await dialog.getByRole("checkbox").count()).toBeGreaterThan(4);
  await dialog.getByRole("button",{name:"Закрыть",exact:true}).click();
});

test("stocktake status/search/pagination and table settings",async({page})=>{
  await openCompany(page,"stocktakes");
  const status=page.getByRole("combobox",{name:"Статус проверки"});
  await status.selectOption("completed");
  await expect(status).toHaveValue("completed");
  await status.selectOption("in_progress");
  await expect(status).toHaveValue("in_progress");
  await status.selectOption("");
  const search=page.getByRole("searchbox",{name:/Поиск/});
  await search.fill("QA");
  await page.waitForTimeout(500);
  await search.fill("");
  const size=page.getByRole("combobox",{name:"Записей на странице"});
  await size.selectOption("10");
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page.getByRole("button",{name:"Настройки таблицы"}).click();
  await expect(page.getByRole("dialog",{name:"Настройки таблицы"})).toBeVisible();
});

test("facility tree search and view switch, reference catalog three tabs",async({page})=>{
  await openCompany(page,"facilities");
  const search=page.getByRole("textbox",{name:"Поиск по объектам"});
  await search.fill("FP Building");
  await expect(page.locator('.tree-list [role="treeitem"]').first()).toContainText("FP Building");
  await search.fill("");
  const view=page.locator(".view-switch button");
  await expect(view).toHaveCount(2);
  await view.nth(1).click();
  await expect(page.locator(".facility-page table")).toBeVisible();
  await view.nth(0).click();
  await expect(page.locator(".diagram-scroll")).toBeVisible();
  await page.goto("/inventory/references");
  const tabs=page.locator(".reference-tabs button");
  await expect(tabs).toHaveCount(3);
  for(let i=0;i<3;i++){
    await tabs.nth(i).click();
    await expect(tabs.nth(i)).toHaveAttribute("aria-pressed","true");
    await expect(page.locator(".reference-card table")).toBeVisible();
  }
});

test("warehouse balances, catalog, history, warehouse selection and filters",async({page})=>{
  await openCompany(page,"warehouses");
  await expect(page.locator(".warehouse-content")).toBeVisible({timeout:16000});
  await expect(page.locator(".warehouse-metrics strong").first()).not.toHaveText("0");
  const warehouse=page.getByRole("combobox",{name:"Склад"});
  expect(await warehouse.locator("option").count()).toBeGreaterThan(0);
  const tabs=page.locator(".warehouse-toolbar .tabs button");
  await expect(tabs).toHaveCount(3);
  for(let i=0;i<3;i++){
    await tabs.nth(i).click();
    await expect(tabs.nth(i)).toHaveAttribute("aria-pressed","true");
    await expect(page.locator(".warehouse-content table")).toBeVisible();
    await page.getByRole("button",{name:"Настройки таблицы"}).click();
    const dialog=page.getByRole("dialog",{name:"Настройки таблицы"});
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button",{name:"Закрыть",exact:true}).click();
  }
  await tabs.nth(1).click();
  const search=page.getByRole("searchbox",{name:/Поиск/});
  await search.fill("QA");await expect(search).toHaveValue("QA");
  await search.fill("");
  const size=page.getByRole("combobox",{name:"Записей на странице"});
  await size.selectOption("10");await expect(size).toHaveValue("10");
  await noPageOverflow(page);
});

test("reports share status/facility/custodian filters and remain responsive",async({page})=>{
  await openCompany(page,"reports");
  await expect(page.locator(".report-panel")).toHaveCount(6);
  const status=page.getByRole("combobox",{name:"Статус"});
  await status.selectOption("disposed");
  await expect(status).toHaveValue("disposed");
  await status.selectOption("");
  const facility=page.getByRole("combobox",{name:"Объект"});
  await expect.poll(async()=>await facility.locator("option").count()).toBeGreaterThan(1);
  await facility.selectOption({index:1});
  await expect(page.locator(".report-metrics strong").first()).not.toHaveText("");
  await facility.selectOption("");
  const person=page.getByRole("combobox",{name:"Ответственное лицо"});
  await expect.poll(async()=>await person.locator("option").count()).toBeGreaterThan(1);
  await person.selectOption({index:1});
  await person.selectOption("");
  for(const width of [360,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await noPageOverflow(page);
  }
});

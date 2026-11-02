import {test,expect} from "./fixtures";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE,"Synthetic QA login required");

test("mixed warehouse quantities are unit-aware in dashboard, A4 print and all locales",async({page})=>{
  await page.route("**/api/v1/companies/*/reports/summary*",async(route)=>{
    if(!new URL(route.request().url()).pathname.endsWith("/reports/summary")){
      return route.continue();
    }
    const response=await route.fetch();
    if(response.status()!==200)return route.fulfill({response});
    const body=await response.json();
    body.data.warehouses.by_warehouse=[
      {id:"unit-warehouse-1",name:"Warehouse Mixed",items:3,
       unit:null,quantity_milli:null,
       unit_quantities:[
         {unit:"kg",items:1,quantity_milli:7500},
         {unit:"pcs",items:2,quantity_milli:4000},
       ]},
    ];
    await route.fulfill({response,json:body});
  });
  await page.goto("/inventory/reports");
  await page.getByRole("combobox",{name:"Компания"})
    .selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByRole("heading",{name:"Отчёты",exact:true})).toBeVisible();
  // The same fifth panel is translated on locale changes; do not anchor its identity to RU heading text.
  const warehouse=page.locator(".report-panel").nth(4);
  await expect(warehouse).toContainText("Склады");
  await expect(warehouse.locator("tbody")).toContainText("7,5 кг · 4 шт.");
  await expect(warehouse.locator("tbody")).not.toContainText("11,5");
  const popupEvent=page.waitForEvent("popup");
  await page.getByRole("button",{name:"Печать / PDF"}).click();
  const print=await popupEvent;
  await print.waitForLoadState("domcontentloaded");
  await expect(print.locator("body")).toContainText("7,5 кг · 4 шт.");
  await print.close();

  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("en");
  await expect(warehouse.locator("tbody")).toContainText("7.5 kg · 4 pcs");
  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("ka");
  await expect(warehouse.locator("tbody")).toContainText("კგ");
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>
      document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

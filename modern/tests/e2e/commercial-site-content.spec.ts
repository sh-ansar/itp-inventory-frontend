import {test,expect} from "@playwright/test";

test("super-admin edits Inventory website copy and live landing reads localized text",async({page})=>{
 let saved:Record<string,string>={};
 await page.route("**/inventory-api/api/v1/me",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify({id:1,name:"Inventory Platform QA"}),
 }));
 await page.route("**/inventory-api/api/v1/platform-admin/overview",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify({
   permissions:["platform.manage"],
   modules:["assets","disposals","facilities","references","people","warehouses","stocktakes","reports"],
   flags:{invoice_issuance_enabled:false,legal_publication_enabled:false,public_registration_enabled:false},
   statistics:{companies:2,users:1,published_plans:3},
  }),
 }));
 await page.route("**/inventory-api/api/v1/platform-admin/site-content**",async route=>{
  if(route.request().method()==="PUT"){
   const data=route.request().postDataJSON() as {locale:string,values:Record<string,string>};
   expect(data.locale).toBe("ru");
   saved=data.values;
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:saved})});
  }
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:saved})});
 });
 await page.route("**/inventory-api/api/v1/commercial/site-content**",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify({data:saved}),
 }));
 await page.route("**/inventory-api/api/v1/commercial/plans",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify({data:[]}),
 }));
 await page.goto("admin/site");
 await expect(page.getByText("Редактирование сайта")).toBeVisible();
 await page.getByLabel("Заголовок первого экрана").fill("Контроль имущества — редакция из админки");
 await page.getByRole("button",{name:"Сохранить"}).click();
 await expect(page.getByText(/Тексты сайта сохранены/)).toBeVisible();
 expect(saved.heroTitle).toBe("Контроль имущества — редакция из админки");
 await page.goto("");
 await expect(page.getByRole("heading",{name:"Контроль имущества — редакция из админки"})).toBeVisible();
});

test("anonymous user cannot edit site content through admin",async({page})=>{
 await page.route("**/inventory-api/api/v1/me",route=>route.fulfill({
  status:401,contentType:"application/json",body:"{}",
 }));
 await page.goto("admin/site");
 await expect(page.getByRole("heading",{name:"Вход в Inventory"})).toBeVisible();
 await expect(page.locator("input[aria-label='Заголовок первого экрана']")).toHaveCount(0);
});

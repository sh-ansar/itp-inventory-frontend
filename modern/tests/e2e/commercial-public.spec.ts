import {test,expect} from "@playwright/test";

const plan={
 id:42,code:"starter",version:1,status:"published",is_public:true,display_order:1,
 terms:{names:{ru:"Старт",en:"Starter",ge:"საწყისი"},description:"",
  price_minor:900000,currency:"KZT",period_months:1,
  limits:{users:10,companies:1,storage_bytes:1073741824,max_file_bytes:10485760},
  modules:{assets:true,facilities:true,stocktakes:true,reports:true,warehouses:false,
   references:true,people:true,disposals:false}},
};
test.beforeEach(async({page})=>{
 await page.route("**/inventory-api/api/v1/commercial/plans",route=>
  route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[plan]})}));
 await page.route("**/inventory-api/api/v1/commercial/legal**",route=>
  route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[]})}));
});

test("public /inventory landing uses Inventory branding, active demos and published plans",async({page})=>{
 await page.goto("/");
 await expect(page.getByRole("heading",{name:/имущество компании/i})).toBeVisible();
 await expect(page.getByRole("link",{name:"ITP Inventory"}).first()).toBeVisible();
 await expect(page.getByRole("heading",{name:"Старт"})).toBeVisible();
 await page.getByRole("tab",{name:"Операции",exact:true}).click();
 await expect(page.getByText("Списание",{exact:true}).first()).toBeVisible();
 await page.locator("#demo").getByRole("tab",{name:"Отчёты",exact:true}).click();
 await expect(page.locator("#demo").getByRole("heading",{name:"Отчёты"})).toBeVisible();
 await page.locator("#demo").getByRole("tab",{name:"Основные средства",exact:true}).click();
 await page.locator("#demo").getByRole("searchbox").fill("INV-000144");
 await expect(page.locator(".inv-demo-table tbody tr")).toHaveCount(1);
 await page.locator("#demo").getByRole("button",{name:/сбросить демо/i}).click();
 await expect(page.locator(".inv-demo-table tbody tr")).toHaveCount(5);
 await page.getByRole("button",{name:"Выбрать тариф"}).click();
 await expect(page).toHaveURL(/\/inventory\/auth\/register\?plan=starter/);
 await expect(page.getByRole("heading",{name:"Создать аккаунт Inventory"})).toBeVisible();
});

test("landing supports RU, EN and GE and all three pricing pages",async({page})=>{
 for(const [locale,heading,planName] of [
  ["ru","Всё имущество компании — под контролем","Старт"],
  ["en","All your company's assets, under control","Starter"],
  ["ka","კომპანიის ყველა აქტივი კონტროლის ქვეშ","საწყისი"]
 ]){
  await page.addInitScript((lang)=>localStorage.setItem("inventory.locale",lang),locale);
  await page.goto("/");
  await expect(page.getByRole("heading",{name:heading})).toBeVisible();
  await page.goto("pricing");
  await expect(page.getByRole("heading",{name:planName})).toBeVisible();
 }
});

test("public layouts fit mobile, tablet and desktop without horizontal body overflow",async({page})=>{
 for(const size of [{width:320,height:750},{width:768,height:980},{width:1440,height:900}]){
  await page.setViewportSize(size);
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  const box=await page.evaluate(()=>({
    body:document.documentElement.scrollWidth,
    viewport:document.documentElement.clientWidth,
  }));
  expect(box.body).toBeLessThanOrEqual(box.viewport+2);
 }
});

test("public documents cannot show unpublished legal text",async({page})=>{
 await page.goto("legal/privacy");
 await expect(page.getByText(/Опубликованных документов пока нет/)).toBeVisible();
 await expect(page.locator("pre")).toHaveCount(0);
});

test("unauthenticated /admin is not a public admin page",async({page})=>{
 await page.route("**/inventory-api/api/v1/health",route=>
  route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   status:"ok",service:"itp-inventory-api",browser_login:true,
  })}));
 await page.route("**/inventory-api/api/v1/me",route=>
  route.fulfill({status:401,contentType:"application/json",body:"{}"}));
 await page.goto("admin/plans");
 await expect(page.getByRole("heading",{name:"Вход в Inventory"})).toBeVisible();
 await expect(page.locator(".inventory-platform-admin")).toHaveCount(0);
});

test("published legal document loads full text via a separate exact-version endpoint",async({page})=>{
 const document={
  id:51,type:"privacy",locale:"ru",jurisdiction:"KZ",title:"Политика конфиденциальности ITP Inventory",
  body:"Данные компании обрабатываются только с разрешённым доступом.",
  version:3,status:"published",required:true,acceptance:"accepted",
  effective_at:"2026-11-05T00:00:00Z",
 };
 await page.route("**/inventory-api/api/v1/commercial/legal**",route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    data:path.endsWith("/51")?document:[{...document,body:undefined,status:undefined}],
  })});
 });
 await page.goto("legal/privacy");
 await expect(page.getByRole("heading",{name:document.title})).toBeVisible();
 await expect(page.locator(".inv-legal-body pre")).toHaveText(document.body);
 await page.goto("legal");
 await expect(page.getByRole("link",{name:/Политика конфиденциальности ITP Inventory/})).toBeVisible();
});

test("regular user cannot open a private super-admin session even if the URL is known",async({page})=>{
 await page.route("**/inventory-api/api/v1/me",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify({id:1,name:"QA"}),
 }));
 await page.route("**/inventory-api/api/v1/platform-admin/overview",route=>route.fulfill({
  status:403,contentType:"application/json",body:JSON.stringify({message:"Forbidden"}),
 }));
 await page.goto("admin/plans");
 await expect(page.getByRole("heading",{name:"Доступ запрещён"})).toBeVisible();
 await expect(page.locator(".inventory-platform-admin")).toHaveCount(0);
});

test("authorized admin can browse companies, published plans, and supplier billing UI",async({page})=>{
 await page.route("**/inventory-api/api/v1/me",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify({id:1,name:"Platform QA"}),
 }));
 await page.route("**/inventory-api/api/v1/platform-admin/**",route=>{
  const path=new URL(route.request().url()).pathname;
  const overview={permissions:["platform.manage"],modules:["assets","facilities","reports"],
   flags:{invoice_issuance_enabled:false,legal_publication_enabled:false,public_registration_enabled:false},
   statistics:{companies:1,users:2,published_plans:1}};
  const p={data:[{id:"f30eb2c8-d92e-4f4c-8ecb-5a1f9360d426",name:"Company QA",
   email:"company@example.test",users_count:2,assets_count:18,plan_code:"starter",subscription_status:"active",
   created_at:"2026-11-05T00:00:00Z"}],last_page:1,current_page:1,total:1,per_page:20};
  let body:unknown={data:[]};
  if(path.endsWith("/overview"))body=overview;
  else if(path.endsWith("/organizations"))body=p;
  else if(path.endsWith("/plans"))body={data:[plan]};
  else if(path.endsWith("/billing/supplier"))body={data:{}};
  else if(path.endsWith("/invoices"))body={...p,data:[]};
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
 });
 await page.goto("admin/companies");
 await expect(page.getByRole("heading",{name:"Компании"})).toBeVisible();
 await expect(page.getByText("Company QA").first()).toBeVisible();
 await page.getByRole("link",{name:"Тарифы"}).click();
 await expect(page.getByRole("heading",{name:"Тарифы"})).toBeVisible();
 await expect(page.getByText("starter",{exact:true}).first()).toBeVisible();
 await page.getByRole("link",{name:"Оплаты и счета"}).click();
 await page.getByRole("button",{name:"Реквизиты поставщика"}).click();
 await expect(page.getByRole("dialog",{name:"Реквизиты поставщика"})).toBeVisible();
});

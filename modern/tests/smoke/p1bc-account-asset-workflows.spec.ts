import { test, expect } from "@playwright/test";

const qaURL = "/inventory/qa-p1bc.html";
const api = "**/inventory-api/**";
async function prepare(page: import("@playwright/test").Page) {
  await page.context().addCookies([{url:"http://127.0.0.1:5174",name:"INVENTORY-XSRF-TOKEN",value:"p1bc-qa-token"}]);
  await page.addInitScript(() => {localStorage.setItem("inventory.locale","ru");localStorage.setItem("inventory.theme","light");});
}
const settings = {
  company_id:"company-qa",legal_name:"Example Mining",country_code:"KZ",
  timezone:"Asia/Almaty",currency:"KZT",asset_number_prefix:"INV",
  document_number_prefix:"DOC",default_locale:"ru",version:0,
};

test("P1BC user can update personal details and change password",async({page})=>{
  await prepare(page);
  const changed:string[]=[];
  await page.route(api,async route=>{
    const req=route.request(),url=req.url();
    if(url.includes("/profile")){
      const body=req.method()==="GET"?{}:req.postDataJSON() as Record<string,unknown>;
      if(req.method()!=="GET")changed.push(url.endsWith("/password")?"password":"name");
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify(url.endsWith("/password")?{ok:true}:
          {data:{id:1,name:req.method()==="PUT"?"Updated Person":"Initial Person",email:"user@example.com"}})});
      return;
    }
    await route.fulfill({status:404,contentType:"application/json",body:"{}"});
  });
  await page.goto(qaURL+"?view=profile",{waitUntil:"networkidle"});
  await page.getByRole("textbox",{name:/Имя и фамилия/}).fill("Updated Person");
  await page.locator(".profile-form").first().locator('button[type="submit"]').click();
  await expect(page.locator(".profile-page")).toContainText("Имя обновлено");
  await page.locator('input[autocomplete="current-password"]').fill("OldPassword#2026");
  await page.locator('input[autocomplete="new-password"]').first().fill("NewPassword#2027");
  await page.locator('input[autocomplete="new-password"]').last().fill("NewPassword#2027");
  await page.locator(".profile-form").nth(1).locator('button[type="submit"]').click();
  await expect(page.locator(".profile-page")).toContainText("Пароль успешно изменён");
  expect(changed).toEqual(["name","password"]);
});

test("P1BC company administrator saves settings, creates and publishes template",async({page})=>{
  await prepare(page);
  let state={...settings};
  let documents:Array<Record<string,unknown>>=[];
  const events:string[]=[];
  await page.route(api,async route=>{
    const req=route.request(),url=req.url(),method=req.method();
    if(url.endsWith("/configuration")){
      if(method==="PUT"){
        state={...(req.postDataJSON() as typeof settings),version:state.version+1};
        events.push("settings");
      }
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:state})});return;
    }
    if(url.endsWith("/document-templates")){
      if(method==="POST"){
        documents=[{id:"template-qa",...req.postDataJSON() as Record<string,unknown>,revision:1,status:"draft"}];
        events.push("draft");
      }
      await route.fulfill({status:method==="POST"?201:200,contentType:"application/json",
        body:JSON.stringify({data:method==="POST"?documents[0]:documents})});return;
    }
    if(url.endsWith("/document-templates/template-qa/publish")){
      documents=[{...documents[0],status:"published"}];events.push("publish");
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:documents[0]})});return;
    }
    await route.fulfill({status:404,contentType:"application/json",body:"{}"});
  });
  await page.goto(qaURL+"?view=settings",{waitUntil:"networkidle"});
  await page.getByRole("textbox",{name:"Юридическое наименование"}).fill("Example Mining LLC");
  await page.locator(".settings-form").locator('button[type="submit"]').click();
  await expect(page.locator(".company-settings")).toContainText("Настройки сохранены");
  await page.getByRole("button",{name:"Новый шаблон"}).click();
  await page.locator("#document-template-form input").fill("Inventory Act");
  await page.locator("#document-template-form textarea").fill("Company {{company_name}}, asset {{asset_number}}");
  await page.locator('button[form="document-template-form"]').click();
  await expect(page.locator(".company-settings tbody tr")).toHaveCount(1);
  await page.getByTitle("Опубликовать").click();
  await expect(page.locator(".company-settings tbody")).toContainText("Опубликован");
  expect(events).toEqual(["settings","draft","publish"]);
});

test("P1BC asset editor saves typed dynamic fields together with base asset",async({page})=>{
  await prepare(page);
  let saved:Record<string,unknown>|null=null;
  const calls:string[]=[];
  await page.route(api,async route=>{
    const req=route.request(),url=req.url();
    calls.push(req.method()+" "+url.replace(/^.*\/inventory-api/,"/inventory-api"));
    if(url.includes("/asset-fields")){
      const fields=[{id:"field-qa",company_id:"company-qa",category_id:"cat-qa",code:"ram_gb",
        label_ru:"RAM GB",label_en:"RAM GB",label_ka:"RAM GB",field_type:"number",
        options:[],required:true,is_active:true,sort_order:0,version:1}];
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:fields})});return;
    }
    if(url.endsWith("/assets/asset-qa/attributes")){
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({data:{"field-qa":16},asset_version:1})});return;
    }
    if(req.method()==="PUT"&&url.endsWith("/assets/asset-qa")){
      saved=req.postDataJSON() as Record<string,unknown>;
      await route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({data:{id:"asset-qa",version:2}})});return;
    }
    await route.fulfill({status:404,contentType:"application/json",body:"{}"});
  });
  await page.goto(qaURL+"?view=asset",{waitUntil:"networkidle"});
  await expect(page.locator(".custom-attributes input[type='number']")).toBeVisible();
  await page.locator(".custom-attributes input[type='number']").fill("32");
  await page.locator('button[form="asset-editor-form"]').click();
  await expect.poll(()=>saved).not.toBeNull();
  expect(saved).toMatchObject({name:"Laptop",category_id:"cat-qa",attributes:{"field-qa":32}});
  expect(calls.some(x=>x.includes("/asset-fields?category_id=cat-qa"))).toBe(true);
});

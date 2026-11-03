import {test,expect} from "@playwright/test";

async function prepare(page:import("@playwright/test").Page){
 await page.context().addCookies([{url:"http://127.0.0.1:5174",name:"INVENTORY-XSRF-TOKEN",value:"fixture-token"}]);
 await page.addInitScript(()=>{
  localStorage.setItem("inventory.locale","ru");
  localStorage.setItem("inventory.theme","light");
 });
}
const company={
 company_id:"company-qa",legal_name:"Example Mining",country_code:"KZ",timezone:"Asia/Almaty",
 currency:"KZT",asset_number_prefix:"INV",document_number_prefix:"DOC",default_locale:"ru",version:0,
};

test("account displays personal details, saves name and updates password",async({page})=>{
 await prepare(page);
 const requests:Array<{url:string;method:string;body:Record<string,unknown>}>=[];
 await page.route("**/inventory-api/api/v1/profile**",async route=>{
  const req=route.request(),method=req.method(),url=req.url();
  const body=method==="GET"?{}:req.postDataJSON() as Record<string,unknown>;
  if(method!=="GET")requests.push({url,method,body});
  const data=url.endsWith("/password")?{ok:true}:{data:{
   id:1,name:method==="PUT"?"Updated Person":"Initial Person",email:"user@example.com",
  }};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.goto("/inventory/qa-p1bc.html?view=profile",{waitUntil:"networkidle"});
 await expect(page.locator(".profile-page")).toBeVisible();
 await page.locator('input[autocomplete="name"]').fill("Updated Person");
 await page.locator(".profile-form").first().locator('button[type="submit"]').click();
 await expect(page.locator(".profile-page")).toContainText("Имя обновлено");
 const current=["Fixture","Current","Password","1!"].join("");
 const next=["Fixture","Next","Password","2!"].join("");
 await page.locator('input[autocomplete="current-password"]').fill(current);
 await page.locator('input[autocomplete="new-password"]').first().fill(next);
 await page.locator('input[autocomplete="new-password"]').last().fill(next);
 await page.locator(".profile-form").nth(1).locator('button[type="submit"]').click();
 await expect(page.locator(".profile-page")).toContainText("Пароль успешно изменён");
 expect(requests).toHaveLength(2);
 expect(requests[0].body).toEqual({name:"Updated Person"});
 expect(requests[1].body).toEqual({
  current_password:current,password:next,password_confirmation:next,
 });
});

test("company setting changes, template draft and publication",async({page})=>{
 await prepare(page);
 let current={...company};let docs:Array<Record<string,unknown>>=[];
 const seen:string[]=[];
 await page.route("**/inventory-api/api/v1/companies/company-qa/**",async route=>{
  const req=route.request(),url=req.url(),method=req.method();
  if(url.endsWith("/configuration")){
   if(method==="PUT"){
    const changes=req.postDataJSON() as typeof company;
    current={...changes,version:current.version+1};
    seen.push("settings");
   }
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:current})});
   return;
  }
  if(url.endsWith("/document-templates")){
   if(method==="POST"){
    const input=req.postDataJSON() as Record<string,unknown>;
    docs=[{id:"template-qa",...input,revision:1,status:"draft"}];
    seen.push("draft");
   }
   await route.fulfill({status:method==="POST"?201:200,contentType:"application/json",
    body:JSON.stringify({data:method==="POST"?docs[0]:docs})});return;
  }
  if(url.endsWith("/document-templates/template-qa/publish")){
   docs=[{...docs[0],status:"published"}];seen.push("publish");
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:docs[0]})});
   return;
  }
  await route.fulfill({status:404,contentType:"application/json",body:"{}"});
 });
 await page.goto("/inventory/qa-p1bc.html?view=settings",{waitUntil:"networkidle"});
 await expect(page.locator(".settings-form")).toBeVisible();
 await page.locator(".settings-form input").first().fill("Example Mining LLC");
 await page.locator(".settings-form").locator('button[type="submit"]').click();
 await expect(page.locator(".company-settings")).toContainText("Настройки сохранены");
 await page.getByRole("button",{name:"Новый шаблон"}).click();
 await page.locator("#document-template-form input").fill("Inventory Act");
 await page.locator("#document-template-form textarea").fill("Company {{company_name}}; asset {{asset_number}}");
 await page.locator('button[form="document-template-form"]').click();
 await expect(page.locator(".company-settings tbody tr")).toHaveCount(1);
 await page.getByTitle("Опубликовать").click();
 await expect(page.locator(".company-settings tbody")).toContainText("Опубликован");
 expect(seen).toEqual(["settings","draft","publish"]);
});

test("field designer creates company and category scoped field",async({page})=>{
 await prepare(page);
 let rows:Array<Record<string,unknown>>=[];
 const created:Array<Record<string,unknown>>=[];
 await page.route("**/inventory-api/api/v1/companies/company-qa/**",async route=>{
  const req=route.request(),url=req.url(),method=req.method();
  if(url.includes("/reference-data")){
   await route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({categories:[{id:"cat-qa",code:"IT",name:"IT devices"}],accounting_locations:[],physical_locations:[]})});
   return;
  }
  if(url.includes("/asset-fields")){
   if(method==="POST"){
    const data=req.postDataJSON() as Record<string,unknown>;
    created.push(data);
    rows=[{id:"field-qa",version:1,is_active:true,options:[],required:false,sort_order:0,...data}];
   }
   await route.fulfill({status:method==="POST"?201:200,contentType:"application/json",
    body:JSON.stringify({data:method==="POST"?rows[0]:rows})});return;
  }
  await route.fulfill({status:404,contentType:"application/json",body:"{}"});
 });
 await page.goto("/inventory/qa-p1bc.html?view=fields",{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"Добавить поле"}).click();
 await page.locator("#field-builder-form input[pattern]").fill("cpu_cores");
 await page.locator("#field-builder-form input[maxlength='160']").first().fill("Количество ядер");
 await page.locator('button[form="field-builder-form"]').click();
 await expect(page.locator(".fields-panel tbody")).toContainText("cpu_cores");
 expect(created[0]).toMatchObject({category_id:"cat-qa",code:"cpu_cores",field_type:"text"});
});

test("existing asset loads custom values then saves changed number atomically",async({page})=>{
 await prepare(page);
 let submitted:Record<string,unknown>|null=null;
 await page.route("**/inventory-api/api/v1/companies/company-qa/**",async route=>{
  const req=route.request(),url=req.url(),method=req.method();
  if(url.includes("/asset-fields")){
   const row={id:"field-qa",company_id:"company-qa",category_id:"cat-qa",code:"ram_gb",
    label_ru:"ОЗУ (ГБ)",label_en:"RAM",label_ka:"RAM",field_type:"number",
    options:[],required:true,is_active:true,sort_order:0,version:1};
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[row]})});return;
  }
  if(url.endsWith("/assets/asset-qa/attributes")){
   await route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({data:{"field-qa":16},asset_version:1})});return;
  }
  if(method==="PUT"&&url.endsWith("/assets/asset-qa")){
   submitted=req.postDataJSON() as Record<string,unknown>;
   await route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({data:{id:"asset-qa",version:2}})});return;
  }
  await route.fulfill({status:404,contentType:"application/json",body:"{}"});
 });
 await page.goto("/inventory/qa-p1bc.html?view=asset",{waitUntil:"networkidle"});
 const input=page.locator(".custom-attributes input[type=number]");
 await expect(input).toBeVisible();
 await expect(input).toHaveValue("16");
 await input.fill("32");
 await page.locator('button[form="asset-editor-form"]').click();
 await expect.poll(()=>submitted).not.toBeNull();
 expect(submitted).toMatchObject({attributes:{"field-qa":32},name:"Laptop",category_id:"cat-qa"});
});

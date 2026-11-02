import {test,expect,type Page} from "@playwright/test";

const company="11111111-1111-4111-8111-111111111111";
const asset="22222222-2222-4222-8222-222222222222";
const person="33333333-3333-4333-8333-333333333333";
const location="44444444-4444-4444-8444-444444444444";

function paged(data:unknown[]) {
  return {data,meta:{current_page:1,last_page:1,total:data.length,per_page:25},
    links:{first:null,last:null,prev:null,next:null}};
}
const assetRow={
  id:asset,public_id:asset,inventory_number:"QA-001",name:"Office laptop",
  serial_number:"SER-001",description:null,status:"active",version:1,
  category_id:null,category_name:null,physical_location_id:null,physical_location_name:null,
  accounting_location_id:null,accounting_location_name:null,facility_node_id:null,facility_node_name:null,
  responsible_person_id:null,responsible_person_name:null,created_at:"2026-11-02T07:00:00Z",
  updated_at:"2026-11-02T07:00:00Z"
};

async function mockApi(page:Page) {
  await page.route("**/inventory-api/**",async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname.replace(/^\/inventory-api/,"");
    let body:unknown={};
    let status=200;
    if(path==="/api/v1/health") body={status:"ok",service:"itp-inventory-api",browser_login:true};
    else if(path==="/api/v1/me") body={id:1,name:"QA admin"};
    else if(path==="/api/v1/companies") body=[{id:company,name:"QA Mining",role_code:"company_admin"}];
    else if(path.endsWith("/reference-data")) body={
      categories:[],accounting_locations:[],
      physical_locations:[{id:location,code:"OFFICE",name:"Main office"}]};
    else if(path.endsWith("/facility-nodes")) body={data:[],total:0};
    else if(path.includes("/responsible-people")) body={data:[
      {id:person,name:"Alex Doe",company_id:company,code:"QA-MOL",is_active:true}],
      total:1,current_page:1,last_page:1,per_page:100};
    else if(path.endsWith("/assets")) body=paged([assetRow]);
    else if(path.endsWith("/members")) body={data:[
      {user_id:1,name:"QA admin",email:"admin@example.test",active:true,role_code:"company_admin"},
      {user_id:2,name:"QA viewer",email:"viewer@example.test",active:true,role_code:"viewer"}]};
    else if(path.endsWith("/assets/bulk-responsible") && route.request().method()==="POST") body={updated:1};
    else if(path.endsWith("/assets/bulk-move") && route.request().method()==="POST") body={moved:1};
    else if(path.endsWith("/assets/export.xlsx")) {
      await route.fulfill({status:200,headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":'attachment; filename="inventory-assets.xlsx"'},body:"PKmock"});
      return;
    } else if(path==="/sanctum/csrf-cookie") body={};
    else {status=404;body={message:"Unexpected smoke API path: "+path};}
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  });
}

for(const width of [360,390,768,1440]){
  test("registry and roles responsive at "+width+"px",async({page,context})=>{
    await page.setViewportSize({width,height:900});
    await context.addCookies([{name:"INVENTORY-XSRF-TOKEN",value:"smoke",url:"http://127.0.0.1:5174"}]);
    await mockApi(page);
    await page.goto("/inventory/");
    await expect(page.getByRole("heading",{name:"Реестр активов"}).first()).toBeVisible();
    const portal = page.locator('a.portal-home:visible');
    await expect(portal).toHaveCount(1);
    await expect(portal).toHaveAttribute("href", "https://platform.itpmining.kz/");
    await expect(portal).toHaveAttribute("aria-label", "ITP Portal");
    if (width > 860) {
      await expect(portal.locator(".portal-home__light")).toBeVisible();
      await page.getByRole("button",{name:"Тёмная тема"}).click();
      await expect(portal.locator(".portal-home__dark")).toBeVisible();
      await expect(portal.locator(".portal-home__light")).toHaveCount(0);
    } else {
      await expect(portal.locator(".portal-home__mark")).toBeVisible();
    }
    await expect(page.getByText("QA-001").first()).toBeVisible();
    const iconActions = page.locator("button.base-icon-button");
    expect(await iconActions.count()).toBeGreaterThanOrEqual(6);
    const missingAccessibleNames = await iconActions.evaluateAll(buttons =>
      buttons.filter(button => !button.getAttribute("aria-label")?.trim()).length
    );
    expect(missingAccessibleNames, "Every icon-only action must have a readable label").toBe(0);

    await expect(page.getByRole("link",{name:/Excel/i})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow,"Page must not overflow; wide tables should scroll internally").toBeLessThanOrEqual(2);
    await page.goto("/inventory/company-roles");
    await expect(page.getByRole("heading",{name:"Пользователи и роли"}).first()).toBeVisible();
    await expect(page.getByText("QA viewer")).toBeVisible();
    const rolesOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(rolesOverflow,"Role manager must remain responsive").toBeLessThanOrEqual(2);
  });
}

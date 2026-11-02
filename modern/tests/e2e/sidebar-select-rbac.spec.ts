import { test,expect } from "./fixtures";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE,"Synthetic QA users required");

async function selectCompany(page:import("@playwright/test").Page,name:string){
  const selector=page.getByRole("combobox",{name:"Компания"});
  await expect(selector).toBeVisible();
  await page.locator(".company-picker .dropdown-trigger").click();
  await expect(page.getByRole("listbox",{name:"Компания"})).toBeVisible();
  await page.getByRole("listbox",{name:"Компания"}).getByRole("option",{name,exact:true}).click();
  await expect(page.locator(".company-picker .dropdown-trigger")).toContainText(name);
  return await selector.inputValue();
}

test("common company and locale selectors display styled popup instead of native OS menu",async({page})=>{
  await page.goto("/inventory/registry");
  const company=page.getByRole("combobox",{name:"Компания"});
  await expect(company).toBeVisible();
  await expect(page.locator("select[aria-label='Компания']")).toHaveCount(1);
  await selectCompany(page,"Inventory QA - Mining");
  await page.locator(".company-picker .dropdown-trigger").click();
  await expect(page.getByRole("listbox",{name:"Компания"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox",{name:"Компания"})).toHaveCount(0);
  await expect(company).not.toHaveValue("");
  await selectCompany(page,"Inventory QA - Solutions");
  await selectCompany(page,"Inventory QA - Mining");
  const locale=page.getByRole("combobox",{name:"Язык / Language"});
  await page.locator("div.locale-select .dropdown-trigger").click();
  await page.getByRole("listbox",{name:"Язык / Language"}).getByRole("option",{name:"EN"}).click();
  await expect(locale).toHaveValue("en");
  await expect(page.locator("html")).toHaveAttribute("lang","en");
  await page.locator("div.locale-select .dropdown-trigger").click();
  await page.getByRole("listbox",{name:"Язык / Language"}).getByRole("option",{name:"GE"}).click();
  await expect(locale).toHaveValue("ka");
  await page.locator("div.locale-select .dropdown-trigger").click();
  await page.getByRole("listbox",{name:"Язык / Language"}).getByRole("option",{name:"RU"}).click();
  await expect(locale).toHaveValue("ru");
});

test("desktop sidebar collapses to icon-only 66px, persists across refresh, restores full width",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/inventory/registry");
  await expect(page.locator(".sidebar")).toBeVisible();
  if(await page.locator(".shell").evaluate(node=>node.classList.contains("shell--collapsed"))){
    await page.getByRole("button",{name:"Развернуть меню"}).click();
  }
  await page.getByRole("button",{name:"Свернуть меню"}).click();
  await expect(page.locator(".shell")).toHaveClass(/shell--collapsed/);
  await expect(page.locator(".sidebar")).toHaveCSS("width","66px");
  await expect(page.getByRole("link",{name:"Основные средства"})).toHaveAttribute("title",/Основные средства/);
  await expect(page.locator(".main-navigation .nav-label").first()).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("inventory.sidebarCollapsed"))).toBe("true");
  await page.reload();
  await expect(page.locator(".shell")).toHaveClass(/shell--collapsed/);
  await page.getByRole("button",{name:"Развернуть меню"}).click();
  await expect(page.locator(".shell")).not.toHaveClass(/shell--collapsed/);
  await expect(page.locator(".sidebar")).toHaveCSS("width","258px");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("inventory.sidebarCollapsed"))).toBe("false");
});

test("mobile sidebar opens HRM-style drawer, traps background scroll and closes by backdrop, escape and route",async({page})=>{
  for(const width of [360,390,768]){
    await page.setViewportSize({width,height:820});
    await page.goto("/inventory/registry");
    const sidebar=page.locator(".sidebar");
    const button=page.getByRole("button",{name:"Открыть меню"});
    await expect(button).toBeVisible();
    await expect(sidebar).not.toHaveClass(/sidebar--open/);
    await button.click();
    await expect(sidebar).toHaveClass(/sidebar--open/);
    await expect(page.locator(".nav-backdrop")).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/inventory-mobile-nav-open/);
    await page.keyboard.press("Escape");
    await expect(sidebar).not.toHaveClass(/sidebar--open/);
    await expect(page.locator(".nav-backdrop")).toHaveCount(0);
    await button.click();
    await page.locator(".nav-backdrop").click({position:{x:width-5,y:800}});
    await expect(sidebar).not.toHaveClass(/sidebar--open/);
    await button.click();
    await page.getByRole("navigation",{name:"Inventory"}).getByRole("link",{name:"Отчёты"}).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(sidebar).not.toHaveClass(/sidebar--open/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("styled selects work in pagination/form controls and do not overflow mobile viewport",async({page})=>{
  for(const width of [390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto("/inventory/registry");
    await selectCompany(page,"Inventory QA - Mining");
    await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).waitFor();
    const selector=page.locator("select.base-select").first();
    await expect(selector).toBeVisible();
    const popupTrigger=page.locator(".base-select .dropdown-trigger").first();
    await popupTrigger.click();
    const visiblePopup=page.locator(".base-select .dropdown-panel").first();
    await expect(visiblePopup).toBeVisible();
    const rect=await visiblePopup.boundingBox();
    expect(rect).toBeTruthy();
    expect(rect!.x).toBeGreaterThanOrEqual(-1);
    expect(rect!.x+rect!.width).toBeLessThanOrEqual(width+1);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("viewer cannot access company roles through menu, direct URL or API",async({browser})=>{
  const context=await browser.newContext({
    baseURL:process.env.INVENTORY_E2E_BASE_URL||"http://127.0.0.1:5215/inventory/",
    storageState:"test-results/.auth/viewer.json",
  });
  try{
    const page=await context.newPage();
    await page.goto("/inventory/registry");
    await expect(page.locator("nav.main-navigation")).toBeVisible();
    await expect(page.getByRole("link",{name:"Пользователи и роли"})).toHaveCount(0);
    await page.goto("/inventory/company-roles");
    await expect(page).toHaveURL(/\/registry$/);
    const status=await page.evaluate(async()=>{
      const response=await fetch("/inventory-api/api/v1/companies");
      const companies=await response.json() as Array<{id:string;role_code:string}>;
      const company=companies.find(x=>x.role_code==="viewer");
      if(!company)throw new Error("Viewer QA membership missing");
      const root="/inventory-api/api/v1/companies/"+encodeURIComponent(company.id);
      const cookie=document.cookie.split("; ").find(x=>x.startsWith("INVENTORY-XSRF-TOKEN="));
      const token=cookie?decodeURIComponent(cookie.substring("INVENTORY-XSRF-TOKEN=".length)):"";
      const headers={"Accept":"application/json","Content-Type":"application/json","X-XSRF-TOKEN":token};
      const [list,privateRole,create]=await Promise.all([
        fetch(root+"/assets",{headers,credentials:"same-origin"}),
        fetch(root+"/members",{headers,credentials:"same-origin"}),
        fetch(root+"/assets",{method:"POST",headers,credentials:"same-origin",body:"{}"}),
      ]);
      return {list:list.status,privateRole:privateRole.status,create:create.status};
    });
    expect(status).toEqual({list:200,privateRole:403,create:403});
  }finally{await context.close()}
});
test("company administrator can see role management and inspect membership list",async({page})=>{
  await page.goto("/inventory/registry");
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByRole("link",{name:"Пользователи и роли"})).toBeVisible();
  await page.getByRole("link",{name:"Пользователи и роли"}).click();
  await expect(page.getByRole("heading",{name:"Пользователи и роли"})).toBeVisible();
});

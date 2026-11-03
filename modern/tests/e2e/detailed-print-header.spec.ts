import {test,expect} from "./fixtures";
import type {Page} from "@playwright/test";
import type {PrintFormKind} from "../../src/api/printForms";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE,"Synthetic authorized Inventory QA is required");
const root="/inventory/";

async function openMining(page:Page,path:string){
  await page.goto(root+path);
  await expect(page.locator("nav.main-navigation")).toBeVisible();
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByRole("combobox",{name:"Компания"})).not.toHaveValue("");
}

// Print tests must not depend on stocktake-flow.spec.ts having run earlier.
async function ensureQaStocktake(page:Page):Promise<string>{
  await openMining(page,"stocktakes");
  const company=await page.getByRole("combobox",{name:"Компания"}).inputValue();
  const getSessions=()=>page.evaluate(async companyId=>{
    const r=await fetch("/inventory-api/api/v1/companies/"+encodeURIComponent(companyId)+
      "/inventory-sessions?per_page=10&page=1",{credentials:"same-origin"});
    if(!r.ok)throw new Error("QA stocktake query failed "+r.status);
    return (await r.json()).data as Array<{id:string}>;
  },company);
  let sessions=await getSessions();
  if(sessions.length===0){
    await page.getByRole("button",{name:"Создать проверку"}).click();
    const form=page.getByRole("dialog",{name:"Новая инвентаризация"});
    await form.getByLabel(/Название проверки/).fill("QA print fixture "+Date.now());
    await form.getByRole("button",{name:"Начать проверку"}).click();
    await expect(form).toBeHidden();
    sessions=await getSessions();
  }
  expect(sessions.length).toBeGreaterThan(0);
  return sessions[0].id;
}

test("header keeps company selector at right across full Inventory navigation and devices",async({page})=>{
  test.setTimeout(180_000);
  await openMining(page,"registry");
  const routes=["registry","facilities","references","people","warehouses","stocktakes","disposals","reports","company-roles"];
  const viewports=[{width:360,height:780},{width:390,height:850},{width:768,height:850},
    {width:1024,height:850},{width:1440,height:900}];
  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    for(const route of routes){
      await page.goto(root+route);
      const header=page.locator(".topbar");
      const right=page.locator(".topbar-trailing");
      const selector=page.getByRole("combobox",{name:"Компания"});
      await expect(selector).toBeVisible();
      const layout=await page.evaluate(()=>{
        const hdr=document.querySelector(".topbar")!.getBoundingClientRect();
        const tools=document.querySelector(".topbar-trailing")!.getBoundingClientRect();
        const company=document.querySelector(".company-switcher select")!.getBoundingClientRect();
        return {
          hdrRight:hdr.right,toolsRight:tools.right,selectRight:company.right,
          selectorWidth:company.width,pageOverflow:document.documentElement.scrollWidth-innerWidth,
          windowWidth:innerWidth,
        };
      });
      expect(layout.pageOverflow,route+" "+viewport.width+" page overflow").toBeLessThanOrEqual(1);
      expect(layout.hdrRight-layout.toolsRight,route+" "+viewport.width+" tool spacing").toBeLessThanOrEqual(32);
      expect(layout.hdrRight-layout.selectRight,route+" "+viewport.width+" company selector misplaced").toBeLessThanOrEqual(
        viewport.width<=760?34:280,
      );
      if(route==="registry"&&[390,1024,1440].includes(viewport.width)){
        await page.screenshot({path:"test-results/header-right-"+viewport.width+".png",fullPage:true,animations:"disabled"});
      }
      await expect(header).toBeVisible();
      await expect(right).toBeVisible();
    }
  }
});

test("six detailed print forms use authenticated API, actual rows, filters and signatures",async({page})=>{
  test.setTimeout(120_000);
  await openMining(page,"reports");
  const form=page.getByRole("combobox",{name:"Вид документа"});
  await expect(form).toBeVisible();
  expect(await form.locator("option").count()).toBe(6);
  const kinds:PrintFormKind[]=[
    "asset-register","by-facility","by-custodian","warehouse-balances","stocktake-act","disposal-register",
  ];
  for(const kind of kinds){
    await form.selectOption(kind);
    if(kind==="stocktake-act"){
      let selector=page.getByRole("combobox",{name:"Инвентаризация"});
      if(await selector.locator("option").count()<=1){
        await ensureQaStocktake(page);
        await openMining(page,"reports");
        await page.getByRole("combobox",{name:"Вид документа"}).selectOption(kind);
        selector=page.getByRole("combobox",{name:"Инвентаризация"});
      }
      await expect.poll(async()=>selector.locator("option").count()).toBeGreaterThan(1);
      await selector.selectOption({index:1});
    }
    if(kind==="warehouse-balances"){
      await page.getByRole("button",{name:"Склад",exact:true}).click();
      const options=page.getByRole("dialog",{name:"Склад"}).getByRole("checkbox");
      // A clean synthetic QA company may have no warehouses yet.
      // Warehouse transactions and populated filtering have dedicated E2E coverage.
      if(await options.count()>0)await options.first().check();
      await page.keyboard.press("Escape");
    }
    if(kind==="disposal-register"){
      await page.getByRole("button",{name:"Этап списания",exact:true}).click();
      await page.getByRole("dialog",{name:"Этап списания"}).getByRole("checkbox",{name:"Черновик"}).check();
      await page.keyboard.press("Escape");
    }
    const api=page.waitForResponse(r=>r.url().includes("/reports/forms/"+kind)&&r.status()===200,{timeout:15000});
    const popupEvent=page.waitForEvent("popup");
    await page.getByRole("button",{name:"Просмотр / печать"}).click();
    const popup=await popupEvent;
    const apiResponse=await api;
    const payload=await apiResponse.json();
    await popup.locator("main.document h1").waitFor({state:"visible",timeout:18000});
    const tables=popup.locator("table");
    if(["by-facility","by-custodian","warehouse-balances"].includes(kind)){
      expect(await tables.count()).toBeGreaterThanOrEqual(1);
    }else{
      await expect(tables).toHaveCount(1);
    }
    await expect(popup.locator(".signature")).toHaveCount(4);
    await expect(popup.locator(".document-head .company")).toContainText("Inventory QA - Mining");
    expect(payload.data.row_count).toBe(payload.data.rows.length);
    expect(payload.data.company.name).toBe("Inventory QA - Mining");
    expect(payload.data.kind).toBe(kind);
    expect(await popup.locator("script").count()).toBe(0);
    const printLayout=await popup.evaluate(()=>({
      style:document.querySelector("style")?.textContent??"",
      wide:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      text:document.body.textContent??"",
    }));
    expect(printLayout.style).toContain("@page{size:A4");
    expect(printLayout.style).toContain("thead{display:table-header-group}");
    if(kind==="stocktake-act")expect(printLayout.text).toContain("Местонахождение по учёту");
    if(kind==="warehouse-balances")expect(printLayout.text).toContain("Остаток");
    if(kind==="disposal-register")expect(printLayout.text).toContain("Этап");
    if(["asset-register","warehouse-balances","stocktake-act","disposal-register"].includes(kind)){
      await popup.screenshot({path:"test-results/print-"+kind+".png",fullPage:true,animations:"disabled"});
    }
    await popup.close();
  }
});

test("print form remains company-scoped after switching company and cannot access foreign stocktake",async({page})=>{
  await openMining(page,"reports");
  const selector=page.getByRole("combobox",{name:"Компания"});
  await page.getByRole("combobox",{name:"Вид документа"}).selectOption("asset-register");
  const apiMining=page.waitForResponse(r=>r.url().includes("/reports/forms/asset-register")&&r.status()===200);
  const popupMiningEvent=page.waitForEvent("popup");
  await page.getByRole("button",{name:"Просмотр / печать"}).click();
  const popupMining=await popupMiningEvent;
  const mining=(await (await apiMining).json()).data;
  await popupMining.close();
  await selector.selectOption({label:"Inventory QA - Solutions"});
  await expect(selector).not.toHaveValue(mining.company.id);
  const apiSolutions=page.waitForResponse(r=>r.url().includes("/reports/forms/asset-register")&&r.status()===200);
  const popupSolutionsEvent=page.waitForEvent("popup");
  await page.getByRole("button",{name:"Просмотр / печать"}).click();
  const popupSolutions=await popupSolutionsEvent;
  const solution=(await (await apiSolutions).json()).data;
  await expect(popupSolutions.locator(".document-head .company")).toContainText("Inventory QA - Solutions");
  expect(solution.company.id).not.toBe(mining.company.id);
  expect(solution.company.name).toBe("Inventory QA - Solutions");
  expect(solution.rows.some((x:{inventory_number:string})=>x.inventory_number==="MIN-0001")).toBe(false);
  await popupSolutions.close();
});


test("stocktake detail opens exactly its own printable act",async({page})=>{
  const sessionId=await ensureQaStocktake(page);
  await page.goto(root+"stocktakes/"+sessionId);
  await expect(page.getByRole("link",{name:"Печатать акт"})).toBeVisible();
  await page.getByRole("link",{name:"Печатать акт"}).click();
  await expect(page).toHaveURL(/\/inventory\/reports\?print_session=/);
  await expect(page.getByRole("combobox",{name:"Вид документа"})).toHaveValue("stocktake-act");
  await expect(page.getByRole("combobox",{name:"Инвентаризация"})).toHaveValue(sessionId);
});

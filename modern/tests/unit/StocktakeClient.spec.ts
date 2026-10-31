import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inventorySessions, createInventorySession, inventorySessionItems,
  countInventoryItem, scanInventoryQr, completeInventorySession,
  reopenInventorySession, inventoryReportHref,
} from "../../src/api/stocktakes";
import { stocktakeTranslations } from "../../src/stocktakeTranslations";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "INVENTORY-XSRF-TOKEN=;max-age=0;path=/";
});

function mockApi() {
  const calls: Array<{url:string;init:RequestInit}>=[];
  vi.stubGlobal("fetch",vi.fn(async (url:string,init:RequestInit) => {
    calls.push({url,init});
    if(url==="/inventory-api/sanctum/csrf-cookie"){
      document.cookie="INVENTORY-XSRF-TOKEN=qa-xsrf;path=/";
      return new Response(null,{status:204});
    }
    return new Response(JSON.stringify({
      data:[],meta:{total:0,current_page:1,last_page:1,per_page:25},links:{},
    }),{status:200,headers:{"Content-Type":"application/json"}});
  }));
  return calls;
}

describe("Stocktake API tenant isolation and request contracts", () => {
  it("pages and searches inside the selected company only",async()=>{
    const calls=mockApi();
    await inventorySessions("company-A",{search:"office laptop",status:"in_progress",page:2,per_page:25});
    expect(calls).toHaveLength(1);
    const query=calls[0].url;
    expect(query).toContain("/inventory-api/api/v1/companies/company-A/inventory-sessions?");
    expect(query).toContain("search=office+laptop");
    expect(query).toContain("status=in_progress");
    expect(query).toContain("page=2");
    expect(calls[0].init.credentials).toBe("same-origin");
    await inventorySessionItems("company-A","session-A",{
      search:"MIN-01",page:1,per_page:10,counted:"0",discrepancy:"",
    });
    expect(calls[1].url).toContain("counted=0");
    expect(calls[1].url).toContain("/companies/company-A/inventory-sessions/session-A/items?");
  });

  it("posts selected assets only to the correct company's protected API",async()=>{
    const calls=mockApi();
    await createInventorySession("company-1",{
      name:"October audit",asset_ids:["asset1","asset2"],
    });
    const event=calls.at(-1)!;
    expect(event.init.method).toBe("POST");
    expect(new Headers(event.init.headers).get("X-XSRF-TOKEN")).toBe("qa-xsrf");
    expect(event.url).toBe("/inventory-api/api/v1/companies/company-1/inventory-sessions");
    expect(JSON.parse(event.init.body as string)).toEqual({
      name:"October audit",asset_ids:["asset1","asset2"],
    });
  });

  it("maintains item-level and session-level optimistic versions",async()=>{
    const calls=mockApi();
    await countInventoryItem("c","s","item",{version:3,actual_location_id:"physical",note:"Checked"});
    expect(JSON.parse(calls.at(-1)!.init.body as string).version).toBe(3);
    expect(calls.at(-1)!.url).toContain("/s/items/item");
    await scanInventoryQr("c","s",{public_id:"a-public-uuid",actual_location_id:"physical"});
    expect(JSON.parse(calls.at(-1)!.init.body as string).public_id).toBe("a-public-uuid");
    await completeInventorySession("c","s",7);
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toEqual({version:7});
    await reopenInventorySession("c","s",8,"Manager reconfirmation");
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toEqual({
      version:8,reason:"Manager reconfirmation",
    });
  });

  it("exports only from same-origin session endpoint; no bearer tokens in URL",()=>{
    expect(inventoryReportHref("company 1","session")).toBe(
      "/inventory-api/api/v1/companies/company%201/inventory-sessions/session/report.csv"
    );
  });
});

describe("Stocktake Russian, English and Georgian keys",()=>{
  it("covers the exact same nonempty keys in every language",()=>{
    const ru=Object.keys(stocktakeTranslations.ru).sort();
    expect(ru.length).toBeGreaterThan(55);
    for(const locale of ["ru","en","ka"] as const){
      expect(Object.keys(stocktakeTranslations[locale]).sort()).toEqual(ru);
      for(const key of ru)expect(stocktakeTranslations[locale][key]?.trim()).not.toBe("");
    }
  });
});


describe("Stocktake screen translation coverage",()=>{
  it("provides RU, EN and KA for every literal key referenced by new screens",()=>{
    const pages=[
      "src/pages/StocktakesPage.vue",
      "src/pages/StocktakeDetailPage.vue",
      "src/components/stocktakes/StocktakeCreateDialog.vue",
    ];
    const required=new Set<string>();
    for(const p of pages){
      const source=readFileSync(join(process.cwd(),p),"utf8");
      for(const match of source.matchAll(/ui\.t\(["'](stock\.[A-Za-z0-9_.]+)["']/g)){
        if (!match[1].endsWith(".")) required.add(match[1]);
      }
    }
    for(const key of required){
      for(const locale of ["ru","en","ka"] as const){
        expect(stocktakeTranslations[locale][key],locale+" missing "+key).toBeTruthy();
      }
    }
    expect(required.size).toBeGreaterThan(35);
  });
});

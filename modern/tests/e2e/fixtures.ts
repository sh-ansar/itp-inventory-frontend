import { test as base, expect } from "@playwright/test";
export type { Page } from "@playwright/test";

/**
 * Each test owns a fresh, authenticated browser context but company-level table
 * preferences live in the database. Reset only synthetic QA accounts before
 * individual scenarios so saved search/status filters cannot hide test fixtures.
 * This is NEVER run for ordinary users without the QA secret-file opt in.
 */
export const test=base.extend({
  page: async ({page},use)=>{
    if(process.env.INVENTORY_QA_SECRET_FILE){
      await page.goto("/inventory/");
      await expect(page.locator("nav.main-navigation")).toBeVisible();
      await page.evaluate(async()=>{
        const response=await fetch("/inventory-api/api/v1/companies",{credentials:"same-origin"});
        if(!response.ok)throw new Error("QA company lookup failed");
        const companies=await response.json() as Array<{id:string}>;
        const cookie=document.cookie.split("; ").find(value=>value.startsWith("INVENTORY-XSRF-TOKEN="));
        if(!cookie)throw new Error("QA XSRF cookie missing");
        const csrf=decodeURIComponent(cookie.slice("INVENTORY-XSRF-TOKEN=".length));
        const views=["assets","stocktakes","disposals","warehouse_balances",
          "warehouse_items","warehouse_history","people"];
        for(const company of companies){
          for(const view of views){
            const r=await fetch("/inventory-api/api/v1/companies/"+encodeURIComponent(company.id)+
              "/preferences/"+view,{
              method:"DELETE",credentials:"same-origin",
              headers:{"Accept":"application/json","X-XSRF-TOKEN":csrf},
            });
            if(r.status!==204&&r.status!==404)
              throw new Error("QA preference cleanup denied: "+r.status);
          }
        }
      });
    }
    await use(page);
  },
});
export {expect};

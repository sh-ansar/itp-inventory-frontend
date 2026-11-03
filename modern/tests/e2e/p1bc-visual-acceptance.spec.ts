import {test,expect} from "./fixtures";
import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
test.skip(!process.env.INVENTORY_QA_SECRET_FILE,"Synthetic QA browser only");
const routes=["registry","facilities","references","people","warehouses","stocktakes",
  "disposals","reports","company-roles","profile","company-settings"];
const locales=["ru","en","ka"] as const;
const themes=["light","dark"] as const;
const widths=[360,390,768,1024,1440];
// Set INVENTORY_VISUAL_OUTPUT to preserve screenshot evidence across Playwright runs.
const base=process.env.INVENTORY_VISUAL_OUTPUT||join(process.cwd(),"test-results","p1bc-visual");
for(const route of routes){
  test("authenticated P1BC visual matrix "+route,async({page})=>{
    test.setTimeout(300_000);
    const rows:Array<Record<string,unknown>>=[];
    const exceptions:string[]=[];
    const httpFailures:string[]=[];
    page.on("pageerror",e=>exceptions.push(e.message));
    page.on("response",r=>{if(r.status()>=500&&r.url().includes("/inventory-api/"))
      httpFailures.push(String(r.status())+" "+new URL(r.url()).pathname)});
    for(const locale of locales){
      for(const theme of themes){
        await page.goto("/inventory/"+route,{waitUntil:"domcontentloaded"});
        await page.evaluate(({locale,theme})=>{
          localStorage.setItem("inventory.locale",locale);
          localStorage.setItem("inventory.theme",theme);
          localStorage.setItem("inventory.sidebarCollapsed","false");
        },{locale,theme});
        await page.reload({waitUntil:"domcontentloaded"});
        // The static shell appears before the authorized Vue view finishes loading.
        // Wait for the real page and the requested UI preferences, not the shell.
        await expect(page.locator(".view-content h2").first()).toBeVisible({timeout:30_000});
        await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe(locale);
        await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe(theme);
        await expect(page.locator(".login-card")).toHaveCount(0);
        // Wait for the data requests that follow initial Vue mounting: a visible
        // heading alone can still coexist with loading skeletons.
        await page.waitForLoadState("networkidle",{timeout:20_000});
        for(const width of widths){
          await page.setViewportSize({width,height:900});
          await page.waitForTimeout(100);
          const m=await page.evaluate(()=>({
            title:document.title,lang:document.documentElement.lang,
            theme:document.documentElement.dataset.theme,
            overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
            contentWidth:Math.round(document.querySelector(".view-content")?.getBoundingClientRect().width??0),
            h2:[...document.querySelectorAll(".view-content h2")].map(e=>e.textContent?.trim()).filter(Boolean).slice(0,2),
            alerts:[...document.querySelectorAll(".view-content [role='alert']")].map(e=>e.textContent?.trim()).filter(Boolean),
          }));
          const dir=join(base,locale,theme,String(width));
          mkdirSync(dir,{recursive:true});
          await page.screenshot({path:join(dir,route+".png"),fullPage:true,animations:"disabled"});
          const ok=m.title==="ITP Inventory"&&m.lang===locale&&m.theme===theme&&
            m.overflow<=1&&m.contentWidth>0&&m.h2.length>0&&
            exceptions.length===0&&httpFailures.length===0&&m.alerts.length===0;
          rows.push({route,locale,theme,width,ok,...m});
        }
      }
    }
    mkdirSync(base,{recursive:true});
    const failed=rows.filter(x=>!x.ok);
    writeFileSync(join(base,route+".json"),JSON.stringify({
      route,total:rows.length,passed:rows.length-failed.length,failed,exceptions,httpFailures
    },null,2));
    console.log("P1BC_VISUAL",route,(rows.length-failed.length)+"/"+rows.length);
    expect(failed,"P1BC visual failures on "+route).toEqual([]);
    expect(exceptions,"JavaScript exceptions on "+route).toEqual([]);
    expect(httpFailures,"API 5xx on "+route).toEqual([]);
  });
}

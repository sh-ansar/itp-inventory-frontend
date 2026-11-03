import {test,expect} from "@playwright/test";

const unitRows=[
 {id:"system:pcs",kind:"unit",code:"pcs",name:"Pieces",precision:0,is_system:true,is_active:true,version:1},
 {id:"system:kg",kind:"unit",code:"kg",name:"Kilograms",precision:3,is_system:true,is_active:true,version:1},
 {id:"custom-roll",kind:"unit",code:"roll",name:"Cable rolls",precision:0,is_active:true,source:"manual",version:1},
];

test("P1-A catalogs are responsive and keep shared forms across themes/locales",async({browser})=>{
 for(const lang of ["ru","en","ka"]){
  for(const theme of ["light","dark"]){
   for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(({lang,theme})=>{
      localStorage.setItem("inventory.locale",lang);
      localStorage.setItem("inventory.theme",theme);
    },{lang,theme});
    await context.addCookies([{name:"INVENTORY-XSRF-TOKEN",value:"smoke-token",
      url:"http://127.0.0.1:5174"}]);
    const page=await context.newPage();
    const errors:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/inventory-api/api/v1/companies/company-qa/industry-catalogs/**",async route=>{
      const req=route.request(),url=req.url();
      if(req.method()==="GET"){
        await route.fulfill({status:200,contentType:"application/json",
          body:JSON.stringify({data:url.includes("/unit")?unitRows:[]})});
      }else{
        await route.fulfill({status:201,contentType:"application/json",
          body:JSON.stringify({data:{id:"new-qa",code:"qa",name:"QA catalog"}})});
      }
    });
    await page.goto("/inventory/qa-industry.html",{waitUntil:"networkidle"});
    await expect(page.locator(".industry-panel")).toBeVisible();
    await expect(page.locator(".industry-panel tbody tr")).toHaveCount(3);
    const geometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      locale:document.documentElement.lang,
      theme:document.documentElement.dataset.theme,
      hasSharedTable:document.querySelectorAll(".industry-panel .base-data-table").length>0,
    }));
    expect(geometry.overflow,"horizontal page overflow").toBeLessThanOrEqual(1);
    expect(geometry.locale).toBe(lang);
    expect(geometry.theme).toBe(theme);
    expect(geometry.hasSharedTable).toBe(true);
    await page.locator(".industry-actions button").last().click();
    await expect(page.locator("dialog.base-drawer")).toBeVisible();
    await expect(page.locator("#industry-catalog-form input")).toHaveCount(2);
    await page.screenshot({path:"test-results/p1a-"+lang+"-"+theme+"-"+width+".png",fullPage:true});
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.base-drawer")).not.toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
   }
  }
 }
});

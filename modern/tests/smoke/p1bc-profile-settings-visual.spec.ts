import {test,expect} from "@playwright/test";

const settings={
  company_id:"company-qa",legal_name:"Example Mining",country_code:"KZ",
  timezone:"Asia/Almaty",currency:"KZT",asset_number_prefix:"INV",
  document_number_prefix:"DOC",default_locale:"ru",version:0,
};
const category={id:"cat-qa",code:"IT",name:"IT devices",is_active:true,version:1};
const field={
  id:"field-qa",company_id:"company-qa",category_id:"cat-qa",
  code:"ram_gb",label_ru:"ОЗУ (ГБ)",label_en:"RAM (GB)",label_ka:"ოპერატიული მეხსიერება",
  field_type:"number",options:[],required:true,is_active:true,sort_order:0,version:1,
};
for(const locale of ["ru","en","ka"]){
 for(const theme of ["light","dark"]){
  for(const width of [390,768,1440]){
   test(`P1BC ${locale} ${theme} ${width}px — profile/settings/field builder`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(({locale,theme})=>{
      localStorage.setItem("inventory.locale",locale);
      localStorage.setItem("inventory.theme",theme);
    },{locale,theme});
    await context.addCookies([{url:"http://127.0.0.1:5174",name:"INVENTORY-XSRF-TOKEN",value:"test-token"}]);
    const page=await context.newPage();
    const errors:string[]=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.route("**/inventory-api/api/v1/**",async route=>{
      const url=new URL(route.request().url()),method=route.request().method();
      let data:unknown={};
      if(url.pathname.endsWith("/profile")){
        data={data:{id:1,name:"Test Administrator",email:"test@example.com"}};
      }else if(url.pathname.endsWith("/configuration")){
        data={data:settings};
      }else if(url.pathname.endsWith("/document-templates")){
        data={data:[]};
      }else if(url.pathname.endsWith("/reference-data")){
        data={categories:[category],accounting_locations:[],physical_locations:[]};
      }else if(url.pathname.endsWith("/asset-fields")){
        data={data:[field]};
      }else if(url.pathname.endsWith("/assets/asset-qa/attributes")){
        data={data:{"field-qa":16},asset_version:1};
      }else if(method!=="GET"){
        data={ok:true};
      }
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    });
    for(const view of ["profile","settings","fields"]){
      await page.goto("/inventory/qa-p1bc.html?view="+view,{waitUntil:"networkidle"});
      await expect(page.locator("main")).toBeVisible();
      const metrics=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        theme:document.documentElement.dataset.theme,
        lang:document.documentElement.lang,
      }));
      expect(metrics.overflow).toBeLessThanOrEqual(1);
      expect(metrics.theme).toBe(theme);
      expect(metrics.lang).toBe(locale);
      if(view==="profile"){
        await expect(page.locator(".profile-page")).toBeVisible();
        await expect(page.locator("input[autocomplete='current-password']")).toBeVisible();
        await expect(page.locator("input[autocomplete='new-password']")).toHaveCount(2);
      }else if(view==="settings"){
        await expect(page.locator(".company-settings")).toBeVisible();
        await expect(page.locator("input")).not.toHaveCount(0);
      }else{
        await expect(page.locator(".fields-panel")).toBeVisible();
        await expect(page.locator(".fields-panel tbody tr")).toHaveCount(1);
      }
      await page.screenshot({path:`test-results/p1bc-${view}-${locale}-${theme}-${width}.png`,fullPage:true});
    }
    expect(errors).toEqual([]);
    await context.close();
   });
  }
 }
}

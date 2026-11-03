import {test,expect} from "@playwright/test";

test("diagnostic: category attribute loading from company-scoped API",async({page})=>{
  const routes:string[]=[];
  await page.route("**/inventory-api/**",async route=>{
    const url=route.request().url(),method=route.request().method();
    routes.push(method+" "+url.replace(/^.*\/inventory-api/,"/inventory-api"));
    if(url.includes("/asset-fields")){
      const data=[{id:"field-qa",company_id:"company-qa",category_id:"cat-qa",code:"ram_gb",
        label_ru:"RAM GB",label_en:"RAM GB",label_ka:"RAM GB",field_type:"number",
        options:[],required:true,is_active:true,sort_order:0,version:1}];
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data})});return;
    }
    if(url.includes("/attributes")){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:{"field-qa":16},asset_version:1})});return;
    }
    await route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({message:"Mock route unknown"})});
  });
  await page.goto("/inventory/qa-p1bc.html?view=asset",{waitUntil:"networkidle"});
  await expect(page.locator("#asset-editor-form")).toBeVisible();
  console.log("P1BC_DEBUG_ROUTES",JSON.stringify(routes));
  console.log("P1BC_DEBUG_CATEGORY",await page.locator("#asset-editor-form select").first().inputValue());
  console.log("P1BC_DEBUG_ERRORS",JSON.stringify(await page.locator("#asset-editor-form .error").allTextContents()));
  console.log("P1BC_DEBUG_DYNAMIC_COUNT",await page.locator(".custom-attributes input[type='number']").count());
});

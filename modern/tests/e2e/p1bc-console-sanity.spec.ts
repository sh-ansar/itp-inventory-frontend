import {test,expect} from "./fixtures";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE,"Synthetic authorized QA only");

test("P1BC routes produce no console errors or Vue warnings and use valid HTML patterns",async({page})=>{
  test.setTimeout(150_000);
  const issues:string[]=[];
  page.on("pageerror",e=>issues.push("PAGE_ERROR "+e.message));
  page.on("console",m=>{
    const message=m.text();
    if(m.type()==="error" || message.includes("[Vue warn]") ||
      message.includes("Pattern attribute value")){
      issues.push(m.type()+": "+message.slice(0,300));
    }
  });
  const routes=["registry","facilities","references","people","warehouses",
    "stocktakes","disposals","reports","company-roles","profile","company-settings"];
  for(const route of routes){
    await page.goto("/inventory/"+route);
    await expect(page.locator(".view-content h2").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    if(route==="references"){
      const catalog=page.locator(".industry-panel");
      await catalog.getByRole("button",{name:"Добавить",exact:true}).click();
      const dialog=page.getByRole("dialog",{name:"Новая запись"});
      const input=dialog.getByLabel(/Код/);
      await input.fill("QA-VALID-1");
      expect(await input.evaluate(el=>(el as HTMLInputElement).validity.patternMismatch)).toBe(false);
      await input.fill("BAD SPACE");
      expect(await input.evaluate(el=>(el as HTMLInputElement).validity.patternMismatch)).toBe(true);
    }
    if(route==="company-settings"){
      const prefix=page.locator('.company-settings input[pattern*="A-Z0-9"]').first();
      await expect(prefix).toBeVisible();
      expect(await prefix.evaluate(el=>(el as HTMLInputElement).validity.patternMismatch)).toBe(false);
    }
  }
  expect(issues).toEqual([]);
});

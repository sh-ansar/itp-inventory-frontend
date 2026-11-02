import {test,expect,type Page} from "@playwright/test";
import {readFileSync} from "node:fs";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE,"Requires isolated local QA database");

async function api(page:Page,path:string,method="GET",data:unknown=null):Promise<any>{
  return page.evaluate(async input=>{
    const token=document.cookie.split("; ").find(x=>x.startsWith("INVENTORY-XSRF-TOKEN="));
    const csrf=token?decodeURIComponent(token.substring("INVENTORY-XSRF-TOKEN=".length)):"";
    const r=await fetch("/inventory-api"+input.path,{
      method:input.method,credentials:"same-origin",
      headers:{Accept:"application/json","Content-Type":"application/json","X-XSRF-TOKEN":csrf},
      ...(input.data===null?{}:{body:JSON.stringify(input.data)})
    });
    const result=await r.json().catch(()=>null);
    if(!r.ok)throw new Error(input.method+" "+input.path+" returned "+r.status+" "+JSON.stringify(result).slice(0,220));
    return result;
  },{path,method,data});
}

test("real API: bulk custodians, moves, XLSX, signed report and company roles", async({page},info)=>{
  await page.goto("/inventory/");
  await expect(page.getByRole("heading",{name:"Реестр активов"})).toBeVisible();
  const memberships=await api(page,"/api/v1/companies");
  const company=memberships.find((x:{name:string})=>x.name==="Inventory QA - Mining");
  expect(company).toBeTruthy();
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
  const base="/api/v1/companies/"+company.id;
  const suffix=String(Date.now());
  const prefix="LP-"+suffix;
  const responsible=(await api(page,base+"/responsible-people","POST",{
    code:"LP-MOL-"+suffix,name:"QA Responsible "+suffix,position:"QA Inventory",is_active:true
  })).data;
  const assetA=(await api(page,base+"/assets","POST",{
    inventory_number:prefix+"-01",name:"QA Bulk laptop one "+suffix
  })).data;
  const assetB=(await api(page,base+"/assets","POST",{
    inventory_number:prefix+"-02",name:"QA Bulk laptop two "+suffix
  })).data;
  const locations=await api(page,base+"/reference-data");
  const destination=locations.physical_locations.find((x:{name:string})=>x.name==="QA office");
  expect(destination).toBeTruthy();

  await page.reload();
  await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).fill(prefix);
  const rows=page.locator("tbody tr").filter({hasText:prefix});
  await expect(rows).toHaveCount(2);
  const selectTwo=async()=>{
    for(const name of [prefix+"-01",prefix+"-02"]){
      await page.locator("tbody tr").filter({hasText:name}).getByRole("checkbox").check();
    }
  };
  await selectTwo();
  await page.getByRole("button",{name:/Назначить МОЛ/}).click();
  const dialog=page.getByRole("dialog",{name:"Массовое назначение ответственного"});
  await expect(dialog).toBeVisible();
  await dialog.locator("select").selectOption(responsible.id);
  await dialog.locator("textarea").fill("Confirmed annual change of responsible person");
  await dialog.getByRole("button",{name:"Назначить выбранным"}).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("tbody tr").filter({hasText:prefix}).first()).toContainText(responsible.name);

  await selectTwo();
  await page.getByRole("button",{name:/Переместить выбранные/}).click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
  await page.getByRole("dialog").first().locator("select").selectOption(destination.id);
  await page.getByRole("dialog").first().locator("textarea").fill("Approved office transfer for stocktake");
  await page.getByRole("dialog").first().locator("button[type=submit]").click();
  await expect(page.getByRole("dialog").first()).toBeHidden();
  await expect(page.locator("tbody tr").filter({hasText:prefix}).first()).toContainText("QA office");
  const history=await api(page,base+"/assets/"+assetA.id+"/movements");
  expect(history.data.some((x:{to_location_id:string})=>x.to_location_id===destination.id)).toBeTruthy();
  const afterBulk=await api(page,base+"/assets/"+assetA.id);
  expect(afterBulk.data.responsible_person_id).toBe(responsible.id);

  const downloadEvent=page.waitForEvent("download");
  await page.getByRole("link",{name:/Экспорт Excel/}).click();
  const excel=await downloadEvent;
  expect(excel.suggestedFilename()).toBe("inventory-assets.xlsx");
  const xlsxPath=info.outputPath("registry.xlsx");
  await excel.saveAs(xlsxPath);
  expect(readFileSync(xlsxPath).subarray(0,2).toString("utf8")).toBe("PK");

  const created=await api(page,base+"/inventory-sessions","POST",{
    name:"QA Signed report "+suffix,asset_ids:[assetA.id,assetB.id]
  });
  await page.goto("/inventory/stocktakes/"+created.data.id);
  await expect(page.getByRole("heading",{name:"QA Signed report "+suffix})).toBeVisible();
  const stockExport=page.waitForEvent("download");
  await page.getByRole("link",{name:"Excel XLSX"}).click();
  const stockXlsx=await stockExport;
  expect(stockXlsx.suggestedFilename()).toBe("inventory-stocktake.xlsx");
  await stockXlsx.saveAs(info.outputPath("stocktake.xlsx"));
  await page.getByRole("button",{name:"Завершить проверку"}).click();
  const confirmation=page.getByRole("dialog",{name:"Завершить проверку"});
  await confirmation.getByRole("button",{name:"Завершить проверку"}).click();
  await expect(confirmation).toBeHidden();
  const documentPanel=page.locator(".document-panel");
  await documentPanel.locator('input[type=file]').setInputFiles({
    name:"signed-qa-report.pdf",mimeType:"application/pdf",
    buffer:Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n")
  });
  await documentPanel.getByRole("button",{name:"Прикрепить документ"}).click();
  await expect(documentPanel.getByRole("link",{name:"signed-qa-report.pdf"})).toBeVisible();
  const signedDl=page.waitForEvent("download");
  await documentPanel.getByRole("link",{name:"signed-qa-report.pdf"}).click();
  expect((await signedDl).suggestedFilename()).toBe("signed-qa-report.pdf");

  await page.goto("/inventory/company-roles");
  await expect(page.getByRole("heading",{name:"Пользователи и роли"}).first()).toBeVisible();
  const viewer=page.locator(".member").filter({hasText:"inventory.viewer@example.test"});
  await expect(viewer).toBeVisible();
  await viewer.locator("select").selectOption("inventory_manager");
  await viewer.locator("input").first().fill("Temporary QA role elevation");
  await viewer.getByRole("button",{name:"Сохранить роль"}).click();
  await expect(viewer.locator("select")).toHaveValue("inventory_manager");
  await viewer.locator("select").selectOption("viewer");
  await viewer.locator("input").first().fill("Restore QA viewer permissions");
  await viewer.getByRole("button",{name:"Сохранить роль"}).click();
  await expect(viewer.locator("select")).toHaveValue("viewer");

  await viewer.locator("input").last().fill("Revalidate membership invitation flow");
  page.once("dialog",async d=>d.accept());
  await viewer.getByRole("button",{name:"Отозвать доступ"}).click();
  await expect(viewer).toHaveCount(0);
  const grant=page.locator(".grant-form");
  await grant.locator('input[type=email]').fill("inventory.viewer@example.test");
  await grant.locator("select").selectOption("viewer");
  await grant.locator("input").last().fill("Reinstate synthetic QA viewer account");
  await grant.getByRole("button",{name:"Предоставить доступ"}).click();
  await expect(viewer).toBeVisible();
  console.log("INVENTORY_REAL_LIVE_PARITY=PASS");
});
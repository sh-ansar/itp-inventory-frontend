import {test,expect} from "./fixtures";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE,"Synthetic Inventory QA tenant required");

test("multi-select OR facets persist per company and are sent to Laravel and Excel",async({page})=>{
  test.setTimeout(90_000);
  await page.goto("/inventory/registry");
  const company=page.getByRole("combobox",{name:"Компания"});
  await company.selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByRole("button",{name:"Настройки таблицы"})).toBeEnabled();

  const status=page.getByRole("button",{name:"Статус",exact:true});
  await status.click();
  const statusList=page.getByRole("dialog",{name:"Статус"});
  await statusList.getByRole("checkbox",{name:"На учёте"}).check();
  const statusSecond=page.waitForResponse(response=>{
    if(!response.url().includes("/assets?")||response.status()!==200)return false;
    const keys=new URL(response.url()).searchParams.getAll("statuses[]");
    return keys.includes("active")&&keys.includes("written_off");
  });
  await statusList.getByRole("checkbox",{name:"Списан"}).check();
  await statusSecond;
  await expect(status).toContainText("2 выбрано");
  await page.keyboard.press("Escape");

  const facility=page.getByRole("button",{name:"Объект / помещение",exact:true});
  await facility.click();
  const facilityList=page.getByRole("dialog",{name:"Объект / помещение"}).getByRole("checkbox");
  await expect.poll(()=>facilityList.count()).toBeGreaterThan(2);
  const first=await facilityList.nth(0).getAttribute("value");
  const second=await facilityList.nth(1).getAttribute("value");
  await facilityList.nth(0).check();
  const facilityResponse=page.waitForResponse(response=>{
    if(!response.url().includes("/assets?")||response.status()!==200)return false;
    const values=new URL(response.url()).searchParams.getAll("facility_node_ids[]");
    return values.includes(first!)&&values.includes(second!);
  });
  await facilityList.nth(1).check();
  await facilityResponse;
  await page.keyboard.press("Escape");

  const custodian=page.getByRole("button",{name:"Ответственное лицо",exact:true});
  await custodian.click();
  const custodianList=page.getByRole("dialog",{name:"Ответственное лицо"}).getByRole("checkbox");
  await expect.poll(()=>custodianList.count()).toBeGreaterThan(1);
  await custodianList.nth(0).check();
  await custodianList.nth(1).check();
  await page.keyboard.press("Escape");

  const exportLink=page.getByRole("link",{name:"Экспорт Excel"});
  await expect(exportLink).toHaveAttribute("href",/statuses/);
  const uri=await exportLink.getAttribute("href");
  const params=new URL(uri!,"http://localhost").searchParams;
  expect(params.getAll("statuses[]")).toEqual(["active","written_off"]);
  expect(params.getAll("facility_node_ids[]")).toEqual([first,second]);
  expect(params.getAll("responsible_person_ids[]")).toHaveLength(2);

  await page.waitForResponse(r=>r.url().includes("/preferences/assets")&&r.request().method()==="PUT"&&r.status()===200);
  await page.reload();
  await expect(page.getByRole("button",{name:"Настройки таблицы"})).toBeEnabled();
  await expect(page.getByRole("button",{name:"Статус",exact:true})).toContainText("2 выбрано");
  await company.selectOption({label:"Inventory QA - Solutions"});
  await expect(page.getByRole("button",{name:"Статус",exact:true})).toContainText("Все");
  await company.selectOption({label:"Inventory QA - Mining"});
  await expect(page.getByRole("button",{name:"Статус",exact:true})).toContainText("2 выбрано");
  await page.getByRole("button",{name:"Настройки таблицы"}).click();
  const dialog=page.getByRole("dialog",{name:"Настройки таблицы"});
  await dialog.getByRole("button",{name:"Сбросить настройки"}).click();
  await dialog.getByRole("button",{name:"Закрыть",exact:true}).click();
});

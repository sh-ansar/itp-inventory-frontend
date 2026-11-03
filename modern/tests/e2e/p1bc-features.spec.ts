import {test, expect} from "./fixtures";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Local synthetic QA accounts only");

test("P1 profile name edit persists after reload and can be restored", async ({page}) => {
  await page.goto("/inventory/profile");
  await expect(page.getByRole("heading",{name:"Личный кабинет"})).toBeVisible();
  const input=page.getByLabel("Имя и фамилия");
  await expect(input).toBeVisible();
  const original=await input.inputValue();
  const changed="Inventory QA Accepted "+Date.now();
  await input.fill(changed);
  await page.getByRole("button",{name:"Сохранить",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Имя обновлено");
  await page.reload();
  await expect(page.getByLabel("Имя и фамилия")).toHaveValue(changed);
  await page.getByLabel("Имя и фамилия").fill(original);
  await page.getByRole("button",{name:"Сохранить",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Имя обновлено");
});

test("P1 industry company catalog creates, archives and displays historical entry",async({page})=>{
  await page.goto("/inventory/references");
  const panel=page.locator(".industry-panel");
  await expect(panel.getByRole("heading",{name:"Отраслевые справочники"})).toBeVisible();
  const uniq=Date.now().toString(36);
  const code="qatest"+uniq;
  const name="QA unit "+uniq;
  await panel.getByRole("button",{name:"Добавить",exact:true}).click();
  const editor=page.getByRole("dialog",{name:"Новая запись"});
  await expect(editor).toBeVisible();
  await editor.getByLabel(/Код/).fill(code);
  await editor.getByLabel(/Наименование/).fill(name);
  await editor.getByRole("button",{name:"Сохранить",exact:true}).click();
  await expect(editor).toBeHidden();
  const row=panel.locator("tr").filter({hasText:name});
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:"Архивировать: "+name}).click();
  const confirm=page.getByRole("dialog",{name:"Подтвердить действие"});
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button",{name:"Подтвердить"}).click();
  await expect(row).toHaveCount(0);
  await panel.getByLabel("Показывать архивные").check();
  await expect(panel.locator("tr").filter({hasText:name})).toBeVisible();
});

test("P1 custom asset field definition saved and visible after reload",async({page})=>{
  await page.goto("/inventory/references");
  const panel=page.locator(".fields-panel");
  await expect(panel.getByRole("heading",{name:"Конструктор характеристик"})).toBeVisible();
  await panel.getByRole("button",{name:"Добавить поле"}).click();
  const dialog=page.getByRole("dialog",{name:"Характеристика имущества"});
  await expect(dialog).toBeVisible();
  const uniq=Date.now().toString(36);
  const code="qafield"+uniq;
  const label="QA Attribute "+uniq;
  await dialog.getByLabel(/Код \(латиницей\)/).fill(code);
  await dialog.getByLabel(/Название RU/).fill(label);
  await dialog.getByRole("button",{name:"Сохранить",exact:true}).click();
  await expect(dialog).toBeHidden();
  await expect(panel.locator("tr").filter({hasText:label})).toBeVisible();
  await page.reload();
  const saved=page.locator(".fields-panel tr").filter({hasText:label});
  await expect(saved).toBeVisible();
  await expect(saved).toContainText("Текст");
  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("en");
  await expect(saved).toContainText("Text");
  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("ka");
  await expect(saved).toContainText("ტექსტი");
  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("ru");
});

test("P1 company settings can create and preview a company-scoped document draft",async({page})=>{
  await page.goto("/inventory/company-settings");
  await expect(page.getByRole("heading",{name:"Настройки компании"})).toBeVisible();
  const name="QA document "+Date.now().toString(36);
  await page.getByRole("button",{name:"Новый шаблон"}).click();
  const dialog=page.getByRole("dialog",{name:"Новый шаблон"});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Название/).fill(name);
  await dialog.getByLabel(/Текст шаблона/).fill("QA document for {{company_name}} - sample fixture only.");
  await dialog.getByRole("button",{name:"Сохранить черновик"}).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("tr").filter({hasText:name})).toBeVisible();
  await page.reload();
  const row=page.locator("tr").filter({hasText:name});
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:"Просмотр"}).click();
  await expect(page.getByRole("dialog",{name})).toContainText("QA document for");
});

test("P1 viewer has profile but cannot open company configuration or edit dictionaries",async({browser})=>{
  const context=await browser.newContext({
    baseURL:process.env.INVENTORY_E2E_BASE_URL,
    storageState:"test-results/.auth/viewer.json",
  });
  try{
    const page=await context.newPage();
    await page.goto("/inventory/profile");
    await expect(page.getByRole("heading",{name:"Личный кабинет"})).toBeVisible();
    await page.goto("/inventory/company-settings");
    await expect(page).toHaveURL(/\/registry$/);
    await page.goto("/inventory/references");
    const panel=page.locator(".industry-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button",{name:"Добавить",exact:true})).toHaveCount(0);
    await expect(page.locator(".fields-panel").getByRole("button",{name:"Добавить поле"})).toHaveCount(0);
  }finally{await context.close()}
});


test("P1 asset card persists a company-defined attribute atomically with asset update",async({page})=>{
  await page.goto("/inventory/references");
  const fieldPanel=page.locator(".fields-panel");
  await expect(fieldPanel.getByRole("heading",{name:"Конструктор характеристик"})).toBeVisible();
  await fieldPanel.getByLabel("Тип имущества").selectOption({label:"IT equipment"});
  await fieldPanel.getByRole("button",{name:"Добавить поле"}).click();
  const dialog=page.getByRole("dialog",{name:"Характеристика имущества"});
  const suffix=Date.now().toString(36);
  const label="QA Asset Field "+suffix;
  await dialog.getByLabel(/Код \(латиницей\)/).fill("qa_asset_"+suffix);
  await dialog.getByLabel(/Название RU/).fill(label);
  await dialog.getByRole("button",{name:"Сохранить",exact:true}).click();
  await expect(dialog).toBeHidden();
  await page.goto("/inventory/registry");
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
  await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).fill("MIN-0001");
  const row=page.locator("tbody tr").filter({hasText:"MIN-0001"});
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:"Редактировать: MIN-0001"}).click();
  const edit=page.getByRole("dialog",{name:"Редактирование актива"});
  const input=edit.getByLabel(label,{exact:true});
  await expect(input).toBeVisible();
  const value="QA value "+suffix;
  await input.fill(value);
  await edit.getByRole("button",{name:"Сохранить"}).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).fill("MIN-0001");
  await page.locator("tbody tr").filter({hasText:"MIN-0001"})
    .getByRole("button",{name:"Редактировать: MIN-0001"}).click();
  const reopened=page.getByRole("dialog",{name:"Редактирование актива"});
  await expect(reopened.getByLabel(label,{exact:true})).toHaveValue(value);
  // Clean the mutable asset value, keep only synthetic field definition in QA.
  await reopened.getByLabel(label,{exact:true}).fill("");
  await reopened.getByRole("button",{name:"Сохранить"}).click();
  await expect(reopened).toBeHidden();
});


test("P1 company legal name persists through settings save and reload",async({page})=>{
  await page.goto("/inventory/company-settings");
  await expect(page.getByRole("heading",{name:"Настройки компании"})).toBeVisible();
  const input=page.getByLabel("Юридическое наименование");
  await expect(input).toBeVisible();
  const original=await input.inputValue();
  const changed="QA Legal "+Date.now();
  await input.fill(changed);
  await page.getByRole("button",{name:"Сохранить настройки"}).click();
  await expect(page.getByRole("status")).toContainText("Настройки сохранены");
  await page.reload();
  await expect(page.getByLabel("Юридическое наименование")).toHaveValue(changed);
  await page.getByLabel("Юридическое наименование").fill(original);
  await page.getByRole("button",{name:"Сохранить настройки"}).click();
  await expect(page.getByRole("status")).toContainText("Настройки сохранены");
});


test("P1 custom field type translations respond to RU EN GE in an open editor",async({page})=>{
  await page.goto("/inventory/references");
  const panel=page.locator(".fields-panel");
  await expect(panel.getByRole("heading",{name:"Конструктор характеристик"})).toBeVisible();
  await panel.getByRole("button",{name:"Добавить поле"}).click();
  const fieldType=page.locator("#field-builder-form").getByRole("combobox").first();
  await expect.poll(async()=>fieldType.locator("option").allTextContents()).toContain("Текст");
  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("en");
  await expect.poll(async()=>fieldType.locator("option").allTextContents()).toContain("Text");
  await expect.poll(async()=>fieldType.locator("option").allTextContents()).toContain("Number");
  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("ka");
  await expect.poll(async()=>fieldType.locator("option").allTextContents()).toContain("რიცხვი");
  await page.getByRole("combobox",{name:"Язык / Language"}).selectOption("ru");
  await expect.poll(async()=>fieldType.locator("option").allTextContents()).toContain("Число");
});


test("P1 manufacturer/model linkage is editable in the asset card and isolated by company",async({page})=>{
  await page.goto("/inventory/references");
  const panel=page.locator(".industry-panel");
  const uniq=Date.now().toString(36);
  const maker="QA Maker "+uniq;
  const model="QA Model "+uniq;
  const catalog=panel.getByRole("combobox",{name:"Справочник"});
  await catalog.selectOption("manufacturer");
  await panel.getByRole("button",{name:"Добавить",exact:true}).click();
  let dialog=page.getByRole("dialog",{name:"Новая запись"});
  await dialog.getByLabel(/Код/).fill("maker"+uniq);
  await dialog.getByLabel(/Наименование/).fill(maker);
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();
  await expect(panel.locator("tr").filter({hasText:maker})).toBeVisible();
  await catalog.selectOption("model");
  await panel.getByRole("button",{name:"Добавить",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"Новая запись"});
  await dialog.getByLabel(/Код/).fill("model"+uniq);
  await dialog.getByLabel(/Наименование/).fill(model);
  await dialog.getByRole("combobox",{name:"Производитель"}).selectOption({label:maker});
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();
  await expect(panel.locator("tr").filter({hasText:model})).toBeVisible();
  await page.goto("/inventory/registry");
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
  await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).fill("MIN-0002");
  await page.locator("tbody tr").filter({hasText:"MIN-0002"})
    .getByRole("button",{name:"Редактировать: MIN-0002"}).click();
  const editor=page.getByRole("dialog",{name:"Редактирование актива"});
  const manufacturer=editor.getByRole("combobox",{name:"Производитель"});
  const modelPicker=editor.getByRole("combobox",{name:"Модель"});
  const originalManufacturer=await manufacturer.inputValue();
  const originalModel=await modelPicker.inputValue();
  await manufacturer.selectOption({label:maker});
  await modelPicker.selectOption({label:model});
  const chosenManufacturer=await manufacturer.inputValue();
  const chosenModel=await modelPicker.inputValue();
  await editor.getByRole("button",{name:"Сохранить"}).click();
  await expect(editor).toBeHidden();
  await page.reload();
  await page.getByRole("searchbox",{name:"Поиск по всему реестру"}).fill("MIN-0002");
  await page.locator("tbody tr").filter({hasText:"MIN-0002"})
    .getByRole("button",{name:"Редактировать: MIN-0002"}).click();
  const reopened=page.getByRole("dialog",{name:"Редактирование актива"});
  await expect(reopened.getByRole("combobox",{name:"Производитель"})).toHaveValue(chosenManufacturer);
  await expect(reopened.getByRole("combobox",{name:"Модель"})).toHaveValue(chosenModel);
  await reopened.getByRole("combobox",{name:"Производитель"}).selectOption(originalManufacturer);
  if(originalManufacturer){
    await reopened.getByRole("combobox",{name:"Модель"}).selectOption(originalModel);
  }else{
    await expect(reopened.getByRole("combobox",{name:"Модель"})).toHaveValue("");
  }
  await reopened.getByRole("button",{name:"Сохранить"}).click();
  await expect(reopened).toBeHidden();
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Solutions"});
  await page.goto("/inventory/references");
  const other=page.locator(".industry-panel");
  await other.getByRole("combobox",{name:"Справочник"}).selectOption("manufacturer");
  await expect(other.locator("tr").filter({hasText:maker})).toHaveCount(0);
});


test("P1 profile rejects an incorrect current password without changing credentials",async({page})=>{
  await page.goto("/inventory/profile");
  await expect(page.getByRole("heading",{name:"Личный кабинет"})).toBeVisible();
  await page.getByLabel("Текущий пароль").fill("IncorrectLocalQaPassword!");
  await page.locator('.profile-form input[autocomplete="new-password"]').first().fill("AnotherSynthetic#2026Pass");
  await page.locator('.profile-form input[autocomplete="new-password"]').last().fill("AnotherSynthetic#2026Pass");
  const response=page.waitForResponse(r=>r.url().includes("/api/v1/profile/password")&&
    r.request().method()==="PUT",{timeout:15000});
  await page.getByRole("button",{name:"Изменить пароль",exact:true}).click();
  expect((await response).status()).toBe(422);
  await expect(page.locator(".profile-page [role='alert']").first()).toBeVisible();
});


test("P1 field constructor requires confirmation before discarding unsaved changes",async({page})=>{
  await page.goto("/inventory/references");
  const panel=page.locator(".fields-panel");
  await expect(panel.getByRole("heading",{name:"Конструктор характеристик"})).toBeVisible();
  await panel.getByRole("button",{name:"Добавить поле"}).click();
  const dialog=page.getByRole("dialog",{name:"Характеристика имущества"});
  await dialog.getByLabel(/Название RU/).fill("QA unsaved field");
  await dialog.getByRole("button",{name:"Отмена"}).click();
  const confirm=page.getByRole("dialog",{name:"Подтвердить действие"});
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button",{name:"Отмена"}).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button",{name:"Отмена"}).click();
  await confirm.getByRole("button",{name:"Подтвердить"}).click();
  await expect(dialog).toBeHidden();
});


test("P1 document template publishes and remains isolated from another company",async({page})=>{
  await page.goto("/inventory/company-settings");
  await expect(page.getByRole("heading",{name:"Настройки компании"})).toBeVisible();
  const title="QA Published "+Date.now().toString(36);
  await page.getByRole("button",{name:"Новый шаблон"}).click();
  const dialog=page.getByRole("dialog",{name:"Новый шаблон"});
  await dialog.getByLabel(/Название/).fill(title);
  await dialog.getByLabel(/Текст шаблона/).fill("QA publish fixture: {{asset_number}}");
  await dialog.getByRole("button",{name:"Сохранить черновик"}).click();
  const row=page.locator("tr").filter({hasText:title});
  await expect(row).toBeVisible();
  await row.getByRole("button",{name:"Опубликовать"}).click();
  await expect(row).toContainText("Опубликован");
  await page.reload();
  await expect(page.locator("tr").filter({hasText:title})).toContainText("Опубликован");
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Solutions"});
  await page.waitForLoadState("networkidle");
  await expect(page.locator("tr").filter({hasText:title})).toHaveCount(0);
});

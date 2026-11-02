import {test,expect} from "./fixtures";

test("dirty responsible-person editor uses a reversible in-app confirmation",async({page})=>{
  await page.goto("/inventory/people");
  await page.getByRole("button",{name:"Добавить ответственное лицо"}).click();
  const editor=page.getByRole("dialog",{name:"Добавить ответственное лицо"});
  await expect(editor).toBeVisible();
  await editor.locator('input:not([type=checkbox])').first().fill("QA-NOT-SAVED-456");
  await editor.getByRole("button",{name:"Отмена"}).click();
  const confirm=page.getByRole("dialog",{name:"Подтвердить действие"});
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("несохранённые изменения");
  await confirm.getByRole("button",{name:"Отмена"}).click();
  await expect(confirm).toBeHidden();
  await expect(editor).toBeVisible();
  await expect(editor.locator('input:not([type=checkbox])').first()).toHaveValue("QA-NOT-SAVED-456");
  await editor.getByRole("button",{name:"Отмена"}).click();
  await confirm.getByRole("button",{name:"Подтвердить"}).click();
  await expect(editor).toBeHidden();
});

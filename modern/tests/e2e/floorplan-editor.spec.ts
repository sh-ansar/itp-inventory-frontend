import { test, expect, type Page } from "@playwright/test";

test.skip(!process.env.INVENTORY_QA_SECRET_FILE, "Requires isolated local QA fixtures");

async function mining(page:Page){
  await page.goto("/inventory/");
  await expect(page.getByRole("heading",{name:"Реестр активов"})).toBeVisible();
  await page.getByRole("combobox",{name:"Компания"}).selectOption({label:"Inventory QA - Mining"});
}
async function goMap(page:Page){
  await page.getByRole("navigation",{name:"Inventory"})
    .getByRole("link",{name:"Карта объектов"}).click();
  await expect(page.getByRole("heading",{name:"Карта объектов"}).first()).toBeVisible();
}
async function newNode(page:Page,name:string,code:string,type:string,inside=false){
  await page.getByRole("button",{name:inside?"Добавить внутрь":"Новый объект"}).first().click();
  const dialog=page.getByRole("dialog",{name:"Добавить помещение или объект"});
  await dialog.getByLabel(/Наименование/).fill(name);
  await dialog.getByLabel(/Код/).fill(code);
  await dialog.getByLabel(/Тип объекта/).selectOption(type);
  await dialog.getByRole("button",{name:"Сохранить"}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("treeitem",{name:new RegExp(name)})).toHaveAttribute("aria-selected","true");
}

test("floor plan: place rooms and assets, drag, resize, save and reload",async({page})=>{
  await mining(page);
  const suffix=String(Date.now()).slice(-8);
  const building="FP Building "+suffix, floor="FP Floor "+suffix;
  const room="FP Room "+suffix,computer="FP PC "+suffix;
  await goMap(page);
  await newNode(page,building,"FP-B-"+suffix,"building");
  await newNode(page,floor,"FP-F-"+suffix,"floor",true);
  await newNode(page,room,"FP-R-"+suffix,"room",true);
  await page.getByRole("treeitem",{name:new RegExp(floor)}).click();
  await expect(page.getByRole("treeitem",{name:new RegExp(floor)}))
    .toHaveAttribute("aria-selected","true");
  await page.getByRole("navigation",{name:"Inventory"}).getByRole("link",{name:"Основные средства"}).click();
  await expect(page.getByRole("heading",{name:"Реестр активов"}).first()).toBeVisible();
  await page.getByRole("button",{name:"Добавить актив"}).click();
  const drawer=page.getByRole("dialog",{name:"Новый актив"});
  await drawer.getByLabel(/Инвентарный №/).fill("FP-INV-"+suffix);
  await drawer.getByLabel(/Наименование/).fill(computer);
  await drawer.getByLabel(/Объект \/ помещение/).selectOption({label:"Этаж · "+floor});
  await drawer.getByRole("button",{name:"Сохранить"}).click();
  await expect(drawer).toBeHidden();

  await goMap(page);
  await page.getByRole("treeitem",{name:new RegExp(floor)}).click();
  await expect(page.getByRole("treeitem",{name:new RegExp(floor)}))
    .toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:"План объекта"}).first().click();
  await expect(page.getByRole("heading",{name:floor})).toBeVisible();
  await expect(page.getByRole("button",{name:"Разместить: "+room})).toBeVisible();
  await expect(page.getByRole("button",{name:"Разместить: "+computer})).toBeVisible();
  await page.getByRole("button",{name:"Разместить: "+room}).click();
  await page.getByRole("button",{name:"Разместить: "+computer}).click();
  await expect(page.locator(".plan-object")).toHaveCount(2);
  const roomShape=page.locator(".plan-object").filter({hasText:room});
  const roomBody=roomShape.locator(".plan-object-body");
  await expect(roomBody).toBeEnabled();
  await roomBody.click();
  await expect(page.locator(".selection-card h3")).toHaveText(room);
  const oldX=await roomShape.evaluate(el=>Number.parseInt((el as HTMLElement).style.left,10));
  const oldWidth=await roomShape.evaluate(el=>Number.parseInt((el as HTMLElement).style.width,10));

  const box=await roomShape.locator(".plan-object-body").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await page.mouse.move(box!.x+box!.width/2+95,box!.y+box!.height/2+60,{steps:8});
  await page.mouse.up();
  await expect.poll(async()=>roomShape.evaluate(el=>Number.parseInt((el as HTMLElement).style.left,10)))
    .toBeGreaterThan(oldX);
  await page.reload();
  await expect(page.getByRole("heading",{name:floor})).toBeVisible();
  const persisted=page.locator(".plan-object").filter({hasText:room});
  const movedX=await persisted.evaluate(el=>Number.parseInt((el as HTMLElement).style.left,10));
  expect(movedX).toBeGreaterThan(oldX);

  const handle=await persisted.locator(".plan-resize-handle").boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(handle!.x+12,handle!.y+12);
  await page.mouse.down();
  await page.mouse.move(handle!.x+60,handle!.y+45,{steps:8});
  await page.mouse.up();
  await expect.poll(async()=>persisted.evaluate(el=>Number.parseInt((el as HTMLElement).style.width,10)))
    .toBeGreaterThan(oldWidth);
  await page.reload();
  const persistedWidth=await page.locator(".plan-object").filter({hasText:room})
    .evaluate(el=>Number.parseInt((el as HTMLElement).style.width,10));
  expect(persistedWidth).toBeGreaterThan(oldWidth);
  const keyboardBody=page.locator(".plan-object").filter({hasText:room})
    .locator(".plan-object-body");
  await keyboardBody.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async()=>page.locator(".plan-object").filter({hasText:room})
    .evaluate(el=>Number.parseInt((el as HTMLElement).style.left,10)))
    .toBeGreaterThan(movedX);

  await page.locator(".plan-object").filter({hasText:computer}).locator(".plan-object-body").click();
  page.once("dialog",async dialog=>{await dialog.accept();});
  await page.getByRole("button",{name:"Убрать с плана"}).click();
  await expect(page.getByRole("button",{name:"Разместить: "+computer})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"Разместить: "+computer})).toBeVisible();

  await page.getByRole("button",{name:"Открыть помещение: "+room}).click();
  await expect(page.getByRole("heading",{name:room})).toBeVisible();
  await page.getByRole("button",{name:"К карте объектов"}).click();
  await expect(page.getByRole("heading",{name:"Карта объектов"}).first()).toBeVisible();
});

test("floor plan editor: background, canvas settings and immutable history",async({page})=>{
  await mining(page);
  const suffix=String(Date.now()).slice(-8),building="BG Building "+suffix;
  await goMap(page);
  await newNode(page,building,"BG-"+suffix,"building");
  await page.getByRole("button",{name:"План объекта"}).first().click();
  await expect(page.getByRole("heading",{name:building})).toBeVisible();
  await page.getByRole("spinbutton",{name:"Ширина"}).fill("1300");
  await page.getByRole("spinbutton",{name:"Высота"}).fill("850");
  await page.getByRole("button",{name:"Изменить размеры"}).click();
  await expect(page.locator(".plan-toolbar-title")).toContainText("1300 × 850");

  const base64=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");canvas.width=600;canvas.height=400;
    const context=canvas.getContext("2d")!;
    context.fillStyle="#eaf2f8";context.fillRect(0,0,600,400);
    context.strokeStyle="#1c5a6c";context.lineWidth=6;
    context.strokeRect(60,40,480,320);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type=file][accept="image/png,image/webp"]')
    .setInputFiles({name:"qa-floorplan.png",mimeType:"image/png",buffer:Buffer.from(base64,"base64")});
  await expect(page.locator(".canvas-image")).toBeVisible();
  await page.reload();
  await expect(page.locator(".canvas-image")).toBeVisible();
  await page.getByRole("button",{name:"История плана"}).click();
  const history=page.getByRole("dialog",{name:"История плана"});
  await expect(history.getByText("Подложка добавлена")).toBeVisible();
  await expect(history.getByText("Размеры плана изменены")).toBeVisible();
  await history.getByRole("button",{name:"Закрыть диалог"}).click();
  await page.getByRole("button",{name:"Убрать подложку"}).click();
  await expect(page.locator(".canvas-image")).toHaveCount(0);
});

test("floor plan editor maintains page width on phone, tablet and desktop",async({page})=>{
  await mining(page);
  await goMap(page);
  const node=page.locator('button.tree-row[role="treeitem"]').first();
  await expect(node).toBeVisible();
  await node.click();
  await expect(node).toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:"План объекта"}).first().click();
  await expect(page.locator(".canvas-scroll")).toBeVisible();
  for(const width of [360,390,768,1024,1440]){
    await page.setViewportSize({width,height:850});
    const result=await page.evaluate(()=>({
      doc:document.documentElement.scrollWidth,
      viewport:document.documentElement.clientWidth,
      canvas:document.querySelector(".canvas-scroll")?.scrollWidth??0,
    }));
    expect(result.doc,"Floor plan page overflow "+width).toBeLessThanOrEqual(result.viewport+1);
    expect(result.canvas).toBeGreaterThan(0);
  }
});

test("readonly viewer cannot place, resize or upload plan elements",async({page,browser})=>{
  await mining(page);
  await goMap(page);
  const suffix=String(Date.now()).slice(-8),building="VIEW Building "+suffix;
  await newNode(page,building,"VW-"+suffix,"building");
  await page.getByRole("button",{name:"План объекта"}).first().click();
  const url=page.url();

  const context=await browser.newContext({
    baseURL:"http://127.0.0.1:5174/inventory/",
    storageState:"test-results/.auth/viewer.json",
  });
  try{
    const viewPage=await context.newPage();
    await viewPage.goto(url);
    await expect(viewPage.getByRole("heading",{name:building})).toBeVisible();
    await expect(viewPage.getByText("Просмотр плана")).toBeVisible();
    await expect(viewPage.getByRole("heading",{name:"Размер холста"})).toHaveCount(0);
    await expect(viewPage.getByRole("button",{name:"Загрузить план PNG/WebP"})).toHaveCount(0);
    await expect(viewPage.getByRole("button",{name:"Изменить размеры"})).toHaveCount(0);
    await expect(viewPage.getByRole("button",{name:/Разместить:/})).toHaveCount(0);
    await expect(viewPage.getByText("Ваши права позволяют только просматривать план.")).toBeVisible();
  }finally{await context.close();}
});

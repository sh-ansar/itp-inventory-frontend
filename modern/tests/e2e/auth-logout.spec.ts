import {test,expect,type Page} from "@playwright/test";

// Laravel intentionally requires a CSRF cookie for every authenticated state-changing call.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  document.cookie="INVENTORY-XSRF-TOKEN=playwright-mock; Path=/; SameSite=Lax";
 });
});

const company="11111111-1111-4111-8111-111111111111";
type Session={authenticated:boolean; logouts:number};

async function mockSession(page:Page):Promise<Session>{
 const state:Session={authenticated:true,logouts:0};
 await page.route("**/inventory-api/**",route=>{
  const path=new URL(route.request().url()).pathname.replace(/^\/inventory-api/,"");
  let status=200,body:unknown={data:[]};
  if(path==="/api/v1/health"){
   body={status:"ok",service:"itp-inventory-api",browser_login:true};
  }else if(path==="/api/v1/me"){
   status=state.authenticated?200:401;
   body=state.authenticated?{id:1,name:"QA admin"}:{message:"Unauthenticated"};
  }else if(path==="/api/v1/companies"){
   body=state.authenticated?[{id:company,name:"QA company",role_code:"company_admin"}]:[];
  }else if(path==="/api/v1/platform-admin/overview"){
   status=state.authenticated?200:401;
   body=state.authenticated?{
     permissions:["platform.manage"],modules:["assets","reports"],
     statistics:{companies:1,users:1,published_plans:3},
     flags:{public_registration_enabled:false,invoice_issuance_enabled:false,legal_publication_enabled:false}
   }:{message:"Unauthenticated"};
  }else if(path==="/auth/logout"&&route.request().method()==="POST"){
   state.authenticated=false;state.logouts++;body={ok:true};
  }else if(!state.authenticated){status=401;body={message:"Unauthenticated"};}
  return route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
 });
 return state;
}

async function oneLoginForm(page:Page){
 await expect(page).toHaveURL(/\/inventory\/auth\/login(?:\?|$)/);
 await expect(page.locator(".inv-auth-form")).toHaveCount(1);
 await expect(page.locator(".login-card")).toHaveCount(0);
 await expect(page.locator(".shell")).toHaveCount(0);
 await expect(page.locator(".inventory-platform-admin")).toHaveCount(0);
}

test("workspace sign out always goes to one public login, never the registry",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("inventory.locale","en"));
 const session=await mockSession(page);
 await page.goto("registry");
 await expect(page.getByRole("button",{name:"Sign out"})).toBeVisible();
 await page.getByRole("button",{name:"Sign out"}).click();
 await oneLoginForm(page);
 expect(new URL(page.url()).searchParams.has("next")).toBe(false);
 expect(session.logouts).toBe(1);
});

test("private registry deep links without a session use the same login and remember next",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("inventory.locale","en"));
 const session=await mockSession(page);
 session.authenticated=false;
 await page.goto("registry");
 await oneLoginForm(page);
 expect(new URL(page.url()).searchParams.get("next")).toBe("/registry");
});

test("unauthenticated super-admin uses public login, not a second admin login",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("inventory.locale","en"));
 const session=await mockSession(page);
 session.authenticated=false;
 await page.goto("admin/site");
 await oneLoginForm(page);
 expect(new URL(page.url()).searchParams.get("next")).toBe("/admin/site");
});

test("super-admin has its own real sign out button with the same destination",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("inventory.locale","en"));
 const session=await mockSession(page);
 await page.goto("admin/site");
 await expect(page.locator(".inventory-platform-admin")).toBeVisible();
 await page.getByRole("button",{name:"Sign out"}).click();
 await oneLoginForm(page);
 expect(new URL(page.url()).searchParams.has("next")).toBe(false);
 expect(session.logouts).toBe(1);
});

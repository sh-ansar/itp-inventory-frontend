import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearFacilityPlanBackground, getFacilityPlan, getFacilityPlanEvents,
  movePlanElement, placePlanElement, removePlanElement,
  resizeFacilityPlan, uploadFacilityPlanBackground,
} from "../../src/api/facilityPlans";
import { floorplanTranslations } from "../../src/floorplanTranslations";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(()=>{
  vi.unstubAllGlobals();
  document.cookie="INVENTORY-XSRF-TOKEN=;max-age=0;path=/";
});
function mockApi(){
  const calls:Array<{url:string;init:RequestInit}>=[];
  vi.stubGlobal("fetch",vi.fn(async(url:string,init:RequestInit)=>{
    calls.push({url,init});
    if(url==="/inventory-api/sanctum/csrf-cookie"){
      document.cookie="INVENTORY-XSRF-TOKEN=test-xsrf;path=/";
      return new Response(null,{status:204});
    }
    return new Response(JSON.stringify({data:{version:1,placement:{id:"p"}}}),{
      status:200,headers:{"Content-Type":"application/json"},
    });
  }));
  return calls;
}
describe("Floorplan company-scoped API contracts",()=>{
  it("GET reads only the selected company's facility",async()=>{
    const calls=mockApi();
    await getFacilityPlan("company 1","floor/2");
    expect(calls[0].url).toBe(
      "/inventory-api/api/v1/companies/company%201/facility-nodes/floor%2F2/plan");
    expect(calls[0].init.credentials).toBe("same-origin");
    await getFacilityPlanEvents("company 1","floor/2");
    expect(calls[1].url).toContain("/plan/events");
  });
  it("creates asset and room placements with exactly one target",async()=>{
    const calls=mockApi();
    const rect={x:40,y:50,width:200,height:120};
    await placePlanElement("co","floor",{kind:"node",id:"room",...rect,expected_version:4});
    const room=JSON.parse(calls.at(-1)!.init.body as string);
    expect(room).toEqual({...rect,child_node_id:"room",expected_version:4});
    expect(room.asset_id).toBeUndefined();
    await placePlanElement("co","floor",{kind:"asset",id:"asset",...rect,expected_version:5});
    const asset=JSON.parse(calls.at(-1)!.init.body as string);
    expect(asset).toEqual({...rect,asset_id:"asset",expected_version:5});
    expect(asset.child_node_id).toBeUndefined();
    expect(new Headers(calls.at(-1)!.init.headers).get("X-XSRF-TOKEN")).toBe("test-xsrf");
  });
  it("uses optimistic plan versions to move, resize and remove",async()=>{
    const calls=mockApi();
    await movePlanElement("co","node","placement",{
      x:123,y:91,width:220,height:150,expected_version:6,
    });
    expect(calls.at(-1)!.init.method).toBe("PATCH");
    expect(JSON.parse(calls.at(-1)!.init.body as string).expected_version).toBe(6);
    await resizeFacilityPlan("co","node",{
      expected_version:7,canvas_width:1500,canvas_height:900,
    });
    expect(calls.at(-1)!.init.method).toBe("PUT");
    expect(JSON.parse(calls.at(-1)!.init.body as string).canvas_width).toBe(1500);
    await removePlanElement("co","node","placement",8);
    expect(calls.at(-1)!.init.method).toBe("DELETE");
    expect(JSON.parse(calls.at(-1)!.init.body as string).expected_version).toBe(8);
  });
  it("uploads a file with a protected multipart request and version",async()=>{
    const calls=mockApi();
    const file=new File(["test"],"plan.png",{type:"image/png"});
    await uploadFacilityPlanBackground("co","node",file,11);
    const sent=calls.at(-1)!;
    expect(sent.init.method).toBe("POST");
    expect(sent.init.body).toBeInstanceOf(FormData);
    expect((sent.init.body as FormData).get("expected_version")).toBe("11");
    expect((sent.init.body as FormData).get("file")).toBeInstanceOf(File);
    expect(new Headers(sent.init.headers).get("Content-Type")).toBeNull();
    await clearFacilityPlanBackground("co","node",12);
    expect(calls.at(-1)!.init.method).toBe("DELETE");
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toEqual({expected_version:12});
  });
});
describe("Floorplan RU / EN / KA translations",()=>{
  it("has identical, nonempty keys in all three languages",()=>{
    const ru=Object.keys(floorplanTranslations.ru).sort();
    expect(ru.length).toBeGreaterThan(50);
    for(const locale of ["ru","en","ka"] as const){
      expect(Object.keys(floorplanTranslations[locale]).sort()).toEqual(ru);
      for(const key of ru){
        expect(floorplanTranslations[locale][key]?.trim(),locale+": "+key).toBeTruthy();
      }
    }
  });
  it("covers every static plan key referenced by the editor",()=>{
    const source=readFileSync(join(process.cwd(),"src/pages/FacilityPlanPage.vue"),"utf8");
    const required=new Set<string>();
    for(const match of source.matchAll(/ui\.t\(["'](plan\.[A-Za-z0-9_.]+)["']/g))
      if(!match[1].endsWith("."))required.add(match[1]);
    expect(required.size).toBeGreaterThan(15);
    for(const key of required){
      for(const locale of ["ru","en","ka"] as const)
        expect(floorplanTranslations[locale][key],locale+": "+key).toBeTruthy();
    }
  });
});

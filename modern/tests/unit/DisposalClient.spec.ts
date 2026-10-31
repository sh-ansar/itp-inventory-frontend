import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approveDisposalCase, completeDisposalCase, createDisposalCase,
  disposalDocumentUrl, getDisposalCase, getDisposalEvents, listDisposalCases,
  returnDisposalCase, submitDisposalCase, updateDisposalCase,
  uploadDisposalDocument,
} from "../../src/api/disposals";
import { disposalTranslations } from "../../src/disposalTranslations";
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
      document.cookie="INVENTORY-XSRF-TOKEN=disposal-xsrf;path=/";
      return new Response(null,{status:204});
    }
    return new Response(JSON.stringify({data:{version:1},meta:{total:0}}),{
      status:200,headers:{"Content-Type":"application/json"},
    });
  }));
  return calls;
}
describe("Disposal API paths, tenant scoping and concurrency",()=>{
  it("lists only company cases with literal search URL encoding",async()=>{
    const calls=mockApi();
    await listDisposalCases("company 7",{search:"ITP %_asset",status:"submitted",page:2,per_page:10});
    expect(calls[0].url).toContain("/inventory-api/api/v1/companies/company%207/disposal-cases?");
    expect(calls[0].url).toContain("search=ITP+%25_asset");
    expect(calls[0].url).toContain("status=submitted");
    expect(calls[0].url).toContain("page=2");
    expect(calls[0].init.credentials).toBe("same-origin");
  });
  it("gets case and audit trail via the same parent asset path",async()=>{
    const calls=mockApi();
    await getDisposalCase("C 1","A/1");
    await getDisposalEvents("C 1","A/1");
    expect(calls[0].url).toBe(
      "/inventory-api/api/v1/companies/C%201/assets/A%2F1/disposal-case");
    expect(calls[1].url).toBe(calls[0].url+"/events");
    expect(disposalDocumentUrl("C 1","A/1","DOC%2")).toBe(
      "/inventory-api/api/v1/companies/C%201/assets/A%2F1/disposal-case/documents/DOC%252");
  });
  it("creates and edits a write-off case with explicit versions",async()=>{
    const calls=mockApi();
    const draft={reason:"Damaged beyond repair",order_number:"ITP-009",order_date:"2026-10-31"};
    await createDisposalCase("c","a",8,draft);
    let sent=calls.at(-1)!;
    expect(sent.init.method).toBe("POST");
    expect(JSON.parse(sent.init.body as string)).toEqual({...draft,asset_version:8});
    expect(new Headers(sent.init.headers).get("X-XSRF-TOKEN")).toBe("disposal-xsrf");
    await updateDisposalCase("c","a",3,draft);
    sent=calls.at(-1)!;
    expect(sent.init.method).toBe("PUT");
    expect(JSON.parse(sent.init.body as string).version).toBe(3);
    await submitDisposalCase("c","a",4);
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toEqual({version:4});
  });
  it("passes status and asset versions to admin-only transitions",async()=>{
    const calls=mockApi();
    await returnDisposalCase("c","a",5,"Invalid order");
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toEqual({
      version:5,reason:"Invalid order",
    });
    await approveDisposalCase("c","a",6,7);
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toEqual({
      version:6,asset_version:7,
    });
    await completeDisposalCase("c","a",8,9,{
      disposal_act_number:"ACT-3",disposal_date:"2026-10-31",disposal_method:"recycling",
    });
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toEqual({
      version:8,asset_version:9,disposal_act_number:"ACT-3",
      disposal_date:"2026-10-31",disposal_method:"recycling",
    });
  });
  it("uses private multipart upload and retains file extension",async()=>{
    const calls=mockApi();
    const file=new File(["document"],"write-off.pdf",{type:"application/pdf"});
    await uploadDisposalDocument("c","a",2,"write_off_order",file);
    const request=calls.at(-1)!;
    expect(request.url).toContain("/disposal-case/documents");
    expect(request.init.body).toBeInstanceOf(FormData);
    expect((request.init.body as FormData).get("version")).toBe("2");
    expect((request.init.body as FormData).get("document_type")).toBe("write_off_order");
    expect((request.init.body as FormData).get("file")).toBeInstanceOf(File);
    expect(new Headers(request.init.headers).get("Content-Type")).toBeNull();
  });
});
describe("Disposal workflow translations",()=>{
  it("covers the same non-empty keys in RU, EN and Georgian",()=>{
    const ru=Object.keys(disposalTranslations.ru).sort();
    expect(ru.length).toBeGreaterThan(65);
    for(const locale of ["ru","en","ka"] as const){
      expect(Object.keys(disposalTranslations[locale]).sort()).toEqual(ru);
      for(const key of ru)
        expect(disposalTranslations[locale][key]?.trim(),locale+" missing "+key).toBeTruthy();
    }
  });
  it("covers all static keys used on the disposal pages",()=>{
    const sources=[
      "src/pages/DisposalCasesPage.vue",
      "src/components/registry/AssetDisposalDialog.vue",
    ];
    const keys=new Set<string>();
    for(const source of sources){
      const data=readFileSync(join(process.cwd(),source),"utf8");
      for(const result of data.matchAll(/ui\.t\(["'](disposal\.[a-zA-Z0-9_.]+)["']/g)){
        if(!result[1].endsWith("."))keys.add(result[1]);
      }
    }
    expect(keys.size).toBeGreaterThan(25);
    for(const key of keys)
      for(const locale of ["ru","en","ka"] as const)
        expect(disposalTranslations[locale][key],locale+" missing "+key).toBeTruthy();
  });
});

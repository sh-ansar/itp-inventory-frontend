import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listIndustryCatalog, createIndustryCatalogItem, archiveIndustryCatalogItem,
} from "../../src/api/industryCatalogs";

beforeEach(()=>{vi.unstubAllGlobals();});

describe("P1 company industry catalog API",()=>{
  it("keeps reference list scoped to a single company and only opts into archives on demand",async()=>{
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify({data:[]}),
      {status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    await listIndustryCatalog("company-A","manufacturer");
    await listIndustryCatalog("company-B","manufacturer",true);
    const first=String(fetchMock.mock.calls[0][0]);
    const second=String(fetchMock.mock.calls[1][0]);
    expect(first).toContain("/companies/company-A/industry-catalogs/manufacturer");
    expect(first).not.toContain("include_archived");
    expect(second).toContain("/companies/company-B/industry-catalogs/manufacturer?include_archived=1");
  });

  it("sends manufacturer parent when creating models",async()=>{
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify({data:{}}),
      {status:201,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    await createIndustryCatalogItem("company-A","model",{
      code:"precision",name:"Precision",parent_id:"manufacturer-1",
    });
    const [url,init]=fetchMock.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toContain("/companies/company-A/industry-catalogs/model");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      code:"precision",name:"Precision",parent_id:"manufacturer-1",
    });
  });

  it("archives with the last known optimistic version",async()=>{
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify({data:{}}),
      {status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    await archiveIndustryCatalogItem("company-A","department","department-3",8);
    const [url,init]=fetchMock.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toContain("/industry-catalogs/department/department-3/archive");
    expect(JSON.parse(String(init.body))).toEqual({version:8});
  });
});

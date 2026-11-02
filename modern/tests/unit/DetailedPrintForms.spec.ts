import {describe,expect,it,vi,afterEach} from "vitest";
import {getDetailedPrintReport,PRINT_FORM_KINDS,renderDetailedPrintDocument,printFormTitle} from "../../src/api/printForms";
import type {DetailedPrintReport,PrintFormKind} from "../../src/api/printForms";

const example=(kind:PrintFormKind):DetailedPrintReport=>({
  kind,company:{id:"company-a",name:'ITP <script>alert(1)</script>'},
  generated_at:"2026-11-02T10:00:00Z",filters:{facility_node_id:"site-a",status:"active"},
  row_count:1,limit:2000,context:{session_name:"QA inventory",session_status:"in_progress",total_items:1,counted_items:1,discrepancies:1},
  rows:[{
    id:"asset-a",inventory_number:"I-0001",name:'Laptop <img src=x onerror="alert(2)">',
    serial_number:"ABC123",category_name:"Computers",facility_name:"Main building",
    responsible_person_name:"Test Custodian",status:"active",expected_name:"Building A",
    actual_name:"Building B",is_counted:true,is_discrepancy:true,
    reason:"Obsolete","case_status":"draft",quantity_milli:1250,minimum_quantity_milli:2000,
    code:"SKU-1",unit:"pcs",warehouse_name:"North warehouse",
  }],
});

afterEach(()=>vi.unstubAllGlobals());

describe("Detailed printable Inventory forms",()=>{
  it("renders all six documents as self-contained printable A4 pages",()=>{
    expect(PRINT_FORM_KINDS).toHaveLength(6);
    for(const kind of PRINT_FORM_KINDS){
      const html=renderDetailedPrintDocument(example(kind),"ru",{facility:"Main building"});
      const doc=new DOMParser().parseFromString(html,"text/html");
      expect(doc.title).toContain(printFormTitle(kind,"ru"));
      expect(html).toContain("@page{size:A4");
      expect(doc.querySelector("meta[http-equiv='Content-Security-Policy']")).not.toBeNull();
      expect(doc.querySelectorAll("table")).toHaveLength(1);
      expect(doc.querySelectorAll(".signature")).toHaveLength(4);
      expect(doc.querySelector(".summary")?.textContent).toContain("1");
      expect(doc.querySelectorAll("script,img[onerror]")).toHaveLength(0);
      expect(doc.body.textContent).toContain("Laptop <img src=x");
    }
  });
  it("shows counts and actual-versus-expected comparison without claiming a draft is approved",()=>{
    const html=renderDetailedPrintDocument(example("stocktake-act"),"ru");
    const dom=new DOMParser().parseFromString(html,"text/html");
    expect(dom.querySelector(".draft")?.textContent).toContain("ПРЕДВАРИТЕЛЬНАЯ");
    expect(dom.body.textContent).toContain("Building A");
    expect(dom.body.textContent).toContain("Building B");
    expect(dom.body.textContent).toContain("Расхождение");
    expect(html).toContain("A4 portrait");
  });
  it("does not suggest approval for completed stocktakes",()=>{
    const doc=example("stocktake-act");
    doc.context.session_status="completed";
    expect(renderDetailedPrintDocument(doc,"en")).not.toContain("PRELIMINARY / UNAPPROVED");
  });
  it("marks unapproved write-off cases as preliminary, not legally signed",()=>{
    const html=renderDetailedPrintDocument(example("disposal-register"),"en");
    expect(html).toContain("PRELIMINARY / UNAPPROVED");
    expect(html).toContain("No approvals or signatures are implied");
    expect(html).toContain("Draft");
  });
  it("keeps warehouse quantities and units separate, flags low stock",()=>{
    const html=renderDetailedPrintDocument(example("warehouse-balances"),"ru");
    const doc=new DOMParser().parseFromString(html,"text/html");
    expect(doc.body.textContent).toContain("1,25");
    expect(doc.body.textContent).toContain("Ниже минимума");
    expect(doc.body.textContent).toContain("pcs");
    expect(doc.querySelector("h2")?.textContent).toContain("North warehouse");
  });
  it("keeps identically named floors and warehouses separate by UUID",()=>{
    const facilityReport=example("by-facility");
    facilityReport.rows=[
      {...facilityReport.rows[0],facility_node_id:"building-a",facility_name:"First floor"},
      {...facilityReport.rows[0],facility_node_id:"building-b",facility_name:"First floor"},
    ];
    facilityReport.row_count=2;
    const facilityDoc=new DOMParser().parseFromString(
      renderDetailedPrintDocument(facilityReport,"ru"),"text/html",
    );
    expect(facilityDoc.querySelectorAll(".group")).toHaveLength(2);
    expect(facilityDoc.querySelectorAll("table")).toHaveLength(2);
    const warehouseReport=example("warehouse-balances");
    warehouseReport.rows=[
      {...warehouseReport.rows[0],warehouse_node_id:"warehouse-a",warehouse_name:"Central"},
      {...warehouseReport.rows[0],warehouse_node_id:"warehouse-b",warehouse_name:"Central"},
    ];
    warehouseReport.row_count=2;
    const warehouseDoc=new DOMParser().parseFromString(
      renderDetailedPrintDocument(warehouseReport,"en"),"text/html",
    );
    expect(warehouseDoc.querySelectorAll(".group")).toHaveLength(2);
  });
  it("translates document titles for Russian, English and Georgian",()=>{
    for(const kind of PRINT_FORM_KINDS){
      for(const language of ["ru","en","ka"] as const){
        const doc=new DOMParser().parseFromString(renderDetailedPrintDocument(example(kind),language),"text/html");
        expect(doc.documentElement.lang).toBe(language);
        expect(doc.title).toContain(printFormTitle(kind,language));
      }
    }
  });
  it("requests only the chosen company and passes validated filter parameters to Laravel",async()=>{
    const spy=vi.fn().mockResolvedValue({
      ok:true,status:200,
      json:async()=>({data:{...example("by-facility"),
        company:{id:"company-a",name:"Test"},kind:"by-facility"}}),
    });
    vi.stubGlobal("fetch",spy);
    const doc=await getDetailedPrintReport("company-a","by-facility",{
      facility_node_id:"facility-1",responsible_person_id:"custodian-1",search:"printer",
    });
    expect(doc.row_count).toBe(1);
    const url=String(spy.mock.calls[0][0]);
    expect(url).toContain("/inventory-api/api/v1/companies/company-a/reports/forms/by-facility");
    expect(url).toContain("facility_node_id=facility-1");
    expect(url).toContain("responsible_person_id=custodian-1");
    expect(url).toContain("search=printer");
    expect(url).not.toContain("company-b");
  });
  it("encodes selected warehouses and disposal stages safely as multi-valued filters",async()=>{
    const spy=vi.fn().mockResolvedValue({
      ok:true,status:200,
      json:async()=>({data:{...example("warehouse-balances"),company:{id:"company-a",name:"Test"}}}),
    });
    vi.stubGlobal("fetch",spy);
    await getDetailedPrintReport("company-a","warehouse-balances",{
      warehouse_node_ids:["warehouse-1","warehouse-2"],search:"toner",
    });
    const params=new URL(String(spy.mock.calls[0][0]),"https://inventory.example").searchParams;
    expect(params.getAll("warehouse_node_ids[]")).toEqual(["warehouse-1","warehouse-2"]);
    expect(params.get("search")).toBe("toner");
    const report=example("disposal-register");
    report.filters={statuses:["active","disposed"],disposal_statuses:["draft","approved"]};
    const html=renderDetailedPrintDocument(report,"en");
    expect(html).toContain("Draft, Approved");
    expect(html).toContain("Active, Disposed");
  });
  it("rejects incomplete or cross-company print API responses",async()=>{
    const spy=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({data:{...example("asset-register"),
        company:{id:"other-company",name:"Other"}}}),
    });
    vi.stubGlobal("fetch",spy);
    await expect(getDetailedPrintReport("company-a","asset-register",{}))
      .rejects.toThrow("Invalid detailed print response");
  });
});

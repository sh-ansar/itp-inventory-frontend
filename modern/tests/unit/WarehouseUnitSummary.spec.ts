import {describe,it,expect} from "vitest";
import {summaryPrintDocument,warehouseQuantityText} from "../../src/api/reports";
import type {InventorySummary,WarehouseSummaryRow} from "../../src/api/reports";

describe("Warehouse quantity unit correctness",()=>{
  const mixed:WarehouseSummaryRow={
    id:"warehouse-1",name:"Main warehouse",items:3,quantity_milli:null,unit:null,
    unit_quantities:[
      {unit:"kg",items:1,quantity_milli:7500},
      {unit:"pcs",items:2,quantity_milli:4000},
    ],
  };
  it("never sums kilograms and pieces into an unlabelled amount",()=>{
    expect(warehouseQuantityText(mixed,"ru")).toBe("7,5 кг · 4 шт.");
    expect(warehouseQuantityText(mixed,"en")).toBe("7.5 kg · 4 pcs");
    expect(warehouseQuantityText(mixed,"ka")).toContain("კგ");
    expect(warehouseQuantityText({...mixed,unit_quantities:[],quantity_milli:null},"en")).toBe("—");
  });
  it("keeps single-unit and legacy data readable while the backend is rolling out",()=>{
    const single:WarehouseSummaryRow={
      id:"warehouse-2",name:"Small warehouse",items:1,unit:"l",
      quantity_milli:1250,unit_quantities:[{unit:"l",items:1,quantity_milli:1250}],
    };
    expect(warehouseQuantityText(single,"ru")).toBe("1,25 л");
    expect(warehouseQuantityText({...single,unit_quantities:undefined,unit:undefined},"en")).toBe("1.25");
  });
  it("prints unit-specific totals without exposing unescaped warehouse strings",()=>{
    const report:InventorySummary={
      generated_at:"2026-11-02T18:00:00Z",
      company:{id:"tenant-1",name:"QA & Co"},
      filters:{},
      assets:{total:0,by_status:[],by_category:[],by_facility:[],by_responsible:[]},
      warehouses:{total_items:3,low_stock_items:0,by_warehouse:[{
        ...mixed,name:"<img src=x onerror=alert(1)>",
      }]},
      stocktakes:[],
    };
    const html=summaryPrintDocument(report,"ru");
    const dom=new DOMParser().parseFromString(html,"text/html");
    expect(dom.querySelector("img")).toBeNull();
    expect(dom.querySelectorAll("script")).toHaveLength(0);
    expect(dom.body.textContent).toContain("7,5 кг · 4 шт.");
    expect(dom.body.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(dom.body.textContent).not.toContain("11,5");
  });
});
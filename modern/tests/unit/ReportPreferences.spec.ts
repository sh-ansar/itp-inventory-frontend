import { describe, expect, it } from "vitest";
import { normalizeTablePreferences, orderAndFilterColumns, defaultTablePreferences } from "../../src/composables/useCompanyTablePreferences";
import { summaryCsvHref, summaryPrintDocument } from "../../src/api/reports";
import type { InventorySummary } from "../../src/api/reports";

describe("Inventory personal table settings",()=>{
  it("normalizes validated data and ignores unsupported page sizes",()=>{
    const defaults={...defaultTablePreferences,sort_key:"inventory_number"};
    const input=normalizeTablePreferences(defaults,{
      search:"Laptop",per_page:50,sort_key:"name",sort_direction:"desc",
      hidden_columns:["status","status","category_name"],
      column_order:["name","inventory_number","name"],
    });
    expect(input.per_page).toBe(50);
    expect(input.sort_direction).toBe("desc");
    expect(input.hidden_columns).toEqual(["status","category_name"]);
    expect(input.column_order).toEqual(["name","inventory_number"]);
    expect(normalizeTablePreferences(defaults,{per_page:27}).per_page).toBe(25);
    expect(normalizeTablePreferences(defaults,null).sort_key).toBe("inventory_number");
  });
  it("upgrades legacy single filters and keeps independent multi-select arrays",()=>{
    const base={...defaultTablePreferences,sort_key:"inventory_number"};
    const legacy=normalizeTablePreferences(base,{
      status:"active",facility_node_id:"11111111-1111-4111-8111-111111111111",
      responsible_person_id:"22222222-2222-4222-8222-222222222222",
    });
    expect(legacy.statuses).toEqual(["active"]);
    expect(legacy.facility_node_ids).toHaveLength(1);
    expect(legacy.responsible_person_ids).toHaveLength(1);
    const modern=normalizeTablePreferences(base,{
      status:"active",statuses:["active","disposed","active"],
      facility_node_ids:["room-a","room-b","room-a"],
    });
    expect(modern.statuses).toEqual(["active","disposed"]);
    expect(modern.facility_node_ids).toEqual(["room-a","room-b"]);
    expect(normalizeTablePreferences(base,null).statuses).toEqual([]);
  });
  it("shows allowed columns in saved order without mutating original list",()=>{
    const columns=[{key:"inventory_number"},{key:"name"},{key:"status"},{key:"actions"}];
    const filtered=orderAndFilterColumns(columns,{
      hidden_columns:["status"],column_order:["name","inventory_number","actions"],
    });
    expect(filtered.map(column=>column.key)).toEqual(["name","inventory_number","actions"]);
    expect(columns[0].key).toBe("inventory_number");
  });
});

describe("Inventory printable summary",()=>{
  const report:InventorySummary={
    generated_at:"2026-11-02T12:00:00Z",
    company:{id:"c1",name:'ITP <script>alert("evil")</script>'},
    filters:{},assets:{
      total:2,by_status:[{id:"active",name:"active",total:2}],
      by_category:[{id:"q",name:'<img src=x onerror=alert(2)>',total:2}],
      by_facility:[],by_responsible:[],
    },
    warehouses:{total_items:0,low_stock_items:0,by_warehouse:[]},stocktakes:[],
  };
  it("creates a printable, escaped A4 document with no script injection",()=>{
    const html=summaryPrintDocument(report,"ru");
    expect(html).toContain("@page{size:A4");
    const dom=new DOMParser().parseFromString(html,"text/html");
    expect(dom.querySelectorAll("script,img[onerror]")).toHaveLength(0);
    expect(dom.title).toContain("ITP");
    expect(dom.querySelectorAll("table")).toHaveLength(6);
    expect(dom.querySelector("body")?.textContent).toContain("Сводный");
  });
  it("serializes multi-select status and location filters into a CSV query",()=>{
    const url=summaryCsvHref("tenant-one",{
      statuses:["active","disposed"],facility_node_ids:["room-a","room-b"],
    });
    const params=new URL(url,"https://inventory.example").searchParams;
    expect(params.getAll("statuses[]")).toEqual(["active","disposed"]);
    expect(params.getAll("facility_node_ids[]")).toEqual(["room-a","room-b"]);
  });
  it("generates a company-specific CSV link with encoded filters",()=>{
    const link=summaryCsvHref("abc def",{status:"active",facility_node_id:"facility-id"});
    expect(link).toContain("/companies/abc%20def/reports/summary.csv?");
    expect(link).toContain("status=active");
    expect(link).toContain("facility_node_id=facility-id");
  });
});

import {beforeEach, describe, expect, it, vi} from "vitest";
import {mount, flushPromises} from "@vue/test-utils";
import {createPinia, setActivePinia} from "pinia";
import {Building2} from "lucide-vue-next";
import FacilityNavigation from "../../src/components/facilities/FacilityNavigation.vue";
import FacilityPlanCatalog from "../../src/components/facilities/FacilityPlanCatalog.vue";
import StocktakeDocumentsPanel from "../../src/components/stocktakes/StocktakeDocumentsPanel.vue";
import type {FacilityNode, FacilityType} from "../../src/api/topology";
import type {PlanElement} from "../../src/api/facilityPlans";
import type {InventorySession} from "../../src/api/stocktakes";
import type {Component} from "vue";

vi.mock("../../src/api/parity",()=>({
  reportDocuments:vi.fn(async()=>({data:[{id:"doc-1",original_name:"QA report.pdf"}]})),
  reportDocumentHref:(_company:string,session:string,doc:string)=>"/qa/"+session+"/"+doc,
  uploadReportDocument:vi.fn(async()=>({ok:true})),
  stocktakeXlsxHref:()=>"/qa/report",
}));
vi.mock("../../src/api/stocktakes",()=>({
  getInventorySession:vi.fn(async()=>({data:{id:"session-1",version:2,status:"completed"}})),
}));
const facility={id:"node-1",name:"Building 1",code:"B1",parent_id:null,
  node_type:"building",sort_order:1,direct_asset_count:2} as FacilityNode;
const iconMap={building:Building2} as unknown as Record<FacilityType,Component>;
const planItem={id:"item-1",kind:"asset",name:"Test PC",code:"PC-001",
  placement_id:null} as PlanElement;
const completed={id:"session-1",version:1,status:"completed"} as InventorySession;

beforeEach(()=>setActivePinia(createPinia()));

describe("maintenance extracted UI boundaries",()=>{
  it("facility navigation retains selected nodes and navigation events",async()=>{
    const wrapper=mount(FacilityNavigation,{props:{
      nodeCount:1,rows:[{node:facility,depth:0}],selectedId:"node-1",
      search:"",mapIcons:iconMap,
    }});
    const buttons=wrapper.findAll("button.tree-row");
    expect(buttons).toHaveLength(2);
    expect(buttons[1].attributes("aria-selected")).toBe("true");
    await buttons[1].trigger("click");
    expect(wrapper.emitted("navigate")?.at(-1)).toEqual(["node-1"]);
    await buttons[0].trigger("click");
    expect(wrapper.emitted("navigate")?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });

  it("plan catalog supports read-only mode and emits a typed placement",async()=>{
    const wrapper=mount(FacilityPlanCatalog,{props:{
      available:[planItem],totalCount:1,canEdit:false,saving:false,query:"",
    }});
    expect(wrapper.text()).toContain("Test PC");
    expect(wrapper.find("button.catalog-add").exists()).toBe(false);
    await wrapper.setProps({canEdit:true});
    await wrapper.get("button.catalog-add").trigger("click");
    expect(wrapper.emitted("add")?.at(-1)).toEqual([planItem]);
    wrapper.unmount();
  });

  it("completed stocktake documents are scoped and uploads hidden from viewers",async()=>{
    const wrapper=mount(StocktakeDocumentsPanel,{props:{
      companyId:"company-a",stocktake:completed,canWrite:false,active:false,
    }});
    await flushPromises();
    expect(wrapper.text()).toContain("QA report.pdf");
    expect(wrapper.find("a[href='/qa/session-1/doc-1']").exists()).toBe(true);
    expect(wrapper.find("input[type=file]").exists()).toBe(false);
    await wrapper.setProps({canWrite:true});
    expect(wrapper.find("input[type=file]").exists()).toBe(true);
    wrapper.unmount();
  });
});

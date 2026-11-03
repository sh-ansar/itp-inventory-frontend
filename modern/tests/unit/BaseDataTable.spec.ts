import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import BaseDataTable from "../../src/components/ui/BaseDataTable.vue";

describe("BaseDataTable - HRM-derived, server-driven", () => {
  const rows = [
    { id:"a", inventory_number:"A-100", name:"Laptop" },
    { id:"b", inventory_number:"A-101", name:"Monitor" },
  ];
  const columns = [
    { key:"inventory_number", label:"Номер", sortable:true },
    { key:"name", label:"Название" },
  ];

  it("renders rows without locally filtering or sorting server results", () => {
    const wrapper = mount(BaseDataTable, { props: {
      rows, rowKey:"id", columns, caption:"Активы",
      sortKey:"inventory_number", sortDirection:"desc",
    }});
    const cells = wrapper.findAll("tbody tr");
    expect(cells).toHaveLength(2);
    expect(cells[0].text()).toContain("A-100");
    expect(wrapper.find('th[aria-sort="descending"]').exists()).toBe(true);
  });

  it("emits sort intent for the parent API query instead of sorting the current page", async () => {
    const wrapper = mount(BaseDataTable, { props: {
      rows, rowKey:"id", columns,
    }});
    await wrapper.find(".sort-heading").trigger("click");
    expect(wrapper.emitted("sort")).toEqual([["inventory_number"]]);
    expect(wrapper.findAll("tbody tr")[0].text()).toContain("A-100");
  });

  it("emits selection updates only for currently loaded rows", async () => {
    const wrapper = mount(BaseDataTable, { props: {
      rows, rowKey:"id", columns, selectable:true, selectedKeys:[],
    }});
    await wrapper.find('thead input[type="checkbox"]').setValue(true);
    expect(wrapper.emitted("update:selectedKeys")?.at(-1)?.[0]).toEqual(["a","b"]);
  });

  it("renders empty state without disappearing headers", () => {
    const wrapper = mount(BaseDataTable, { props: {
      rows:[], rowKey:"id", columns, emptyTitle:"Нет записей",
    }});
    expect(wrapper.text()).toContain("Нет записей");
    expect(wrapper.findAll("thead th")).toHaveLength(2);
  });
  it("keeps the table as a named keyboard-scrollable region",()=>{
    const wrapper=mount(BaseDataTable,{props:{rows,rowKey:"id",columns,caption:"Asset register"}});
    const viewport=wrapper.get(".table-scroll");
    expect(viewport.attributes("role")).toBe("region");
    expect(viewport.attributes("aria-label")).toBe("Asset register");
    expect(viewport.attributes("tabindex")).toBe("0");
  });

  it("marks selected rows without changing the backing data or selected keys",()=>{
    const wrapper=mount(BaseDataTable,{props:{
      rows,rowKey:"id",columns,selectable:true,selectedKeys:["b"]
    }});
    expect(wrapper.findAll("tbody .table-row--selected")).toHaveLength(1);
    expect(wrapper.get("tbody .table-row--selected").attributes("data-row-key")).toBe("b");
    expect(wrapper.get('thead input[type="checkbox"]').element.checked).toBe(false);
    expect(wrapper.emitted("update:selectedKeys")).toBeUndefined();
  });
});
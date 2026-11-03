import {describe,it,expect} from "vitest";
import {mount} from "@vue/test-utils";
import BaseSearchField from "../../src/components/ui/BaseSearchField.vue";

describe("HRM-aligned Inventory search component",()=>{
  it("renders one semantic search field and an icon",()=>{
    const wrapper=mount(BaseSearchField,{props:{
      modelValue:"",label:"Search assets",placeholder:"Search entire registry"
    }});
    expect(wrapper.findAll('input[type="search"]')).toHaveLength(1);
    expect(wrapper.findAll(".registry-search")).toHaveLength(1);
    expect(wrapper.get('input[type="search"]').attributes("placeholder")).toBe("Search entire registry");
    expect(wrapper.find("svg").exists()).toBe(true);
  });
  it("preserves v-model updates and disabled behavior",async()=>{
    const wrapper=mount(BaseSearchField,{props:{modelValue:"",label:"Search"}});
    await wrapper.get("input").setValue("asset 12");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["asset 12"]);
    await wrapper.setProps({disabled:true});
    expect(wrapper.get("input").attributes("disabled")).toBeDefined();
  });
});
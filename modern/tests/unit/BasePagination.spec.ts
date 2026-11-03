import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import BasePagination from "../../src/components/ui/BasePagination.vue";

const props = { page: 3, lastPage: 8, total: 185, pageSize: 25, locale: "en" };

describe("BasePagination shared design-system control", () => {
  it("marks the current page and retains disabled navigation semantics", () => {
    const wrapper = mount(BasePagination, { props });
    const current = wrapper.find('.page-number[aria-current="page"]');
    expect(current.exists()).toBe(true);
    expect(current.text()).toBe("3");
    expect(current.attributes("disabled")).toBeDefined();
    expect(wrapper.findAll(".page-number").length).toBeGreaterThan(2);
  });
  it("emits page changes without changing the server-controlled current page", async () => {
    const wrapper = mount(BasePagination, { props });
    await wrapper.find('.page-number[aria-label="Page 4"]').trigger("click");
    expect(wrapper.emitted("change:page")).toEqual([[4]]);
    expect(wrapper.find('.page-number[aria-current="page"]').text()).toBe("3");
  });
  it("uses the shared select and disables actions during loading", () => {
    const wrapper = mount(BasePagination, { props: {...props,loading:true} });
    expect(wrapper.find(".base-select").exists()).toBe(true);
    expect(wrapper.findAll("button").every(item => item.attributes("disabled") !== undefined)).toBe(true);
  });
});

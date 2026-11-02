import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import BaseSelect from "../../src/components/ui/BaseSelect.vue";
import BasePagination from "../../src/components/ui/BasePagination.vue";

describe("shared inventory selects", () => {
  const options = '<option value="">All</option><option value="active">Active</option><option value="disposed">Disposed</option>';

  it("keeps a controlled v-model and forwards accessible attributes", async () => {
    const wrapper = mount(BaseSelect, {
      props: { modelValue: "active", "aria-label": "Status" },
      slots: { default: options },
    });
    expect(wrapper.find("select").attributes("aria-label")).toBe("Status");
    expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("active");
    await wrapper.find("select").setValue("disposed");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["disposed"]);
    expect(wrapper.emitted("change")?.length).toBe(1);
    await wrapper.setProps({ modelValue: "disposed" });
    expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("disposed");
  });

  it("supports external value and disabled state", () => {
    const wrapper = mount(BaseSelect, {
      props: { value: "active", disabled: true },
      slots: { default: options },
    });
    expect(wrapper.find("select").attributes("disabled")).toBeDefined();
    expect((wrapper.find("select").element as HTMLSelectElement).value).toBe("active");
  });

  it("pagination reuses the shared select and emits numeric page sizes", async () => {
    const wrapper = mount(BasePagination, {
      props: { page: 1, lastPage: 3, pageSize: 25, total: 60, locale: "en" },
    });
    const select = wrapper.find("select.base-select");
    expect(select.exists()).toBe(true);
    expect(select.attributes("aria-label")).toBe("Rows per page");
    await select.setValue("50");
    expect(wrapper.emitted("change:size")?.at(-1)).toEqual([50]);
  });

  it("pagination labels reflect Georgian locale", () => {
    const wrapper = mount(BasePagination, {
      props: { page: 1, lastPage: 2, pageSize: 25, total: 30, locale: "ka" },
    });
    expect(wrapper.find("select").attributes("aria-label")).toBe("ჩანაწერები გვერდზე");
  });
});

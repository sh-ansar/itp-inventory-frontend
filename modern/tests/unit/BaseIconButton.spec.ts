import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import BaseIconButton from "../../src/components/ui/BaseIconButton.vue";

describe("BaseIconButton", () => {
  it("uses shared dimensions and exposes accessible action label", () => {
    const click = vi.fn();
    const button = mount(BaseIconButton, {
      attrs: { "aria-label": "Open inventory history", title: "History", onClick: click },
      slots: { default: "<svg aria-hidden='true'></svg>" },
    });
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("aria-label")).toBe("Open inventory history");
    expect(button.attributes("title")).toBe("History");
    expect(button.classes()).toContain("base-icon-button--sm");
    (button.element as HTMLButtonElement).click();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("uses danger styling without changing interaction semantics", () => {
    const button = mount(BaseIconButton, { props: { tone: "danger", size: "md" } });
    expect(button.classes()).toContain("base-icon-button--danger");
    expect(button.classes()).toContain("base-icon-button--md");
  });

  it("cannot trigger an action while disabled", () => {
    const click = vi.fn();
    const button = mount(BaseIconButton, { props: { disabled: true }, attrs: { onClick: click } });
    expect(button.attributes("disabled")).toBeDefined();
    (button.element as HTMLButtonElement).click();
    expect(click).not.toHaveBeenCalled();
  });
});

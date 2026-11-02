import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { useConfirmDialog } from "../../src/composables/useConfirmDialog";

function setupConfirmation() {
  let api: ReturnType<typeof useConfirmDialog> | null = null;
  const wrapper = mount(defineComponent({
    setup() { api = useConfirmDialog(); return () => h("div"); },
  }));
  if (!api) throw new Error("Composable did not mount");
  return { api: api as ReturnType<typeof useConfirmDialog>, wrapper };
}

describe("useConfirmDialog", () => {
  it("returns the user's explicit decision and resets the request", async () => {
    const {api, wrapper} = setupConfirmation();
    const decision = api.ask("Discard changes?", {danger: true, title: "Discard"});
    expect(api.open.value).toBe(true);
    expect(api.message.value).toBe("Discard changes?");
    expect(api.danger.value).toBe(true);
    expect(api.title.value).toBe("Discard");
    api.settle(true);
    await expect(decision).resolves.toBe(true);
    expect(api.open.value).toBe(false);
    expect(api.message.value).toBe("");
    wrapper.unmount();
  });

  it("rejects overlapping requests and cancels on navigation/unmount", async () => {
    const {api, wrapper} = setupConfirmation();
    const active = api.ask("Revoke company membership?", {confirmLabel:"Revoke"});
    const overlap = api.ask("Second request");
    await expect(overlap).resolves.toBe(false);
    expect(api.confirmLabel.value).toBe("Revoke");
    wrapper.unmount();
    await expect(active).resolves.toBe(false);
    expect(api.open.value).toBe(false);
  });

  it("allows successive prompts after an explicit cancellation", async () => {
    const {api, wrapper} = setupConfirmation();
    const first=api.ask("First");
    api.settle(false);
    await expect(first).resolves.toBe(false);
    const second=api.ask("Second");
    api.settle(true);
    await expect(second).resolves.toBe(true);
    wrapper.unmount();
  });
});

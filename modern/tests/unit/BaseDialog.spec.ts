import {afterEach,beforeEach,describe,expect,it} from "vitest";
import {mount} from "@vue/test-utils";
import {nextTick} from "vue";
import BaseDialog from "../../src/components/ui/BaseDialog.vue";

const originalShow=HTMLDialogElement.prototype.showModal;
const originalClose=HTMLDialogElement.prototype.close;

beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
});
afterEach(()=>{
  HTMLDialogElement.prototype.showModal=originalShow;
  HTMLDialogElement.prototype.close=originalClose;
});

describe("shared Inventory drawer",()=>{
  it("renders an accessible title, modal state and a close action",async()=>{
    const wrapper=mount(BaseDialog,{attachTo:document.body,props:{
      open:true,title:"Edit asset",closeLabel:"Close panel"
    }});
    await nextTick();
    const dialog=wrapper.get("dialog");
    const title=wrapper.get("h2");
    expect(dialog.attributes("open")).toBeDefined();
    expect(dialog.attributes("aria-labelledby")).toBe(title.attributes("id"));
    await wrapper.get('button[aria-label="Close panel"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
  });
  it("restores the original keyboard focus when the form closes",async()=>{
    const trigger=document.createElement("button");
    trigger.textContent="Open drawer";
    document.body.appendChild(trigger);
    trigger.focus();
    const wrapper=mount(BaseDialog,{attachTo:document.body,props:{open:false,title:"Stock operation"}});
    await wrapper.setProps({open:true});
    await nextTick();
    expect(wrapper.get("dialog").attributes("open")).toBeDefined();
    await wrapper.setProps({open:false});
    await nextTick();
    expect(wrapper.get("dialog").attributes("open")).toBeUndefined();
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
    trigger.remove();
  });
});
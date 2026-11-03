import {describe,it,expect,afterEach,vi} from "vitest";
import {mount} from "@vue/test-utils";
import BaseMultiSelect from "../../src/components/ui/BaseMultiSelect.vue";

const options=[
  {value:"a",label:"Alpha"},
  {value:"b",label:"Bravo"},
  {value:"c",label:"Charlie"},
];

afterEach(()=>document.body.innerHTML="");

describe("shared Inventory multi-select",()=>{
  it("is a labeled custom dropdown and emits immutable arrays for selection and removal",async()=>{
    const wrapper=mount(BaseMultiSelect,{attachTo:document.body,props:{
      label:"Facility",modelValue:[],options,locale:"en",
    }});
    const trigger=wrapper.get("button.multi-trigger");
    expect(trigger.attributes("aria-label")).toBe("Facility");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.text()).toContain("All");
    await trigger.trigger("click");
    expect(trigger.attributes("aria-expanded")).toBe("true");
    const first=wrapper.get('input[value="a"]');
    await first.setValue(true);
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([["a"]]);
    await wrapper.setProps({modelValue:["a"]});
    expect(first.element.checked).toBe(true);
    await first.setValue(false);
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([[]]);
    wrapper.unmount();
  });
  it("supports selecting visible and clearing while preventing over-limit silent selection",async()=>{
    const wrapper=mount(BaseMultiSelect,{attachTo:document.body,props:{
      label:"Status",modelValue:[],options,locale:"en",maxSelected:2,
    }});
    await wrapper.get("button.multi-trigger").trigger("click");
    const buttons=wrapper.findAll(".multi-actions button");
    expect(buttons[0].attributes("disabled")).toBeDefined();
    await wrapper.get('input[value="a"]').setValue(true);
    await wrapper.setProps({modelValue:["a"]});
    await wrapper.get('input[value="b"]').setValue(true);
    await wrapper.setProps({modelValue:["a","b"]});
    expect(wrapper.get('input[value="c"]').attributes("disabled")).toBeDefined();
    await buttons[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([[]]);
    wrapper.unmount();
  });
  it("searches options, keeps a predictable popup and closes on Escape",async()=>{
    const many=Array.from({length:11},(_,i)=>({value:String(i),label:"Location "+i}));
    const wrapper=mount(BaseMultiSelect,{attachTo:document.body,props:{
      label:"Object",modelValue:[],options:many,locale:"ru",
    }});
    await wrapper.get("button.multi-trigger").trigger("click");
    const input=wrapper.get("input[type=search]");
    await input.setValue("Location 10");
    expect(wrapper.findAll(".multi-option")).toHaveLength(1);
    await input.trigger("keydown",{key:"Escape"});
    expect(wrapper.find(".multi-panel").exists()).toBe(false);
    expect(wrapper.get(".multi-trigger").attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });
  it("renders translated labels and does not open when disabled",async()=>{
    const wrapper=mount(BaseMultiSelect,{props:{
      label:"პასუხისმგებელი",modelValue:[],options,locale:"ka",disabled:true,
    }});
    expect(wrapper.text()).toContain("ყველა");
    await wrapper.get("button").trigger("click");
    expect(wrapper.find(".multi-panel").exists()).toBe(false);
  });
  it("clamps the popup to the viewport when a mobile filter starts at the left edge",async()=>{
    const original=Element.prototype.getBoundingClientRect;
    const previousWidth=window.innerWidth;
    Object.defineProperty(window,"innerWidth",{configurable:true,value:320});
    const rect=(left:number,width:number,top=80,height=40)=>({
      x:left,y:top,left,right:left+width,top,bottom:top+height,width,height,toJSON:()=>({})
    } as DOMRect);
    Element.prototype.getBoundingClientRect=function(){
      if((this as HTMLElement).classList?.contains("multi-panel"))return rect(-30,296,125,260);
      if((this as HTMLElement).classList?.contains("multi-trigger"))return rect(10,130);
      return original.call(this);
    };
    let wrapper:ReturnType<typeof mount>|undefined;
    try{
      wrapper=mount(BaseMultiSelect,{attachTo:document.body,props:{
        label:"Status",modelValue:[],options,locale:"en"
      }});
      await wrapper.get(".multi-trigger").trigger("click");
      await new Promise(resolve=>setTimeout(resolve,0));
      expect(wrapper.get(".multi-panel").attributes("style")).toContain("left: -2px");
      expect(wrapper.get(".multi-panel").attributes("style")).toContain("right: auto");
    }finally{
      wrapper?.unmount();
      Element.prototype.getBoundingClientRect=original;
      Object.defineProperty(window,"innerWidth",{configurable:true,value:previousWidth});
    }
  });
  it("does not lose chosen values when options are refreshed and labels are repeated",async()=>{
    const wrapper=mount(BaseMultiSelect,{attachTo:document.body,props:{
      label:"Room",modelValue:["building-a"],options:[
        {value:"building-a",label:"Floor 1"},{value:"building-b",label:"Floor 1"},
      ],locale:"en",
    }});
    await wrapper.get("button.multi-trigger").trigger("click");
    expect(wrapper.get('input[value="building-a"]').element.checked).toBe(true);
    expect(wrapper.get('input[value="building-b"]').element.checked).toBe(false);
    await wrapper.get('input[value="building-b"]').setValue(true);
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([["building-a","building-b"]]);
    wrapper.unmount();
  });
});

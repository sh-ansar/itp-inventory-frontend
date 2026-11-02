<script setup lang="ts">
import { computed, isVNode, useAttrs, useSlots } from "vue";
import BaseDropdownSelect from "./BaseDropdownSelect.vue";
import type { SelectOption } from "./BaseDropdownSelect.vue";

defineOptions({ inheritAttrs: false });
const props=defineProps<{
  modelValue?: string|number|null;
  value?: string|number|null;
  disabled?:boolean;
}>();
const emit=defineEmits<{
  "update:modelValue":[value:string];
  change:[event:Event];
}>();
const attrs=useAttrs();
const slots=useSlots();
const current=computed(()=>String(props.modelValue!==undefined?props.modelValue??"":props.value??""));
const label=computed(()=>String(attrs["aria-label"]??attrs.title??""));
// The original BaseSelect accepted <option> and <optgroup> children everywhere.
// Interpret those nodes during render, so existing 38 call-sites continue sharing
// the same component without requiring a second dropdown implementation.
function optionText(child:unknown):string{
  if(child===null||child===undefined||typeof child==="boolean")return "";
  if(typeof child==="string"||typeof child==="number")return String(child);
  if(Array.isArray(child))return child.map(optionText).join("");
  if(isVNode(child))return optionText(child.children);
  if(typeof child==="object"&&child&&"default" in child){
    const render=(child as {default?:()=>unknown}).default;
    return typeof render==="function"?optionText(render()):"";
  }
  return "";
}
function collectOptions(child:unknown):SelectOption[]{
  if(Array.isArray(child))return child.flatMap(collectOptions);
  if(!isVNode(child))return [];
  if(child.type==="option"){
    const nodeProps=child.props??{};
    const name=optionText(child.children);
    return [{value:String(nodeProps.value??name),label:name,disabled:nodeProps.disabled!==undefined&&nodeProps.disabled!==false}];
  }
  return collectOptions(child.children);
}
function onSelection(value:string){
  emit("update:modelValue",value);
  // Preserve the old BaseSelect change contract (event.target.value) for
  // existing filters, pagination and form inputs.
  const event=new Event("change",{bubbles:true});
  Object.defineProperty(event,"target",{configurable:true,value:{value}});
  emit("change",event);
}
</script>

<template>
  <BaseDropdownSelect
    v-bind="attrs" class="base-select"
    :model-value="current"
    :label="label"
    :disabled="disabled"
    :options="collectOptions(slots.default?.())"
    @change="onSelection"
  />
</template>

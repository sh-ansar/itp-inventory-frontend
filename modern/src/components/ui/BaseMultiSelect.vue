<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from "vue";
import { Check, ChevronDown, Search, X } from "lucide-vue-next";

interface Option { value: string; label: string; disabled?: boolean }
const props=withDefaults(defineProps<{
  modelValue:string[];
  options:Option[];
  label:string;
  allLabel?:string;
  clearLabel?:string;
  selectVisibleLabel?:string;
  searchPlaceholder?:string;
  emptyLabel?:string;
  locale?:"ru"|"en"|"ka";
  maxSelected?:number;
  disabled?:boolean;
}>(),{locale:"ru",maxSelected:30,disabled:false});
const emit=defineEmits<{"update:modelValue":[values:string[]]}>();
const root=ref<HTMLElement|null>(null);
const trigger=ref<HTMLButtonElement|null>(null);
const searchInput=ref<HTMLInputElement|null>(null);
const opened=ref(false);
const search=ref("");
const id=useId();
const panelId="inventory-multi-"+id.replace(/[^a-z0-9-]/gi,"");
const strings=computed(()=>{
  if(props.locale==="en")return {all:"All",clear:"Clear",visible:"Select visible",search:"Find option",empty:"No matches",selected:"selected",maximum:"Selection limit"};
  if(props.locale==="ka")return {all:"ყველა",clear:"გასუფთავება",visible:"ხილულების არჩევა",search:"ძიება",empty:"არ მოიძებნა",selected:"არჩეული",maximum:"არჩევის ლიმიტი"};
  return {all:"Все",clear:"Очистить",visible:"Выбрать видимые",search:"Поиск",empty:"Ничего не найдено",selected:"выбрано",maximum:"Лимит выбора"};
});
const selected=computed(()=>new Set(props.modelValue));
const selectedOptions=computed(()=>props.modelValue.map(value=>
  props.options.find(option=>option.value===value)?.label||value));
const summary=computed(()=>{
  if(props.modelValue.length===0)return props.allLabel||strings.value.all;
  if(props.modelValue.length===1)return selectedOptions.value[0];
  return props.modelValue.length+" "+strings.value.selected;
});
const visibleOptions=computed(()=>{
  const term=search.value.trim().toLocaleLowerCase();
  return term?props.options.filter(option=>option.label.toLocaleLowerCase().includes(term)):props.options;
});
const remaining=computed(()=>Math.max(0,props.maxSelected-props.modelValue.length));
const selectableVisible=computed(()=>visibleOptions.value.filter(item=>!item.disabled&&!selected.value.has(item.value)));
function open(){
  if(props.disabled)return;
  opened.value=!opened.value;
  if(opened.value){
    search.value="";
    void nextTick(()=>{if(props.options.length>8)searchInput.value?.focus()});
  }
}
function close(focus=false){
  if(!opened.value)return;
  opened.value=false;
  search.value="";
  if(focus)void nextTick(()=>trigger.value?.focus());
}
function toggle(value:string){
  const option=props.options.find(x=>x.value===value);
  if(!option||option.disabled)return;
  if(selected.value.has(value))emit("update:modelValue",props.modelValue.filter(x=>x!==value));
  else if(props.modelValue.length<props.maxSelected)emit("update:modelValue",[...props.modelValue,value]);
}
function clear(){emit("update:modelValue",[])}
function selectVisible(){
  if(selectableVisible.value.length===0||selectableVisible.value.length>remaining.value)return;
  emit("update:modelValue",[...props.modelValue,...selectableVisible.value.map(item=>item.value)]);
}
function outside(event:PointerEvent){
  if(!root.value?.contains(event.target as Node))close();
}
function escape(event:KeyboardEvent){if(opened.value){event.stopPropagation();event.preventDefault();close(true)}}
onMounted(()=>document.addEventListener("pointerdown",outside,true));
onUnmounted(()=>document.removeEventListener("pointerdown",outside,true));
watch(()=>props.disabled,disabled=>{if(disabled)close()});
</script>

<template>
  <div ref="root" class="base-multi-select" :class="{expanded:opened,disabled}">
    <button ref="trigger" type="button" class="multi-trigger"
      :aria-label="label" :aria-expanded="opened" aria-haspopup="dialog"
      :aria-controls="panelId" :disabled="disabled" :title="selectedOptions.join(', ')||summary"
      @click="open" @keydown.down.prevent="open" @keydown.esc="escape">
      <span class="multi-summary" :class="{placeholder:!modelValue.length}">{{summary}}</span>
      <span v-if="modelValue.length" class="multi-count">{{modelValue.length}}</span>
      <ChevronDown :size="16" class="chevron" aria-hidden="true"/>
    </button>
    <div v-if="opened" :id="panelId" class="multi-panel" role="dialog"
      :aria-label="label" @keydown.esc="escape">
      <div v-if="options.length>8" class="multi-search">
        <Search :size="15" aria-hidden="true"/>
        <input ref="searchInput" v-model="search" type="search" :aria-label="searchPlaceholder||strings.search"
          :placeholder="searchPlaceholder||strings.search" autocomplete="off"/>
      </div>
      <div class="multi-actions">
        <button type="button" :disabled="!selectableVisible.length||selectableVisible.length>remaining"
          @click="selectVisible">{{selectVisibleLabel||strings.visible}}</button>
        <button type="button" :disabled="modelValue.length===0" @click="clear">
          <X :size="13" aria-hidden="true"/>{{clearLabel||strings.clear}}
        </button>
      </div>
      <div class="multi-options" role="group" :aria-label="label">
        <label v-for="option in visibleOptions" :key="option.value" class="multi-option"
          :class="{selected:selected.has(option.value),disabled:option.disabled}">
          <input type="checkbox" :checked="selected.has(option.value)"
            :disabled="option.disabled||(!selected.has(option.value)&&remaining===0)"
            :value="option.value" :aria-label="option.label" @change="toggle(option.value)"/>
          <span class="option-text">{{option.label}}</span>
          <Check v-if="selected.has(option.value)" :size="16" aria-hidden="true"/>
        </label>
        <div v-if="visibleOptions.length===0" class="multi-empty">{{emptyLabel||strings.empty}}</div>
      </div>
      <div class="multi-footer" role="status" aria-live="polite">
        {{modelValue.length}} / {{maxSelected}} {{strings.selected}}
        <span v-if="remaining===0"> · {{strings.maximum}}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.base-multi-select{position:relative;min-width:0;width:100%;font:inherit}
.multi-trigger{display:flex;align-items:center;gap:8px;min-height:var(--control-height,40px);width:100%;padding:8px 11px;
  border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);
  color:var(--color-text);background:var(--color-surface-raised,var(--color-surface));font:inherit;font-size:13px;
  text-align:left;cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease}
.multi-trigger:hover:not(:disabled){border-color:var(--color-primary)}
.multi-trigger:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
.expanded .multi-trigger{border-color:var(--color-primary);box-shadow:0 0 0 2px var(--color-accent-soft)}
.multi-trigger:disabled{opacity:.55;cursor:not-allowed}
.multi-summary{min-width:0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.multi-summary.placeholder{color:var(--color-muted)}
.multi-count{display:flex;align-items:center;justify-content:center;flex:none;min-width:23px;height:23px;
  padding:0 6px;border-radius:8px;background:var(--color-accent-soft);color:var(--color-primary);font-size:11px;font-weight:700}
.chevron{flex:none;color:var(--color-muted);transition:transform .16s ease}
.expanded .chevron{transform:rotate(180deg)}
.multi-panel{position:absolute;z-index:120;top:calc(100% + 5px);right:0;
  width:min(360px,calc(100vw - 24px));max-width:calc(100vw - 24px);
  padding:8px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-lg);
  background:var(--color-surface);box-shadow:0 14px 35px #14273730}
.multi-search{display:flex;align-items:center;gap:8px;padding:0 9px;
  border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);color:var(--color-muted)}
.multi-search:focus-within{outline:2px solid var(--color-primary);outline-offset:1px}
.multi-search input{flex:1;min-width:0;height:38px;border:0;outline:0;color:var(--color-text);
  background:transparent;font:inherit;font-size:13px}
.multi-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px}
.multi-actions button{display:inline-flex;align-items:center;gap:3px;background:transparent;border:0;
  color:var(--color-primary);font:inherit;font-size:12px;cursor:pointer}
.multi-actions button:disabled{color:var(--color-muted);opacity:.65;cursor:default}
.multi-options{display:grid;gap:2px;max-height:270px;overflow:auto;overscroll-behavior:contain;
  border-top:1px solid var(--color-stroke);border-bottom:1px solid var(--color-stroke);padding:5px 0}
.multi-option{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:var(--radius-sm);
  min-height:38px;cursor:pointer;font-size:13px;color:var(--color-text)}
.multi-option:hover{background:var(--color-accent-soft)}
.multi-option.selected{background:var(--color-accent-soft)}
.multi-option.disabled{opacity:.55;cursor:not-allowed}
.multi-option input{width:16px;height:16px;accent-color:var(--color-primary);flex:none}
.multi-option .option-text{flex:1;min-width:0;overflow-wrap:anywhere}
.multi-option svg{flex:none;color:var(--color-primary)}
.multi-empty{padding:15px;text-align:center;color:var(--color-muted);font-size:12px}
.multi-footer{padding:8px 5px 2px;text-align:right;color:var(--color-muted);font-size:11px}
@media(max-width:600px){
 .multi-trigger{min-height:44px;font-size:14px}
 .multi-panel{max-height:min(60vh,470px)}
 .multi-options{max-height:min(42vh,270px)}
 .multi-option{min-height:44px}
 .multi-search input{font-size:16px}
}
@media(prefers-reduced-motion:reduce){.multi-trigger,.chevron{transition:none}}
</style>

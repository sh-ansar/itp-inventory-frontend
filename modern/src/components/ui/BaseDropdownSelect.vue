<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from "vue";
import { Check, ChevronDown, Search } from "lucide-vue-next";

export interface SelectOption { value: string; label: string; disabled?: boolean }

const props=withDefaults(defineProps<{
  modelValue:string;
  options:SelectOption[];
  label:string;
  placeholder?:string;
  locale?:"ru"|"en"|"ka";
  searchable?:boolean;
  disabled?:boolean;
}>(),{locale:"ru",searchable:false,disabled:false});
const emit=defineEmits<{ "update:modelValue":[value:string]; change:[value:string] }>();
const root=ref<HTMLElement|null>(null);
const trigger=ref<HTMLButtonElement|null>(null);
const nativeSelect=ref<HTMLSelectElement|null>(null);
const panel=ref<HTMLElement|null>(null);
const searchInput=ref<HTMLInputElement|null>(null);
const opened=ref(false);
const opensUp=ref(false);
const query=ref("");
const highlighted=ref(-1);
const uid=useId().replace(/[^\w-]/g,"");
const listId="inventory-single-options-"+uid;
const message=computed(()=>props.locale==="en"?{search:"Search",empty:"No results",select:"Select"}
  :props.locale==="ka"?{search:"ძიება",empty:"შედეგი არ მოიძებნა",select:"არჩევა"}
  :{search:"Поиск",empty:"Ничего не найдено",select:"Выбрать"});
const selection=computed(()=>props.options.find(item=>item.value===props.modelValue));
const visibleOptions=computed(()=>{
  const term=query.value.toLocaleLowerCase().trim();
  return term?props.options.filter(x=>x.label.toLocaleLowerCase().includes(term)):props.options;
});
const selectable=computed(()=>visibleOptions.value
  .map((item,index)=>item.disabled?-1:index).filter(index=>index>=0));
const activeId=computed(()=>opened.value&&highlighted.value>=0
  ?listId+"-option-"+highlighted.value:undefined);
function focusActive(){
  nextTick(()=>{const item=panel.value?.querySelector<HTMLElement>("[data-active='true']");item?.scrollIntoView?.({block:"nearest"});});
}
function updatePosition(){
  if(!opened.value)return;
  const box=panel.value?.getBoundingClientRect();
  const target=trigger.value?.getBoundingClientRect();
  if(box&&target)opensUp.value=box.bottom>window.innerHeight-8&&target.top>box.height+10;
}
function open(){
  if(props.disabled||opened.value)return;
  opened.value=true;
  opensUp.value=false;
  query.value="";
  const current=visibleOptions.value.findIndex(item=>item.value===props.modelValue&&!item.disabled);
  highlighted.value=current>=0?current:(selectable.value[0]??-1);
  void nextTick(()=>{
    updatePosition();
    if(props.searchable)searchInput.value?.focus();
    focusActive();
  });
}
function close(restoreFocus=false){
  opened.value=false;
  opensUp.value=false;
  query.value="";
  if(restoreFocus)void nextTick(()=>nativeSelect.value?.focus());
}
function onNativeChange(event:Event){
  const next=props.options.find(item=>item.value===(event.target as HTMLSelectElement).value);
  if(next)choose(next);
}
function choose(item:SelectOption){
  if(item.disabled)return;
  if(item.value!==props.modelValue){
    emit("update:modelValue",item.value);
    emit("change",item.value);
  }
  close(true);
}
function move(delta:1|-1){
  if(!opened.value)open();
  else if(selectable.value.length){
    const current=selectable.value.indexOf(highlighted.value);
    const next=(current+delta+selectable.value.length)%selectable.value.length;
    highlighted.value=selectable.value[next];
    focusActive();
  }
}
function onKey(event:KeyboardEvent){
  if(event.key==="Escape"&&opened.value){event.preventDefault();event.stopPropagation();close(true);return}
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
    event.preventDefault();move(event.key==="ArrowDown"?1:-1);return;
  }
  if(event.key==="Home"&&opened.value){event.preventDefault();highlighted.value=selectable.value[0]??-1;focusActive()}
  if(event.key==="End"&&opened.value){event.preventDefault();highlighted.value=selectable.value.at(-1)??-1;focusActive()}
  if(event.key==="Enter"||event.key===" "){
    if(event.target===searchInput.value&&event.key===" ")return;
    event.preventDefault();
    if(!opened.value){open();return}
    const item=visibleOptions.value[highlighted.value];
    if(item)choose(item);
  }
  if(event.key==="Tab"&&opened.value)close();
}
function onOutside(event:PointerEvent){
  if(root.value&&!root.value.contains(event.target as Node))close();
}
watch(query,()=>{highlighted.value=selectable.value[0]??-1;focusActive()});
watch(()=>props.modelValue,()=>{if(opened.value)close()});
watch(()=>props.disabled,value=>{if(value)close()});
onMounted(()=>{
  document.addEventListener("pointerdown",onOutside,true);
  window.addEventListener("resize",updatePosition);
});
onUnmounted(()=>{
  document.removeEventListener("pointerdown",onOutside,true);
  window.removeEventListener("resize",updatePosition);
});
</script>

<template>
  <div ref="root" class="base-dropdown-select" :class="{'is-open':opened,'is-disabled':disabled}">
    <!-- Native semantic select retains keyboard, screen-reader and form behavior;
         pointer users get the unified Inventory popup, never the OS options popup. -->
    <select ref="nativeSelect" class="dropdown-native" :class="$attrs.class"
      :aria-label="label" :aria-expanded="opened" aria-haspopup="listbox"
      :aria-controls="listId" :aria-activedescendant="activeId"
      :value="modelValue" :disabled="disabled" @change="onNativeChange" @keydown="onKey">
      <option v-for="item in options" :key="item.value" :value="item.value"
        :disabled="item.disabled">{{item.label}}</option>
    </select>
    <button ref="trigger" type="button" class="dropdown-trigger" tabindex="-1" aria-hidden="true"
      :title="selection?.label||placeholder||label"
      :disabled="disabled" @click="opened?close():open()" @keydown="onKey">
      <span class="dropdown-value" :class="{'is-placeholder':!selection}">
        {{selection?.label||placeholder||message.select}}
      </span>
      <ChevronDown :size="16" aria-hidden="true" class="chevron"/>
    </button>
    <div v-if="opened" ref="panel" class="dropdown-panel" :class="{'opens-up':opensUp}">
      <div v-if="searchable" class="dropdown-search">
        <Search :size="15" aria-hidden="true"/>
        <input ref="searchInput" v-model="query" type="search"
          :aria-label="message.search" :placeholder="message.search" autocomplete="off"
          @keydown="onKey"/>
      </div>
      <div :id="listId" role="listbox" :aria-label="label" class="dropdown-options">
        <div v-for="(item,index) in visibleOptions" :id="listId+'-option-'+index"
          :key="item.value" role="option" class="dropdown-option"
          :data-active="index===highlighted"
          :aria-selected="item.value===modelValue"
          :aria-disabled="item.disabled||undefined"
          :class="{'is-selected':item.value===modelValue,'is-active':index===highlighted,'is-disabled':item.disabled}"
          @click="choose(item)" @mouseenter="!item.disabled&&(highlighted=index)">
          <span>{{item.label}}</span>
          <Check v-if="item.value===modelValue" :size="16" aria-hidden="true"/>
        </div>
        <p v-if="visibleOptions.length===0" class="dropdown-empty">{{message.empty}}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.base-dropdown-select{width:100%;min-width:0;position:relative}
.dropdown-native{
  position:absolute;inset:0;z-index:1;width:100%;height:100%;
  min-height:40px;opacity:0;pointer-events:none;padding:0;margin:0;
}
.base-dropdown-select:focus-within .dropdown-trigger{
  outline:2px solid var(--color-primary);outline-offset:1px;
}
.dropdown-trigger{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  height:var(--control-height,40px);min-height:40px;padding:8px 11px;
  width:100%;min-width:0;border:1px solid var(--color-stroke-strong);
  border-radius:var(--radius-sm);background:var(--color-surface-raised,var(--color-surface));
  color:var(--color-text);font:inherit;font-size:13px;line-height:20px;
  box-shadow:var(--shadow-control);cursor:pointer;text-align:left;
  transition:border-color .16s,box-shadow .16s
}
.dropdown-trigger:hover:not(:disabled){border-color:var(--color-primary)}
.dropdown-trigger:focus-visible{outline:2px solid var(--color-primary);outline-offset:1px}
.is-open .dropdown-trigger{border-color:var(--color-primary);box-shadow:0 0 0 2px var(--color-accent-soft)}
.is-disabled .dropdown-trigger{opacity:.55;cursor:not-allowed}
.dropdown-value{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dropdown-value.is-placeholder{color:var(--color-muted)}
.chevron{flex:none;color:var(--color-muted);transition:transform .16s}
.is-open .chevron{transform:rotate(180deg)}
.dropdown-panel{
  position:absolute;top:calc(100% + 5px);right:0;z-index:200;
  width:max(100%,min(300px,calc(100vw - 24px)));max-width:calc(100vw - 24px);
  border:1px solid var(--color-stroke-strong);border-radius:var(--radius-lg);
  background:var(--color-surface);box-shadow:0 14px 35px #14273730;padding:6px
}
.dropdown-panel.opens-up{top:auto;bottom:calc(100% + 5px)}
.dropdown-search{display:flex;align-items:center;gap:8px;padding:0 9px;
  border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);
  color:var(--color-muted);margin-bottom:5px}
.dropdown-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;
  color:var(--color-text);height:37px;font-size:13px;box-shadow:none}
.dropdown-options{overflow-y:auto;overscroll-behavior:contain;max-height:min(270px,55dvh);scrollbar-width:thin}
.dropdown-option{min-height:39px;padding:9px 10px;display:flex;align-items:center;gap:10px;
  color:var(--color-text);font-size:13px;line-height:19px;cursor:pointer;
  border-radius:var(--radius-sm);overflow-wrap:anywhere}
.dropdown-option span{min-width:0;flex:1}
.dropdown-option svg{flex:none;color:var(--color-primary)}
.dropdown-option.is-active,.dropdown-option:hover{background:var(--color-hover)}
.dropdown-option.is-selected{background:var(--color-accent-soft);color:var(--color-primary);font-weight:600}
.dropdown-option.is-disabled{opacity:.55;pointer-events:none}
.dropdown-empty{font-size:12px;color:var(--color-muted);text-align:center;padding:12px;margin:0}
@media(max-width:600px){
  .dropdown-trigger{min-height:44px;height:44px;font-size:14px}
  .dropdown-option{min-height:44px}
  .dropdown-search input{font-size:16px}
}
@media(prefers-reduced-motion:reduce){.dropdown-trigger,.chevron{transition:none}}
</style>

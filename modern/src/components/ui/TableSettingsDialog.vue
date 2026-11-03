<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, RotateCcw, SlidersHorizontal } from "lucide-vue-next";
import BaseDialog from "./BaseDialog.vue";
import BaseButton from "./BaseButton.vue";
import BaseIconButton from "./BaseIconButton.vue";
import { useUiSettings } from "../../stores/uiSettings";

interface Column { key:string; label:string }
const props=defineProps<{
  open:boolean;
  columns:Column[];
  hiddenColumns:string[];
  columnOrder:string[];
  busy?:boolean;
}>();
const emit=defineEmits<{
  close:[];
  reset:[];
  "update:hiddenColumns":[value:string[]];
  "update:columnOrder":[value:string[]];
}>();
const ui=useUiSettings();
const t=computed(()=>ui.locale==="ka"
  ? {title:"ცხრილის პარამეტრები",show:"ხილული სვეტები",hint:"სვეტების დამალვა და მიმდევრობის შეცვლა",
      reset:"ნაგულისხმევის აღდგენა",close:"დახურვა",up:"ზემოთ",down:"ქვემოთ"}
  : ui.locale==="en"
    ? {title:"Table settings",show:"Visible columns",hint:"Show, hide and reorder columns",
        reset:"Restore defaults",close:"Close",up:"Move up",down:"Move down"}
    : {title:"Настройки таблицы",show:"Видимые столбцы",hint:"Скрывайте и меняйте порядок столбцов",
        reset:"Сбросить настройки",close:"Закрыть",up:"Выше",down:"Ниже"});
const fixed=new Set(["inventory_number","name","actions"]);
const ordered=computed(()=>{
  const keys=new Map(props.columnOrder.map((key,index)=>[key,index]));
  return [...props.columns].sort((a,b)=>(keys.get(a.key)??1000)-(keys.get(b.key)??1000));
});
function toggle(key:string,visible:boolean){
  if(fixed.has(key))return;
  const hidden=new Set(props.hiddenColumns);
  if(visible)hidden.delete(key);else hidden.add(key);
  emit("update:hiddenColumns",[...hidden]);
}
function move(key:string,delta:number){
  const list=ordered.value.map(column=>column.key);
  const index=list.indexOf(key),to=index+delta;
  if(index<0||to<0||to>=list.length)return;
  [list[index],list[to]]=[list[to],list[index]];
  emit("update:columnOrder",list);
}
</script>

<template>
  <BaseDialog :open="open" :title="t.title" size="default" @close="emit('close')">
    <p class="settings-intro"><SlidersHorizontal :size="18" aria-hidden="true"/>{{t.hint}}</p>
    <h3 class="settings-label">{{t.show}}</h3>
    <div class="settings-list">
      <div v-for="(column,index) in ordered" :key="column.key" class="settings-row">
        <label class="column-toggle">
          <input type="checkbox" :checked="!hiddenColumns.includes(column.key)"
            :disabled="busy||fixed.has(column.key)"
            @change="toggle(column.key,($event.target as HTMLInputElement).checked)" />
          <span>{{column.label}}</span>
        </label>
        <div class="order-actions">
          <BaseIconButton type="button" :title="t.up" :aria-label="t.up+': '+column.label"
            :disabled="busy||index===0" @click="move(column.key,-1)">
            <ArrowUp :size="16" aria-hidden="true"/>
          </BaseIconButton>
          <BaseIconButton type="button" :title="t.down" :aria-label="t.down+': '+column.label"
            :disabled="busy||index===ordered.length-1" @click="move(column.key,1)">
            <ArrowDown :size="16" aria-hidden="true"/>
          </BaseIconButton>
        </div>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="emit('reset')">
        <RotateCcw :size="16" aria-hidden="true"/>{{t.reset}}
      </BaseButton>
      <BaseButton @click="emit('close')">{{t.close}}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.settings-intro{display:flex;align-items:center;gap:9px;color:var(--color-muted);font-size:13px;line-height:1.5;margin:0 0 18px}
.settings-intro svg{flex:none;color:var(--color-primary)}
.settings-label{font-size:14px;font-weight:600;margin:0 0 10px}
.settings-list{display:grid;gap:8px;min-width:0}
.settings-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:8px 11px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);background:var(--color-surface-raised);min-width:0}
.column-toggle{display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0;font-size:13px}
.column-toggle input{width:17px;height:17px;min-height:0;margin:0;padding:0;accent-color:var(--color-primary);flex:none}
.column-toggle span{overflow-wrap:anywhere}
.order-actions{display:flex;gap:5px;flex:none}
@media(max-width:600px){.settings-row{min-height:52px;padding:8px}.order-actions{gap:3px}.column-toggle{min-height:40px}}
</style>
<script setup lang="ts">
import {ref,computed,watch,onUnmounted} from "vue";
import {Plus,Pencil,Archive,SlidersHorizontal} from "lucide-vue-next";
import BaseCard from "./ui/BaseCard.vue";
import BaseButton from "./ui/BaseButton.vue";
import BaseIconButton from "./ui/BaseIconButton.vue";
import BaseSelect from "./ui/BaseSelect.vue";
import BaseDialog from "./ui/BaseDialog.vue";
import BaseDataTable from "./ui/BaseDataTable.vue";
import BaseConfirmDialog from "./ui/BaseConfirmDialog.vue";
import {useConfirmDialog} from "../composables/useConfirmDialog";
import {useUiSettings} from "../stores/uiSettings";
import {referenceData} from "../api/inventory";
import type {RefItem} from "../api/inventory";
import {listAssetFields,createAssetField,updateAssetField} from "../api/assetFields";
import type {AssetFieldDefinition,FieldType} from "../api/assetFields";
import {InventoryApiError} from "../api/client";

const props=defineProps<{companyId:string;role:string}>();
const ui=useUiSettings();
const t=(ru:string,en:string,ka:string)=>ui.locale==="en"?en:ui.locale==="ka"?ka:ru;
const canWrite=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const categories=ref<RefItem[]>([]);
const categoryId=ref("");
const fields=ref<AssetFieldDefinition[]>([]);
const showArchived=ref(false),open=ref(false),busy=ref(false),saving=ref(false);
const error=ref(""),message=ref("");
const editing=ref<AssetFieldDefinition|null>(null);
const code=ref(""),labelRu=ref(""),labelEn=ref(""),labelKa=ref(""),fieldType=ref<FieldType>("text");
const required=ref(false),options=ref(""),sortOrder=ref(0);
const originalForm=ref("");
const validation=ref<Record<string,string[]>>({});
const {open:confirmOpen,message:confirmMessage,title:confirmTitle,confirmLabel,danger,
  ask:setConfirm,settle}=useConfirmDialog();
const displayed=computed(()=>fields.value.filter(x=>showArchived.value||x.is_active));
const columns=computed(()=>[
 {key:"code",label:t("Код","Code","კოდი"),minWidth:120},
 {key:"label_ru",label:t("Название","Name","სახელი"),minWidth:200},
 {key:"field_type",label:t("Тип поля","Field type","ველის ტიპი"),minWidth:115},
 {key:"required",label:t("Обязательное","Required","სავალდებულო"),minWidth:120},
 {key:"is_active",label:t("Статус","Status","სტატუსი"),minWidth:100},
 {key:"actions",label:t("Действия","Actions","ქმედებები"),align:"right" as const,minWidth:115},
]);
// Keep options reactive when the user switches RU/EN/GE without reopening the page.
const fieldLabels=computed<Record<FieldType,string>>(()=>({
  text:t("Текст","Text","ტექსტი"),number:t("Число","Number","რიცხვი"),
  date:t("Дата","Date","თარიღი"),boolean:t("Да/нет","Yes/no","დიახ/არა"),
  select:t("Выбор","Select","არჩევანი"),
}));
const fieldTypeName=(type:string)=>fieldLabels.value[type as FieldType]??type;
let abort:AbortController|null=null,serial=0;
async function refresh(){
  abort?.abort();const next=new AbortController();abort=next;const current=++serial;
  error.value="";if(!props.companyId){categories.value=[];fields.value=[];return;}
  busy.value=true;
  try{
    const refs=await referenceData(props.companyId,next.signal);
    if(next.signal.aborted||current!==serial)return;
    categories.value=refs.categories;
    if(!categories.value.some(c=>c.id===categoryId.value))categoryId.value=categories.value[0]?.id??"";
    if(categoryId.value){
      const r=await listAssetFields(props.companyId,categoryId.value,true,next.signal);
      if(!next.signal.aborted&&current===serial)fields.value=r.data;
    }else fields.value=[];
  }catch(e){if(!next.signal.aborted)error.value=e instanceof Error?e.message:String(e);}
  finally{if(current===serial)busy.value=false;}
}
async function loadFields(){
  abort?.abort();const next=new AbortController();abort=next;const current=++serial;
  if(!categoryId.value){fields.value=[];return;}
  busy.value=true;
  try{const r=await listAssetFields(props.companyId,categoryId.value,true,next.signal);
    if(!next.signal.aborted&&current===serial)fields.value=r.data;
  }catch(e){if(!next.signal.aborted)error.value=e instanceof Error?e.message:String(e);}
  finally{if(current===serial)busy.value=false;}
}
watch(()=>props.companyId,()=>{open.value=false;categoryId.value="";void refresh();},{immediate:true});
watch(categoryId,()=>{if(categoryId.value)void loadFields();});
onUnmounted(()=>abort?.abort());
function snapshotForm(){
  return JSON.stringify({
    code:code.value,labelRu:labelRu.value,labelEn:labelEn.value,labelKa:labelKa.value,
    fieldType:fieldType.value,required:required.value,options:options.value,sortOrder:sortOrder.value,
  });
}
async function closeEditor(){
  if(saving.value)return;
  if(snapshotForm()!==originalForm.value && !(await setConfirm(t(
    "Закрыть форму без сохранения?","Discard unsaved changes?","დავხუროთ შენახვის გარეშე?"
  ))))return;
  open.value=false;
}
function edit(row:AssetFieldDefinition|null=null){
  if(!canWrite.value||!categoryId.value)return;
  editing.value=row;code.value=row?.code??"";labelRu.value=row?.label_ru??"";
  labelEn.value=row?.label_en??"";labelKa.value=row?.label_ka??"";
  fieldType.value=row?.field_type??"text";options.value=(row?.options??[]).join("\n");
  required.value=row?.required??false;sortOrder.value=row?.sort_order??0;
  validation.value={};error.value="";
  originalForm.value=snapshotForm();open.value=true;
}
async function save(){
  if(saving.value||!labelRu.value.trim())return;
  saving.value=true;error.value="";validation.value={};
  try{
    if(editing.value){
      await updateAssetField(props.companyId,editing.value.id,{
        version:editing.value.version,label_ru:labelRu.value.trim(),
        label_en:labelEn.value.trim(),label_ka:labelKa.value.trim(),
        sort_order:sortOrder.value,
      });
    }else{
      await createAssetField(props.companyId,{
        category_id:categoryId.value,code:code.value.trim(),
        label_ru:labelRu.value.trim(),label_en:labelEn.value.trim(),label_ka:labelKa.value.trim(),
        field_type:fieldType.value,options:fieldType.value==="select"
          ?options.value.split("\n").map(s=>s.trim()).filter(Boolean):[],
        required:required.value,sort_order:sortOrder.value,
      });
    }
    open.value=false;await loadFields();
    message.value=t("Поле сохранено","Field saved","ველი შენახულია");
  }catch(e){
    if(e instanceof InventoryApiError){validation.value=e.fields;error.value=e.message;}
    else error.value=e instanceof Error?e.message:String(e);
  }finally{saving.value=false;}
}
async function archive(row:AssetFieldDefinition){
  if(!canWrite.value||!row.is_active)return;
  if(!(await setConfirm(t("Архивировать поле «"+row.label_ru+"»?","Archive field “"+row.label_ru+"”?","ველის არქივირება: "+row.label_ru+"?"))))return;
  saving.value=true;error.value="";
  try{await updateAssetField(props.companyId,row.id,{
    version:row.version,label_ru:row.label_ru,label_en:row.label_en??"",
    label_ka:row.label_ka??"",is_active:false,
  });await loadFields();}
  catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{saving.value=false;}
}
</script>
<template>
  <section class="fields-panel">
    <div class="fields-title"><div><h3><SlidersHorizontal :size="18"/>{{t("Конструктор характеристик","Custom asset fields","აქტივის ველები")}}</h3>
      <p>{{t("Свой набор характеристик для каждого типа имущества","Different attributes for each asset type","ველები ქონების ტიპის მიხედვით")}}</p></div>
      <BaseButton v-if="canWrite&&categoryId" @click="edit(null)"><Plus :size="16"/>{{t("Добавить поле","Add field","ველის დამატება")}}</BaseButton>
    </div>
    <div class="fields-filter">
      <label>{{t("Тип имущества","Asset category","ქონების ტიპი")}}
        <BaseSelect v-model="categoryId">
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{cat.name}}</option>
        </BaseSelect>
      </label>
      <label class="archive-label"><input v-model="showArchived" type="checkbox"/>{{t("Архив","Archived","არქივი")}}</label>
    </div>
    <p v-if="error&&!open" role="alert" class="error">{{error}}</p>
    <p v-if="message" role="status" class="notice">{{message}}</p>
    <BaseCard>
      <BaseDataTable :rows="displayed" row-key="id" :columns="columns" :loading="busy"
        :caption="t('Характеристики','Custom fields','ველები')" :min-table-width="700">
        <template #cell-field_type="{row}">{{fieldTypeName(row.field_type)}}</template>
        <template #cell-required="{row}">{{row.required?t("Да","Yes","დიახ"):t("Нет","No","არა")}}</template>
        <template #cell-is_active="{row}">{{row.is_active?t("Активен","Active","აქტიური"):t("Архив","Archived","არქივი")}}</template>
        <template #cell-actions="{row}">
          <div class="field-actions" v-if="canWrite&&row.is_active">
            <BaseIconButton :title="t('Изменить','Edit','რედაქტირება')" @click="edit(row)"><Pencil :size="16"/></BaseIconButton>
            <BaseIconButton :title="t('Архивировать','Archive','არქივირება')" @click="archive(row)"><Archive :size="16"/></BaseIconButton>
          </div>
        </template>
      </BaseDataTable>
    </BaseCard>
    <BaseDialog :open="open" :title="t('Характеристика имущества','Asset attribute','ქონების ველი')" @close="closeEditor">
      <form id="field-builder-form" class="field-form" @submit.prevent="save">
        <p v-if="error" role="alert" class="error">{{error}}</p>
        <label v-if="!editing">{{t("Код (латиницей)","Code","კოდი")}} *
          <input v-model="code" pattern="[a-z][a-z0-9_]*" required maxlength="60"/>
          <small v-if="validation.code">{{validation.code[0]}}</small>
        </label>
        <label>{{t("Название RU","Label RU","სახელი RU")}} *
          <input v-model="labelRu" required maxlength="160"/>
        </label>
        <label>{{t("Название EN","Label EN","სახელი EN")}}
          <input v-model="labelEn" maxlength="160"/>
        </label>
        <label>{{t("Название GE","Label GE","სახელი GE")}}
          <input v-model="labelKa" maxlength="160"/>
        </label>
        <label v-if="!editing">{{t("Тип значения","Field type","ველის ტიპი")}}
          <BaseSelect v-model="fieldType">
            <option v-for="(name,key) in fieldLabels" :key="key" :value="key">{{name}}</option>
          </BaseSelect>
        </label>
        <label v-if="!editing&&fieldType==='select'">{{t("Варианты (каждый с новой строки)","Options (one per line)","პარამეტრები")}}
          <textarea v-model="options" rows="4" maxlength="3000"/>
        </label>
        <label v-if="!editing" class="field-inline"><input v-model="required" type="checkbox"/>
          {{t("Обязательное поле","Required","სავალდებულო")}}
        </label>
        <label>{{t("Порядок","Sort order","რიგი")}}
          <input v-model.number="sortOrder" type="number" min="0" max="10000"/>
        </label>
      </form>
      <template #footer><BaseButton variant="secondary" @click="closeEditor">{{t("Отмена","Cancel","გაუქმება")}}</BaseButton>
        <BaseButton type="submit" form="field-builder-form" :disabled="saving||!labelRu.trim()">{{t("Сохранить","Save","შენახვა")}}</BaseButton>
      </template>
    </BaseDialog>
    <BaseConfirmDialog :open="confirmOpen" :message="confirmMessage" :title="confirmTitle"
      :confirm-label="confirmLabel" :danger="danger" @confirm="settle(true)" @cancel="settle(false)"/>
  </section>
</template>
<style scoped>
.fields-panel{display:grid;gap:16px;min-width:0}
.fields-title{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.fields-title h3{margin:0;display:flex;align-items:center;gap:8px;font-size:16px}
.fields-title p{margin:5px 0;color:var(--color-muted);font-size:12px}
.fields-filter{display:flex;align-items:end;gap:16px;flex-wrap:wrap}
.fields-filter label:first-child{display:grid;gap:7px;min-width:230px;max-width:100%}
.archive-label,.field-inline{display:flex;align-items:center;gap:8px;font-size:12px}
.field-actions{display:flex;justify-content:flex-end;gap:5px}
.field-form{display:grid;gap:14px}
.field-form label:not(.field-inline){display:grid;gap:6px}
.field-form input:not([type=checkbox]),.field-form textarea{min-height:40px;width:100%;min-width:0;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);padding:9px;background:var(--color-surface);color:var(--color-text)}
.field-form small{color:var(--color-danger)}
@media(max-width:600px){.fields-filter label:first-child{width:100%}}
</style>

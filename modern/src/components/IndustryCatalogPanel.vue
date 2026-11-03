<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { Plus, Pencil, Archive, RefreshCw } from "lucide-vue-next";
import BaseButton from "./ui/BaseButton.vue";
import BaseSelect from "./ui/BaseSelect.vue";
import BaseCard from "./ui/BaseCard.vue";
import BaseDialog from "./ui/BaseDialog.vue";
import BaseConfirmDialog from "./ui/BaseConfirmDialog.vue";
import BaseDataTable from "./ui/BaseDataTable.vue";
import BaseIconButton from "./ui/BaseIconButton.vue";
import { useConfirmDialog } from "../composables/useConfirmDialog";
import { useUiSettings } from "../stores/uiSettings";
import { InventoryApiError } from "../api/client";
import {
  listIndustryCatalog, createIndustryCatalogItem, updateIndustryCatalogItem, archiveIndustryCatalogItem,
} from "../api/industryCatalogs";
import type { IndustryKind, IndustryCatalogItem } from "../api/industryCatalogs";
import { industryCatalogLabel } from "../api/industryCatalogs";

const props = defineProps<{companyId:string;role:string}>();
const ui = useUiSettings();
const canWrite = computed(()=>["company_admin","inventory_manager"].includes(props.role));
const kinds: IndustryKind[] = ["unit","manufacturer","model","department"];
const labels: Record<IndustryKind,Record<string,string>> = {
  unit:{ru:"Единицы измерения",en:"Units of measure",ka:"ზომის ერთეულები"},
  manufacturer:{ru:"Производители",en:"Manufacturers",ka:"მწარმოებლები"},
  model:{ru:"Модели",en:"Models",ka:"მოდელები"},
  department:{ru:"Подразделения",en:"Departments",ka:"განყოფილებები"},
};
const translate = (ru:string,en:string,ka:string) =>
  ui.locale==="en"?en:ui.locale==="ka"?ka:ru;
const titleFor = (kind:IndustryKind) => labels[kind][ui.locale]??labels[kind].ru;
const kind=ref<IndustryKind>("unit");
const rows=ref<IndustryCatalogItem[]>([]);
const manufacturers=ref<IndustryCatalogItem[]>([]);
const showArchived=ref(false);
const busy=ref(false),saving=ref(false),dialogOpen=ref(false);
const message=ref(""),error=ref("");
const fields=ref<Record<string,string[]>>({});
const editing=ref<IndustryCatalogItem|null>(null);
const code=ref(""),name=ref(""),parentId=ref(""),precision=ref("0");
const initialForm=ref("");
const formSnapshot=()=>JSON.stringify({code:code.value,name:name.value,parentId:parentId.value,precision:precision.value});
let serial=0;
let abort:AbortController|null=null;
const {open:confirmOpen,message:confirmMessage,title:confirmTitle,
  confirmLabel,danger,ask,settle} = useConfirmDialog();
const columns=computed(()=>[
  {key:"code",label:translate("Код","Code","კოდი"),minWidth:120},
  {key:"name",label:translate("Наименование","Name","სახელი"),minWidth:220},
  ...(kind.value==="model"?[{key:"parent_id",label:translate("Производитель","Manufacturer","მწარმოებელი"),minWidth:180}]:[]),
  ...(kind.value==="unit"?[{key:"precision",label:translate("Знаков после запятой","Decimal places","ათწილადი"),minWidth:145}]:[]),
  {key:"is_active",label:translate("Состояние","Status","სტატუსი"),minWidth:130},
  {key:"actions",label:translate("Действия","Actions","ქმედებები"),minWidth:115,align:"right" as const},
]);

async function load() {
  abort?.abort();
  const next=new AbortController();abort=next;
  const requestId=++serial;
  error.value="";message.value="";
  if(!props.companyId){rows.value=[];manufacturers.value=[];busy.value=false;return;}
  busy.value=true;
  try {
    const [items,parents]=await Promise.all([
      listIndustryCatalog(props.companyId,kind.value,true,next.signal),
      kind.value==="model"
        ? listIndustryCatalog(props.companyId,"manufacturer",false,next.signal)
        : Promise.resolve({data:[] as IndustryCatalogItem[]}),
    ]);
    if(requestId!==serial || next.signal.aborted)return;
    rows.value=items.data;
    manufacturers.value=parents.data;
  } catch(e) {
    if(!next.signal.aborted)error.value=e instanceof Error?e.message:String(e);
  } finally {
    if(requestId===serial)busy.value=false;
  }
}
watch(()=>[props.companyId,kind.value],()=>{
  dialogOpen.value=false;editing.value=null;void load();
},{immediate:true});
onUnmounted(()=>abort?.abort());
const displayed=computed(()=>rows.value.filter(r=>showArchived.value||r.is_active!==false));
const manufacturerName=(id:string|null|undefined)=>
  manufacturers.value.find(m=>m.id===id)?.name??"—";

function edit(row:IndustryCatalogItem|null=null){
  if(!canWrite.value || row?.is_system || row?.source && row.source!=="manual")return;
  editing.value=row;
  code.value=row?.code??"";name.value=row?.name??"";
  parentId.value=row?.parent_id??"";precision.value=String(row?.precision??0);
  fields.value={};error.value="";message.value="";
  initialForm.value=formSnapshot();dialogOpen.value=true;
}
async function close(){
  if(saving.value)return;
  if(formSnapshot()!==initialForm.value&&!(await ask(translate(
    "Закрыть форму без сохранения?","Close without saving?","შენახვის გარეშე დახურვა?"
  ))))return;
  dialogOpen.value=false;
}
async function save(){
  if(!canWrite.value||saving.value||!name.value.trim())return;
  if(!editing.value&&!code.value.trim())return;
  saving.value=true;fields.value={};error.value="";
  try{
    if(editing.value){
      await updateIndustryCatalogItem(props.companyId,kind.value,editing.value.id,
        editing.value.version,name.value.trim());
    }else{
      await createIndustryCatalogItem(props.companyId,kind.value,{
        code:code.value.trim(),name:name.value.trim(),
        ...(kind.value==="model"?{parent_id:parentId.value}:{}),
        ...(kind.value==="unit"?{precision:Number(precision.value)}:{}),
      });
    }
    dialogOpen.value=false;editing.value=null;
    await load();
    message.value=translate("Запись сохранена","Entry saved","ჩანაწერი შენახულია");
  }catch(e){
    if(e instanceof InventoryApiError){fields.value=e.fields;error.value=e.message;}
    else error.value=e instanceof Error?e.message:String(e);
  }finally{saving.value=false;}
}
async function archive(row:IndustryCatalogItem){
  if(!canWrite.value||row.is_system||row.is_active===false||saving.value)return;
  if(!(await ask(translate("Архивировать «"+row.name+"»?","Archive “"+row.name+"”?","არქივში გადატანა: "+row.name+"?"))))return;
  saving.value=true;error.value="";
  try{
    await archiveIndustryCatalogItem(props.companyId,kind.value,row.id,row.version);
    await load();
    message.value=translate("Запись архивирована","Entry archived","ჩანაწერი დაარქივებულია");
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{saving.value=false;}
}
</script>

<template>
  <section class="industry-panel" aria-label="Industry reference catalogs">
    <header class="industry-header">
      <div>
        <h3>{{ translate("Отраслевые справочники","Industry catalogs","დარგობრივი ცნობარები") }}</h3>
        <p>{{ translate("Настройки действуют только для выбранной компании.","These entries belong only to the selected company.","ჩანაწერები მხოლოდ არჩეულ კომპანიას ეკუთვნის.") }}</p>
      </div>
      <div class="industry-actions">
        <BaseButton variant="secondary" :disabled="busy" @click="load">
          <RefreshCw :size="16" aria-hidden="true"/>{{translate("Обновить","Refresh","განახლება")}}
        </BaseButton>
        <BaseButton v-if="canWrite" @click="edit(null)">
          <Plus :size="16" aria-hidden="true"/>{{translate("Добавить","Add","დამატება")}}
        </BaseButton>
      </div>
    </header>
    <div class="industry-controls">
      <label>{{translate("Справочник","Catalog","ცნობარი")}}
        <BaseSelect v-model="kind" :aria-label="translate('Справочник','Catalog','ცნობარი')">
          <option v-for="k in kinds" :key="k" :value="k">{{titleFor(k)}}</option>
        </BaseSelect>
      </label>
      <label class="industry-archive">
        <input v-model="showArchived" type="checkbox"/>
        {{translate("Показывать архивные","Show archived","არქივის ჩვენება")}}
      </label>
    </div>
    <p v-if="message" role="status" class="industry-success">{{message}}</p>
    <p v-if="error&&!dialogOpen" role="alert" class="industry-error">{{error}}</p>
    <BaseCard>
      <BaseDataTable :rows="displayed" row-key="id" :columns="columns" :loading="busy"
        :caption="titleFor(kind)" :min-table-width="kind==='model'?780:620">
        <template #cell-name="{row}">{{industryCatalogLabel(row,ui.locale)}}</template>
        <template #cell-parent_id="{row}">{{manufacturerName(row.parent_id)}}</template>
        <template #cell-precision="{row}">{{row.precision??"—"}}</template>
        <template #cell-is_active="{row}">
          {{row.is_active===false?translate("Архив","Archived","არქივი")
            :translate("Активен","Active","აქტიური")}}
        </template>
        <template #cell-actions="{row}">
          <div v-if="canWrite&&row.is_active!==false&&!row.is_system&&row.source!=='hrm'&&row.source!=='erp'" class="industry-row-actions">
            <BaseIconButton :title="translate('Изменить','Edit','რედაქტირება')"
              :aria-label="translate('Изменить: ','Edit: ','რედაქტირება: ')+row.name"
              @click="edit(row)"><Pencil :size="16"/></BaseIconButton>
            <BaseIconButton :title="translate('В архив','Archive','არქივი')"
              :aria-label="translate('Архивировать: ','Archive: ','არქივი: ')+row.name"
              @click="archive(row)"><Archive :size="16"/></BaseIconButton>
          </div>
        </template>
      </BaseDataTable>
    </BaseCard>
    <BaseDialog :open="dialogOpen"
      :title="editing?translate('Изменить запись','Edit entry','ჩანაწერის რედაქტირება')
        :translate('Новая запись','New entry','ახალი ჩანაწერი')" @close="close">
      <form id="industry-catalog-form" class="reference-form" @submit.prevent="save">
        <p v-if="error" class="industry-error" role="alert">{{error}}</p>
        <label v-if="!editing">{{translate("Код","Code","კოდი")}} *
          <input v-model="code" required autocomplete="off" maxlength="80" pattern="(?:[a-zA-Z0-9_]|-)+"
            :disabled="saving" />
          <small v-if="fields.code">{{fields.code[0]}}</small>
        </label>
        <label>{{translate("Наименование","Name","სახელი")}} *
          <input v-model="name" required minlength="2" maxlength="200" autocomplete="off" :disabled="saving"/>
          <small v-if="fields.name">{{fields.name[0]}}</small>
        </label>
        <label v-if="kind==='model'&&!editing">{{translate("Производитель","Manufacturer","მწარმოებელი")}} *
          <BaseSelect v-model="parentId" :disabled="saving"
            :aria-label="translate('Производитель','Manufacturer','მწარმოებელი')">
            <option value="">{{translate("Выберите производителя","Select manufacturer","აირჩიეთ მწარმოებელი")}}</option>
            <option v-for="item in manufacturers" :key="item.id" :value="item.id">{{item.name}}</option>
          </BaseSelect>
          <small v-if="fields.parent_id">{{fields.parent_id[0]}}</small>
        </label>
        <label v-if="kind==='unit'&&!editing">{{translate("Точность количества","Quantity precision","რაოდენობის სიზუსტე")}}
          <BaseSelect v-model="precision" :disabled="saving"
            :aria-label="translate('Точность количества','Quantity precision','რაოდენობის სიზუსტე')">
            <option value="0">{{translate("Целые значения","Whole values","მთელი რიცხვები")}}</option>
            <option value="3">{{translate("До 3 знаков после запятой","Up to 3 decimals","3 ათწილადი")}}</option>
          </BaseSelect>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="close">
          {{translate("Отмена","Cancel","გაუქმება")}}
        </BaseButton>
        <BaseButton type="submit" form="industry-catalog-form" :disabled="saving||!name.trim()||(!editing&&!code.trim())">
          {{translate("Сохранить","Save","შენახვა")}}
        </BaseButton>
      </template>
    </BaseDialog>
    <BaseConfirmDialog :open="confirmOpen" :message="confirmMessage" :title="confirmTitle"
      :confirm-label="confirmLabel" :danger="danger"
      @confirm="settle(true)" @cancel="settle(false)" />
  </section>
</template>

<style scoped>
.industry-panel{display:grid;gap:16px;min-width:0}
.industry-header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.industry-header h3{margin:0;font-size:16px;font-weight:650}
.industry-header p{font-size:12px;color:var(--color-muted);margin:5px 0 0}
.industry-actions{display:flex;flex-wrap:wrap;gap:8px}
.industry-controls{display:flex;align-items:end;gap:16px;flex-wrap:wrap}
.industry-controls>label:first-child{display:grid;gap:7px;min-width:225px;max-width:100%}
.industry-archive{display:inline-flex;align-items:center;gap:8px;min-height:40px;font-size:12px;color:var(--color-muted)}
.industry-archive input{width:18px;height:18px;accent-color:var(--color-primary)}
.industry-row-actions{display:flex;gap:6px;justify-content:flex-end}
.industry-success{margin:0;color:var(--color-primary)}
.industry-error{color:var(--color-danger);margin:0;overflow-wrap:anywhere}
.reference-form{display:grid;gap:16px}
.reference-form label{display:grid;gap:7px;min-width:0;font-size:13px}
.reference-form small{color:var(--color-danger)}
@media(max-width:600px){.industry-controls>label:first-child{width:100%;min-width:0}.industry-actions{width:100%}}
</style>

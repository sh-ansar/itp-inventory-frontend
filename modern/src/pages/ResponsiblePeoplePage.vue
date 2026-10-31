<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { Plus, Pencil, RefreshCw, Users, Info } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import { createResponsiblePerson, getResponsiblePeople, updateResponsiblePerson } from "../api/topology";
import type { ResponsiblePerson, ResponsibleInput } from "../api/topology";
import { InventoryApiError } from "../api/client";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const rows=ref<ResponsiblePerson[]>([]);
const loading=ref(false),issue=ref(""),notice=ref("");
const page=ref(1),perPage=ref(25),total=ref(0),lastPage=ref(1);
const search=ref(""),query=ref(""),status=ref("1");
const formOpen=ref(false),editing=ref<ResponsiblePerson|null>(null),saving=ref(false),formError=ref("");
const fieldErrors=ref<Record<string,string[]>>({});
const fields=reactive<ResponsibleInput>({
  code:"",name:"",position:"",email:"",is_active:true,
});
const original=ref("");
const canWrite=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const columns=computed(()=>[
  {key:"code",label:ui.t("people.code"),minWidth:140},
  {key:"name",label:ui.t("people.name"),minWidth:220},
  {key:"position",label:ui.t("people.position"),minWidth:160},
  {key:"email",label:ui.t("people.email"),minWidth:190},
  {key:"source",label:ui.t("people.source"),minWidth:100},
  {key:"is_active",label:ui.t("table.status"),minWidth:95},
  {key:"assets_count",label:ui.t("people.assetCount"),minWidth:100},
  {key:"actions",label:ui.t("table.actions"),minWidth:90,align:"right" as const},
]);
let ctrl:AbortController|null=null,serial=0;
let timer:ReturnType<typeof setTimeout>|null=null;
watch(search,value=>{
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{page.value=1;query.value=value.trim();},250);
});
watch(()=>props.companyId,()=>{
  rows.value=[];page.value=1;search.value="";query.value="";
  notice.value="";issue.value="";formOpen.value=false;void load();
},{immediate:true});
watch([page,perPage,query,status],()=>{void load()});
async function load(){
  ctrl?.abort();const controller=new AbortController();ctrl=controller;
  const current=++serial;
  if(!props.companyId)return;
  rows.value=[];total.value=0;loading.value=true;issue.value="";
  try{
    const data=await getResponsiblePeople(props.companyId,{
      page:page.value,per_page:perPage.value,search:query.value,active:status.value,
    },controller.signal);
    if(controller.signal.aborted||current!==serial)return;
    rows.value=data.data;total.value=data.total;lastPage.value=Math.max(1,data.last_page);
    if(page.value>lastPage.value)page.value=lastPage.value;
  }catch(e){if(!controller.signal.aborted&&current===serial)
    issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{if(current===serial)loading.value=false;}
}
function openForm(person:ResponsiblePerson|null=null){
  if(!canWrite.value||(person?.source==="hrm"))return;
  editing.value=person;
  fields.code=person?.code??"";fields.name=person?.name??"";
  fields.position=person?.position??"";fields.email=person?.email??"";
  fields.is_active=person?.is_active??true;
  original.value=JSON.stringify(fields);
  fieldErrors.value={};formError.value="";formOpen.value=true;
}
function closeForm(){
  if(saving.value)return;
  if(JSON.stringify(fields)!==original.value&&!window.confirm(ui.t("form.unsaved")))return;
  formOpen.value=false;
}
async function save(){
  if(saving.value||!fields.code.trim()||!fields.name.trim())return;
  saving.value=true;formError.value="";fieldErrors.value={};
  const input:ResponsibleInput={
    code:fields.code.trim(),name:fields.name.trim(),
    position:fields.position?.trim()||null,email:fields.email?.trim()||null,
    is_active:fields.is_active,
  };
  try{
    if(editing.value) await updateResponsiblePerson(props.companyId,editing.value.id,input,editing.value.version);
    else await createResponsiblePerson(props.companyId,input);
    notice.value=ui.t(editing.value?"people.updated":"people.created");
    formOpen.value=false;void load();
  }catch(e){
    if(e instanceof InventoryApiError){formError.value=e.message;fieldErrors.value=e.fields;}
    else formError.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{saving.value=false;}
}
onUnmounted(()=>{ctrl?.abort();if(timer)clearTimeout(timer)});
</script>

<template>
  <div class="people-page">
    <div class="people-header">
      <div><h2>{{ ui.t("people.title") }}</h2>
        <p class="muted">{{ companyName }} · {{ ui.t("people.subtitle") }}</p></div>
      <div class="actions">
        <BaseButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw :size="17" aria-hidden="true"/>{{ ui.t("actions.refresh") }}</BaseButton>
        <BaseButton v-if="canWrite" @click="openForm()">
          <Plus :size="17" aria-hidden="true"/>{{ ui.t("people.new") }}</BaseButton>
      </div>
    </div>
    <p v-if="issue" class="error" role="alert">{{ issue }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <BaseCard class="people-note">
      <Info :size="19" aria-hidden="true"/>
      <p>{{ ui.t("people.hrmFuture") }}</p>
    </BaseCard>
    <BaseCard class="people-content">
      <div class="people-toolbar">
        <BaseSearchField v-model="search" :label="ui.t('people.search')"
          :placeholder="ui.t('people.search')"/>
        <label class="status-filter">
          <span>{{ ui.t("table.status") }}</span>
          <select v-model="status" :aria-label="ui.t('table.status')" @change="page=1">
            <option value="1">{{ ui.t("people.active") }}</option>
            <option value="0">{{ ui.t("people.inactive") }}</option>
            <option value="">{{ ui.t("filter.all") }}</option>
          </select>
        </label>
      </div>
      <BaseDataTable :rows="rows" row-key="id" :columns="columns" :loading="loading"
        :caption="ui.t('people.title')" :empty-title="ui.t('people.empty')"
        :min-table-width="1080">
        <template #cell-source="{row}">{{ ui.t("people.source."+row.source) }}</template>
        <template #cell-is_active="{row}">
          <BaseStatusPill :tone="row.is_active?'success':'neutral'">
            {{ ui.t(row.is_active?'people.active':'people.inactive') }}
          </BaseStatusPill>
        </template>
        <template #cell-email="{row}">{{ row.email||"—" }}</template>
        <template #cell-position="{row}">{{ row.position||"—" }}</template>
        <template #cell-actions="{row}">
          <button v-if="canWrite&&row.source==='manual'" type="button" class="icon-action"
            :title="ui.t('actions.edit')" :aria-label="ui.t('actions.edit')+': '+row.name"
            @click="openForm(row)">
            <Pencil :size="17" aria-hidden="true"/>
          </button>
          <span v-else>—</span>
        </template>
      </BaseDataTable>
      <BasePagination v-if="!loading&&total>0" :page="page" :last-page="lastPage"
        :page-size="perPage" :total="total" :locale="ui.locale"
        :caption="ui.t('people.title')"
        @change:page="page=$event" @change:size="perPage=$event;page=1"/>
    </BaseCard>
    <BaseDialog :open="formOpen" :title="ui.t(editing?'people.edit':'people.new')" @close="closeForm">
      <form id="person-form" class="person-form" @submit.prevent="save">
        <p v-if="formError" class="error" role="alert">{{ formError }}</p>
        <label class="field"><span>{{ ui.t("people.code") }} *</span>
          <input v-model="fields.code" required maxlength="80" :disabled="saving"/>
          <small v-if="fieldErrors.code">{{ fieldErrors.code[0] }}</small>
        </label>
        <label class="field"><span>{{ ui.t("people.name") }} *</span>
          <input v-model="fields.name" required minlength="2" maxlength="255" :disabled="saving"/>
          <small v-if="fieldErrors.name">{{ fieldErrors.name[0] }}</small>
        </label>
        <label class="field"><span>{{ ui.t("people.position") }}</span>
          <input v-model="fields.position" maxlength="200" :disabled="saving"/>
        </label>
        <label class="field"><span>{{ ui.t("people.email") }}</span>
          <input v-model="fields.email" type="email" maxlength="255" :disabled="saving"/>
          <small v-if="fieldErrors.email">{{ fieldErrors.email[0] }}</small>
        </label>
        <label class="active-check"><input v-model="fields.is_active" type="checkbox" :disabled="saving"/>
          {{ ui.t("people.active") }}
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="closeForm">{{ ui.t("actions.cancel") }}</BaseButton>
        <BaseButton type="submit" form="person-form" :disabled="saving||!fields.code.trim()||!fields.name.trim()">
          {{ ui.t("actions.save") }}</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<style scoped>
.people-page{display:grid;gap:18px;min-width:0}
.people-header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.people-header h2{margin:0}.people-header p{margin:6px 0 0}
.actions{display:flex;gap:9px;flex-wrap:wrap}
.people-note{display:flex;align-items:center;gap:12px;color:var(--color-muted);font-size:12px}
.people-note svg{flex:none;color:var(--color-primary)}
.people-note p{margin:0}
.people-content{min-width:0}
.people-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:17px}
.status-filter{display:grid;gap:6px;min-width:150px;font-size:12px;color:var(--color-muted)}
.status-filter select{min-width:150px}
.icon-action{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-text)}
.icon-action:hover{background:var(--color-accent-soft);color:var(--color-primary)}
.person-form{display:grid;gap:14px}
.field{display:grid;gap:7px;font-size:12px;font-weight:500}
.field input{width:100%}
.field small{font-size:11px;color:var(--color-danger)}
.active-check{display:flex;align-items:center;gap:9px;font-size:12px}
@media(max-width:650px){.actions{width:100%}.actions :deep(.base-button){flex:1}.people-toolbar{flex-direction:column;align-items:stretch}.status-filter,.status-filter select{width:100%}}
</style>

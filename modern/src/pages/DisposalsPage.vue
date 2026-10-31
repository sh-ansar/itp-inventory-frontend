<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { FileDown, Plus, RefreshCw } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import { companyAssets } from "../api/inventory";
import type { Asset } from "../api/inventory";
import { listDisposals, submitDisposal, disposalDocumentHref } from "../api/disposals";
import type { AssetDisposal } from "../api/disposals";
import { InventoryApiError } from "../api/client";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const rows=ref<AssetDisposal[]>([]);
const assets=ref<Asset[]>([]);
const loading=ref(false),busy=ref(false),issue=ref(""),notice=ref("");
const page=ref(1),total=ref(0),lastPage=ref(1),search=ref(""),stage=ref("");
const open=ref(false),file=ref<File|null>(null);
const form=ref({asset_id:"",stage:"write_off" as "write_off"|"disposal",
  document_number:"",document_date:"",reason:"",disposal_method:""});
const canApprove=computed(()=>props.role==="company_admin");
const eligible=computed(()=>assets.value.filter(a=>a.status===(form.value.stage==="write_off"?"active":"written_off")));
const selected=computed(()=>assets.value.find(a=>a.id===form.value.asset_id));
const columns=computed(()=>[
  {key:"inventory_number",label:ui.t("table.number"),minWidth:150},
  {key:"asset_name",label:ui.t("table.name"),minWidth:170},
  {key:"stage",label:ui.t("disposal.stage"),minWidth:120},
  {key:"document_number",label:ui.t("disposal.number"),minWidth:160},
  {key:"document_date",label:ui.t("disposal.date"),minWidth:135},
  {key:"actor_name",label:ui.t("disposal.actor"),minWidth:155},
  {key:"documents",label:ui.t("disposal.docs"),minWidth:180},
]);
let controller:AbortController|null=null;let serial=0;
async function load(){
  controller?.abort();const c=new AbortController();controller=c;const current=++serial;
  loading.value=true;issue.value="";
  try{
    const response=await listDisposals(props.companyId,{page:page.value,search:search.value,stage:stage.value},c.signal);
    if(current!==serial||c.signal.aborted)return;
    rows.value=response.data;total.value=response.meta.total;lastPage.value=Math.max(1,response.meta.last_page);
  }catch(e){if(current===serial&&!c.signal.aborted)issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
  finally{if(current===serial)loading.value=false;}
}
async function loadEligible(){
  try{
    const [active,written]=await Promise.all(["active","written_off"].map(status=>
      companyAssets(props.companyId,{page:1,per_page:100,search:"",status,sort:"inventory_number",direction:"asc"})));
    assets.value=[...active.data,...written.data];
  }catch(e){issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
}
watch(()=>props.companyId,()=>{rows.value=[];assets.value=[];page.value=1;search.value="";stage.value="";open.value=false;void load();},{immediate:true});
watch([page,stage],()=>void load());
function start(){open.value=true;file.value=null;form.value={asset_id:"",stage:"write_off",document_number:"",document_date:"",reason:"",disposal_method:""};void loadEligible();}
function onFile(e:Event){const input=e.target as HTMLInputElement;file.value=input.files?.[0]??null;}
function close(){if(busy.value)return;open.value=false;}
async function save(){
  const a=selected.value;
  if(!a||!file.value||busy.value)return;
  if(file.value.size>10*1024*1024){issue.value=ui.t("disposal.document");return;}
  busy.value=true;issue.value="";
  try{
    await submitDisposal(props.companyId,a.id,{
      stage:form.value.stage,version:a.version,document_number:form.value.document_number,
      document_date:form.value.document_date,reason:form.value.reason,
      disposal_method:form.value.disposal_method,document:file.value
    });
    open.value=false;notice.value=ui.t("disposal.saved");await load();
  }catch(e){
    issue.value=e instanceof InventoryApiError&&e.status===409?ui.t("disposal.stale"):
      e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{busy.value=false;}
}
function download(row:AssetDisposal,doc:AssetDisposal["documents"][number]){
  window.location.assign(disposalDocumentHref(props.companyId,row.id,doc.id));
}
onUnmounted(()=>controller?.abort());
</script>

<template>
  <section class="disposal-page">
    <header class="page-heading"><div><h2>{{ui.t("disposal.title")}}</h2><p class="muted">{{ui.t("disposal.subtitle")}} · {{companyName}}</p></div>
      <div class="actions">
        <BaseButton variant="secondary" :disabled="loading" @click="load"><RefreshCw :size="17"/>{{ui.t("actions.refresh")}}</BaseButton>
        <BaseButton v-if="canApprove" @click="start"><Plus :size="17"/>{{ui.t("disposal.new")}}</BaseButton>
      </div>
    </header>
    <p v-if="notice" role="status" class="notice">{{notice}}</p>
    <p v-if="issue&&!open" role="alert" class="error">{{issue}}</p>
    <BaseCard>
      <div class="filters"><label>{{ui.t("disposal.search")}}<input v-model.trim="search" @change="page=1;load()" @keyup.enter="page=1;load()" maxlength="120" /></label>
        <label>{{ui.t("disposal.stage")}}<select v-model="stage" @change="page=1">
          <option value="">{{ui.t("filter.all")}}</option><option value="write_off">{{ui.t("disposal.writeOff")}}</option>
          <option value="disposal">{{ui.t("disposal.dispose")}}</option>
        </select></label></div>
      <BaseDataTable :rows="rows" :columns="columns" row-key="id" :loading="loading"
        :caption="ui.t('disposal.title')" :empty-title="ui.t('disposal.empty')" :min-table-width="1100">
        <template #cell-stage="{row}"><BaseStatusPill :tone="row.stage==='write_off'?'warning':'neutral'">
          {{ui.t(row.stage==="write_off"?"disposal.writeOff":"disposal.dispose")}}</BaseStatusPill></template>
        <template #cell-documents="{row}"><div class="documents">
          <button v-for="doc in row.documents" :key="doc.id" type="button" :title="doc.original_name"
            class="doc-action" @click="download(row,doc)"><FileDown :size="16"/><span>{{doc.original_name}}</span></button>
        </div></template>
      </BaseDataTable>
      <BasePagination v-if="total>0&&!loading" :page="page" :last-page="lastPage" :page-size="25"
        :total="total" :locale="ui.locale" :caption="ui.t('disposal.title')" @change:page="page=$event"/>
    </BaseCard>
    <BaseDialog :open="open" :title="ui.t('disposal.new')" @close="close">
      <p class="muted">{{ui.t("disposal.warning")}}</p>
      <p v-if="issue" role="alert" class="error">{{issue}}</p>
      <form id="disposal-form" class="form" @submit.prevent="save">
        <label>{{ui.t("disposal.stage")}}<select v-model="form.stage" @change="form.asset_id=''">
          <option value="write_off">{{ui.t("disposal.writeOff")}}</option>
          <option value="disposal">{{ui.t("disposal.dispose")}}</option></select></label>
        <label>{{ui.t("disposal.asset")}}<select v-model="form.asset_id" required>
          <option value="" disabled>{{ui.t("disposal.select")}}</option>
          <option v-for="asset in eligible" :key="asset.id" :value="asset.id">{{asset.inventory_number}} · {{asset.name}}</option>
        </select></label>
        <p v-if="!eligible.length" class="muted">{{ui.t("disposal.noAssets")}}</p>
        <label>{{ui.t("disposal.number")}}<input v-model.trim="form.document_number" maxlength="100" required/></label>
        <label>{{ui.t("disposal.date")}}<input v-model="form.document_date" type="date" :max="new Date().toISOString().slice(0,10)" required/></label>
        <label>{{ui.t("disposal.reason")}}<textarea v-model.trim="form.reason" minlength="5" maxlength="3000" rows="3" required/></label>
        <label v-if="form.stage==='disposal'">{{ui.t("disposal.method")}}<input v-model.trim="form.disposal_method" minlength="3" maxlength="200" required/></label>
        <label>{{ui.t("disposal.document")}}<input type="file" accept=".pdf,.png,.jpg,.jpeg" required @change="onFile"/></label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="busy" @click="close">{{ui.t("actions.cancel")}}</BaseButton>
        <BaseButton type="submit" form="disposal-form" :disabled="busy||!file||!selected">{{ui.t("disposal.submit")}}</BaseButton>
      </template>
    </BaseDialog>
  </section>
</template>

<style scoped>
.disposal-page{display:grid;gap:18px;min-width:0}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}.page-heading h2{margin:0}.page-heading p{margin:6px 0 0}.actions{display:flex;gap:8px;flex-wrap:wrap}.filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:17px}.filters label,.form label{display:grid;gap:6px;font-size:var(--font-caption-size);color:var(--color-muted)}.filters label{flex:1;min-width:175px}.form{display:grid;gap:16px}.form input,.form select,.form textarea{width:100%;min-width:0}.documents{display:flex;gap:6px;flex-wrap:wrap}.doc-action{display:flex;align-items:center;gap:6px;border:1px solid var(--color-stroke-strong);background:var(--color-surface);color:var(--color-text);border-radius:var(--radius-sm);padding:7px;max-width:175px;cursor:pointer}.doc-action span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.error{color:var(--color-danger)}.notice{color:var(--color-success)}@media(max-width:600px){.actions{width:100%}.filters{display:grid}.filters label{min-width:0}}
</style>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Archive, ClipboardCheck, FileText, RefreshCw, Search, ShieldCheck } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import AssetDisposalDialog from "../components/registry/AssetDisposalDialog.vue";
import { listDisposalCases } from "../api/disposals";
import type { DisposalCase } from "../api/disposals";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings(),route=useRoute(),router=useRouter();
const rows=ref<DisposalCase[]>([]),loading=ref(false),issue=ref(""),notice=ref("");
const page=ref(1),perPage=ref(25),total=ref(0),lastPage=ref(1);
const search=ref(""),query=ref(""),status=ref("");
const opened=ref<DisposalCase|null>(null);
const columns=computed(()=>[
  {key:"asset",label:ui.t("table.number"),minWidth:145},
  {key:"name",label:ui.t("table.name"),minWidth:195},
  {key:"status",label:ui.t("disposal.stage"),minWidth:140},
  {key:"order_number",label:ui.t("disposal.order"),minWidth:165},
  {key:"documents",label:ui.t("disposal.attachments"),minWidth:105},
  {key:"updated_at",label:ui.t("disposal.lastUpdate"),minWidth:160},
  {key:"actions",label:ui.t("table.actions"),minWidth:120,align:"right" as const},
]);
const activeFilter=computed(()=>status.value);
let ctrl:AbortController|null=null,serial=0,timer:ReturnType<typeof setTimeout>|null=null;
watch(search,value=>{
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{page.value=1;query.value=value.trim();},280);
});
watch(()=>props.companyId,()=>{
  rows.value=[];total.value=0;page.value=1;query.value="";search.value="";
  status.value="";opened.value=null;issue.value="";notice.value="";
  void load();
},{immediate:true});
watch([page,perPage,query,status],()=>{void load()});
watch(()=>route.query.asset,()=>{
  const id=route.query.asset;
  if(typeof id==="string"){
    const row=rows.value.find(item=>item.asset_id===id);
    if(row)opened.value=row;
  }
});

async function load(){
  ctrl?.abort();const controller=new AbortController();ctrl=controller;
  const current=++serial;
  if(!props.companyId)return;
  rows.value=[];total.value=0;issue.value="";loading.value=true;
  try{
    const data=await listDisposalCases(props.companyId,{
      page:page.value,per_page:perPage.value,search:query.value,status:activeFilter.value,
    },controller.signal);
    if(controller.signal.aborted||current!==serial)return;
    rows.value=data.data;total.value=data.meta.total;lastPage.value=Math.max(1,data.meta.last_page);
    if(page.value>lastPage.value)page.value=lastPage.value;
    const fromQuery=route.query.asset;
    if(typeof fromQuery==="string"){
      const row=rows.value.find(item=>item.asset_id===fromQuery);
      if(row)opened.value=row;
    }
  }catch(e){if(!controller.signal.aborted&&current===serial)
    issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{if(current===serial)loading.value=false;}
}
function open(row:DisposalCase){
  opened.value=row;
  void router.replace({query:{...route.query,asset:row.asset_id}});
}
function close(){
  opened.value=null;
  if(route.query.asset)void router.replace({query:{...route.query,asset:undefined}});
}
function updated(){
  notice.value=ui.t("disposal.recordUpdated");
  void load();
}
function prettyDate(value:string){
  return new Date(value).toLocaleString(ui.locale==="ka"?"ka-GE":
    ui.locale==="en"?"en-GB":"ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function tone(value:string):"success"|"warning"|"neutral"{
  return value==="disposed"?"success":value==="submitted"?"warning":"neutral";
}
onUnmounted(()=>{ctrl?.abort();if(timer)clearTimeout(timer);});
</script>

<template>
  <div class="disposals-page">
    <header class="page-heading">
      <div><h2>{{ ui.t("disposal.title") }}</h2>
        <p class="muted">{{ companyName }} · {{ ui.t("disposal.subtitle") }}</p></div>
      <div class="page-actions">
        <BaseButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw :size="17" aria-hidden="true"/>{{ ui.t("actions.refresh") }}
        </BaseButton>
        <router-link class="registry-link" to="/registry">
          <Archive :size="17" aria-hidden="true"/>{{ ui.t("table.assets") }}
        </router-link>
      </div>
    </header>
    <div class="summary-grid">
      <BaseCard class="metric"><ClipboardCheck :size="22" aria-hidden="true"/>
        <div><strong>{{ total.toLocaleString(ui.locale) }}</strong>
          <span class="muted">{{ ui.t("disposal.received") }}</span></div>
      </BaseCard>
      <BaseCard class="metric"><ShieldCheck :size="22" aria-hidden="true"/>
        <div><strong>{{ ui.t("disposal.stage") }}</strong>
          <span class="muted">{{ ui.t("disposal.controlNote") }}</span></div>
      </BaseCard>
    </div>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <BaseCard class="queue-card">
      <div class="toolbar">
        <BaseSearchField v-model="search" :label="ui.t('disposal.search')"
          :placeholder="ui.t('disposal.search')"/>
        <label class="filter-field">
          <span>{{ ui.t("disposal.stage") }}</span>
          <select v-model="status" :aria-label="ui.t('disposal.stage')" @change="page=1">
            <option value="">{{ ui.t("disposal.all") }}</option>
            <option value="draft">{{ ui.t("disposal.stage.draft") }}</option>
            <option value="submitted">{{ ui.t("disposal.stage.submitted") }}</option>
            <option value="approved">{{ ui.t("disposal.stage.approved") }}</option>
            <option value="disposed">{{ ui.t("disposal.stage.disposed") }}</option>
          </select>
        </label>
      </div>
      <BaseDataTable :rows="rows" row-key="id" :columns="columns" :loading="loading"
        :caption="ui.t('disposal.title')" :empty-title="ui.t('disposal.empty')"
        :min-table-width="930">
        <template #cell-asset="{row}"><strong>{{ row.asset.inventory_number }}</strong></template>
        <template #cell-name="{row}"><span class="truncate" :title="row.asset.name">{{ row.asset.name }}</span></template>
        <template #cell-status="{row}">
          <BaseStatusPill :tone="tone(row.status)">
            {{ ui.t("disposal.stage."+row.status) }}
          </BaseStatusPill>
        </template>
        <template #cell-order_number="{row}">{{ row.order_number||"—" }}</template>
        <template #cell-documents="{row}">
          <span class="document-count"><FileText :size="15" aria-hidden="true"/>{{ row.documents.length }}</span>
        </template>
        <template #cell-updated_at="{row}">{{ prettyDate(row.updated_at) }}</template>
        <template #cell-actions="{row}">
          <button type="button" class="open-case" :aria-label="ui.t('disposal.open')+': '+row.asset.inventory_number"
            @click="open(row)">{{ ui.t("disposal.open") }}</button>
        </template>
      </BaseDataTable>
      <BasePagination v-if="!loading&&total>0" :page="page" :last-page="lastPage"
        :page-size="perPage" :total="total" :locale="ui.locale"
        :caption="ui.t('disposal.title')" @change:page="page=$event"
        @change:size="perPage=$event;page=1"/>
    </BaseCard>
    <AssetDisposalDialog :asset-id="opened?.asset_id??null" :company-id="companyId"
      :asset-name="opened?.asset.name" :inventory-number="opened?.asset.inventory_number"
      :asset-version="opened?.asset.version" :asset-status="opened?.asset.status"
      :role="role" @close="close" @changed="updated"/>
  </div>
</template>

<style scoped>
.disposals-page{display:grid;gap:19px;min-width:0}
.page-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}
.page-heading h2{margin:0}.page-heading p{margin:6px 0 0;font-size:12px}
.page-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.registry-link{height:var(--control-height);display:inline-flex;gap:7px;align-items:center;justify-content:center;
  padding:0 12px;border:1px solid var(--color-stroke-strong);background:var(--color-surface);border-radius:var(--radius-sm);
  color:var(--color-text);text-decoration:none;font-size:var(--font-label-size)}
.registry-link:hover{color:var(--color-primary);background:var(--color-hover)}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.metric{display:flex;align-items:center;gap:14px;min-width:0}
.metric>svg{flex:none;color:var(--color-primary)}
.metric>div{display:grid;gap:5px;min-width:0}
.metric strong{font-size:20px;font-weight:600}
.metric span{font-size:11px;line-height:17px}
.queue-card{min-width:0}
.toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:17px}
.filter-field{min-width:190px;display:grid;gap:6px;color:var(--color-muted);font-size:12px}
.filter-field select{width:100%;min-width:190px}
.truncate{max-width:270px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
.document-count{display:flex;align-items:center;gap:7px;color:var(--color-text)}
.document-count svg{color:var(--color-primary)}
.open-case{display:inline-flex;align-items:center;justify-content:center;padding:8px 10px;border:1px solid var(--color-stroke-strong);
  border-radius:var(--radius-sm);color:var(--color-text);background:var(--color-surface);font-size:12px;cursor:pointer}
.open-case:hover{background:var(--color-hover);color:var(--color-primary)}
.error{color:var(--color-danger)}.notice{color:var(--color-success)}
@media(max-width:760px){.toolbar{display:grid;grid-template-columns:1fr}.filter-field{min-width:0}
 .filter-field select{width:100%;min-width:0}.summary-grid{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.page-actions{width:100%}.page-actions :deep(.base-button),.registry-link{flex:1}
 .summary-grid{grid-template-columns:1fr}.metric strong{font-size:17px}}
</style>

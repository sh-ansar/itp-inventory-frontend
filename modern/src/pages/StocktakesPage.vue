<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ClipboardCheck, Plus, RefreshCw, Download } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import StocktakeCreateDialog from "../components/stocktakes/StocktakeCreateDialog.vue";
import { referenceData } from "../api/inventory";
import type { ReferenceData } from "../api/inventory";
import { getFacilityNodes } from "../api/topology";
import type { FacilityNode } from "../api/topology";
import { inventorySessions, inventoryReportHref } from "../api/stocktakes";
import type { InventorySession } from "../api/stocktakes";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings(), route=useRoute(), router=useRouter();
const sessions=ref<InventorySession[]>([]);
const loading=ref(false), issue=ref(""), notice=ref("");
const refs=ref<ReferenceData>({categories:[], accounting_locations:[],physical_locations:[]});
const facilities=ref<FacilityNode[]>([]);
const page=ref(1), perPage=ref(25), total=ref(0), lastPage=ref(1);
const search=ref(""), filteredSearch=ref(""), status=ref("");
const creating=ref(false);
const canWrite=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const selectedFacilityId=computed(()=>{
   const raw=route.query.facility;
   return typeof raw==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw)?raw:"";
 });
 const selectedAssetIds=computed(()=>{
  const raw=route.query.assets;
  if(typeof raw!=="string")return [];
  const ids=raw.split(",").map(s=>s.trim()).filter(s=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s));
  return [...new Set(ids)].slice(0,1000);
});
const columns=computed(()=>[
  {key:"name",label:ui.t("stock.name"),minWidth:240},
  {key:"status",label:ui.t("stock.status"),minWidth:128},
  {key:"progress",label:ui.t("stock.progress"),minWidth:165},
  {key:"discrepancies",label:ui.t("stock.discrepancies"),minWidth:110},
  {key:"created_at",label:ui.t("stock.createdAt"),minWidth:160},
  {key:"created_by_name",label:ui.t("stock.initiator"),minWidth:160},
  {key:"actions",label:ui.t("table.actions"),minWidth:180,align:"right" as const},
]);

let listReq:AbortController|null=null;
let refsReq:AbortController|null=null;
let serial=0,refSerial=0;
let timer:ReturnType<typeof setTimeout>|null=null;
watch(search,value=>{
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{page.value=1;filteredSearch.value=value.trim();},300);
});
watch(()=>props.companyId,id=>{
  sessions.value=[];total.value=0;page.value=1;status.value="";
  search.value="";filteredSearch.value="";issue.value="";notice.value="";creating.value=false;
  refs.value={categories:[],accounting_locations:[],physical_locations:[]};
  facilities.value=[];
  refsReq?.abort();
  const current=++refSerial;
  const ctrl=new AbortController();refsReq=ctrl;
  if(id)void Promise.all([referenceData(id,ctrl.signal),getFacilityNodes(id,ctrl.signal)]).then(([data,map])=>{
    if(current===refSerial&&!ctrl.signal.aborted){refs.value=data;facilities.value=map.data;}
  }).catch(()=>{});
},{immediate:true});
watch([()=>props.companyId,page,perPage,filteredSearch,status],()=>{void load();},{immediate:true});

async function load(){
  listReq?.abort();
  const ctrl=new AbortController();listReq=ctrl;
  const current=++serial;issue.value="";sessions.value=[];total.value=0;
  if(!props.companyId)return;
  loading.value=true;
  try{
    const data=await inventorySessions(props.companyId,{
      page:page.value,per_page:perPage.value,search:filteredSearch.value,status:status.value,
    },ctrl.signal);
    if(ctrl.signal.aborted||current!==serial)return;
    sessions.value=data.data;
    total.value=data.meta.total;
    lastPage.value=Math.max(1,data.meta.last_page);
    if(page.value>lastPage.value&&total.value>0)page.value=lastPage.value;
  }catch(e){
    if(ctrl.signal.aborted||current!==serial)return;
    issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{if(current===serial)loading.value=false;}
}
function created(session:InventorySession){
  creating.value=false;
  void router.push({name:"stocktake",params:{sessionId:session.id}});
}
function formatDate(raw:string|null){
  if(!raw)return "—";
  return new Date(raw).toLocaleString(ui.locale==="en"?"en-GB":ui.locale==="ka"?"ka-GE":"ru-RU");
}
function completion(row:InventorySession){
  if(!row.total_items)return 0;
  return Math.round(row.counted_items/row.total_items*100);
}
onUnmounted(()=>{
  listReq?.abort();refsReq?.abort();
  if(timer)clearTimeout(timer);
});
</script>

<template>
  <div class="stock-page">
    <div class="stock-heading">
      <div><h2>{{ ui.t("stock.title") }}</h2><p class="muted">{{ companyName }}</p></div>
      <div class="stock-actions">
        <BaseButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw :size="17" aria-hidden="true"/>{{ ui.t("actions.refresh") }}
        </BaseButton>
        <BaseButton v-if="canWrite" @click="creating=true">
          <Plus :size="17" aria-hidden="true"/>{{ ui.t("stock.create") }}
        </BaseButton>
      </div>
    </div>
    <div v-if="selectedAssetIds.length||selectedFacilityId" class="selection-notice" role="status">
      <ClipboardCheck :size="19" aria-hidden="true" />
      {{ selectedAssetIds.length ? (selectedAssetIds.length+" "+ui.t("stock.assetsSelected")) :
        (ui.t("stock.facilityNode")+": "+(facilities.find(n=>n.id===selectedFacilityId)?.name??"")) }}
      <BaseButton variant="secondary" @click="creating=true">{{ ui.t("stock.createFromSelected") }}</BaseButton>
      <button type="button" class="clear-selection" @click="router.replace({name:'stocktakes'})"
        :aria-label="ui.t('actions.close')">×</button>
    </div>
    <div v-if="issue" class="error" role="alert">
      {{ issue }} <BaseButton variant="secondary" @click="load">{{ ui.t("actions.retry") }}</BaseButton>
    </div>
    <div class="stock-metrics">
      <BaseCard>
        <ClipboardCheck :size="23" aria-hidden="true"/>
        <strong>{{ total.toLocaleString(ui.locale) }}</strong>
        <span class="muted">{{ ui.t("stock.totalSessions") }}</span>
      </BaseCard>
      <BaseCard>
        <span class="muted">{{ ui.t("table.page") }}</span>
        <strong>{{ page }} / {{ lastPage }}</strong>
      </BaseCard>
    </div>
    <BaseCard class="stock-table-card">
      <div class="stock-toolbar">
        <BaseSearchField v-model="search" :label="ui.t('stock.search')"
          :placeholder="ui.t('stock.search')"/>
        <label class="stock-filter">
          <span>{{ ui.t("stock.status") }}</span>
          <select v-model="status" :aria-label="ui.t('stock.status')" @change="page=1">
            <option value="">{{ ui.t("filter.all") }}</option>
            <option value="in_progress">{{ ui.t("stock.inProgress") }}</option>
            <option value="completed">{{ ui.t("stock.completed") }}</option>
          </select>
        </label>
      </div>
      <BaseDataTable :rows="sessions" row-key="id" :columns="columns" :loading="loading"
        :caption="ui.t('stock.title')" :empty-title="ui.t('stock.empty')" :min-table-width="1030">
        <template #cell-name="{row}">
          <div class="stock-name"><strong :title="row.name">{{ row.name }}</strong>
            <span>{{ row.scope_facility_node_name || row.scope_location_name || (row.scope_type==='selected' ? ui.t('stock.selectedScope') : ui.t('stock.allLocations')) }}</span></div>
        </template>
        <template #cell-status="{row}">
          <BaseStatusPill :tone="row.status==='completed'?'success':'warning'">
            {{ ui.t(row.status==='completed'?'stock.completed':'stock.inProgress') }}
          </BaseStatusPill>
        </template>
        <template #cell-progress="{row}">
          <div class="stock-progress">
            <span>{{ row.counted_items }} / {{ row.total_items }} ({{ completion(row) }}%)</span>
            <progress :value="row.counted_items" :max="Math.max(1,row.total_items)"
              :aria-label="ui.t('stock.progress')"></progress>
          </div>
        </template>
        <template #cell-created_at="{row}">{{ formatDate(row.created_at) }}</template>
        <template #cell-actions="{row}">
          <div class="stock-row-actions">
            <RouterLink class="stock-link" :to="{name:'stocktake',params:{sessionId:row.id}}">
              {{ ui.t("stock.open") }}
            </RouterLink>
            <a class="stock-download" :href="inventoryReportHref(companyId,row.id)"
              :title="ui.t('stock.report')" :aria-label="ui.t('stock.report')+': '+row.name"
              download><Download :size="17" aria-hidden="true"/></a>
          </div>
        </template>
      </BaseDataTable>
      <BasePagination v-if="!loading&&total>0" :page="page" :last-page="lastPage"
        :page-size="perPage" :total="total" :locale="ui.locale" :caption="ui.t('stock.title')"
        @change:page="page=$event" @change:size="perPage=$event;page=1"/>
    </BaseCard>
    <StocktakeCreateDialog :open="creating" :company-id="companyId" :references="refs"
      :selected-asset-ids="selectedAssetIds" :facilities="facilities" :selected-facility-id="selectedFacilityId" @close="creating=false" @created="created"/>
  </div>
</template>

<style scoped>
.stock-page{display:grid;gap:20px;min-width:0}
.stock-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.stock-heading h2{margin:0}.stock-heading p{margin:5px 0 0}
.stock-actions{display:flex;gap:9px;flex-wrap:wrap}
.stock-metrics{display:grid;grid-template-columns:repeat(2,minmax(170px,1fr));gap:14px}
.stock-metrics :deep(.base-card){display:grid;align-content:start;gap:8px}
.stock-metrics strong{font-size:24px;font-weight:600}
.stock-table-card{min-width:0}
.stock-toolbar{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px}
.stock-filter{display:grid;gap:6px;min-width:170px;color:var(--color-muted);font-size:12px}
.stock-filter select{min-width:170px}
.stock-name{display:grid;min-width:0;max-width:360px;gap:5px}
.stock-name strong{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stock-name span{font-size:11px;color:var(--color-muted)}
.stock-progress{display:grid;gap:7px;font-size:12px;white-space:nowrap}
.stock-progress progress{width:100%;max-width:150px;height:8px;accent-color:var(--color-primary)}
.stock-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px}
.stock-link{color:var(--color-text);text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
.stock-link:hover{color:var(--color-primary)}
.stock-download{display:grid;place-items:center;width:35px;height:35px;flex:none;
 border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);color:var(--color-text)}
.stock-download:hover{background:var(--color-accent-soft);color:var(--color-primary)}
.selection-notice{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 15px;border:1px solid var(--color-primary-stroke);background:var(--color-accent-soft);border-radius:var(--radius-sm);font-size:12px}
.selection-notice svg{color:var(--color-primary);flex:none}
.clear-selection{border:0;background:transparent;font-size:23px;color:var(--color-muted);margin-left:auto}
@media(max-width:620px){
 .stock-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
 .stock-metrics strong{font-size:19px}
 .stock-actions{width:100%}
 .stock-actions :deep(.base-button){flex:1}
 .stock-toolbar{align-items:stretch;flex-direction:column}
 .stock-filter,.stock-filter select{width:100%;min-width:0}
}
</style>

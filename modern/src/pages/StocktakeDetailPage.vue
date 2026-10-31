<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeft, Check, ClipboardCheck, Download, History, QrCode, RefreshCw, RotateCcw } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BaseLoadingState from "../components/ui/BaseLoadingState.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import { InventoryApiError } from "../api/client";
import { referenceData } from "../api/inventory";
import type { ReferenceData } from "../api/inventory";
import { getFacilityNodes } from "../api/topology";
import type { FacilityNode } from "../api/topology";
import {
  completeInventorySession, countInventoryItem, getInventorySession,
  inventoryReportHref, inventorySessionEvents, inventorySessionItems,
  reopenInventorySession, scanInventoryQr,
} from "../api/stocktakes";
import type { InventorySession, InventorySessionItem, InventorySessionEvent } from "../api/stocktakes";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings(),route=useRoute(),router=useRouter();
const sessionId=computed(()=>String(route.params.sessionId||""));
const stocktake=ref<InventorySession|null>(null);
const rows=ref<InventorySessionItem[]>([]);
const references=ref<ReferenceData>({categories:[],accounting_locations:[],physical_locations:[]});
const facilities=ref<FacilityNode[]>([]);
const initialLoading=ref(true),loading=ref(false),issue=ref(""),notice=ref("");
const page=ref(1),perPage=ref(25),total=ref(0),lastPage=ref(1);
const search=ref(""),debouncedSearch=ref(""),filter=ref("");
const counting=ref<InventorySessionItem|null>(null);
const actualLocationId=ref(""),actualFacilityId=ref(""),countNote=ref(""),countReason=ref("");
const savingCount=ref(false),countError=ref("");
const scanText=ref(""),scanLocation=ref(""),scanFacility=ref(""),scanNote=ref(""),scanning=ref(false),scanError=ref("");
const scanInput=ref<HTMLInputElement|null>(null);
const action=ref<"complete"|"reopen"|null>(null),actionReason=ref(""),actionBusy=ref(false),actionError=ref("");
const showEvents=ref(false),events=ref<InventorySessionEvent[]>([]),eventsBusy=ref(false),eventsError=ref("");

const canWrite=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const canReopen=computed(()=>props.role==="company_admin");
const active=computed(()=>stocktake.value?.status==="in_progress");
const progress=computed(()=>stocktake.value?.total_items?
  Math.round(stocktake.value.counted_items/stocktake.value.total_items*100):0);
const columns=computed(()=>[
  {key:"inventory_number",label:ui.t("table.number"),minWidth:130},
  {key:"name",label:ui.t("table.name"),minWidth:205},
  {key:"expected_location_name",label:ui.t("stock.expected"),minWidth:160},
  {key:"actual_location_name",label:ui.t("stock.actual"),minWidth:150},
  {key:"is_counted",label:ui.t("stock.checked"),minWidth:125},
  {key:"counted_by_name",label:ui.t("stock.checkedBy"),minWidth:150},
  {key:"actions",label:ui.t("table.actions"),minWidth:140,align:"right" as const},
]);

let listCtrl:AbortController|null=null;
let serial=0,sessionSerial=0;
let searchTimer:ReturnType<typeof setTimeout>|null=null;
watch(search,value=>{
  if(searchTimer)clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{page.value=1;debouncedSearch.value=value.trim();},300);
});
watch(()=>props.companyId,(id,oldId)=>{
  // Do not show data of a previous tenant if the company is changed in the header.
  if(oldId&&oldId!==id)void router.replace({name:"stocktakes"});
});
watch([()=>props.companyId,sessionId],()=>{
  const current=++sessionSerial;
  stocktake.value=null;rows.value=[];references.value={categories:[],accounting_locations:[],physical_locations:[]};
  facilities.value=[];
  issue.value="";notice.value="";page.value=1;search.value="";debouncedSearch.value="";filter.value="";
  showEvents.value=false;counting.value=null;action.value=null;total.value=0;
  initialLoading.value=true;
  if(!props.companyId||!sessionId.value){initialLoading.value=false;return;}
  const currentCompany=props.companyId,currentId=sessionId.value;
  void Promise.all([getInventorySession(currentCompany,currentId),referenceData(currentCompany),getFacilityNodes(currentCompany)]).then(([response,refs,map])=>{
    if(current!==sessionSerial)return;
    stocktake.value=response.data;
    references.value=refs;facilities.value=map.data;
    scanLocation.value=refs.physical_locations[0]?.id||"";
    scanFacility.value=response.data.scope_facility_node_id||map.data[0]?.id||"";
  }).catch(e=>{
    if(current===sessionSerial)issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }).finally(()=>{
    if(current===sessionSerial)initialLoading.value=false;
  });
},{immediate:true});

watch([()=>props.companyId,sessionId,page,perPage,debouncedSearch,filter],()=>{void loadItems();},{immediate:true});

async function loadItems(){
  listCtrl?.abort();
  const ctrl=new AbortController();listCtrl=ctrl;
  const current=++serial;
  rows.value=[];total.value=0;
  if(!props.companyId||!sessionId.value){loading.value=false;return;}
  loading.value=true;
  try{
    const state=filter.value;
    const data=await inventorySessionItems(props.companyId,sessionId.value,{
      page:page.value,per_page:perPage.value,search:debouncedSearch.value,
      counted:state==="pending"?"0":state==="counted"?"1":"",
      discrepancy:state==="discrepancy"?"1":"",
    },ctrl.signal);
    if(current!==serial||ctrl.signal.aborted)return;
    rows.value=data.data;total.value=data.meta.total;
    lastPage.value=Math.max(1,data.meta.last_page);
    if(page.value>lastPage.value&&total.value>0)page.value=lastPage.value;
  }catch(e){
    if(current===serial&&!ctrl.signal.aborted)
      issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{if(current===serial)loading.value=false;}
}
async function refresh(){
  if(!props.companyId||!sessionId.value)return;
  try{
    const response=await getInventorySession(props.companyId,sessionId.value);
    stocktake.value=response.data;
    void loadItems();
  }catch(e){issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
}
function formatDate(raw:string|null){
  return raw?new Date(raw).toLocaleString(ui.locale==="en"?"en-GB":ui.locale==="ka"?"ka-GE":"ru-RU"):"—";
}
function beginCount(row:InventorySessionItem){
  if(!active.value||!canWrite.value)return;
  counting.value=row;
  actualLocationId.value=row.actual_location_id||row.expected_location_id||references.value.physical_locations[0]?.id||"";
  actualFacilityId.value=row.actual_facility_node_id||row.expected_facility_node_id||facilities.value[0]?.id||"";
  countNote.value=row.note||"";countReason.value="";countError.value="";
}
function closeCount(){
  if(savingCount.value)return;
  counting.value=null;
}
async function saveCount(){
  if(!counting.value||savingCount.value||(!counting.value.expected_facility_node_id&&!actualLocationId.value)||
    (counting.value.expected_facility_node_id&&!actualFacilityId.value))return;
  const item=counting.value;
  savingCount.value=true;countError.value="";
  try{
    const data=await countInventoryItem(props.companyId,sessionId.value,item.id,{
      version:item.version,
      ...(item.expected_facility_node_id ? {actual_facility_node_id:actualFacilityId.value} : {actual_location_id:actualLocationId.value}),
      note:countNote.value.trim()||null,
      ...(item.is_counted?{reason:countReason.value.trim()}:{}),
    });
    stocktake.value=data.data.session;
    counting.value=null;
    notice.value=ui.t(item.is_counted?"stock.recountSaved":"stock.countSaved");
    void loadItems();
  }catch(e){countError.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
  finally{savingCount.value=false;}
}

function scanUuid(value:string):string|null{
  const match=value.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i);
  return match?.[0]||null;
}
async function scan(){
  if(!active.value||!canWrite.value||scanning.value||
    !(stocktake.value?.scope_type==="facility"?scanFacility.value:scanLocation.value))return;
  const publicId=scanUuid(scanText.value.trim());
  if(!publicId){scanError.value=ui.t("stock.scanInvalid");return;}
  scanning.value=true;scanError.value="";
  try{
    const response=await scanInventoryQr(props.companyId,sessionId.value,{
      public_id:publicId,
      ...(stocktake.value?.scope_type==="facility"?{actual_facility_node_id:scanFacility.value}:{actual_location_id:scanLocation.value}),
      note:scanNote.value.trim()||null,
    });
    stocktake.value=response.data.session;
    notice.value=ui.t("stock.scanSaved")+" — "+response.data.item.inventory_number;
    scanText.value="";scanNote.value="";
    void loadItems();
    await nextTick();
    scanInput.value?.focus();
  }catch(e){
    scanError.value=e instanceof InventoryApiError && e.status===409
      ?ui.t("stock.scanDuplicate"):e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{scanning.value=false;}
}
async function confirmAction(){
  if(!stocktake.value||!action.value||actionBusy.value)return;
  actionBusy.value=true;actionError.value="";
  try{
    const result=action.value==="complete"
      ?await completeInventorySession(props.companyId,sessionId.value,stocktake.value.version)
      :await reopenInventorySession(props.companyId,sessionId.value,stocktake.value.version,actionReason.value.trim());
    stocktake.value=result.data;
    notice.value=ui.t(action.value==="complete"?"stock.completedNotice":"stock.reopenedNotice");
    action.value=null;actionReason.value="";
    void loadItems();
  }catch(e){actionError.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
  finally{actionBusy.value=false;}
}
async function openEvents(){
  showEvents.value=true;eventsBusy.value=true;eventsError.value="";events.value=[];
  try{
    const response=await inventorySessionEvents(props.companyId,sessionId.value);
    if(showEvents.value)events.value=response.data;
  }catch(e){eventsError.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
  finally{eventsBusy.value=false;}
}
onUnmounted(()=>{listCtrl?.abort();if(searchTimer)clearTimeout(searchTimer);});
</script>

<template>
  <div class="detail-page">
    <div class="detail-heading">
      <div class="detail-heading-text">
        <RouterLink :to="{name:'stocktakes'}" class="back-link"><ArrowLeft :size="16" aria-hidden="true"/>{{ ui.t("stock.back") }}</RouterLink>
        <h2>{{ stocktake?.name||ui.t("stock.title") }}</h2>
        <p class="muted">{{ companyName }}</p>
      </div>
      <div class="detail-actions">
        <BaseButton variant="secondary" @click="refresh"><RefreshCw :size="16" aria-hidden="true"/>{{ ui.t("actions.refresh") }}</BaseButton>
        <BaseButton variant="secondary" @click="openEvents"><History :size="16" aria-hidden="true"/>{{ ui.t("actions.history") }}</BaseButton>
        <a v-if="stocktake" class="download-link" :href="inventoryReportHref(companyId,stocktake.id)" download>
          <Download :size="17" aria-hidden="true"/>{{ ui.t("stock.report") }}
        </a>
      </div>
    </div>
    <BaseLoadingState v-if="initialLoading" :label="ui.t('generic.loading')"/>
    <div v-else-if="issue&&!stocktake" class="error" role="alert">{{ issue }}</div>
    <template v-else-if="stocktake">
      <div v-if="notice" class="notice" role="status">{{ notice }}
        <button type="button" :aria-label="ui.t('actions.close')" @click="notice=''">×</button>
      </div>
      <div class="stock-meta">
        <BaseStatusPill :tone="active?'warning':'success'">{{ ui.t(active?'stock.inProgress':'stock.completed') }}</BaseStatusPill>
        <span class="muted">{{ ui.t("stock.initiator") }}: {{ stocktake.created_by_name }}</span>
        <span class="muted">{{ formatDate(stocktake.created_at) }}</span>
        <span class="muted">{{ stocktake.scope_facility_node_name||stocktake.scope_location_name||ui.t("stock.allLocations") }}</span>
      </div>
      <div class="detail-kpis">
        <BaseCard><ClipboardCheck :size="22" aria-hidden="true"/><strong>{{ stocktake.total_items }}</strong><span class="muted">{{ ui.t("stock.totalAssets") }}</span></BaseCard>
        <BaseCard><Check :size="22" aria-hidden="true"/><strong>{{ stocktake.counted_items }}</strong><span class="muted">{{ ui.t("stock.checked") }}</span></BaseCard>
        <BaseCard><strong>{{ stocktake.missing_items }}</strong><span class="muted">{{ ui.t(active?"stock.pending":"stock.missing") }}</span></BaseCard>
        <BaseCard><strong>{{ stocktake.discrepancies }}</strong><span class="muted">{{ ui.t("stock.discrepancies") }}</span></BaseCard>
      </div>
      <div class="overall-progress">
        <span>{{ ui.t("stock.progress") }} — {{ progress }}%</span>
        <progress :value="stocktake.counted_items" :max="Math.max(1,stocktake.total_items)"
          :aria-label="ui.t('stock.progress')"/>
      </div>
      <BaseCard v-if="active&&canWrite" class="scan-card">
        <div class="scan-heading"><QrCode :size="22" aria-hidden="true"/><div><h3>{{ ui.t("stock.scanTitle") }}</h3>
          <p class="muted">{{ ui.t("stock.scanDescription") }}</p></div></div>
        <form class="scan-form" @submit.prevent="scan">
          <label class="form-field"><span>{{ ui.t("stock.qrCode") }}</span>
            <input ref="scanInput" v-model="scanText" autocomplete="off"
              :disabled="scanning" :placeholder="ui.t('stock.qrPlaceholder')" required/>
          </label>
          <label v-if="stocktake?.scope_type==='facility'" class="form-field">
            <span>{{ ui.t("stock.actual") }} · {{ ui.t("stock.facilityNode") }}</span>
            <select v-model="scanFacility" :disabled="scanning" required>
              <option value="">{{ ui.t("form.none") }}</option>
              <option v-for="node in facilities" :key="node.id" :value="node.id">
                {{ node.name }}</option>
            </select>
          </label>
          <label v-else class="form-field"><span>{{ ui.t("stock.actual") }}</span>
            <select v-model="scanLocation" :disabled="scanning" required>
              <option value="">{{ ui.t("form.none") }}</option>
              <option v-for="loc in references.physical_locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
            </select>
          </label>
          <BaseButton type="submit" :disabled="scanning||!scanText.trim()||!(stocktake?.scope_type==='facility'?scanFacility:scanLocation)">
            <Check :size="17" aria-hidden="true"/>{{ ui.t("stock.scanConfirm") }}
          </BaseButton>
        </form>
        <p v-if="scanError" class="error" role="alert">{{ scanError }}</p>
        <p v-if="stocktake?.scope_type!=='facility'&&!references.physical_locations.length" class="muted">{{ ui.t("stock.needsLocation") }}</p>
      </BaseCard>
      <BaseCard class="items-card">
        <div class="items-heading">
          <div><h3>{{ ui.t("stock.itemList") }}</h3><p class="muted">{{ ui.t("stock.itemListNote") }}</p></div>
          <div class="status-actions">
            <BaseButton v-if="canWrite&&active" @click="action='complete';actionError=''">
              <Check :size="17" aria-hidden="true"/>{{ ui.t("stock.complete") }}
            </BaseButton>
            <BaseButton v-if="canReopen&&!active" variant="secondary"
              @click="action='reopen';actionReason='';actionError=''">
              <RotateCcw :size="17" aria-hidden="true"/>{{ ui.t("stock.reopen") }}
            </BaseButton>
          </div>
        </div>
        <div class="item-toolbar">
          <BaseSearchField v-model="search" :label="ui.t('stock.itemSearch')"
            :placeholder="ui.t('stock.itemSearch')"/>
          <label class="form-field">
            <span>{{ ui.t("stock.filter") }}</span>
            <select v-model="filter" :aria-label="ui.t('stock.filter')" @change="page=1">
              <option value="">{{ ui.t("filter.all") }}</option>
              <option value="pending">{{ ui.t("stock.pending") }}</option>
              <option value="counted">{{ ui.t("stock.checked") }}</option>
              <option value="discrepancy">{{ ui.t("stock.discrepancies") }}</option>
            </select>
          </label>
        </div>
        <div v-if="issue" class="error" role="alert">{{ issue }}</div>
        <BaseDataTable :rows="rows" row-key="id" :columns="columns" :loading="loading"
          :caption="ui.t('stock.itemList')" :empty-title="ui.t('table.empty')" :min-table-width="1040">
          <template #cell-name="{row}"><span class="truncate" :title="row.name">{{ row.name }}</span></template>
          <template #cell-expected_location_name="{row}">{{ row.expected_facility_node_name||row.expected_location_name||"—" }}</template>
          <template #cell-actual_location_name="{row}">{{ row.actual_facility_node_name||row.actual_location_name||"—" }}</template>
          <template #cell-is_counted="{row}">
            <BaseStatusPill :tone="row.is_discrepancy?'warning':row.is_counted?'success':'neutral'">
              {{ ui.t(row.is_discrepancy?'stock.discrepancy':row.is_counted?'stock.checked':'stock.pending') }}
            </BaseStatusPill>
          </template>
          <template #cell-counted_by_name="{row}">{{ row.counted_by_name||"—" }}</template>
          <template #cell-actions="{row}">
            <button v-if="canWrite&&active" class="text-action" type="button"
              :aria-label="ui.t(row.is_counted?'stock.recheck':'stock.markChecked')+': '+row.inventory_number"
              @click="beginCount(row)">{{ ui.t(row.is_counted?'stock.recheck':'stock.markChecked') }}</button>
            <span v-else>—</span>
          </template>
        </BaseDataTable>
        <BasePagination v-if="!loading&&total>0" :page="page" :last-page="lastPage"
          :page-size="perPage" :total="total" :locale="ui.locale" :caption="ui.t('stock.itemList')"
          @change:page="page=$event" @change:size="perPage=$event;page=1"/>
      </BaseCard>
    </template>

    <BaseDialog :open="!!counting" :title="ui.t(counting?.is_counted?'stock.recheck':'stock.markChecked')"
      @close="closeCount">
      <form id="stocktake-count-form" class="drawer-form" @submit.prevent="saveCount">
        <p v-if="counting" class="muted">{{ counting.inventory_number }} — {{ counting.name }}</p>
        <p v-if="countError" class="error" role="alert">{{ countError }}</p>
        <div class="info-field"><span>{{ ui.t("stock.expected") }}</span>
          <strong>{{ counting?.expected_facility_node_name||counting?.expected_location_name||ui.t("form.none") }}</strong></div>
        <label v-if="counting?.expected_facility_node_id" class="form-field">
          <span>{{ ui.t("stock.actual") }} · {{ ui.t("stock.facilityNode") }} *</span>
          <select v-model="actualFacilityId" :disabled="savingCount" required>
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="node in facilities" :key="node.id" :value="node.id">{{ node.name }}</option>
          </select>
        </label>
        <label v-else class="form-field"><span>{{ ui.t("stock.actual") }} *</span>
          <select v-model="actualLocationId" :disabled="savingCount" required>
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="loc in references.physical_locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
          </select>
        </label>
        <label class="form-field"><span>{{ ui.t("stock.note") }}</span>
          <textarea v-model="countNote" maxlength="1000" rows="3" :disabled="savingCount"/>
        </label>
        <label v-if="counting?.is_counted" class="form-field"><span>{{ ui.t("stock.recheckReason") }} *</span>
          <textarea v-model="countReason" minlength="5" maxlength="1000" rows="3"
            :disabled="savingCount" required/>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="savingCount" @click="closeCount">{{ ui.t("actions.cancel") }}</BaseButton>
        <BaseButton type="submit" form="stocktake-count-form"
          :disabled="savingCount||!(counting?.expected_facility_node_id?actualFacilityId:actualLocationId)||(counting?.is_counted&&countReason.trim().length<5)">
          <Check :size="17" aria-hidden="true"/>{{ ui.t("actions.save") }}
        </BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog :open="!!action" :title="ui.t(action==='complete'?'stock.complete':'stock.reopen')"
      @close="action=null">
      <form id="stocktake-action-form" class="drawer-form" @submit.prevent="confirmAction">
        <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
        <p class="muted">{{ ui.t(action==='complete'?'stock.completeWarning':'stock.reopenWarning') }}</p>
        <p v-if="action==='complete'&&stocktake">
          {{ ui.t("stock.missing") }}: <strong>{{ stocktake.missing_items }}</strong>
        </p>
        <label v-if="action==='reopen'" class="form-field">
          <span>{{ ui.t("stock.reopenReason") }} *</span>
          <textarea v-model="actionReason" minlength="10" maxlength="1000" rows="4" required
            :disabled="actionBusy"/>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="actionBusy" @click="action=null">{{ ui.t("actions.cancel") }}</BaseButton>
        <BaseButton type="submit" form="stocktake-action-form"
          :disabled="actionBusy||(action==='reopen'&&actionReason.trim().length<10)">
          {{ ui.t(action==='complete'?'stock.complete':'stock.reopen') }}
        </BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog :open="showEvents" :title="ui.t('actions.history')" size="wide"
      @close="showEvents=false">
      <BaseLoadingState v-if="eventsBusy" :label="ui.t('generic.loading')"/>
      <p v-else-if="eventsError" class="error" role="alert">{{ eventsError }}</p>
      <p v-else-if="!events.length" class="muted">{{ ui.t("history.empty") }}</p>
      <ol v-else class="audit-list">
        <li v-for="event in events" :key="event.id" class="audit-item">
          <div class="audit-top"><strong>{{ ui.t("stock.event."+event.event_type) }}</strong>
            <span>{{ formatDate(event.created_at) }} · v{{ event.version }}</span></div>
          <p class="muted">{{ event.actor_name }}</p>
          <p v-if="event.reason">{{ event.reason }}</p>
        </li>
      </ol>
    </BaseDialog>
  </div>
</template>

<style scoped>
.detail-page{display:grid;gap:18px;min-width:0}
.detail-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
.detail-heading-text{display:grid;gap:7px;min-width:0;flex:1 1 260px}
.detail-heading h2{margin:0;overflow-wrap:anywhere}
.detail-heading p{margin:0}
.back-link{display:flex;align-items:center;gap:7px;color:var(--color-muted);font-size:12px}
.detail-actions,.status-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.download-link{display:flex;align-items:center;gap:8px;min-height:var(--control-height);
 padding:8px 12px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);
 color:var(--color-text);background:var(--color-surface);font-size:12px;text-decoration:none}
.download-link:hover{background:var(--color-accent-soft)}
.stock-meta{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.detail-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.detail-kpis :deep(.base-card){display:grid;justify-items:start;gap:8px}
.detail-kpis strong{font-size:26px;line-height:32px;font-weight:600}
.detail-kpis svg{color:var(--color-primary)}
.overall-progress{display:grid;gap:6px;font-size:12px;color:var(--color-muted)}
.overall-progress progress{width:100%;height:9px;accent-color:var(--color-primary)}
.scan-card,.items-card{min-width:0}
.scan-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
.scan-heading svg{color:var(--color-primary);flex:none}
.scan-heading h3,.items-heading h3{margin:0;font-size:15px}
.scan-heading p,.items-heading p{margin:5px 0 0}
.scan-form{display:grid;grid-template-columns:minmax(150px,1.3fr) minmax(150px,1fr) auto;gap:11px;align-items:end}
.scan-form :deep(.base-button){min-width:155px}
.scan-card>p{margin:12px 0 0}
.items-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.item-toolbar{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px}
.form-field{display:grid;gap:7px;min-width:0;font-size:12px;font-weight:500}
.form-field select,.form-field input,.form-field textarea{width:100%;min-width:0}
.form-field textarea{resize:vertical}
.item-toolbar .form-field{min-width:185px}
.drawer-form{display:grid;gap:17px}
.drawer-form>p{margin:0}
.info-field{display:grid;gap:6px;padding:12px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);font-size:12px}
.info-field span{color:var(--color-muted)}
.info-field strong{font-weight:500}
.text-action{border:0;padding:7px;background:transparent;text-decoration:underline;
 text-underline-offset:3px;font-size:12px;color:var(--color-text)}
.text-action:hover{color:var(--color-primary)}
.truncate{display:block;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.audit-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.audit-item{padding:13px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
.audit-top{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px}
.audit-top strong{font-weight:600}
.audit-top span{color:var(--color-muted)}
.audit-item p{margin:6px 0 0;font-size:12px}
@media(max-width:1000px){.detail-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.scan-form{grid-template-columns:repeat(2,minmax(0,1fr))}.scan-form :deep(.base-button){grid-column:span 2}}
@media(max-width:620px){
 .detail-actions{width:100%}
 .detail-actions :deep(.base-button),.download-link{flex:1;justify-content:center}
 .detail-kpis strong{font-size:22px}
 .item-toolbar{flex-direction:column;align-items:stretch}
 .item-toolbar .form-field,.item-toolbar select{width:100%;min-width:0}
 .scan-form{grid-template-columns:1fr}
 .scan-form :deep(.base-button){grid-column:auto;width:100%}
 .stock-meta{gap:7px}
 .status-actions{width:100%}
 .status-actions :deep(.base-button){flex:1}
}
</style>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Archive, History, Pencil, Plus, RefreshCw, PackageOpen, QrCode, ArrowRightLeft, Route, FileCheck2, Download, UserRoundCheck } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import AssetEditorDialog from "../components/registry/AssetEditorDialog.vue";
import ArchiveAssetDialog from "../components/registry/ArchiveAssetDialog.vue";
import AssetDisposalDialog from "../components/registry/AssetDisposalDialog.vue";
import AssetHistoryDialog from "../components/registry/AssetHistoryDialog.vue";
import QrLabelDialog from "../components/registry/QrLabelDialog.vue";
import MoveAssetDialog from "../components/registry/MoveAssetDialog.vue";
import AssetMovementHistoryDialog from "../components/registry/AssetMovementHistoryDialog.vue";
import { companyAssets, referenceData } from "../api/inventory";
import { bulkAssignCustodian, bulkMoveAssets, registryExportHref } from "../api/parity";
import type { Asset, ReferenceData } from "../api/inventory";
import { getFacilityNodes, getResponsiblePeople } from "../api/topology";
import type { FacilityNode, ResponsiblePerson } from "../api/topology";
import { useUiSettings } from "../stores/uiSettings";

const props = defineProps<{companyId: string; companyName: string; role: string}>();
const ui = useUiSettings();
const router = useRouter();
const selectedKeys = ref<string[]>([]);
const bulkOpen=ref(false),bulkPerson=ref(""),bulkLocation=ref(""),bulkMode=ref<"custodian"|"move">("custodian"),bulkReason=ref(""),bulkBusy=ref(false),bulkError=ref("");
const rows = ref<Asset[]>([]);
const loading = ref(false);
const issue = ref("");
const message = ref("");
const page = ref(1);
const perPage = ref(25);
const total = ref(0);
const lastPage = ref(1);
const search = ref("");
const debouncedSearch = ref("");
const status = ref("");
const facilityFilter=ref("");
const personFilter=ref("");
const facilities=ref<FacilityNode[]>([]);
const people=ref<ResponsiblePerson[]>([]);
const sortKey = ref("inventory_number");
const sortDirection = ref<"asc" | "desc">("asc");
const references = ref<ReferenceData>({
  categories: [], accounting_locations: [], physical_locations: [],
});
const showForm = ref(false);
const editing = ref<Asset | null>(null);
const history = ref<Asset | null>(null);
const archiving = ref<Asset | null>(null);
const disposing = ref<Asset | null>(null);
const qrAsset = ref<Asset | null>(null);
const moving = ref<Asset | null>(null);
const movementHistory = ref<Asset | null>(null);

const canWrite = computed(() => ["company_admin", "inventory_manager"].includes(props.role));
const canArchive = computed(() => props.role === "company_admin");
const selectedAssets = computed(() => rows.value.filter(row => selectedKeys.value.includes(row.id)));
const bulkText = computed(() => ui.locale==="ru" ? {export:"Экспорт Excel",assign:"Назначить МОЛ",title:"Массовое назначение ответственного",reason:"Причина изменения",save:"Назначить выбранным",selected:"Выбрано",note:"Изменения применяются ко всем выбранным активам или не применяются вовсе.",saved:"Ответственные назначены",moved:"Активы перемещены",move:"Переместить выбранные",location:"Новое местонахождение",action:"Операция"} : ui.locale==="ka" ? {export:"Excel ექსპორტი",assign:"პასუხისმგებლის დანიშვნა",title:"პასუხისმგებლის ჯგუფური დანიშვნა",reason:"ცვლილების მიზეზი",save:"დანიშვნა",selected:"არჩეულია",note:"ცვლილება სრულდება ერთიანად ან საერთოდ არ სრულდება.",saved:"პასუხისმგებელი დანიშნულია",moved:"ქონება გადატანილია",move:"არჩეულის გადატანა",location:"ახალი მდებარეობა",action:"ოპერაცია"} : {export:"Export Excel",assign:"Assign custodian",title:"Bulk custodian assignment",reason:"Reason for change",save:"Assign to selected",selected:"Selected",note:"The whole batch succeeds or nothing is changed.",saved:"Custodians assigned",moved:"Assets moved",move:"Move selected assets",location:"New location",action:"Operation"});
const exportHref = computed(() => registryExportHref(props.companyId, Object.fromEntries(Object.entries({search:debouncedSearch.value,status:status.value,facility_node_id:facilityFilter.value,include_descendants:"1",responsible_person_id:personFilter.value}).filter(([,v])=>v))));
async function submitBulk() {
  if (!canWrite.value || bulkBusy.value || selectedAssets.value.length===0 || bulkReason.value.trim().length<5) return;
  if(bulkMode.value==="move"&&!bulkLocation.value)return;
  bulkBusy.value=true;bulkError.value="";
  try {
    const selected=selectedAssets.value.map(a=>({id:a.id,version:a.version}));
    if(bulkMode.value==="move"){
      await bulkMoveAssets(props.companyId,selected,bulkLocation.value,bulkReason.value.trim());
    } else {
      await bulkAssignCustodian(props.companyId,selected,bulkPerson.value||null,bulkReason.value.trim());
    }
    selectedKeys.value=[];bulkOpen.value=false;bulkReason.value="";
    message.value=bulkMode.value==="move"?bulkText.value.moved:bulkText.value.saved;
    await loadAssets();
  } catch(e) {bulkError.value=e instanceof Error?e.message:String(e)} finally{bulkBusy.value=false}
}
const columns = computed(() => [
  { key:"inventory_number", label:ui.t("table.number"), sortable:true, minWidth:135 },
  { key:"name", label:ui.t("table.name"), sortable:true, minWidth:215 },
  { key:"category_name", label:ui.t("table.category"), minWidth:145 },
  { key:"facility_node_name", label:ui.t("asset.facilityNode"), minWidth:185 },
  { key:"responsible_person_name", label:ui.t("asset.responsiblePerson"), minWidth:180 },
  { key:"physical_location_name", label:ui.t("table.location"), minWidth:150 },
  { key:"status", label:ui.t("table.status"), minWidth:110 },
  { key:"actions", label:ui.t("table.actions"), minWidth:320, align:"right" as const },
]);

let requestSerial = 0;
let referenceSerial = 0;
let requestController: AbortController | null = null;
let referenceController: AbortController | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(search, value => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    debouncedSearch.value = value.trim();
  }, 300);
});
watch(() => props.companyId, id => {
  // Clear old tenant state BEFORE any new network request is initiated.
  rows.value = [];
  selectedKeys.value = [];
  bulkOpen.value=false;bulkError.value="";
  total.value = 0;
  issue.value = ""; message.value = "";
  search.value = ""; debouncedSearch.value = "";
  status.value = "";facilityFilter.value="";personFilter.value="";page.value = 1;
  showForm.value = false; editing.value = null;
  history.value = null; archiving.value = null; disposing.value = null;
  qrAsset.value = null; moving.value = null; movementHistory.value = null;
  references.value = { categories: [], accounting_locations: [], physical_locations: [] };
  facilities.value=[];people.value=[];
  referenceController?.abort();
  const controller = new AbortController();
  referenceController = controller;
  const current = ++referenceSerial;
  if (id) void Promise.all([
    referenceData(id,controller.signal),getFacilityNodes(id,controller.signal),
    getResponsiblePeople(id,{per_page:100,active:"1"},controller.signal),
  ]).then(([data,map,persons])=>{
    if (current === referenceSerial && !controller.signal.aborted){
      references.value=data;facilities.value=map.data;people.value=persons.data;
    }
  }).catch(error => {
    if (current === referenceSerial && !controller.signal.aborted) {
      issue.value = error instanceof Error ? error.message : ui.t("generic.unknownError");
    }
  });
}, { immediate:true });

watch(
  [() => props.companyId, page, perPage, debouncedSearch, status, sortKey, sortDirection, facilityFilter, personFilter],
  () => { void loadAssets(); }, { immediate:true },
);

async function loadAssets() {
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const current = ++requestSerial;
  const companyId = props.companyId;
  rows.value = []; total.value = 0;
  issue.value = "";
  if (!companyId) { loading.value = false; return; }
  loading.value = true;
  try {
    const data = await companyAssets(companyId, {
      page: page.value, per_page: perPage.value,
      search: debouncedSearch.value, status: status.value,
      sort: sortKey.value, direction: sortDirection.value,
      facility_node_id:facilityFilter.value||undefined,
      responsible_person_id:personFilter.value||undefined,
      include_descendants:true,
    }, controller.signal);
    if (controller.signal.aborted || current !== requestSerial) return;
    rows.value = data.data;
    total.value = data.meta.total;
    lastPage.value = Math.max(1, data.meta.last_page);
    if (page.value > lastPage.value && total.value > 0) page.value = lastPage.value;
  } catch(e) {
    if (controller.signal.aborted || current !== requestSerial) return;
    issue.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally {
    if (current === requestSerial) loading.value = false;
  }
}
function sortBy(key: string) {
  if (key === sortKey.value) sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  else { sortKey.value = key; sortDirection.value = "asc"; }
  page.value = 1;
}
function changeStatus(event: Event) {
  status.value = (event.target as HTMLSelectElement).value;
  page.value = 1;
}
function createStocktakeForSelected() {
  if (!canWrite.value || selectedKeys.value.length === 0) return;
  void router.push({ name:"stocktakes", query:{ assets: selectedKeys.value.slice(0, 30).join(",") }});
}
function create() { if (!canWrite.value) return; editing.value = null; showForm.value = true; }
function edit(asset: Asset) { if (!canWrite.value) return; editing.value = asset; showForm.value = true; }
function afterSave() {
  message.value = ui.t(editing.value ? "form.saved" : "form.created");
  showForm.value = false; editing.value = null;
  void loadAssets();
}
function afterMove(updated: Asset) {
  moving.value = null;
  message.value = ui.t("movement.saved");
  rows.value = rows.value.map(row => row.id === updated.id ? updated : row);
  void loadAssets();
}
function afterDisposalChanged() {
  message.value = ui.t("disposal.recordUpdated");
  void loadAssets();
}
function afterArchive() {
  archiving.value = null;
  message.value = ui.t("form.archived");
  void loadAssets();
}
onUnmounted(() => {
  requestController?.abort(); referenceController?.abort();
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="asset-page">
    <div class="page-heading">
      <div>
        <h2>{{ ui.t("table.assets") }}</h2>
        <p class="muted">{{ companyName }}</p>
      </div>
      <div class="page-actions">
        <BaseButton variant="secondary" :disabled="loading" :aria-label="ui.t('actions.refresh')"
          @click="loadAssets"><RefreshCw :size="17" aria-hidden="true" /> {{ ui.t("actions.refresh") }}</BaseButton>
        <a class="export-link" :href="exportHref" :download="'inventory-assets.xlsx'"><Download :size="16" aria-hidden="true"/>{{bulkText.export}}</a>
        <BaseButton v-if="canWrite && selectedAssets.length" variant="secondary" @click="bulkMode='custodian';bulkOpen=true"><UserRoundCheck :size="16"/>{{bulkText.assign}} ({{selectedAssets.length}})</BaseButton>
        <BaseButton v-if="canWrite && selectedAssets.length" variant="secondary" @click="bulkMode='move';bulkOpen=true"><ArrowRightLeft :size="16"/>{{bulkText.move}} ({{selectedAssets.length}})</BaseButton>
        <BaseButton v-if="canWrite && selectedKeys.length" variant="secondary" @click="createStocktakeForSelected">
          {{ ui.t("stock.createFromSelected") }} ({{ selectedKeys.length }})
        </BaseButton>
        <BaseButton v-if="canWrite" @click="create"><Plus :size="17" aria-hidden="true" /> {{ ui.t("actions.create") }}</BaseButton>
      </div>
    </div>
    <div class="summary-grid">
      <BaseCard>
        <PackageOpen :size="23" aria-hidden="true"/>
        <div class="summary-value">{{ total.toLocaleString(ui.locale) }}</div>
        <span class="muted">{{ ui.t("table.total") }}</span>
      </BaseCard>
      <BaseCard>
        <div class="summary-value">{{ page }} / {{ lastPage }}</div>
        <span class="muted">{{ ui.t("table.page") }}</span>
      </BaseCard>
    </div>
    <div v-if="message" class="notice" role="status">{{ message }} <button type="button" :aria-label="ui.t('actions.close')" @click="message=''">×</button></div>
    <div v-if="issue" class="error" role="alert">{{ issue }} <BaseButton variant="secondary" @click="loadAssets">{{ ui.t("actions.retry") }}</BaseButton></div>
    <BaseCard class="registry-card">
      <div class="toolbar">
        <BaseSearchField v-model="search" :label="ui.t('table.search')" :placeholder="ui.t('table.search')" />
        <label class="filter-field">
          <span>{{ ui.t("asset.facilityNode") }}</span>
          <select v-model="facilityFilter" :aria-label="ui.t('asset.facilityNode')" @change="page=1">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="node in facilities" :key="node.id" :value="node.id">{{ node.name }}</option>
          </select>
        </label>
        <label class="filter-field">
          <span>{{ ui.t("asset.responsiblePerson") }}</span>
          <select v-model="personFilter" :aria-label="ui.t('asset.responsiblePerson')" @change="page=1">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="person in people" :key="person.id" :value="person.id">{{ person.name }}</option>
          </select>
        </label>
        <label class="filter-field">
          <span>{{ ui.t("filter.status") }}</span>
          <select :value="status" :aria-label="ui.t('filter.status')" @change="changeStatus">
            <option value="">{{ ui.t("filter.all") }}</option>
            <option value="active">{{ ui.t("status.active") }}</option>
            <option value="written_off">{{ ui.t("status.written_off") }}</option>
            <option value="disposed">{{ ui.t("status.disposed") }}</option>
          </select>
        </label>
      </div>
      <BaseDataTable
        :rows="rows" row-key="id" :columns="columns" :loading="loading"
        :selectable="canWrite" :selected-keys="selectedKeys"
        @update:selectedKeys="selectedKeys=$event.slice(0,30)"
        :sort-key="sortKey" :sort-direction="sortDirection"
        :caption="ui.t('table.assets')" :empty-title="ui.t('table.empty')" :min-table-width="1500"
        @sort="sortBy">
        <template #cell-name="{row}">
          <span class="truncate" :title="row.name">{{ row.name }}</span>
        </template>
        <template #cell-category_name="{row}">{{ row.category_name || "—" }}</template>
        <template #cell-facility_node_name="{row}">{{ row.facility_node_name || "—" }}</template>
        <template #cell-responsible_person_name="{row}">{{ row.responsible_person_name || "—" }}</template>
        <template #cell-physical_location_name="{row}">{{ row.physical_location_name || "—" }}</template>
        <template #cell-status="{row}">
          <BaseStatusPill :tone="row.status === 'active' ? 'success' : 'warning'">{{ ui.t("status." + row.status) }}</BaseStatusPill>
        </template>
        <template #cell-actions="{row}">
          <div class="row-actions">
            <button type="button" class="icon-action" :title="ui.t('actions.history')"
              :aria-label="ui.t('actions.history') + ': ' + row.inventory_number"
              @click="history=row"><History :size="17" /></button>
            <button type="button" class="icon-action" :title="ui.t('actions.qr')"
              :aria-label="ui.t('actions.qr') + ': ' + row.inventory_number"
              @click="qrAsset=row"><QrCode :size="17" /></button>
            <button type="button" class="icon-action" :title="ui.t('actions.movements')"
              :aria-label="ui.t('actions.movements') + ': ' + row.inventory_number"
              @click="movementHistory=row"><Route :size="17" /></button>
            <button v-if="canWrite && row.status === 'active'" type="button" class="icon-action" :title="ui.t('actions.move')"
              :aria-label="ui.t('actions.move') + ': ' + row.inventory_number"
              @click="moving=row"><ArrowRightLeft :size="17" /></button>
            <button type="button" class="icon-action" :title="ui.t('disposal.title')"
              :aria-label="ui.t('disposal.open') + ': ' + row.inventory_number"
              @click="disposing=row"><FileCheck2 :size="17" /></button>
            <button v-if="canWrite && row.status === 'active'" type="button" class="icon-action" :title="ui.t('actions.edit')"
              :aria-label="ui.t('actions.edit') + ': ' + row.inventory_number"
              @click="edit(row)"><Pencil :size="17" /></button>
            <button v-if="canArchive && row.status === 'active' && !row.has_disposal_case" type="button" class="icon-action danger-action" :title="ui.t('actions.archive')"
              :aria-label="ui.t('actions.archive') + ': ' + row.inventory_number"
              @click="archiving=row"><Archive :size="17" /></button>
          </div>
        </template>
      </BaseDataTable>
      <BasePagination v-if="!loading && total > 0"
        :page="page" :last-page="lastPage" :page-size="perPage"
        :total="total" :locale="ui.locale" :caption="ui.t('table.assets')"
        @change:page="page=$event"
        @change:size="perPage=$event; page=1" />
    </BaseCard>
    <BaseDialog :open="bulkOpen" :title="bulkMode==='move'?bulkText.move:bulkText.title" @close="!bulkBusy&&(bulkOpen=false)">
      <p class="muted">{{bulkText.selected}}: {{selectedAssets.length}}. {{bulkText.note}}</p>
      <p v-if="bulkError" class="error" role="alert">{{bulkError}}</p>
      <form id="bulk-person-form" class="bulk-form" @submit.prevent="submitBulk">
        <label v-if="bulkMode==='move'">{{bulkText.location}}<select v-model="bulkLocation" required><option value="" disabled>{{ui.t("form.none")}}</option>
          <option v-for="loc in references.physical_locations" :key="loc.id" :value="loc.id">{{loc.name}}</option></select></label>
        <label v-else>{{ui.t("asset.responsiblePerson")}}<select v-model="bulkPerson"><option value="">{{ui.t("form.none")}}</option><option v-for="person in people" :key="person.id" :value="person.id">{{person.name}}</option></select></label>
        <label>{{bulkText.reason}}<textarea v-model="bulkReason" minlength="5" maxlength="1000" required rows="3"/></label>
      </form>
      <template #footer><BaseButton variant="secondary" :disabled="bulkBusy" @click="bulkOpen=false">{{ui.t("actions.cancel")}}</BaseButton><BaseButton type="submit" form="bulk-person-form" :disabled="bulkBusy||bulkReason.trim().length<5||(bulkMode==='move'&&!bulkLocation)">{{bulkMode==='move'?bulkText.move:bulkText.save}}</BaseButton></template>
    </BaseDialog>
    <AssetEditorDialog :open="showForm" :asset="editing" :company-id="companyId"
      :references="references" :facilities="facilities" :people="people" @close="showForm=false" @saved="afterSave" />
    <AssetDisposalDialog :asset-id="disposing?.id??null" :company-id="companyId" :role="role"
      :asset-name="disposing?.name" :inventory-number="disposing?.inventory_number"
      :asset-version="disposing?.version" :asset-status="disposing?.status"
      @close="disposing=null" @changed="afterDisposalChanged"/>
    <ArchiveAssetDialog :asset="archiving" :company-id="companyId"
      @close="archiving=null" @archived="afterArchive"/>
    <AssetHistoryDialog :asset="history" :company-id="companyId" @close="history=null" />
    <QrLabelDialog :asset="qrAsset" @close="qrAsset=null"/>
    <MoveAssetDialog :asset="moving" :company-id="companyId" @close="moving=null" @moved="afterMove"/>
    <AssetMovementHistoryDialog :asset="movementHistory" :company-id="companyId" @close="movementHistory=null"/>
  </div>
</template>

<style scoped>
.export-link{display:flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);text-decoration:none;color:var(--color-text);background:var(--color-surface);font-size:13px}.export-link:hover{background:var(--color-accent-soft)}.bulk-form{display:grid;gap:16px}.bulk-form label{display:grid;gap:6px}.bulk-form select,.bulk-form textarea{width:100%}
.asset-page{display:grid;gap:20px;min-width:0}
.page-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.page-heading h2{margin:0}.page-heading p{margin:6px 0 0}
.page-actions{display:flex;gap:9px;flex-wrap:wrap}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(170px,1fr));gap:14px}
.summary-value{font-size:24px;font-weight:600;line-height:32px;margin-top:10px;color:var(--color-text)}
.registry-card{min-width:0}
.toolbar{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:17px}
.filter-field{display:grid;gap:6px;min-width:170px;font-size:var(--font-caption-size);color:var(--color-muted)}
.filter-field select{min-width:170px}
.truncate{display:block;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;white-space:nowrap}
.icon-action{display:grid;place-items:center;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-text);height:36px;width:36px;cursor:pointer}
.icon-action:hover{color:var(--color-primary);background:var(--color-accent-soft)}
.icon-action.danger-action:hover{color:var(--color-danger);background:var(--color-danger-surface)}
.notice{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--color-success);border-radius:var(--radius-sm);color:var(--color-success);background:var(--color-success-surface);padding:9px 13px;font-size:13px}
.notice button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:20px}
.error{display:flex;justify-content:space-between;gap:12px;align-items:center}
@media(max-width:650px){.page-actions{width:100%}.page-actions :deep(.base-button){flex:1}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar{display:grid;grid-template-columns:1fr}.filter-field select{width:100%}.truncate{max-width:210px}}
</style>

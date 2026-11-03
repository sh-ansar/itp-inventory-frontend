<script setup lang="ts">
import BaseSelect from "../components/ui/BaseSelect.vue";
import BaseMultiSelect from "../components/ui/BaseMultiSelect.vue";
import { computed, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import { Archive, History, Pencil, Plus, RefreshCw, PackageOpen, ClipboardList, QrCode, ArrowRightLeft, Route, FileCheck2, Download, Printer, SlidersHorizontal, UserRoundCheck } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseIconButton from "../components/ui/BaseIconButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import TableSettingsDialog from "../components/ui/TableSettingsDialog.vue";
import { orderAndFilterColumns, useCompanyTablePreferences } from "../composables/useCompanyTablePreferences";
import AssetEditorDialog from "../components/registry/AssetEditorDialog.vue";
import ArchiveAssetDialog from "../components/registry/ArchiveAssetDialog.vue";
import AssetDisposalDialog from "../components/registry/AssetDisposalDialog.vue";
import AssetHistoryDialog from "../components/registry/AssetHistoryDialog.vue";
import QrLabelDialog from "../components/registry/QrLabelDialog.vue";
import BulkQrDialog from "../components/registry/BulkQrDialog.vue";
import MoveAssetDialog from "../components/registry/MoveAssetDialog.vue";
import AssetMovementHistoryDialog from "../components/registry/AssetMovementHistoryDialog.vue";
import { companyAssets, referenceData } from "../api/inventory";
import { listIndustryCatalog } from "../api/industryCatalogs";
import type { IndustryCatalogItem } from "../api/industryCatalogs";
import { bulkAssignCustodian, bulkMoveAssets, registryExportHref } from "../api/parity";
import type { Asset, ReferenceData } from "../api/inventory";
import { getFacilityNodes, getAllActiveResponsiblePeople } from "../api/topology";
import type { FacilityNode, ResponsiblePerson } from "../api/topology";
import { useUiSettings } from "../stores/uiSettings";

const props = defineProps<{companyId: string; companyName: string; role: string}>();
const ui = useUiSettings();
const router = useRouter();
const preferences=useCompanyTablePreferences(toRef(props,"companyId"),"assets",{
  sort_key:"inventory_number",sort_direction:"asc",per_page:25,
});
const settingsOpen=ref(false);
const settingsTitle=computed(()=>ui.locale==="ka"?"ცხრილის პარამეტრები":ui.locale==="en"?"Table settings":"Настройки таблицы");
const selectedKeys = ref<string[]>([]);
const bulkOpen=ref(false),bulkPerson=ref(""),bulkLocation=ref(""),bulkMode=ref<"custodian"|"move">("custodian"),bulkReason=ref(""),bulkBusy=ref(false),bulkError=ref("");
const rows = ref<Asset[]>([]);
const loading = ref(false);
const issue = ref("");
const message = ref("");
const page = ref(1);
const perPage = computed({get:()=>preferences.state.per_page,set:value=>preferences.state.per_page=value});
const total = ref(0);
const lastPage = ref(1);
const search = computed({get:()=>preferences.state.search,set:value=>preferences.state.search=value});
const debouncedSearch = ref("");
const statuses = computed({get:()=>preferences.state.statuses,set:value=>preferences.state.statuses=value});
const facilityFilters=computed({get:()=>preferences.state.facility_node_ids,set:value=>preferences.state.facility_node_ids=value});
const personFilters=computed({get:()=>preferences.state.responsible_person_ids,set:value=>preferences.state.responsible_person_ids=value});
const facilities=ref<FacilityNode[]>([]);
const people=ref<ResponsiblePerson[]>([]);
const manufacturers=ref<IndustryCatalogItem[]>([]);
const models=ref<IndustryCatalogItem[]>([]);
const allOptions=computed(()=>ui.locale==="ka"?"ყველა":ui.locale==="en"?"All":"Все");
const statusOptions=computed(()=>[
  {value:"active",label:ui.t("status.active")},
  {value:"written_off",label:ui.t("status.written_off")},
  {value:"disposed",label:ui.t("status.disposed")},
]);
const facilityOptions=computed(()=>facilities.value.map(node=>({value:node.id,label:node.name})));
const personOptions=computed(()=>people.value.map(person=>({value:person.id,label:person.name})));
const sortKey = computed({get:()=>preferences.state.sort_key,set:value=>preferences.state.sort_key=value});
const sortDirection = computed({get:()=>preferences.state.sort_direction,set:value=>preferences.state.sort_direction=value});
const references = ref<ReferenceData>({
  categories: [], accounting_locations: [], physical_locations: [],
});
const showForm = ref(false);
const editing = ref<Asset | null>(null);
const history = ref<Asset | null>(null);
const archiving = ref<Asset | null>(null);
const disposing = ref<Asset | null>(null);
const qrAsset = ref<Asset | null>(null);
const bulkQrOpen = ref(false);
const moving = ref<Asset | null>(null);
const movementHistory = ref<Asset | null>(null);

const canWrite = computed(() => ["company_admin", "inventory_manager"].includes(props.role));
const canArchive = computed(() => props.role === "company_admin");
const selectedAssets = computed(() => rows.value.filter(row => selectedKeys.value.includes(row.id)));
const qrBulkTitle = computed(() => ui.locale === "ka" ? "QR ეტიკეტების ბეჭდვა" : ui.locale === "en" ? "Print QR labels" : "Печать QR-этикеток");
const bulkText = computed(() => ui.locale==="ru" ? {export:"Экспорт Excel",assign:"Назначить МОЛ",title:"Массовое назначение ответственного",reason:"Причина изменения",save:"Назначить выбранным",selected:"Выбрано",note:"Изменения применяются ко всем выбранным активам или не применяются вовсе.",saved:"Ответственные назначены",moved:"Активы перемещены",move:"Переместить выбранные",location:"Новое местонахождение",action:"Операция"} : ui.locale==="ka" ? {export:"Excel ექსპორტი",assign:"პასუხისმგებლის დანიშვნა",title:"პასუხისმგებლის ჯგუფური დანიშვნა",reason:"ცვლილების მიზეზი",save:"დანიშვნა",selected:"არჩეულია",note:"ცვლილება სრულდება ერთიანად ან საერთოდ არ სრულდება.",saved:"პასუხისმგებელი დანიშნულია",moved:"ქონება გადატანილია",move:"არჩეულის გადატანა",location:"ახალი მდებარეობა",action:"ოპერაცია"} : {export:"Export Excel",assign:"Assign custodian",title:"Bulk custodian assignment",reason:"Reason for change",save:"Assign to selected",selected:"Selected",note:"The whole batch succeeds or nothing is changed.",saved:"Custodians assigned",moved:"Assets moved",move:"Move selected assets",location:"New location",action:"Operation"});
const exportHref = computed(() => registryExportHref(props.companyId,{
  search:debouncedSearch.value,statuses:statuses.value,facility_node_ids:facilityFilters.value,
  responsible_person_ids:personFilters.value,include_descendants:"1",
}));
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

const visibleColumns=computed(()=>orderAndFilterColumns(columns.value,preferences.state));
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
  debouncedSearch.value = "";
  page.value = 1;
  settingsOpen.value = false;
  showForm.value = false; editing.value = null;
  history.value = null; archiving.value = null; disposing.value = null;
  qrAsset.value = null; bulkQrOpen.value = false; moving.value = null; movementHistory.value = null;
  references.value = { categories: [], accounting_locations: [], physical_locations: [] };
  facilities.value=[];people.value=[];manufacturers.value=[];models.value=[];
  referenceController?.abort();
  const controller = new AbortController();
  referenceController = controller;
  const current = ++referenceSerial;
  if (id) void Promise.all([
    referenceData(id,controller.signal),getFacilityNodes(id,controller.signal),
    getAllActiveResponsiblePeople(id,controller.signal),
    listIndustryCatalog(id,"manufacturer",true,controller.signal),
    listIndustryCatalog(id,"model",true,controller.signal),
  ]).then(([data,map,persons,mfrs,productModels])=>{
    if (current === referenceSerial && !controller.signal.aborted){
      references.value=data;facilities.value=map.data;people.value=persons;manufacturers.value=mfrs.data;models.value=productModels.data;
    }
  }).catch(error => {
    if (current === referenceSerial && !controller.signal.aborted) {
      issue.value = error instanceof Error ? error.message : ui.t("generic.unknownError");
    }
  });
}, { immediate:true });

watch(
  [() => props.companyId, page, perPage, debouncedSearch, statuses, sortKey, sortDirection, facilityFilters, personFilters],
  () => { void loadAssets(); }, { immediate:true },
);

async function loadAssets() {
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const current = ++requestSerial;
  const companyId = props.companyId;
  // A selection applies to exactly the loaded page, never to stale filters or tenants.
  selectedKeys.value = [];
  bulkQrOpen.value = false;
  rows.value = []; total.value = 0;
  issue.value = "";
  if (!companyId) { loading.value = false; return; }
  loading.value = true;
  try {
    const data = await companyAssets(companyId, {
      page: page.value, per_page: perPage.value,
      search: debouncedSearch.value, statuses: statuses.value,
      sort: sortKey.value, direction: sortDirection.value,
      facility_node_ids:facilityFilters.value,
      responsible_person_ids:personFilters.value,
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
      </div>
      <div class="page-actions">
        <BaseButton variant="secondary" :title="settingsTitle" :aria-label="settingsTitle"
          :disabled="!preferences.ready.value" @click="settingsOpen=true">
          <SlidersHorizontal :size="17" aria-hidden="true"/><span class="page-action-label">{{settingsTitle}}</span>
        </BaseButton>
        <BaseButton variant="secondary" :disabled="loading" :aria-label="ui.t('actions.refresh')" :title="ui.t('actions.refresh')"
          @click="loadAssets"><RefreshCw :size="17" aria-hidden="true" /><span class="page-action-label">{{ ui.t("actions.refresh") }}</span></BaseButton>
        <a class="export-link" :href="exportHref" :download="'inventory-assets.xlsx'" :title="bulkText.export" :aria-label="bulkText.export"><Download :size="16" aria-hidden="true"/><span class="page-action-label">{{bulkText.export}}</span></a>
        <BaseButton v-if="selectedAssets.length" variant="secondary" :title="qrBulkTitle"
          :aria-label="qrBulkTitle + ' (' + selectedAssets.length + ')'" @click="bulkQrOpen=true">
          <Printer :size="16" aria-hidden="true" /><span class="page-action-label">{{ qrBulkTitle }} ({{ selectedAssets.length }})</span>
        </BaseButton>
        <BaseButton v-if="canWrite && selectedAssets.length" variant="secondary" :title="bulkText.assign" :aria-label="bulkText.assign+' ('+selectedAssets.length+')'" @click="bulkMode='custodian';bulkOpen=true"><UserRoundCheck :size="16"/><span class="page-action-label">{{bulkText.assign}} ({{selectedAssets.length}})</span></BaseButton>
        <BaseButton v-if="canWrite && selectedAssets.length" variant="secondary" :title="bulkText.move" :aria-label="bulkText.move+' ('+selectedAssets.length+')'" @click="bulkMode='move';bulkOpen=true"><ArrowRightLeft :size="16"/><span class="page-action-label">{{bulkText.move}} ({{selectedAssets.length}})</span></BaseButton>
        <BaseButton v-if="canWrite && selectedKeys.length" variant="secondary" :title="ui.t('stock.createFromSelected')" :aria-label="ui.t('stock.createFromSelected')+' ('+selectedKeys.length+')'" @click="createStocktakeForSelected">
          <ClipboardList :size="16" aria-hidden="true"/><span class="page-action-label">{{ ui.t("stock.createFromSelected") }} ({{ selectedKeys.length }})</span>
        </BaseButton>
        <BaseButton v-if="canWrite" :title="ui.t('actions.create')" :aria-label="ui.t('actions.create')" @click="create"><Plus :size="17" aria-hidden="true"/><span class="page-action-label">{{ ui.t("actions.create") }}</span></BaseButton>
      </div>
    </div>
    <div class="summary-grid">
      <BaseCard>
        <PackageOpen :size="23" aria-hidden="true"/>
        <div class="summary-value">{{ total.toLocaleString(ui.locale) }}</div>
        <span class="muted">{{ ui.t("table.total") }}</span>
      </BaseCard>
    </div>
    <div v-if="message" class="notice" role="status">{{ message }} <button type="button" :aria-label="ui.t('actions.close')" @click="message=''">×</button></div>
    <div v-if="issue" class="error" role="alert">{{ issue }} <BaseButton variant="secondary" @click="loadAssets">{{ ui.t("actions.retry") }}</BaseButton></div>
    <BaseCard class="registry-card">
      <div class="toolbar">
        <BaseSearchField v-model="search" :label="ui.t('table.search')" :placeholder="ui.t('table.search')" />
        <div class="filter-field">
          <span>{{ ui.t("asset.facilityNode") }}</span>
          <BaseMultiSelect v-model="facilityFilters" :label="ui.t('asset.facilityNode')"
            :options="facilityOptions" :locale="ui.locale" :all-label="allOptions"
            @update:modelValue="page=1"/>
        </div>
        <div class="filter-field">
          <span>{{ ui.t("asset.responsiblePerson") }}</span>
          <BaseMultiSelect v-model="personFilters" :label="ui.t('asset.responsiblePerson')"
            :options="personOptions" :locale="ui.locale" :all-label="allOptions"
            @update:modelValue="page=1"/>
        </div>
        <div class="filter-field">
          <span>{{ ui.t("filter.status") }}</span>
          <BaseMultiSelect v-model="statuses" :label="ui.t('filter.status')"
            :options="statusOptions" :locale="ui.locale" :all-label="ui.t('filter.all')"
            @update:modelValue="page=1"/>
        </div>
      </div>
      <BaseDataTable
        :rows="rows" row-key="id" :columns="visibleColumns" :loading="loading"
        :selectable="canWrite" :selected-keys="selectedKeys"
        @update:selectedKeys="selectedKeys=$event.slice(0,30)"
        :sort-key="sortKey" :sort-direction="sortDirection"
        :caption="ui.t('table.assets')" :empty-title="ui.t('table.empty')" :min-table-width="Math.max(680,visibleColumns.length*155)"
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
            <BaseIconButton type="button" :title="ui.t('actions.history')"
              :aria-label="ui.t('actions.history') + ': ' + row.inventory_number"
              @click="history=row"><History :size="17" /></BaseIconButton>
            <BaseIconButton type="button" :title="ui.t('actions.qr')"
              :aria-label="ui.t('actions.qr') + ': ' + row.inventory_number"
              @click="qrAsset=row"><QrCode :size="17" /></BaseIconButton>
            <BaseIconButton type="button" :title="ui.t('actions.movements')"
              :aria-label="ui.t('actions.movements') + ': ' + row.inventory_number"
              @click="movementHistory=row"><Route :size="17" /></BaseIconButton>
            <BaseIconButton v-if="canWrite && row.status === 'active'" type="button" :title="ui.t('actions.move')"
              :aria-label="ui.t('actions.move') + ': ' + row.inventory_number"
              @click="moving=row"><ArrowRightLeft :size="17" /></BaseIconButton>
            <BaseIconButton type="button" :title="ui.t('disposal.title')"
              :aria-label="ui.t('disposal.open') + ': ' + row.inventory_number"
              @click="disposing=row"><FileCheck2 :size="17" /></BaseIconButton>
            <BaseIconButton v-if="canWrite && row.status === 'active'" type="button" :title="ui.t('actions.edit')"
              :aria-label="ui.t('actions.edit') + ': ' + row.inventory_number"
              @click="edit(row)"><Pencil :size="17" /></BaseIconButton>
            <BaseIconButton tone="danger" v-if="canArchive && row.status === 'active' && !row.has_disposal_case" type="button" :title="ui.t('actions.archive')"
              :aria-label="ui.t('actions.archive') + ': ' + row.inventory_number"
              @click="archiving=row"><Archive :size="17" /></BaseIconButton>
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
        <label v-if="bulkMode==='move'">{{bulkText.location}}<BaseSelect v-model="bulkLocation" required><option value="" disabled>{{ui.t("form.none")}}</option>
          <option v-for="loc in references.physical_locations" :key="loc.id" :value="loc.id">{{loc.name}}</option></BaseSelect></label>
        <label v-else>{{ui.t("asset.responsiblePerson")}}<BaseSelect v-model="bulkPerson"><option value="">{{ui.t("form.none")}}</option><option v-for="person in people" :key="person.id" :value="person.id">{{person.name}}</option></BaseSelect></label>
        <label>{{bulkText.reason}}<textarea v-model="bulkReason" minlength="5" maxlength="1000" required rows="3"/></label>
      </form>
      <template #footer><BaseButton variant="secondary" :disabled="bulkBusy" @click="bulkOpen=false">{{ui.t("actions.cancel")}}</BaseButton><BaseButton type="submit" form="bulk-person-form" :disabled="bulkBusy||bulkReason.trim().length<5||(bulkMode==='move'&&!bulkLocation)">{{bulkMode==='move'?bulkText.move:bulkText.save}}</BaseButton></template>
    </BaseDialog>
    <AssetEditorDialog :manufacturers="manufacturers" :models="models" :open="showForm" :asset="editing" :company-id="companyId"
      :references="references" :facilities="facilities" :people="people" @close="showForm=false" @saved="afterSave" />
    <AssetDisposalDialog :asset-id="disposing?.id??null" :company-id="companyId" :role="role"
      :asset-name="disposing?.name" :inventory-number="disposing?.inventory_number"
      :asset-version="disposing?.version" :asset-status="disposing?.status"
      @close="disposing=null" @changed="afterDisposalChanged"/>
    <ArchiveAssetDialog :asset="archiving" :company-id="companyId"
      @close="archiving=null" @archived="afterArchive"/>
    <AssetHistoryDialog :asset="history" :company-id="companyId" @close="history=null" />
    <TableSettingsDialog :open="settingsOpen" :columns="columns"
      :hidden-columns="preferences.state.hidden_columns" :column-order="preferences.state.column_order"
      :busy="!preferences.ready.value||preferences.saving.value"
      @close="settingsOpen=false" @reset="preferences.reset()"
      @update:hidden-columns="preferences.state.hidden_columns=$event"
      @update:column-order="preferences.state.column_order=$event"/>
    <QrLabelDialog :asset="qrAsset" @close="qrAsset=null"/>
    <BulkQrDialog :open="bulkQrOpen" :assets="selectedAssets" @close="bulkQrOpen=false"/>
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
.summary-grid{display:grid;grid-template-columns:minmax(0,280px);gap:14px}
.summary-value{font-size:24px;font-weight:600;line-height:32px;margin-top:10px;color:var(--color-text)}
.registry-card{min-width:0}
.toolbar{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:17px}
.filter-field{display:grid;gap:6px;min-width:170px;font-size:var(--font-caption-size);color:var(--color-muted)}
.filter-field select{min-width:170px}
.truncate{display:block;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;white-space:nowrap}
.notice{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--color-success);border-radius:var(--radius-sm);color:var(--color-success);background:var(--color-success-surface);padding:9px 13px;font-size:13px}
.notice button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:20px}
.error{display:flex;justify-content:space-between;gap:12px;align-items:center}
@media(max-width:650px){.page-actions{width:100%}.page-actions :deep(.base-button){flex:1;min-width:44px;justify-content:center}.page-actions .export-link{flex:1;min-width:44px;justify-content:center}.page-actions .page-action-label{display:none}.summary-grid{grid-template-columns:minmax(0,1fr)}.toolbar{display:grid;grid-template-columns:1fr}.filter-field select{width:100%}.truncate{max-width:210px}}
</style>

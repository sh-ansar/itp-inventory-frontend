<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { Archive, History, Pencil, Plus, RefreshCw, PackageOpen } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import AssetEditorDialog from "../components/registry/AssetEditorDialog.vue";
import ArchiveAssetDialog from "../components/registry/ArchiveAssetDialog.vue";
import AssetHistoryDialog from "../components/registry/AssetHistoryDialog.vue";
import { companyAssets, referenceData } from "../api/inventory";
import type { Asset, ReferenceData } from "../api/inventory";
import { useUiSettings } from "../stores/uiSettings";

const props = defineProps<{companyId: string; companyName: string; role: string}>();
const ui = useUiSettings();
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
const sortKey = ref("inventory_number");
const sortDirection = ref<"asc" | "desc">("asc");
const references = ref<ReferenceData>({
  categories: [], accounting_locations: [], physical_locations: [],
});
const showForm = ref(false);
const editing = ref<Asset | null>(null);
const history = ref<Asset | null>(null);
const archiving = ref<Asset | null>(null);

const canWrite = computed(() => ["company_admin", "inventory_manager"].includes(props.role));
const canArchive = computed(() => props.role === "company_admin");
const columns = computed(() => [
  { key:"inventory_number", label:ui.t("table.number"), sortable:true, minWidth:135 },
  { key:"name", label:ui.t("table.name"), sortable:true, minWidth:215 },
  { key:"category_name", label:ui.t("table.category"), minWidth:145 },
  { key:"physical_location_name", label:ui.t("table.location"), minWidth:150 },
  { key:"status", label:ui.t("table.status"), minWidth:110 },
  { key:"actions", label:ui.t("table.actions"), minWidth:124, align:"right" as const },
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
  total.value = 0;
  issue.value = ""; message.value = "";
  search.value = ""; debouncedSearch.value = "";
  status.value = ""; page.value = 1;
  showForm.value = false; editing.value = null;
  history.value = null; archiving.value = null;
  references.value = { categories: [], accounting_locations: [], physical_locations: [] };
  referenceController?.abort();
  const controller = new AbortController();
  referenceController = controller;
  const current = ++referenceSerial;
  if (id) void referenceData(id, controller.signal).then(data => {
    if (current === referenceSerial && !controller.signal.aborted) references.value = data;
  }).catch(error => {
    if (current === referenceSerial && !controller.signal.aborted) {
      issue.value = error instanceof Error ? error.message : ui.t("generic.unknownError");
    }
  });
}, { immediate:true });

watch(
  [() => props.companyId, page, perPage, debouncedSearch, status, sortKey, sortDirection],
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
function create() { if (!canWrite.value) return; editing.value = null; showForm.value = true; }
function edit(asset: Asset) { if (!canWrite.value) return; editing.value = asset; showForm.value = true; }
function afterSave() {
  message.value = ui.t(editing.value ? "form.saved" : "form.created");
  showForm.value = false; editing.value = null;
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
        :sort-key="sortKey" :sort-direction="sortDirection"
        :caption="ui.t('table.assets')" :empty-title="ui.t('table.empty')" :min-table-width="950"
        @sort="sortBy">
        <template #cell-name="{row}">
          <span class="truncate" :title="row.name">{{ row.name }}</span>
        </template>
        <template #cell-category_name="{row}">{{ row.category_name || "—" }}</template>
        <template #cell-physical_location_name="{row}">{{ row.physical_location_name || "—" }}</template>
        <template #cell-status="{row}">
          <BaseStatusPill :tone="row.status === 'active' ? 'success' : 'warning'">{{ ui.t("status." + row.status) }}</BaseStatusPill>
        </template>
        <template #cell-actions="{row}">
          <div class="row-actions">
            <button type="button" class="icon-action" :title="ui.t('actions.history')"
              :aria-label="ui.t('actions.history') + ': ' + row.inventory_number"
              @click="history=row"><History :size="17" /></button>
            <button v-if="canWrite" type="button" class="icon-action" :title="ui.t('actions.edit')"
              :aria-label="ui.t('actions.edit') + ': ' + row.inventory_number"
              @click="edit(row)"><Pencil :size="17" /></button>
            <button v-if="canArchive" type="button" class="icon-action danger-action" :title="ui.t('actions.archive')"
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
    <AssetEditorDialog :open="showForm" :asset="editing" :company-id="companyId"
      :references="references" @close="showForm=false" @saved="afterSave" />
    <ArchiveAssetDialog :asset="archiving" :company-id="companyId"
      @close="archiving=null" @archived="afterArchive"/>
    <AssetHistoryDialog :asset="history" :company-id="companyId" @close="history=null" />
  </div>
</template>

<style scoped>
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
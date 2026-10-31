<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ClipboardCheck } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import { InventoryApiError } from "../../api/client";
import { createInventorySession } from "../../api/stocktakes";
import type { InventorySession } from "../../api/stocktakes";
import type { ReferenceData } from "../../api/inventory";
import type { FacilityNode } from "../../api/topology";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{
  open: boolean;
  companyId: string;
  references: ReferenceData;
  selectedAssetIds?: string[];
  facilities?:FacilityNode[];
  selectedFacilityId?:string|null;
}>();
const emit = defineEmits<{ close: []; created: [session: InventorySession] }>();
const ui = useUiSettings();
const name = ref("");
const locationId = ref("");
const facilityId=ref("");
const saving = ref(false);
const error = ref("");
const validation = ref<Record<string,string[]>>({});
const selectedCount = computed(() => props.selectedAssetIds?.length ?? 0);
const canSubmit = computed(() => name.value.trim().length >= 3 && !saving.value &&
  (selectedCount.value < 1 || selectedCount.value <= 1000));
watch(() => props.open, open => {
  if (open) { name.value=""; locationId.value=""; facilityId.value=props.selectedFacilityId??""; saving.value=false; error.value=""; validation.value={}; }
});
function close() {
  if (saving.value) return;
  if ((name.value.trim() || locationId.value || facilityId.value!== (props.selectedFacilityId??"")) && !window.confirm(ui.t("form.unsaved"))) return;
  emit("close");
}
async function save() {
  if (!canSubmit.value) return;
  saving.value=true; error.value=""; validation.value={};
  try {
    const payload = {
      name: name.value.trim(),
      ...(selectedCount.value ? {asset_ids:props.selectedAssetIds} :
        facilityId.value ? {facility_node_id:facilityId.value} :
        locationId.value ? {scope_location_id:locationId.value} : {}),
    };
    const response = await createInventorySession(props.companyId, payload);
    emit("created", response.data);
  } catch(e) {
    if (e instanceof InventoryApiError) {
      error.value=e.message; validation.value=e.fields;
    } else error.value=e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { saving.value=false; }
}
</script>

<template>
  <BaseDialog :open="open" :title="ui.t('stock.createTitle')" @close="close">
    <form id="stocktake-create-form" class="stocktake-form" @submit.prevent="save">
      <p class="muted">{{ ui.t("stock.snapshotHelp") }}</p>
      <p v-if="error" role="alert" class="error">{{ error }}
        <span v-for="(messages,key) in validation" :key="key" class="stock-validation">{{ messages[0] }}</span>
      </p>
      <label class="stocktake-field">
        <span>{{ ui.t("stock.name") }} *</span>
        <input v-model="name" type="text" minlength="3" maxlength="200"
          autocomplete="off" :disabled="saving" required :placeholder="ui.t('stock.namePlaceholder')"/>
      </label>
      <div v-if="selectedCount" class="stocktake-selection">
        <ClipboardCheck :size="19" aria-hidden="true"/>
        <div><strong>{{ ui.t("stock.selectedScope") }}</strong>
          <span>{{ selectedCount }} {{ ui.t("stock.assetsShort") }}</span></div>
      </div>
      <label v-if="!selectedCount" class="stocktake-field">
        <span>{{ ui.t("stock.facilityNode") }}</span>
        <select v-model="facilityId" :disabled="saving" @change="locationId=''">
          <option value="">{{ ui.t("stock.allLocations") }}</option>
          <option v-for="node in (facilities??[])" :key="node.id" :value="node.id">
            {{ ui.t("topology.type."+node.node_type) }} · {{ node.name }}
          </option>
        </select>
      </label>
      <label v-if="!selectedCount&&!facilityId" class="stocktake-field">
        <span>{{ ui.t("stock.scope") }}</span>
        <select v-model="locationId" :disabled="saving">
          <option value="">{{ ui.t("stock.allLocations") }}</option>
          <option v-for="location in references.physical_locations"
            :key="location.id" :value="location.id">{{ location.name }}</option>
        </select>
      </label>
      <p class="muted stocktake-warning">{{ ui.t("stock.snapshotNote") }}</p>
    </form>
    <template #footer>
      <BaseButton variant="secondary" :disabled="saving" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
      <BaseButton type="submit" form="stocktake-create-form" :disabled="!canSubmit">
        <ClipboardCheck :size="17" aria-hidden="true"/>{{ ui.t("stock.start") }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.stocktake-form{display:grid;gap:18px;min-width:0}
.stocktake-form>p{margin:0}
.stocktake-field{display:grid;gap:7px;font-size:13px;font-weight:500;min-width:0}
.stocktake-field input,.stocktake-field select{min-width:0;width:100%}
.stocktake-selection{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--color-primary-stroke);background:var(--color-accent-soft);border-radius:var(--radius-sm)}
.stocktake-selection svg{flex:none;color:var(--color-primary)}
.stocktake-selection div{display:grid;gap:4px;font-size:13px}
.stocktake-selection div strong{font-weight:600}
.stocktake-selection div span{font-size:12px;color:var(--color-muted)}
.stocktake-warning{padding:10px 12px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
.stock-validation{display:block}
</style>

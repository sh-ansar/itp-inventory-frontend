<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowRightLeft } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import BaseLoadingState from "../ui/BaseLoadingState.vue";
import { InventoryApiError } from "../../api/client";
import { moveAsset, referenceData } from "../../api/inventory";
import type { Asset, ReferenceData } from "../../api/inventory";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{ asset: Asset | null; companyId: string }>();
const emit = defineEmits<{ close: []; moved: [asset: Asset] }>();
const ui = useUiSettings();

const destination = ref("");
const reason = ref("");
const references = ref<ReferenceData>({
  categories: [], accounting_locations: [], physical_locations: [],
});
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const validation = ref<Record<string, string[]>>({});
let fetchSerial = 0;

watch(() => [props.asset?.id, props.companyId], () => {
  const serial = ++fetchSerial;
  destination.value = "";
  reason.value = "";
  error.value = "";
  validation.value = {};
  references.value = { categories: [], accounting_locations: [], physical_locations: [] };
  if (!props.asset || !props.companyId) return;
  loading.value = true;
  void referenceData(props.companyId).then(data => {
    if (fetchSerial === serial) references.value = data;
  }).catch(e => {
    if (fetchSerial === serial)
      error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  }).finally(() => { if (fetchSerial === serial) loading.value = false; });
}, { immediate: true });

const targets = computed(() =>
  references.value.physical_locations.filter(l => l.id !== props.asset?.physical_location_id)
);
const canSave = computed(() => !!props.asset && !loading.value && !saving.value &&
  destination.value.length > 0 && reason.value.trim().length >= 5);

function close() {
  if (saving.value) return;
  if ((destination.value || reason.value.trim()) && !window.confirm(ui.t("form.unsaved"))) return;
  emit("close");
}

async function save() {
  if (!props.asset || !canSave.value) return;
  saving.value = true; error.value = ""; validation.value = {};
  try {
    const response = await moveAsset(props.companyId, props.asset.id, props.asset.version,
      destination.value, reason.value.trim());
    destination.value = ""; reason.value = "";
    emit("moved", response.data.asset);
  } catch(e) {
    if (e instanceof InventoryApiError) {
      validation.value = e.fields;
      error.value = e.status === 409 ? ui.t("form.conflict") : e.message;
    } else error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { saving.value = false; }
}
</script>

<template>
  <BaseDialog :open="!!asset" :title="ui.t('movement.title')" size="default" @close="close">
    <p v-if="asset" class="asset-name">{{ asset.inventory_number }} — {{ asset.name }}</p>
    <BaseLoadingState v-if="loading" :label="ui.t('generic.loading')"/>
    <form v-else id="asset-movement-form" class="movement-form" @submit.prevent="save">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="current-location">
        <span class="muted">{{ ui.t("movement.current") }}</span>
        <strong>{{ asset?.physical_location_name || ui.t("form.none") }}</strong>
      </div>
      <p v-if="targets.length === 0" class="muted">{{ ui.t("movement.noLocations") }}</p>
      <label class="field">
        <span>{{ ui.t("movement.location") }} *</span>
        <select v-model="destination" :disabled="saving || targets.length === 0" required>
          <option value="">{{ ui.t("form.none") }}</option>
          <option v-for="location in targets" :key="location.id" :value="location.id">{{ location.name }}</option>
        </select>
        <small v-if="validation.to_location_id" role="alert">{{ validation.to_location_id[0] }}</small>
      </label>
      <label class="field">
        <span>{{ ui.t("movement.reason") }} *</span>
        <textarea v-model="reason" rows="4" minlength="5" maxlength="1000"
          :disabled="saving" required />
        <small v-if="validation.reason" role="alert">{{ validation.reason[0] }}</small>
      </label>
    </form>
    <template #footer>
      <BaseButton variant="secondary" :disabled="saving" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
      <BaseButton type="submit" form="asset-movement-form" :disabled="!canSave">
        <ArrowRightLeft :size="16" aria-hidden="true"/>{{ ui.t("movement.submit") }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.asset-name{font-size:13px;font-weight:600;margin-top:0}
.movement-form{display:grid;gap:17px;min-width:0}
.current-location{display:grid;gap:4px;border:1px solid var(--color-stroke-strong);background:var(--color-soft);border-radius:var(--radius-sm);padding:10px 12px}
.current-location strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}
.field{display:grid;gap:7px;font-size:13px;font-weight:500}
.field textarea{min-height:100px;resize:vertical;background:var(--color-surface-raised);color:var(--color-text);border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);padding:10px 12px}
.field select{width:100%;min-width:0}
.field small{font-size:12px;font-weight:400;color:var(--color-danger)}
</style>
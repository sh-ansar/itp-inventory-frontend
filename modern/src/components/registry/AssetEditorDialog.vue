<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Save } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import { InventoryApiError } from "../../api/client";
import { createAsset, updateAsset } from "../../api/inventory";
import type { Asset, AssetInput, ReferenceData } from "../../api/inventory";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{
  open: boolean;
  companyId: string;
  asset: Asset | null;
  references: ReferenceData;
}>();
const emit = defineEmits<{close: []; saved: [asset: Asset]}>();
const ui = useUiSettings();
const fields = reactive({
  inventory_number: "", name: "", serial_number: "", description: "",
  category_id: "", accounting_location_id: "", physical_location_id: "",
});
const busy = ref(false);
const error = ref("");
const validation = ref<Record<string,string[]>>({});
const original = ref("");

function normalize() {
  const asset = props.asset;
  fields.inventory_number = asset?.inventory_number ?? "";
  fields.name = asset?.name ?? "";
  fields.serial_number = asset?.serial_number ?? "";
  fields.description = asset?.description ?? "";
  fields.category_id = asset?.category_id ?? "";
  fields.accounting_location_id = asset?.accounting_location_id ?? "";
  fields.physical_location_id = asset?.physical_location_id ?? "";
  original.value = JSON.stringify(fields);
  error.value = "";
  validation.value = {};
}
watch(() => [props.open,props.asset?.id,props.companyId], normalize, { immediate:true });
const dirty = computed(() => JSON.stringify(fields) !== original.value);
const formTitle = computed(() => props.asset ? ui.t("form.editTitle") : ui.t("form.createTitle"));

function close() {
  if (busy.value) return;
  if (dirty.value && !window.confirm(ui.t("form.unsaved"))) return;
  emit("close");
}
function inputData(): AssetInput {
  return {
    inventory_number: fields.inventory_number.trim(),
    name: fields.name.trim(),
    serial_number: fields.serial_number.trim() || null,
    description: fields.description.trim() || null,
    category_id: fields.category_id || null,
    accounting_location_id: fields.accounting_location_id || null,
    physical_location_id: fields.physical_location_id || null,
  };
}
async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  validation.value = {};
  try {
    const response = props.asset
      ? await updateAsset(props.companyId, props.asset.id, props.asset.version, inputData())
      : await createAsset(props.companyId, inputData());
    original.value = JSON.stringify(fields);
    emit("saved", response.data);
  } catch (e) {
    if (e instanceof InventoryApiError) {
      validation.value = e.fields;
      error.value = e.status === 409 ? ui.t("form.conflict") : e.message;
    } else error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { busy.value = false; }
}
</script>

<template>
  <BaseDialog :open="open" :title="formTitle" size="wide" @close="close">
    <form id="asset-editor-form" class="asset-form" @submit.prevent="save">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="form-grid">
        <label class="field">
          <span>{{ ui.t("table.number") }} *</span>
          <input v-model="fields.inventory_number" required maxlength="100" :disabled="busy" autocomplete="off" />
          <small v-if="validation.inventory_number" role="alert">{{ validation.inventory_number[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("table.name") }} *</span>
          <input v-model="fields.name" required minlength="2" maxlength="255" :disabled="busy" autocomplete="off" />
          <small v-if="validation.name" role="alert">{{ validation.name[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("table.serial") }}</span>
          <input v-model="fields.serial_number" maxlength="160" :disabled="busy" autocomplete="off" />
          <small v-if="validation.serial_number" role="alert">{{ validation.serial_number[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("form.category") }}</span>
          <select v-model="fields.category_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in references.categories" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <small v-if="validation.category_id" role="alert">{{ validation.category_id[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("form.accounting") }}</span>
          <select v-model="fields.accounting_location_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in references.accounting_locations" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <small v-if="validation.accounting_location_id" role="alert">{{ validation.accounting_location_id[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("form.physical") }}</span>
          <select v-model="fields.physical_location_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in references.physical_locations" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <small v-if="validation.physical_location_id" role="alert">{{ validation.physical_location_id[0] }}</small>
        </label>
      </div>
      <label class="field">
        <span>{{ ui.t("form.description") }}</span>
        <textarea v-model="fields.description" maxlength="3000" rows="4" :disabled="busy"></textarea>
        <small v-if="validation.description" role="alert">{{ validation.description[0] }}</small>
      </label>
    </form>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
      <BaseButton form="asset-editor-form" type="submit" :disabled="busy || !fields.name.trim() || !fields.inventory_number.trim()">
        <Save :size="16" aria-hidden="true" /> {{ busy ? ui.t("generic.loading") : ui.t("actions.save") }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.asset-form{display:grid;gap:20px}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
.field{display:grid;gap:7px;min-width:0;color:var(--color-text);font-size:var(--font-label-size);font-weight:500}
.field input,.field select,.field textarea{min-width:0;width:100%;background:var(--color-surface-raised);border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);min-height:40px;padding:9px 12px;color:var(--color-text);font-weight:400}
.field textarea{resize:vertical;line-height:1.45}
.field small{color:var(--color-danger);font-size:12px;font-weight:400}
.error{margin:0}
@media(max-width:600px){.form-grid{grid-template-columns:1fr}}
</style>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { BookOpen, Plus, RefreshCw } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import { InventoryApiError } from "../api/client";
import { createCategory, createLocation, referenceData } from "../api/inventory";
import type { RefItem, ReferenceData } from "../api/inventory";
import { useUiSettings } from "../stores/uiSettings";

const props = defineProps<{companyId: string; companyName: string; role: string}>();
const ui = useUiSettings();
type Kind = keyof ReferenceData;
const kinds: Kind[] = ["categories", "accounting_locations", "physical_locations"];
const dictionary = ref<ReferenceData>({categories:[],accounting_locations:[],physical_locations:[]});
const current = ref<Kind>("categories");
const busy = ref(false);
const saving = ref(false);
const issue = ref("");
const message = ref("");
const open = ref(false);
const code = ref("");
const name = ref("");
const errors = ref<Record<string,string[]>>({});
let serial = 0;
let controller: AbortController | null = null;
const canWrite = computed(() => ["company_admin", "inventory_manager"].includes(props.role));
const rows = computed<RefItem[]>(() => dictionary.value[current.value]);
const columns = computed(() => [
  {key:"code",label:ui.t("table.code"),minWidth:125},
  {key:"name",label:ui.t("table.name"),minWidth:300},
]);
const title = computed(() => ui.t(current.value === "categories" ? "references.categories" :
  current.value === "accounting_locations" ? "references.accounting" : "references.physical"));

function nameFor(kind: Kind) {
  return ui.t(kind === "categories" ? "references.categories" :
    kind === "accounting_locations" ? "references.accounting" : "references.physical");
}
async function refresh() {
  controller?.abort();
  const next = new AbortController();
  controller = next;
  const mySerial = ++serial;
  dictionary.value = {categories:[],accounting_locations:[],physical_locations:[]};
  issue.value = "";
  if (!props.companyId) { busy.value = false; return; }
  busy.value = true;
  try {
    const data = await referenceData(props.companyId, next.signal);
    if (serial === mySerial && !next.signal.aborted) dictionary.value = data;
  } catch(e) {
    if (serial === mySerial && !next.signal.aborted)
      issue.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally {
    if (serial === mySerial) busy.value = false;
  }
}
watch(() => props.companyId, () => {
  open.value = false; current.value = "categories";
  message.value = ""; void refresh();
}, {immediate:true});
onUnmounted(() => controller?.abort());

function showCreate() {
  if (!canWrite.value) return;
  code.value = ""; name.value = ""; errors.value = {};
  issue.value = ""; open.value = true;
}
function close() {
  if (saving.value) return;
  if ((code.value.trim() || name.value.trim()) && !window.confirm(ui.t("form.unsaved"))) return;
  open.value = false;
}
async function save() {
  if (!canWrite.value || saving.value || !code.value.trim() || !name.value.trim()) return;
  saving.value = true; errors.value = {}; issue.value = "";
  try {
    if (current.value === "categories")
      await createCategory(props.companyId, code.value.trim(), name.value.trim());
    else
      await createLocation(props.companyId,
        current.value === "accounting_locations" ? "accounting" : "physical",
        code.value.trim(), name.value.trim());
    code.value = ""; name.value = ""; open.value = false;
    message.value = ui.t("form.created");
    await refresh();
  } catch(e) {
    if (e instanceof InventoryApiError) {
      errors.value = e.fields; issue.value = e.message;
    } else issue.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { saving.value = false; }
}
</script>

<template>
  <div class="references-page">
    <div class="page-heading">
      <div><h2>{{ ui.t("heading.references") }}</h2><p class="muted">{{ companyName }} · {{ ui.t("references.note") }}</p></div>
      <div class="page-actions">
        <BaseButton variant="secondary" :disabled="busy" @click="refresh">
          <RefreshCw :size="17" />{{ ui.t("actions.refresh") }}
        </BaseButton>
        <BaseButton v-if="canWrite" @click="showCreate"><Plus :size="17" />{{ ui.t("actions.add") }}</BaseButton>
      </div>
    </div>
    <div class="reference-tabs" role="group" :aria-label="ui.t('references.kind')">
      <button v-for="kind in kinds" :key="kind" type="button"
        :class="{selected: current===kind}" :aria-pressed="current===kind"
        @click="current=kind">
        {{ nameFor(kind) }}
        <span class="count">{{ dictionary[kind].length }}</span>
      </button>
    </div>
    <p v-if="message" class="notice" role="status">{{ message }}</p>
    <div v-if="issue && !open" class="error" role="alert">{{ issue }}</div>
    <BaseCard class="reference-card">
      <div class="reference-heading"><BookOpen :size="21" aria-hidden="true" /><h3>{{ title }}</h3></div>
      <BaseDataTable :rows="rows" row-key="id" :columns="columns" :loading="busy"
        :caption="title" :empty-title="ui.t('references.empty')" :min-table-width="460" />
    </BaseCard>
    <BaseDialog :open="open" :title="title" @close="close">
      <form id="reference-create-form" class="reference-form" @submit.prevent="save">
        <p v-if="issue" class="error" role="alert">{{ issue }}</p>
        <label>{{ ui.t("table.code") }} *
          <input v-model="code" autocomplete="off" required maxlength="60" :disabled="saving"/>
          <small v-if="errors.code">{{ errors.code[0] }}</small>
        </label>
        <label>{{ ui.t("table.name") }} *
          <input v-model="name" autocomplete="off" required minlength="2" maxlength="200" :disabled="saving"/>
          <small v-if="errors.name">{{ errors.name[0] }}</small>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
        <BaseButton type="submit" form="reference-create-form" :disabled="saving || !name.trim() || !code.trim()">
          {{ saving ? ui.t("generic.loading") : ui.t("actions.save") }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<style scoped>
.references-page{display:grid;gap:20px;min-width:0}
.page-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.page-heading h2,.reference-heading h3{margin:0}
.page-heading p{margin:5px 0}
.page-actions{display:flex;gap:9px;flex-wrap:wrap}
.reference-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--color-stroke-strong);padding-bottom:9px}
.reference-tabs button{display:flex;align-items:center;gap:9px;border:1px solid transparent;border-radius:var(--radius-sm);padding:9px 12px;min-height:39px;background:transparent;color:var(--color-muted);cursor:pointer;font-size:13px}
.reference-tabs button.selected{color:var(--color-primary);background:var(--color-accent-soft);border-color:var(--color-primary-stroke)}
.count{display:grid;place-items:center;min-width:23px;height:23px;padding:0 5px;border-radius:50%;background:var(--color-soft);color:var(--color-text);font-size:11px}
.reference-heading{display:flex;align-items:center;gap:9px;margin-bottom:15px}
.reference-form{display:grid;gap:20px}
.reference-form label{display:grid;gap:7px;font-size:13px;font-weight:500}
.reference-form input{width:100%}
.reference-form small{color:var(--color-danger);font-size:12px}
@media(max-width:650px){.page-actions{width:100%}.page-actions :deep(.base-button){flex:1}.reference-tabs button{flex:1;min-width:120px}}
</style>
<script setup lang="ts">
import { ref, watch } from "vue";
import { History } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseLoadingState from "../ui/BaseLoadingState.vue";
import { assetEvents } from "../../api/inventory";
import type { Asset, AssetEvent } from "../../api/inventory";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{asset: Asset | null; companyId: string}>();
const emit = defineEmits<{close: []}>();
const ui = useUiSettings();
const entries = ref<AssetEvent[]>([]);
const loading = ref(false);
const error = ref("");
let serial = 0;

watch(() => [props.asset?.id, props.companyId], async () => {
  const current = ++serial;
  entries.value = []; error.value = "";
  if (!props.asset?.id) return;
  loading.value = true;
  try {
    const data = await assetEvents(props.companyId, props.asset.id);
    if (current !== serial) return;
    entries.value = data.data;
  } catch (e) {
    if (current !== serial) return;
    error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { if (current === serial) loading.value = false; }
}, { immediate: true });

function label(key: string): string {
  const map: Record<string,string> = {
    inventory_number: "table.number", name: "table.name",
    serial_number: "table.serial", description: "form.description",
    category_id: "form.category", accounting_location_id: "form.accounting",
    physical_location_id: "form.physical", physical_location_name: "form.physical", status: "table.status",
  };
  return ui.t(map[key] ?? key);
}
function changes(e: AssetEvent): Array<{name:string, oldValue:string, newValue:string}> {
  const before = e.before ?? {};
  const after = e.after ?? {};
  const fields = e.event_type === "moved" ? ["physical_location_name"] :
    ["inventory_number", "name", "serial_number", "description",
      "category_id", "accounting_location_id", "physical_location_id", "status"];
  return fields.filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(key => ({
      name: label(key),
      oldValue: e.event_type === "created" ? "—" : String(before[key] ?? "—"),
      newValue: String(after[key] ?? "—"),
    }));
}
function date(value: string): string {
  const locale = ui.locale === "ka" ? "ka-GE" : ui.locale === "en" ? "en-GB" : "ru-RU";
  return new Date(value).toLocaleString(locale);
}
</script>

<template>
  <BaseDialog :open="!!asset" :title="ui.t('history.title')" size="wide" @close="emit('close')">
    <p v-if="asset" class="muted">{{ asset.inventory_number }} — {{ asset.name }}</p>
    <BaseLoadingState v-if="loading" />
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="entries.length === 0" class="muted">{{ ui.t("history.empty") }}</p>
    <ol v-else class="event-timeline">
      <li v-for="event in entries" :key="event.id" class="event">
        <div class="event-heading">
          <History :size="16" aria-hidden="true" />
          <strong>{{ ui.t("history." + event.event_type) }}</strong>
          <small>{{ date(event.created_at) }}</small>
        </div>
        <p class="muted">{{ ui.t("history.actor") }}: {{ event.actor_name }} · {{ ui.t("history.version") }}: {{ event.version }}</p>
        <p v-if="event.reason" class="muted">{{ event.reason }}</p>
        <div v-if="changes(event).length" class="event-diffs">
          <div v-for="c in changes(event)" :key="c.name" class="event-diff">
            <span>{{ c.name }}</span>
            <span class="muted">{{ c.oldValue }}</span>
            <span aria-hidden="true">→</span>
            <strong>{{ c.newValue }}</strong>
          </div>
        </div>
      </li>
    </ol>
  </BaseDialog>
</template>

<style scoped>
.event-timeline{margin:0;padding:0;list-style:none;display:grid;gap:16px}
.event{border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);padding:15px}
.event-heading{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.event-heading small{font-size:11px;color:var(--color-muted);margin-left:auto}
.event-diffs{display:grid;gap:8px;margin-top:10px}
.event-diff{display:grid;grid-template-columns:minmax(90px,1fr) minmax(70px,1fr) 18px minmax(70px,1fr);gap:8px;align-items:start;font-size:12px;overflow-wrap:anywhere}
.event-diff strong{font-weight:600}
@media(max-width:550px){.event-diff{grid-template-columns:1fr 1fr}.event-diff > :nth-child(3){display:none}}
</style>
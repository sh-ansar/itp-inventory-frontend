<script setup lang="ts">
import { ref, watch } from "vue";
import { ArrowRight } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseLoadingState from "../ui/BaseLoadingState.vue";
import { assetMovements } from "../../api/inventory";
import type { Asset, AssetMovement } from "../../api/inventory";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{asset: Asset | null; companyId: string}>();
const emit = defineEmits<{close: []}>();
const ui = useUiSettings();
const movements = ref<AssetMovement[]>([]);
const loading = ref(false);
const error = ref("");
let serial = 0;

watch(() => [props.asset?.id, props.companyId], async () => {
  const now = ++serial;
  movements.value = []; error.value = "";
  if (!props.asset?.id) return;
  loading.value = true;
  try {
    const page = await assetMovements(props.companyId, props.asset.id);
    if (now !== serial) return;
    movements.value = page.data;
  } catch(e) {
    if (now === serial) error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { if (now === serial) loading.value = false; }
}, { immediate: true });

function when(value: string): string {
  const lang = ui.locale === "en" ? "en-GB" : ui.locale === "ka" ? "ka-GE" : "ru-RU";
  return new Date(value).toLocaleString(lang);
}
</script>

<template>
  <BaseDialog :open="!!asset" :title="ui.t('actions.movements')" size="wide" @close="emit('close')">
    <p v-if="asset" class="muted">{{ asset.inventory_number }} — {{ asset.name }}</p>
    <BaseLoadingState v-if="loading" :label="ui.t('generic.loading')"/>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="movements.length === 0" class="muted">{{ ui.t("movement.empty") }}</p>
    <ol v-else class="movement-history">
      <li v-for="move in movements" :key="move.id" class="movement-event">
        <div class="event-heading">
          <strong>{{ when(move.created_at) }}</strong>
          <span>{{ ui.t("movement.version") }} {{ move.version }}</span>
        </div>
        <div class="locations">
          <span>{{ move.from_location_name || ui.t("form.none") }}</span>
          <ArrowRight :size="18" aria-hidden="true"/>
          <strong>{{ move.to_location_name }}</strong>
        </div>
        <p class="muted">{{ move.actor_name }}</p>
        <p class="reason">{{ move.reason }}</p>
      </li>
    </ol>
  </BaseDialog>
</template>

<style scoped>
.movement-history{list-style:none;display:grid;gap:12px;margin:0;padding:0}
.movement-event{display:grid;gap:9px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);padding:15px}
.event-heading{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px}
.event-heading strong{font-weight:600}
.event-heading span{color:var(--color-muted)}
.locations{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:13px;overflow-wrap:anywhere}
.locations svg{flex:none;color:var(--color-primary)}
.locations strong{font-weight:600}
.movement-event p{margin:0}
.reason{font-size:12px;color:var(--color-text)}
</style>
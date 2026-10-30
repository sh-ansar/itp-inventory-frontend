<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { ArrowRightLeft, ArrowLeft, QrCode, RefreshCw } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseLoadingState from "../components/ui/BaseLoadingState.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import MoveAssetDialog from "../components/registry/MoveAssetDialog.vue";
import AssetMovementHistoryDialog from "../components/registry/AssetMovementHistoryDialog.vue";
import { InventoryApiError } from "../api/client";
import { resolveQrAsset } from "../api/inventory";
import type { Asset } from "../api/inventory";
import { useUiSettings } from "../stores/uiSettings";

const props = defineProps<{companyId: string; companyName: string; role: string}>();
const route = useRoute();
const ui = useUiSettings();
const token = computed(() => String(route.params.publicId || ""));
const asset = ref<Asset | null>(null);
const loading = ref(false);
const issue = ref("");
const message = ref("");
const move = ref<Asset | null>(null);
const history = ref<Asset | null>(null);
const canWrite = computed(() => ["company_admin","inventory_manager"].includes(props.role));
let serial = 0;

async function load() {
  const active = ++serial;
  asset.value = null;
  issue.value = "";
  message.value = "";
  if (!props.companyId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token.value)) {
    issue.value = ui.t("qr.notFound");
    return;
  }
  loading.value = true;
  try {
    const data = await resolveQrAsset(props.companyId, token.value);
    if (active !== serial) return;
    asset.value = data.data;
  } catch(e) {
    if (active !== serial) return;
    issue.value = e instanceof InventoryApiError && (e.status === 403 || e.status === 404)
      ? ui.t("qr.notFound")
      : e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { if (active === serial) loading.value = false; }
}
watch(() => [props.companyId,token.value], () => { void load(); }, {immediate:true});
function moved(updated: Asset) {
  asset.value = updated;
  move.value = null;
  message.value = ui.t("movement.saved");
}
</script>

<template>
  <div class="scan-page">
    <div class="scan-heading">
      <div><h2>{{ ui.t("qr.scanTitle") }}</h2><p class="muted">{{ companyName }}</p></div>
      <RouterLink to="/assets" class="back-link"><ArrowLeft :size="17" aria-hidden="true"/>{{ ui.t("nav.assets") }}</RouterLink>
    </div>
    <BaseLoadingState v-if="loading" :label="ui.t('qr.load')" />
    <div v-else-if="issue" class="error" role="alert">
      <p>{{ issue }}</p><BaseButton variant="secondary" @click="load"><RefreshCw :size="16"/>{{ ui.t("actions.retry") }}</BaseButton>
    </div>
    <BaseCard v-else-if="asset" class="scan-card">
      <div class="scan-card-heading"><QrCode :size="26" aria-hidden="true"/>
        <div><h3>{{ asset.name }}</h3><p class="muted">{{ asset.inventory_number }}</p></div>
      </div>
      <div class="scan-details">
        <div><span>{{ ui.t("table.status") }}</span><span class="status-value"><BaseStatusPill :tone="asset.status==='active'?'success':'warning'">{{ ui.t("status."+asset.status) }}</BaseStatusPill></span></div>
        <div><span>{{ ui.t("form.category") }}</span><strong>{{ asset.category_name || "—" }}</strong></div>
        <div><span>{{ ui.t("form.accounting") }}</span><strong>{{ asset.accounting_location_name || "—" }}</strong></div>
        <div><span>{{ ui.t("form.physical") }}</span><strong>{{ asset.physical_location_name || "—" }}</strong></div>
        <div><span>{{ ui.t("table.serial") }}</span><strong>{{ asset.serial_number || "—" }}</strong></div>
      </div>
      <p v-if="message" role="status" class="notice">{{ message }}</p>
      <div class="scan-actions">
        <BaseButton variant="secondary" @click="history=asset">{{ ui.t("actions.movements") }}</BaseButton>
        <BaseButton v-if="canWrite && asset.status==='active'" @click="move=asset">
          <ArrowRightLeft :size="17" aria-hidden="true" />{{ ui.t("actions.move") }}
        </BaseButton>
      </div>
    </BaseCard>
    <MoveAssetDialog :asset="move" :company-id="companyId" @close="move=null" @moved="moved"/>
    <AssetMovementHistoryDialog :asset="history" :company-id="companyId" @close="history=null"/>
  </div>
</template>

<style scoped>
.scan-page{display:grid;gap:20px;max-width:800px;margin:0 auto}
.scan-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.scan-heading h2{margin:0}.scan-heading p{margin:5px 0}
.back-link{display:flex;align-items:center;gap:8px;color:var(--color-text);font-size:13px}
.scan-card{min-width:0}
.scan-card-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:20px}
.scan-card-heading svg{color:var(--color-primary);flex:none}
.scan-card-heading h3{margin:0 0 4px;font-size:20px;overflow-wrap:anywhere}
.scan-card-heading p{margin:0}
.scan-details{display:grid;gap:0;border-top:1px solid var(--color-stroke)}
.scan-details>div{display:grid;grid-template-columns:minmax(130px,1fr) minmax(0,1.2fr);gap:12px;padding:12px 0;border-bottom:1px solid var(--color-stroke);align-items:center;font-size:13px}
.scan-details>div>span:first-child{color:var(--color-muted)}
.scan-details strong{font-weight:500;overflow-wrap:anywhere}
.status-value{display:inline-flex;justify-self:start;align-items:center;max-width:100%}
.scan-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:20px}
@media(max-width:600px){.scan-details>div{grid-template-columns:1fr;gap:4px}.scan-actions :deep(.base-button){flex:1;justify-content:center}}
</style>
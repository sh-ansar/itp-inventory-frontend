<script setup lang="ts">
import { computed, ref, watch } from "vue";
import QRCode from "qrcode";
import { Copy, Printer, ExternalLink, QrCode } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import type { Asset } from "../../api/inventory";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{asset: Asset | null}>();
const emit = defineEmits<{close: []}>();
const ui = useUiSettings();
const image = ref("");
const error = ref("");
const copied = ref(false);
let serial = 0;
const link = computed(() => props.asset?.public_id
  ? new URL(import.meta.env.BASE_URL + "scan/" + encodeURIComponent(props.asset.public_id),
      window.location.origin).href
  : ""
);

watch(() => [props.asset?.public_id, link.value], async () => {
  const current = ++serial;
  image.value = "";
  error.value = "";
  copied.value = false;
  if (!props.asset?.public_id) return;
  try {
    const src = await QRCode.toDataURL(link.value, {
      errorCorrectionLevel: "Q", width: 280, margin: 2,
      color: {dark: "#062739", light: "#ffffff"},
    });
    if (current === serial) image.value = src;
  } catch {
    if (current === serial) error.value = ui.t("qr.generateError");
  }
}, {immediate:true});

async function copy() {
  if (!link.value) return;
  try { await navigator.clipboard.writeText(link.value); copied.value = true; }
  catch { error.value = ui.t("generic.unknownError"); }
}
function print() {
  if (image.value && props.asset) window.print();
}
</script>

<template>
  <BaseDialog :open="!!asset" :title="ui.t('qr.title')" size="default" @close="emit('close')">
    <p class="muted">{{ ui.t("qr.subtitle") }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="qr-printable" v-if="asset">
      <div class="qr-label-header"><QrCode :size="20" aria-hidden="true"/><strong>ITP Inventory</strong></div>
      <img v-if="image" :src="image" class="qr-image" alt="QR" width="240" height="240"/>
      <p v-else class="muted">{{ ui.t("generic.loading") }}</p>
      <strong class="qr-number">{{ asset.inventory_number }}</strong>
      <span class="qr-name">{{ asset.name }}</span>
      <span class="qr-id">ID: {{ asset.public_id }}</span>
    </div>
    <label class="qr-link-label">
      <span>{{ ui.t("qr.link") }}</span>
      <input :value="link" readonly :aria-label="ui.t('qr.link')" />
    </label>
    <template #footer>
      <BaseButton variant="secondary" @click="copy"><Copy :size="16" aria-hidden="true"/>{{ copied ? "✓" : ui.t("qr.copy") }}</BaseButton>
      <a v-if="link" class="qr-open" :href="link" target="_blank" rel="noopener noreferrer" :aria-label="ui.t('qr.scanTitle')">
        <ExternalLink :size="16" aria-hidden="true"/>
      </a>
      <BaseButton :disabled="!image" @click="print"><Printer :size="16" aria-hidden="true"/>{{ ui.t("qr.print") }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.qr-printable{display:grid;justify-items:center;gap:8px;margin:8px auto 20px;padding:14px 12px;max-width:340px;border:1px dashed var(--color-stroke-strong);border-radius:var(--radius-sm);text-align:center;background:#fff;color:#062739}
.qr-label-header{display:flex;align-items:center;gap:8px;font-size:13px;color:#062739}
.qr-image{max-width:100%;height:auto;aspect-ratio:1/1;object-fit:contain;image-rendering:auto}
.qr-number{font-size:17px;overflow-wrap:anywhere;color:#062739}
.qr-name{font-size:12px;overflow-wrap:anywhere;color:#062739}
.qr-id{font-size:8px;overflow-wrap:anywhere;color:#556976}
.qr-link-label{display:grid;gap:7px;font-size:12px;font-weight:500;min-width:0}
.qr-link-label input{font-size:11px;width:100%;min-width:0}
.qr-open{display:grid;place-items:center;min-width:38px;min-height:38px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);color:var(--color-text);background:var(--color-surface)}
.qr-open:hover{color:var(--color-primary);background:var(--color-accent-soft)}
@media print{
  @page { size: auto; margin: 10mm; }
  body * { visibility:hidden!important; }
  .qr-printable,.qr-printable *{visibility:visible!important;}
  .qr-printable{position:fixed!important;top:0!important;left:0!important;width:75mm!important;max-width:75mm!important;border:1px solid #999!important;box-shadow:none!important;padding:3mm!important;margin:0!important;print-color-adjust:exact!important;}
  .qr-image{width:55mm!important;height:55mm!important;}
}
</style>
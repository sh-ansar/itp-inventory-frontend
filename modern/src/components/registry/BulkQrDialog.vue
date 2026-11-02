<script setup lang="ts">
import { computed, ref, watch } from "vue";
import QRCode from "qrcode";
import { Printer, QrCode } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import BaseLoadingState from "../ui/BaseLoadingState.vue";
import type { Asset } from "../../api/inventory";
import { bulkQrPrintDocument, inventoryQrUrl } from "../../utils/inventoryQr";
import type { PrintableQrLabel } from "../../utils/inventoryQr";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{ open: boolean; assets: Asset[] }>();
const emit = defineEmits<{ close: [] }>();
const ui = useUiSettings();
const labels = ref<PrintableQrLabel[]>([]);
const generating = ref(false);
const error = ref("");
let request = 0;

const words = computed(() => ui.locale === "ka"
  ? {
      title: "QR ეტიკეტების ჯგუფური ბეჭდვა",
      selected: "არჩეული ეტიკეტები",
      limit: "ერთ ჯერზე მაქსიმუმ 30 ჩანაწერი",
      print: "ბეჭდვა A4-ზე",
      cancel: "დახურვა",
      missing: "ერთ ან რამდენიმე ჩანაწერს არ აქვს QR იდენტიფიკატორი",
      failed: "QR ეტიკეტების შექმნა ვერ მოხერხდა",
      popup: "ბეჭდვის ფანჯარა დაბლოკილია ბრაუზერში",
    }
  : ui.locale === "en"
    ? {
        title: "Print selected QR labels",
        selected: "Selected labels",
        limit: "Up to 30 labels per batch",
        print: "Print on A4",
        cancel: "Close",
        missing: "One or more assets lack a QR identifier",
        failed: "Could not generate QR labels",
        popup: "The browser blocked the print window",
      }
    : {
        title: "Печать выбранных QR-этикеток",
        selected: "Выбрано этикеток",
        limit: "Не более 30 этикеток за один раз",
        print: "Печать на A4",
        cancel: "Закрыть",
        missing: "У одного или нескольких активов отсутствует QR-идентификатор",
        failed: "Не удалось сформировать QR-этикетки",
        popup: "Браузер заблокировал окно печати",
      });

watch(
  () => [props.open, props.assets.map(item => [item.id,item.public_id,item.inventory_number,item.name].join("|")).join("\n")] as const,
  async () => {
    const serial = ++request;
    labels.value = [];
    error.value = "";
    generating.value = false;
    if (!props.open || props.assets.length === 0) return;
    if (props.assets.length > 30) {
      error.value = words.value.limit;
      return;
    }
    if (props.assets.some(item => !item.public_id)) {
      error.value = words.value.missing;
      return;
    }
    generating.value = true;
    try {
      const prepared: PrintableQrLabel[] = [];
      for (const asset of props.assets) {
        const url = inventoryQrUrl(asset.public_id, import.meta.env.BASE_URL, window.location.origin);
        const image = await QRCode.toDataURL(url, {
          errorCorrectionLevel: "Q", width: 240, margin: 2,
          color: { dark: "#062739", light: "#ffffff" },
        });
        if (serial !== request) return;
        prepared.push({
          publicId: asset.public_id,
          inventoryNumber: asset.inventory_number,
          name: asset.name,
          image,
        });
      }
      labels.value = prepared;
    } catch {
      if (serial === request) error.value = words.value.failed;
    } finally {
      if (serial === request) generating.value = false;
    }
  },
  { immediate: true },
);

function print() {
  if (generating.value || labels.value.length === 0 || labels.value.length !== props.assets.length) return;
  // Open synchronously on user click to avoid browser popup blockers.
  const popup = window.open("", "_blank", "width=920,height=880");
  if (!popup) {
    error.value = words.value.popup;
    return;
  }
  popup.opener = null;
  try {
    popup.document.open();
    popup.document.write(bulkQrPrintDocument(labels.value, ui.locale));
    popup.document.close();
    void Promise.all(Array.from(popup.document.images).map(image => image.decode().catch(() => undefined)))
      .then(() => {
        if (!popup.closed) {
          popup.focus();
          popup.print();
        }
      })
      .catch(() => { error.value = words.value.failed; });
  } catch {
    error.value = words.value.failed;
    popup.close();
  }
}
</script>

<template>
  <BaseDialog :open="open" :title="words.title" size="wide" @close="emit('close')">
    <div class="batch-summary">
      <QrCode :size="19" aria-hidden="true" />
      <span>{{ words.selected }}: <strong>{{ assets.length }}</strong></span>
      <span class="batch-limit">{{ words.limit }}</span>
    </div>
    <p v-if="error" class="batch-error" role="alert">{{ error }}</p>
    <BaseLoadingState v-if="generating" :label="words.title" />
    <div v-else-if="labels.length" class="qr-preview" role="list">
      <article v-for="label in labels" :key="label.publicId" class="qr-preview-label" role="listitem">
        <img :src="label.image" alt="QR" width="94" height="94" />
        <div class="qr-preview-text">
          <strong>ITP Inventory</strong>
          <span class="qr-preview-number">{{ label.inventoryNumber }}</span>
          <span class="qr-preview-name">{{ label.name }}</span>
        </div>
      </article>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('close')">{{ words.cancel }}</BaseButton>
      <BaseButton :disabled="generating || !labels.length || labels.length !== assets.length" @click="print">
        <Printer :size="17" aria-hidden="true" /> {{ words.print }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.batch-summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:13px;color:var(--color-text);margin-bottom:14px}
.batch-summary svg{color:var(--color-primary)}
.batch-limit{font-size:12px;color:var(--color-muted);margin-left:auto}
.batch-error{padding:10px 12px;color:var(--color-danger);border:1px solid var(--color-danger);border-radius:var(--radius-sm)}
.qr-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.qr-preview-label{display:flex;align-items:center;min-width:0;gap:10px;padding:10px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);background:var(--color-surface-raised)}
.qr-preview-label img{width:94px;height:94px;object-fit:contain;background:#fff;border-radius:4px;flex:none}
.qr-preview-text{display:grid;align-content:center;gap:6px;min-width:0;font-size:11px}
.qr-preview-number{font-weight:600;font-size:12px;overflow-wrap:anywhere}
.qr-preview-name{color:var(--color-muted);overflow-wrap:anywhere}
@media(max-width:600px){.qr-preview{grid-template-columns:1fr}.batch-limit{margin-left:0;width:100%}}
</style>

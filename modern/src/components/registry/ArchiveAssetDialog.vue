<script setup lang="ts">
import { ref, watch } from "vue";
import { Archive } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import { InventoryApiError } from "../../api/client";
import { archiveAsset } from "../../api/inventory";
import type { Asset } from "../../api/inventory";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{asset: Asset | null; companyId: string}>();
const emit = defineEmits<{close: []; archived: []}>();
const ui = useUiSettings();
const reason = ref("");
const busy = ref(false);
const error = ref("");
watch(() => props.asset?.id, () => { reason.value = ""; error.value = ""; });
function close() {
  if (busy.value) return;
  if (reason.value.trim() && !window.confirm(ui.t("form.unsaved"))) return;
  emit("close");
}
async function archive() {
  if (!props.asset || busy.value || reason.value.trim().length < 5) return;
  busy.value = true; error.value = "";
  try {
    await archiveAsset(props.companyId, props.asset.id, props.asset.version, reason.value.trim());
    reason.value = "";
    emit("archived");
  } catch(e) {
    error.value = e instanceof InventoryApiError && e.status === 409
      ? ui.t("form.conflict") : e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { busy.value = false; }
}
</script>

<template>
  <BaseDialog :open="!!asset" :title="ui.t('form.archiveTitle')" @close="close">
    <p v-if="asset"><strong>{{ asset.inventory_number }}</strong> — {{ asset.name }}</p>
    <p class="muted">{{ ui.t("form.archiveNote") }}</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <form id="archive-asset-form" class="archive-form" @submit.prevent="archive">
      <label>
        <span>{{ ui.t("form.archiveReason") }} *</span>
        <textarea v-model="reason" rows="4" required minlength="5" maxlength="1000" :disabled="busy"></textarea>
      </label>
    </form>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
      <BaseButton type="submit" form="archive-asset-form" :disabled="busy || reason.trim().length < 5">
        <Archive :size="16" aria-hidden="true" />{{ ui.t("form.archiveConfirm") }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.archive-form label{display:grid;gap:8px;font-size:var(--font-label-size);font-weight:500}
textarea{border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface-raised);color:var(--color-text);padding:12px;resize:vertical;font:inherit}
</style>
<script setup lang="ts">
import { computed } from "vue";
import BaseDialog from "./BaseDialog.vue";
import BaseButton from "./BaseButton.vue";
import { useUiSettings } from "../../stores/uiSettings";

const props = withDefaults(defineProps<{
  open: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}>(), {
  title: "",
  confirmLabel: "",
  danger: false,
});
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const ui = useUiSettings();
const labels = computed(() => ({
  ru: { title: "Подтвердить действие", confirm: "Подтвердить", cancel: "Отмена" },
  en: { title: "Confirm action", confirm: "Confirm", cancel: "Cancel" },
  ka: { title: "მოქმედების დადასტურება", confirm: "დადასტურება", cancel: "გაუქმება" },
})[ui.locale]);
</script>

<template>
  <BaseDialog :open="open" :title="title || labels.title" @close="emit('cancel')">
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <BaseButton variant="secondary" @click="emit('cancel')">{{ labels.cancel }}</BaseButton>
      <BaseButton :variant="danger ? 'danger' : 'primary'" @click="emit('confirm')">
        {{ confirmLabel || labels.confirm }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.confirm-message{
  margin:0;line-height:1.6;color:var(--color-text);
  font-size:var(--font-body-size);overflow-wrap:anywhere;
}
</style>

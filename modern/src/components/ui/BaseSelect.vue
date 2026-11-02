<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });
const props = defineProps<{
  modelValue?: string | number | null;
  value?: string | number | null;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [event: Event];
}>();
const attrs = useAttrs();
const selectedValue = computed(() => props.modelValue !== undefined ? props.modelValue : props.value);
function onChange(event: Event) {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
  emit("change", event);
}
</script>

<template>
  <select
    v-bind="attrs"
    class="base-select"
    :value="selectedValue ?? ''"
    :disabled="disabled"
    @change="onChange"
  >
    <slot />
  </select>
</template>

<style scoped>
.base-select {
  display: block;
  width: 100%;
  min-height: var(--control-height, 40px);
  min-width: 0;
  padding: 8px 36px 8px 11px;
  color: var(--color-text);
  background-color: var(--color-surface-raised, var(--color-surface));
  border: 1px solid var(--color-stroke-strong);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  cursor: pointer;
  box-shadow: var(--shadow-control);
  color-scheme: light;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23738699' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 11px center;
  background-repeat: no-repeat;
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
}
.base-select:hover:not(:disabled) { border-color: var(--color-primary); }
.base-select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
.base-select:disabled { cursor: not-allowed; opacity: .55; }
.base-select:invalid { border-color: var(--color-stroke-strong); }
:global([data-theme="dark"]) .base-select, :global(.theme-dark) .base-select { color-scheme: dark; }
.base-select option { background: var(--color-surface); color: var(--color-text); }
@media(max-width:600px) { .base-select { min-height: 44px; font-size: 16px; } }
</style>

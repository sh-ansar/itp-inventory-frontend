<script setup lang="ts">
import { useId } from "vue";
import { Search } from "lucide-vue-next";
defineProps<{modelValue: string; label: string; placeholder?: string; disabled?: boolean}>();
defineEmits<{"update:modelValue": [value: string]}>();
const id = useId();
</script>

<template>
  <div class="registry-search">
    <Search :size="17" aria-hidden="true" />
    <label class="sr-only" :for="id">{{ label }}</label>
    <input :id="id" type="search" :value="modelValue" :disabled="disabled"
      :aria-label="label" :placeholder="placeholder || label"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  </div>
</template>

<style scoped>
.registry-search{display:flex;align-items:center;gap:9px;flex:1 1 240px;max-width:420px;width:100%;min-width:0;min-height:var(--control-height);padding:0 12px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface-raised);color:var(--color-muted)}
.registry-search:focus-within{outline:2px solid var(--color-primary);outline-offset:1px}
.registry-search svg{flex:none}
.registry-search input{flex:1;min-width:0;width:100%;border:0;outline:0;min-height:36px;background:transparent;box-shadow:none;color:var(--color-text);font-size:var(--font-caption-size)}
.registry-search input:focus-visible{outline:0}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:600px){.registry-search{max-width:none;flex-basis:100%}}
</style>
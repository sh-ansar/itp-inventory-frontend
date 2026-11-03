<script setup lang="ts">
import { useId } from "vue";
import { Search } from "lucide-vue-next";
defineProps<{modelValue:string;label:string;placeholder?:string;disabled?:boolean}>();
defineEmits<{"update:modelValue":[value:string]}>();
const id=useId();
</script>

<template>
  <div class="registry-search" :class="{'is-disabled':disabled}">
    <Search :size="17" aria-hidden="true"/>
    <label class="sr-only" :for="id">{{label}}</label>
    <input :id="id" type="search" :value="modelValue" :disabled="disabled"
      :aria-label="label" :placeholder="placeholder||label" autocomplete="off"
      @input="$emit('update:modelValue',($event.target as HTMLInputElement).value)" />
  </div>
</template>

<style scoped>
/* HRM BaseSearchField contract: one control surface, not an input nested in another input. */
.registry-search{display:flex;align-items:center;gap:9px;flex:1 1 240px;width:100%;max-width:420px;min-width:0;height:var(--control-height);min-height:var(--control-height);padding:0 12px;border:1px solid var(--color-stroke);border-radius:var(--space-2);background:var(--color-surface-raised);color:var(--color-muted);box-shadow:var(--shadow-control);transition:border-color .15s ease,box-shadow .15s ease}
.registry-search:focus-within{border-color:var(--color-primary-stroke);outline:1px solid var(--color-primary-stroke);outline-offset:0}
.registry-search :deep(svg){flex:none}
.registry-search input{display:block;flex:1 1 auto;width:100%;min-width:0;height:100%;min-height:0;margin:0;padding:0;border:0;border-radius:0;outline:0;background:transparent;box-shadow:none;color:var(--color-text);font:inherit;font-size:var(--font-caption-size);line-height:19px;appearance:none}
.registry-search input:focus,.registry-search input:focus-visible{border:0;outline:0;box-shadow:none}
.registry-search input::placeholder{color:var(--color-muted)}
.registry-search input::-webkit-search-cancel-button{display:none}
.registry-search.is-disabled{opacity:.55;cursor:not-allowed}
.registry-search input:disabled{cursor:not-allowed}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
@media(max-width:650px){.registry-search{max-width:none;flex-basis:100%}.registry-search input{font-size:16px}}
@media(prefers-reduced-motion:reduce){.registry-search{transition:none}}
</style>
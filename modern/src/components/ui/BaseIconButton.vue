<script setup lang="ts">
withDefaults(defineProps<{
  tone?: "default" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}>(), {
  tone: "default",
  size: "sm",
  type: "button",
  disabled: false,
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="base-icon-button"
    :class="['base-icon-button--'+size,'base-icon-button--'+tone]"
  >
    <slot />
  </button>
</template>

<style scoped>
.base-icon-button {
  display:inline-grid;
  place-items:center;
  flex:0 0 auto;
  appearance:none;
  padding:0;
  margin:0;
  border:1px solid var(--color-stroke-strong);
  border-radius:var(--radius-sm);
  background:var(--color-surface);
  color:var(--color-text);
  box-shadow:var(--shadow-control);
  font:inherit;
  cursor:pointer;
  transition:background-color .16s,border-color .16s,color .16s;
}
.base-icon-button--sm{width:36px;height:36px;min-height:36px}
.base-icon-button--md{width:40px;height:40px;min-height:40px}
.base-icon-button :deep(svg){width:18px;height:18px;flex:none}
.base-icon-button:hover:not(:disabled){
  background:var(--color-accent-soft);
  border-color:var(--color-primary-stroke);
  color:var(--color-primary)
}
.base-icon-button--danger:hover:not(:disabled){
  background:var(--color-danger-surface);
  border-color:var(--color-danger-border);
  color:var(--color-danger)
}
.base-icon-button:active:not(:disabled){transform:translateY(1px)}
.base-icon-button:focus-visible{
  outline:2px solid var(--color-primary);
  outline-offset:2px
}
.base-icon-button:disabled{opacity:.5;cursor:not-allowed}
@media(prefers-reduced-motion:reduce){
  .base-icon-button{transition:none}
  .base-icon-button:active:not(:disabled){transform:none}
}
</style>

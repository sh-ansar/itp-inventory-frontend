<script setup lang="ts">
withDefaults(defineProps<{tone?:'success'|'warning'|'danger'|'info'|'neutral';dot?:boolean}>(),{tone:'neutral',dot:false})
</script>
<template>
  <span class="status-pill" :class="'status-pill--'+tone"><i v-if="dot" class="status-dot" aria-hidden="true"></i><slot /></span>
</template>
<style scoped>
.status-pill{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:3px 9px;border:1px solid var(--color-stroke);border-radius:999px;color:var(--color-text);background:var(--color-soft);font-size:11px;line-height:16px;font-weight:500;white-space:nowrap}
.status-dot{width:6px;height:6px;flex:none;border-radius:50%;background:currentColor}
.status-pill--success{color:var(--color-success);background:var(--color-success-surface)}
.status-pill--warning{color:var(--color-warning);background:var(--color-warning-surface)}
.status-pill--danger{color:var(--color-danger);background:var(--color-danger-surface)}
.status-pill--info{color:var(--color-primary);background:var(--color-accent-soft)}
:root[data-theme="dark"] .status-pill{border-color:var(--color-stroke-strong)}
</style>

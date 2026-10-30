<script setup lang="ts">
withDefaults(defineProps<{
  label?: string
  rows?: number
}>(), {
  label: 'Загрузка данных…',
  rows: 3,
})
</script>

<template>
  <div class="loading-state" role="status" aria-live="polite" aria-busy="true">
    <span class="visually-hidden">{{ label }}</span>
    <div class="skeleton-head" aria-hidden="true"></div>
    <div v-for="index in Math.max(1, Math.min(rows, 8))" :key="index"
      class="skeleton-row" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.loading-state{display:grid;gap:var(--space-3);width:100%;padding:var(--space-2) 0}
.skeleton-head,.skeleton-row{
  background:linear-gradient(90deg,var(--color-soft) 25%,var(--color-surface-raised) 50%,var(--color-soft) 75%);
  background-size:200% 100%;animation:shimmer 1.6s linear infinite;border-radius:var(--space-2)
}
.skeleton-head{width:32%;height:20px;min-width:110px}
.skeleton-row{width:100%;height:40px}
.skeleton-row:nth-child(odd){width:88%}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@keyframes shimmer{to{background-position-x:-200%}}
@media(prefers-reduced-motion:reduce){.skeleton-head,.skeleton-row{animation:none}}
</style>

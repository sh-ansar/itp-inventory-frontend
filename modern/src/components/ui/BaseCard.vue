<template><section class="base-card"><slot /></section></template>
<style scoped>
.base-card{
  min-width:0;padding:var(--space-4);
  border:1px solid var(--color-stroke);border-radius:var(--radius-lg);
  background:var(--color-surface);box-shadow:var(--shadow-card);
}
@media(max-width:600px){.base-card{padding:var(--space-3)}}
</style>

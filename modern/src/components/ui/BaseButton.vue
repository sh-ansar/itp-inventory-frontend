<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary'; disabled?: boolean; type?: 'button' | 'submit' | 'reset'; iconOnly?: boolean }>(),{
  variant:'primary',type:'button',disabled:false,iconOnly:false,
})
</script>

<template>
  <button :type="type" :disabled="disabled" :class="['base-button',variant,{ 'icon-only': iconOnly }]"><slot /></button>
</template>

<style scoped>
.base-button{
  position:relative;isolation:isolate;min-width:0;height:var(--control-height);min-height:var(--control-height);
  display:inline-flex;align-items:center;justify-content:center;gap:var(--space-1);
  margin:0;padding:var(--space-2) var(--space-3);overflow:hidden;appearance:none;
  border:1px solid transparent;border-radius:var(--space-2);
  font-family:inherit;font-size:var(--font-label-size);line-height:var(--line-caption);font-weight:500;
  text-align:center;text-decoration:none;white-space:nowrap;cursor:pointer;
  transition:background .16s ease,border-color .16s ease;
}
.base-button::before{content:"";position:absolute;z-index:0;inset:0;background:currentColor;opacity:0;transition:opacity .16s ease}
.base-button:hover:not(:disabled)::before{opacity:.08}
.base-button:active:not(:disabled)::before{opacity:.12}
.base-button:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
.base-button:disabled{opacity:.5;cursor:not-allowed}
.base-button :deep(svg){position:relative;z-index:1;width:20px;height:20px;flex:none}
.icon-only{width:var(--control-height);min-width:var(--control-height);padding:0}
.icon-only :deep(svg){width:18px;height:18px}
.base-button :deep(*){position:relative;z-index:1}
.primary{border-color:var(--color-primary);background:var(--color-primary);color:var(--color-on-primary);box-shadow:var(--shadow-control)}
.secondary{border-color:var(--color-stroke);background:var(--color-surface-raised);background-clip:padding-box;color:var(--color-text);box-shadow:var(--shadow-control);backdrop-filter:blur(20px)}
.secondary:hover:not(:disabled){background:var(--color-surface-raised);border-color:var(--color-stroke)}
@media(max-width:600px){.base-button{font-size:12px;line-height:16px}}
@media(prefers-reduced-motion:reduce){.base-button,.base-button::before{transition:none}}
</style>

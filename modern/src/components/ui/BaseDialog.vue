<script setup lang="ts">
import { nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  closeLabel?: string
  size?: 'default' | 'wide' | 'half-screen'
}>(), { size: 'default', closeLabel: 'Закрыть диалог' })

const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLDialogElement | null>(null)
const titleId = useId()
let returnFocus: HTMLElement | null = null

watch(() => props.open, async open => {
  await nextTick()
  const node = panel.value
  if (!node) return
  if (open && !node.open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    node.showModal()
  } else if (!open && node.open) {
    node.close()
    returnFocus?.focus()
    returnFocus = null
  }
}, { immediate: true })

function close() { emit('close') }
function onBackdrop(event: MouseEvent) {
  if (event.target === panel.value) close()
}
onUnmounted(() => { if (panel.value?.open) panel.value.close() })
</script>

<template>
  <dialog ref="panel" :class="['base-drawer', 'base-drawer--' + size]" :aria-labelledby="titleId"
    @cancel.prevent="close" @click="onBackdrop">
    <div class="drawer-sheet">
      <header class="drawer-header">
        <div class="drawer-title">
          <h2 :id="titleId">{{ title }}</h2>
          <slot name="subtitle" />
        </div>
        <button type="button" class="drawer-close" :aria-label="closeLabel" @click="close">
          <X :size="20" aria-hidden="true" />
        </button>
      </header>
      <div class="drawer-content"><slot /></div>
      <footer v-if="$slots.footer" class="drawer-footer"><slot name="footer" /></footer>
    </div>
  </dialog>
</template>

<style scoped>
.base-drawer{
  position:fixed;inset:0 0 0 auto;margin:0 0 0 auto;
  width:min(500px,100vw);max-width:100vw;height:100vh;height:100dvh;max-height:100dvh;
  overflow:hidden;padding:0;border:0;border-left:1px solid var(--color-stroke);
  border-radius:var(--space-3) 0 0 var(--space-3);background:transparent;color:var(--color-text);
  box-shadow:var(--shadow-float)
}
.base-drawer--wide{width:min(720px,100vw)}
.base-drawer--half-screen{width:50vw;min-width:min(620px,100vw)}
.base-drawer[open] .drawer-sheet{animation:drawer-enter .2s ease-out both}
.base-drawer::backdrop{background:var(--color-overlay);animation:backdrop-enter .16s ease-out}
.drawer-sheet{min-height:100%;height:100%;width:100%;display:flex;flex-direction:column;background:var(--color-surface)}
.drawer-header{
  position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);
  min-height:64px;padding:var(--space-3) var(--space-5);background:var(--color-surface);
  border-bottom:1px solid var(--color-stroke)
}
.drawer-title{min-width:0;display:grid;gap:var(--space-1)}
.drawer-title h2{margin:0;color:var(--color-text);font-size:var(--font-section-heading);line-height:1.4;font-weight:700;letter-spacing:0}
.drawer-title :deep(p){margin:0;color:var(--color-muted);font-size:12px;line-height:17px}
.drawer-close{
  width:40px;height:40px;display:grid;place-items:center;flex:0 0 40px;padding:0;
  border:1px solid var(--color-stroke);border-radius:var(--space-2);
  background:var(--color-surface-raised);color:var(--color-muted);box-shadow:var(--shadow-control)
}
.drawer-close:hover{color:var(--color-text);background:var(--color-hover)}
.drawer-close:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
.drawer-content{flex:1;min-height:0;min-width:0;overflow-y:auto;padding:var(--space-5)}
.drawer-footer{
  flex:none;display:flex;align-items:center;justify-content:flex-end;gap:var(--space-2);flex-wrap:wrap;
  padding:var(--space-3) var(--space-5);border-top:1px solid var(--color-stroke);background:var(--color-surface)
}
@keyframes drawer-enter{from{opacity:.9;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
@keyframes backdrop-enter{from{opacity:0}to{opacity:1}}
@media(max-width:900px){.base-drawer--half-screen{width:min(720px,100vw);min-width:0}}
@media(max-width:600px){
  .base-drawer,.base-drawer--wide,.base-drawer--half-screen{width:100vw;min-width:0;border-radius:0}
  .drawer-header,.drawer-footer{padding:var(--space-3) var(--space-4)}
  .drawer-content{padding:var(--space-4)}
}
@media(prefers-reduced-motion:reduce){.base-drawer[open] .drawer-sheet,.base-drawer::backdrop{animation:none}}
</style>
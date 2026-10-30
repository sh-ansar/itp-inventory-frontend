<script setup lang="ts">
import { computed } from "vue";
import BaseButton from "./BaseButton.vue";

const props = withDefaults(defineProps<{
  page: number;
  lastPage: number;
  total: number;
  pageSize: number;
  loading?: boolean;
  caption?: string;
  locale?: string;
  sizes?: number[];
}>(), { loading: false, caption: "Страницы реестра", locale: "ru", sizes: () => [10,25,50,100] });

const emit = defineEmits<{
  "change:page": [page: number];
  "change:size": [size: number];
}>();
const formattedTotal = computed(() => new Intl.NumberFormat(props.locale).format(props.total));
const pages = computed(() => {
  const candidates = new Set([1, props.lastPage, props.page - 1, props.page, props.page + 1]);
  const numbers = [...candidates].filter(n => n >= 1 && n <= props.lastPage).sort((a,b) => a-b);
  const result: Array<number | "…"> = [];
  let prev = 0;
  for (const n of numbers) {
    if (prev > 0 && n - prev > 1) result.push("…");
    result.push(n); prev = n;
  }
  return result;
});
function changeSize(e: Event) {
  const size = Number((e.target as HTMLSelectElement).value);
  if (props.sizes.includes(size) && size !== props.pageSize) emit("change:size",size);
}
</script>

<template>
  <nav class="base-pagination" :aria-label="caption">
    <div class="pagination-summary">
      <span>{{ formattedTotal }} {{ locale === 'ru' ? 'записей' : locale === 'ka' ? 'ჩანაწერი' : 'records' }}</span>
      <label><span class="sr-only">Размер страницы</span>
        <select :value="pageSize" aria-label="Записей на странице" :disabled="loading"
          @change="changeSize">
          <option v-for="size in sizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>
    <div class="pagination-pages">
      <BaseButton variant="secondary" :disabled="loading || page <= 1"
        @click="emit('change:page',page - 1)" aria-label="Предыдущая страница">‹</BaseButton>
      <template v-for="(item,index) in pages" :key="index">
        <span v-if="item === '…'" class="pagination-ellipsis">…</span>
        <button v-else type="button" class="page-number" :class="{selected: item === page}"
          :disabled="loading || item === page" :aria-current="item === page ? 'page' : undefined"
          :aria-label="'Страница ' + item" @click="emit('change:page',item)">{{ item }}</button>
      </template>
      <BaseButton variant="secondary" :disabled="loading || page >= lastPage"
        @click="emit('change:page',page + 1)" aria-label="Следующая страница">›</BaseButton>
    </div>
  </nav>
</template>

<style scoped>
.base-pagination{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:14px}
.pagination-summary{display:flex;align-items:center;gap:9px;min-width:0;color:var(--color-muted);font-size:12px}
.pagination-summary select{min-height:34px;padding:5px 28px 5px 9px;font-size:12px}
.pagination-pages{display:flex;align-items:center;justify-content:flex-end;gap:3px;flex-wrap:wrap;margin-left:auto}
.pagination-pages :deep(.base-button){min-width:34px;min-height:34px;padding:5px 9px}
.page-number{display:grid;place-items:center;min-width:32px;height:34px;border:1px solid var(--color-stroke-strong);background:var(--color-surface);color:var(--color-text);font-size:12px;cursor:pointer}
.page-number.selected{color:var(--color-primary);background:var(--color-accent-soft);border-color:var(--color-primary-stroke);cursor:default}
.pagination-ellipsis{padding:0 5px;color:var(--color-muted)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:600px){.pagination-summary,.pagination-pages{width:100%;justify-content:flex-start;margin:0}}
</style>
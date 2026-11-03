<script setup lang="ts">
import { computed } from "vue";
import BaseButton from "./BaseButton.vue";
import BaseSelect from "./BaseSelect.vue";

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
const captions = computed(() => props.locale === "ka"
  ? {size:"ჩანაწერები გვერდზე",previous:"წინა გვერდი",next:"შემდეგი გვერდი",page:"გვერდი"}
  : props.locale === "en"
    ? {size:"Rows per page",previous:"Previous page",next:"Next page",page:"Page"}
    : {size:"Записей на странице",previous:"Предыдущая страница",next:"Следующая страница",page:"Страница"});
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
      <label><span class="sr-only">{{ captions.size }}</span>
        <BaseSelect :value="pageSize" :aria-label="captions.size" :disabled="loading"
          @change="changeSize">
          <option v-for="size in sizes" :key="size" :value="size">{{ size }}</option>
        </BaseSelect>
      </label>
    </div>
    <div class="pagination-pages">
      <BaseButton variant="secondary" :disabled="loading || page <= 1"
        @click="emit('change:page',page - 1)"  :aria-label="captions.previous">‹</BaseButton>
      <template v-for="(item,index) in pages" :key="index">
        <span v-if="item === '…'" class="pagination-ellipsis">…</span>
        <button v-else type="button" class="page-number" :class="{selected: item === page}"
          :disabled="loading || item === page" :aria-current="item === page ? 'page' : undefined"
          :aria-label="captions.page + ' ' + item" @click="emit('change:page',item)">{{ item }}</button>
      </template>
      <BaseButton variant="secondary" :disabled="loading || page >= lastPage"
        @click="emit('change:page',page + 1)"  :aria-label="captions.next">›</BaseButton>
    </div>
  </nav>
</template>

<style scoped>
.base-pagination{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:14px;min-width:0}
.pagination-summary{display:flex;align-items:center;gap:9px;min-width:0;color:var(--color-muted);font-size:12px}
.pagination-summary label{min-width:58px}
.pagination-summary :deep(.base-select){min-height:36px;padding:5px 28px 5px 9px;font-size:12px}
.pagination-pages{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;margin-left:auto}
.pagination-pages :deep(.base-button){min-width:36px;min-height:36px;padding:5px 9px;border-radius:var(--radius-sm)}
.page-number{display:inline-grid;place-items:center;min-width:36px;height:36px;padding:0 7px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);background:var(--color-surface-raised);color:var(--color-text);box-shadow:var(--shadow-control);font:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:background-color .16s,border-color .16s,color .16s}
.page-number:hover:not(:disabled){background:var(--color-accent-soft);border-color:var(--color-primary-stroke);color:var(--color-primary)}
.page-number:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
.page-number.selected{color:var(--color-primary);background:var(--color-accent-soft);border-color:var(--color-primary-stroke);box-shadow:none;cursor:default;opacity:1}
.page-number:disabled:not(.selected){opacity:.5;cursor:not-allowed}
.pagination-ellipsis{display:inline-grid;place-items:center;min-width:16px;height:36px;color:var(--color-muted)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:600px){.pagination-summary,.pagination-pages{width:100%;justify-content:flex-start;margin:0}.pagination-summary :deep(.base-select){min-height:44px;font-size:16px}.page-number,.pagination-pages :deep(.base-button){min-width:44px;min-height:44px;height:44px}.pagination-ellipsis{height:44px}}
@media(prefers-reduced-motion:reduce){.page-number{transition:none}}
</style>

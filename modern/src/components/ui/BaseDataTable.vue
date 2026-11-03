<script setup lang="ts" generic="T extends object">
import { computed } from "vue";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-vue-next";
import BaseLoadingState from "./BaseLoadingState.vue";

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";
}

const props = withDefaults(defineProps<{
  columns: TableColumn[];
  rows: T[];
  rowKey: keyof T & string;
  loading?: boolean;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  caption?: string;
  emptyTitle?: string;
  minTableWidth?: number;
  selectable?: boolean;
  selectedKeys?: string[];
}>(), {
  loading: false,
  caption: "Реестр данных",
  emptyTitle: "Нет записей",
  minTableWidth: 720,
  selectable: false,
  selectedKeys: () => [],
});

const emit = defineEmits<{
  sort: [key: string];
  "update:selectedKeys": [keys: string[]];
}>();

const selected = computed(() => new Set(props.selectedKeys));
const allSelected = computed(() =>
  props.rows.length > 0 && props.rows.every(row => selected.value.has(keyFor(row)))
);
const partiallySelected = computed(() =>
  props.rows.some(row => selected.value.has(keyFor(row))) && !allSelected.value
);
const cols = computed(() => props.columns.filter(c => c.key !== "selection"));
function cell(row: T, key: string): unknown { return (row as Record<string, unknown>)[key]; }
function keyFor(row: T): string { return String(cell(row, props.rowKey)); }
function toggleRow(row: T, checked: boolean) {
  const set = new Set(props.selectedKeys);
  if (checked) set.add(keyFor(row));
  else set.delete(keyFor(row));
  emit("update:selectedKeys", [...set]);
}
function toggleAll(checked: boolean) {
  const set = new Set(props.selectedKeys);
  for (const row of props.rows) {
    if (checked) set.add(keyFor(row));
    else set.delete(keyFor(row));
  }
  emit("update:selectedKeys", [...set]);
}
</script>

<template>
  <div class="base-data-table">
    <BaseLoadingState v-if="loading" :label="'Загрузка: ' + caption" />
    <div v-else class="table-scroll" role="region" :aria-label="caption" tabindex="0">
      <table :style="{minWidth: minTableWidth + 'px'}">
        <caption class="sr-only">{{ caption }}</caption>
        <thead>
          <tr>
            <th v-if="selectable" scope="col" class="select-cell">
              <input type="checkbox" :checked="allSelected" :indeterminate="partiallySelected"
                :aria-label="'Выбрать все строки: ' + caption"
                :disabled="rows.length === 0"
                @change="toggleAll(($event.target as HTMLInputElement).checked)" />
            </th>
            <th v-for="c in cols" :key="c.key" scope="col"
              :class="'align-' + (c.align ?? 'left')"
              :aria-sort="c.sortable ? (sortKey === c.key ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none') : undefined"
              :style="{width: c.width ? c.width + 'px' : undefined, minWidth: c.minWidth ? c.minWidth + 'px' : undefined}">
              <button v-if="c.sortable" type="button" class="sort-heading"
                :aria-label="'Сортировать: ' + c.label"
                :title="'Сортировка по всем записям: ' + c.label"
                @click="emit('sort', c.key)">
                <span>{{ c.label }}</span>
                <ArrowDown v-if="sortKey === c.key && sortDirection === 'desc'" :size="15" aria-hidden="true" />
                <ArrowUp v-else-if="sortKey === c.key" :size="15" aria-hidden="true" />
                <ArrowUpDown v-else :size="15" aria-hidden="true" />
              </button>
              <span v-else>{{ c.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="keyFor(row)" :data-row-key="keyFor(row)"
            :class="{'table-row--selected': selected.has(keyFor(row))}">
            <td v-if="selectable" class="select-cell">
              <input type="checkbox" :checked="selected.has(keyFor(row))"
                :aria-label="'Выбрать строку: ' + keyFor(row)"
                @change="toggleRow(row, ($event.target as HTMLInputElement).checked)" />
            </td>
            <td v-for="c in cols" :key="c.key" :class="'align-' + (c.align ?? 'left')">
              <slot :name="'cell-' + c.key" :row="row" :value="cell(row, c.key)">
                {{ cell(row,c.key) ?? '—' }}
              </slot>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="cols.length + (selectable ? 1 : 0)" class="empty-cell">{{ emptyTitle }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* HRM table contract: consistent grid density, scoping and keyboard access. */
.base-data-table{width:100%;max-width:100%;min-width:0;font-size:var(--font-table-size);line-height:19px}
.table-scroll{
  width:100%;max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;
  overscroll-behavior-inline:contain;contain:layout paint;
  border:1px solid var(--color-table-border);border-radius:var(--radius-md);
  background:var(--color-surface);box-shadow:var(--shadow-card);
  scrollbar-width:thin;scrollbar-color:var(--color-primary-stroke) transparent;
}
.table-scroll:focus-visible{outline:2px solid var(--color-primary);outline-offset:3px}
table{width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;margin:0;text-align:left;color:var(--color-text);background:var(--color-surface);font-size:var(--font-table-size);line-height:19px}
thead th{
  height:46px;min-height:46px;vertical-align:middle;text-align:left;
  padding:8px 12px;background:var(--color-table-heading);color:var(--color-table-heading-text);
  font-size:12px;font-weight:500;line-height:17px;white-space:normal;
  border-bottom:1px solid var(--color-table-border);
}
thead th:not(:last-child),tbody td:not(:last-child){border-right:1px solid var(--color-table-border)}
tbody tr{height:50px}
tbody td{
  min-height:50px;padding:9px 12px;vertical-align:middle;
  color:var(--color-text);font-size:var(--font-table-size);line-height:19px;
  overflow-wrap:anywhere;border-bottom:1px solid var(--color-table-border);
}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:var(--color-table-hover)}
tbody tr.table-row--selected td,tbody tr.table-row--selected:hover td{background:var(--color-accent-soft)}
.align-right{text-align:right}.align-center{text-align:center}
th.align-right .sort-heading{justify-content:flex-end}
th.align-center .sort-heading{justify-content:center}
.sort-heading{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  width:100%;min-height:29px;padding:0;text-align:inherit;
  color:inherit;border:0;background:transparent;font:inherit;
  font-size:12px;font-weight:600;line-height:17px;cursor:pointer;
}
.sort-heading:hover{color:var(--color-primary)}
.sort-heading:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px;border-radius:3px}
.sort-heading svg{flex:0 0 auto;color:var(--color-muted)}
.select-cell{width:45px;min-width:45px;max-width:45px;text-align:center;padding:8px!important}
.select-cell input{display:inline-block;width:16px;height:16px;min-height:0;margin:0;padding:0;accent-color:var(--color-primary);vertical-align:middle;cursor:pointer}
.select-cell input:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
.select-cell input:disabled{cursor:not-allowed}
.empty-cell{text-align:center;color:var(--color-muted);padding:36px 14px;line-height:1.6}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:650px){
  thead th{height:44px;min-height:44px;padding:7px 9px}
  tbody tr{height:46px}
  tbody td{min-height:46px;padding:8px 10px}
  .sort-heading{min-height:30px}
  .select-cell{padding:7px!important}
}
</style>
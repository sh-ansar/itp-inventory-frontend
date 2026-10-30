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
.base-data-table{width:100%;max-width:100%;min-width:0;font-size:var(--font-table-size);line-height:19px}
.table-scroll{max-width:100%;width:100%;overflow-x:auto;overscroll-behavior-inline:contain;contain:layout paint;border:1px solid var(--color-table-border);border-radius:var(--radius-sm)}
table{width:100%;border-collapse:separate;border-spacing:0;margin:0;color:var(--color-text);background:var(--color-surface)}
th,td{padding:11px 12px;border:0;border-right:1px solid var(--color-table-border);border-bottom:1px solid var(--color-table-border);white-space:normal;overflow-wrap:anywhere;vertical-align:middle}
tr:last-child td{border-bottom:0}
th:last-child,td:last-child{border-right:0}
thead th{background:var(--color-table-heading);color:var(--color-table-heading-text);font-weight:500;text-align:left;white-space:nowrap}
tbody tr:hover td{background:var(--color-table-hover)}
.table-row--selected td{background:var(--color-accent-soft)}
.align-right{text-align:right}.align-center{text-align:center}
th.align-right .sort-heading{justify-content:flex-end}
.sort-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:inherit;color:inherit;border:0;background:transparent;font:inherit;font-weight:600;cursor:pointer;padding:2px 0;width:100%;min-height:30px}
.sort-heading:hover{color:var(--color-primary)}
.sort-heading svg{flex:0 0 auto}
.select-cell{width:43px;text-align:center}
.select-cell input{width:16px;height:16px;min-height:0;accent-color:var(--color-primary);cursor:pointer}
.empty-cell{text-align:center;color:var(--color-muted);padding:36px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:600px){th,td{padding:10px 9px}.sort-heading{min-height:36px}}
</style>
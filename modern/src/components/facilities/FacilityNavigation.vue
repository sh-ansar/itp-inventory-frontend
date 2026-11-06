<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import { MapPinned } from "lucide-vue-next";
import BaseCard from "../ui/BaseCard.vue";
import BaseSearchField from "../ui/BaseSearchField.vue";
import { useUiSettings } from "../../stores/uiSettings";
import type { FacilityType } from "../../api/topology";
import type { FacilityTreeRow } from "../../utils/facilityHierarchy";

const props = defineProps<{
  nodeCount: number;
  rows: FacilityTreeRow[];
  selectedId: string | null;
  search: string;
  mapIcons: Record<FacilityType, Component>;
}>();
const emit = defineEmits<{
  "update:search": [value: string];
  navigate: [id: string | null];
}>();
const ui = useUiSettings();
const searchModel = computed({
  get: () => props.search,
  set: (value: string) => emit("update:search", value),
});
</script>

<template>
  <BaseCard class="facility-nav">
    <div class="nav-heading">
      <strong>{{ ui.t("topology.objects") }}</strong>
      <span class="muted">{{ nodeCount }}</span>
    </div>
    <BaseSearchField v-model="searchModel" class="tree-search"
      :label="ui.t('topology.search')" :placeholder="ui.t('topology.search')" />
    <div class="tree-list" role="tree" :aria-label="ui.t('topology.objects')">
      <button type="button" class="tree-row" :class="{selected:!selectedId}"
        @click="emit('navigate',null)">
        <MapPinned :size="17" aria-hidden="true"/>{{ ui.t("topology.allObjects") }}
      </button>
      <button v-for="{node,depth} in rows" :key="node.id" type="button"
        class="tree-row" role="treeitem" :aria-selected="selectedId===node.id"
        :class="{selected:selectedId===node.id}"
        :style="{paddingLeft:(12+Math.min(depth,5)*16)+'px'}"
        @click="emit('navigate',node.id)">
        <component :is="mapIcons[node.node_type]" :size="16" aria-hidden="true"/>
        <span class="tree-text" :title="node.name">{{ node.name }}</span>
        <span v-if="node.direct_asset_count" class="tree-count">{{ node.direct_asset_count }}</span>
      </button>
    </div>
  </BaseCard>
</template>

<style scoped>
.facility-nav{position:sticky;top:12px;min-width:0;max-height:calc(100vh - 135px);display:flex;flex-direction:column}
.nav-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}
.nav-heading strong{font-size:14px;font-weight:600}
.tree-search{margin-bottom:10px;max-width:none;flex:none}
.tree-list{overflow:auto;flex:1;min-height:80px;display:grid;align-content:start;gap:2px}
.tree-row{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;border:1px solid transparent;background:transparent;border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;text-align:left;padding:8px 10px;cursor:pointer}
.tree-row:hover{background:var(--color-hover)}
.tree-row.selected{background:var(--color-accent-soft);border-color:var(--color-primary-stroke);font-weight:600}
.tree-row svg{flex:none;color:var(--color-muted)}
.tree-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tree-count{margin-left:auto;color:var(--color-muted);font-size:11px}
@media(max-width:900px){.facility-nav{position:static;max-height:270px}.tree-list{max-height:170px}}
</style>

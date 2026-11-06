<script setup lang="ts">
import { computed } from "vue";
import { Building2, Plus } from "lucide-vue-next";
import type { PlanElement } from "../../api/facilityPlans";
import BaseCard from "../ui/BaseCard.vue";
import BaseSearchField from "../ui/BaseSearchField.vue";
import EquipmentTypeIcon from "../ui/EquipmentTypeIcon.vue";
import { useUiSettings } from "../../stores/uiSettings";

const props = defineProps<{
  available: PlanElement[];
  totalCount: number;
  canEdit: boolean;
  saving: boolean;
  query: string;
}>();
const emit = defineEmits<{
  "update:query": [value: string];
  add: [item: PlanElement];
}>();
const ui = useUiSettings();
const searchModel = computed({
  get: () => props.query,
  set: (value: string) => emit("update:query", value),
});
</script>

<template>
  <BaseCard class="catalog-card">
    <div class="catalog-heading">
      <h3>{{ ui.t("plan.catalog") }}</h3>
      <strong>{{ available.length }}</strong>
    </div>
    <BaseSearchField v-model="searchModel" class="catalog-search"
      :label="ui.t('plan.search')" :placeholder="ui.t('plan.search')"/>
    <p v-if="!totalCount" class="muted">{{ ui.t("plan.noItems") }}</p>
    <p v-else-if="!available.length" class="muted">{{ ui.t("plan.emptyCatalog") }}</p>
    <div v-else class="catalog-list">
      <div v-for="el in available" :key="el.kind+el.id" class="catalog-item">
        <div class="catalog-icon">
          <EquipmentTypeIcon v-if="el.kind==='asset'" :icon-key="el.icon_key"
            :icon-url="el.icon_url" :size="21"/>
          <Building2 v-else :size="21" aria-hidden="true"/>
        </div>
        <div class="catalog-description">
          <strong :title="el.name">{{ el.name }}</strong>
          <span>{{ el.code }}</span>
          <small>{{ ui.t(el.kind==='node'?'plan.children':'plan.assets') }}</small>
        </div>
        <button v-if="canEdit" type="button" class="catalog-add" :disabled="saving"
          :aria-label="ui.t('plan.place')+': '+el.name" :title="ui.t('plan.place')"
          @click="emit('add',el)">
          <Plus :size="18" aria-hidden="true"/>
        </button>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.catalog-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px}
.catalog-heading h3{font-size:13px;line-height:18px;margin:0;min-width:0;overflow-wrap:anywhere;font-weight:600}
.catalog-heading>strong{font-size:12px;color:var(--color-muted)}
.catalog-search{max-width:none;margin-bottom:11px;flex:none}
.catalog-list{display:grid;gap:6px;max-height:440px;overflow-y:auto}
.catalog-item{display:flex;align-items:center;gap:9px;min-width:0;padding:10px 8px;background:var(--color-soft);border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
.catalog-icon{width:33px;height:33px;flex:none;display:grid;place-items:center;color:var(--color-primary);background:var(--color-surface);border-radius:8px}
.catalog-description{display:grid;gap:3px;min-width:0;flex:1}
.catalog-description strong{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;font-weight:600}
.catalog-description span,.catalog-description small{font-size:10px;color:var(--color-muted)}
.catalog-add{width:30px;height:30px;flex:none;border:1px solid var(--color-stroke-strong);color:var(--color-primary);border-radius:var(--radius-sm);background:var(--color-surface);display:grid;place-items:center;cursor:pointer}
.catalog-add:hover{background:var(--color-accent-soft)}
.catalog-card>.muted{font-size:12px}
@media(max-width:930px){.catalog-list{max-height:280px}}
</style>

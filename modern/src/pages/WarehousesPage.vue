<script setup lang="ts">
import BaseSelect from "../components/ui/BaseSelect.vue";
import { computed, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { RouterLink } from "vue-router";
import { ArrowLeftRight, Boxes, Plus, RefreshCw, Warehouse, PackageCheck , SlidersHorizontal } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseIconButton from "../components/ui/BaseIconButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseLoadingState from "../components/ui/BaseLoadingState.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import BaseSearchField from "../components/ui/BaseSearchField.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import TableSettingsDialog from "../components/ui/TableSettingsDialog.vue";
import { orderAndFilterColumns,useCompanyTablePreferences } from "../composables/useCompanyTablePreferences";
import { InventoryApiError } from "../api/client";
import { referenceData } from "../api/inventory";
import type { ReferenceData } from "../api/inventory";
import {
  createStockItem,getFacilityNodes,getStockBalances,getStockItems,
  getStockTransactions,postStockTransaction,
} from "../api/topology";
import type { FacilityNode,StockItem,StockBalance,StockTransaction,StockMovementInput } from "../api/topology";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const balancePreferences=useCompanyTablePreferences(toRef(props,"companyId"),"warehouse_balances");
const catalogPreferences=useCompanyTablePreferences(toRef(props,"companyId"),"warehouse_items");
const historyPreferences=useCompanyTablePreferences(toRef(props,"companyId"),"warehouse_history");
const settingsOpen=ref(false);
const settingsTitle=computed(()=>ui.locale==="ka"?"ცხრილის პარამეტრები":ui.locale==="en"?"Table settings":"Настройки таблицы");
const tab=ref<"balances"|"catalog"|"history">("balances");
const activePreferences=computed(()=>tab.value==="balances"?balancePreferences:tab.value==="catalog"?catalogPreferences:historyPreferences);
const warehouses=ref<FacilityNode[]>([]);
const warehouseId=computed({get:()=>balancePreferences.state.warehouse_node_id,set:v=>balancePreferences.state.warehouse_node_id=v});
const items=ref<StockItem[]>([]),balances=ref<StockBalance[]>([]),history=ref<StockTransaction[]>([]);
const refs=ref<ReferenceData>({categories:[],accounting_locations:[],physical_locations:[]});
const loading=ref(false),bootstrapping=ref(false),issue=ref(""),notice=ref("");
const page=ref(1),total=ref(0),lastPage=ref(1);
const perPage=computed({get:()=>activePreferences.value.state.per_page,set:v=>activePreferences.value.state.per_page=v});
const search=computed({get:()=>activePreferences.value.state.search,set:v=>activePreferences.value.state.search=v});
const debouncedSearch=ref("");
const allItems=ref<StockItem[]>([]);
const itemOpen=ref(false),movementOpen=ref(false),saving=ref(false),formError=ref("");
const fieldErrors=ref<Record<string,string[]>>({});
const itemFields=reactive({code:"",name:"",unit:"pcs" as StockItem["unit"],category_id:"",minimum_quantity:"0"});
const moveFields=reactive({
  stock_item_id:"",operation:"receipt" as StockMovementInput["operation"],
  warehouse_node_id:"",target_warehouse_node_id:"",
  quantity:"1",reason:"",
});
const canWrite=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const selectedWarehouse=computed(()=>warehouses.value.find(w=>w.id===warehouseId.value)||null);
const tabOptions=computed(()=>[
  {id:"balances" as const,label:ui.t("stock.tab.balances")},
  {id:"catalog" as const,label:ui.t("stock.tab.catalog")},
  {id:"history" as const,label:ui.t("stock.tab.history")},
]);
const balanceColumns=computed(()=>[
  {key:"code",label:ui.t("stock.skuCode"),minWidth:150},
  {key:"name",label:ui.t("table.name"),minWidth:250},
  {key:"quantity_milli",label:ui.t("stock.quantity"),minWidth:120},
  {key:"unit",label:ui.t("stock.unit"),minWidth:100},
  {key:"minimum_quantity_milli",label:ui.t("stock.minimum"),minWidth:120},
]);
const itemColumns=computed(()=>[
  {key:"code",label:ui.t("stock.skuCode"),minWidth:150},
  {key:"name",label:ui.t("table.name"),minWidth:260},
  {key:"unit",label:ui.t("stock.unit"),minWidth:95},
  {key:"balances_sum_quantity_milli",label:ui.t("stock.quantity"),minWidth:130},
  {key:"minimum_quantity_milli",label:ui.t("stock.minimum"),minWidth:120},
  {key:"actions",label:ui.t("table.actions"),minWidth:80,align:"right" as const},
]);
const historyColumns=computed(()=>[
  {key:"created_at",label:ui.t("table.created"),minWidth:165},
  {key:"operation",label:ui.t("stock.operation"),minWidth:125},
  {key:"stock_item_id",label:ui.t("stock.sku"),minWidth:200},
  {key:"quantity_milli",label:ui.t("stock.quantity"),minWidth:110},
  {key:"actor_name",label:ui.t("history.actor"),minWidth:175},
  {key:"reason",label:ui.t("stock.reason"),minWidth:280},
]);
const activeColumns=computed(()=>tab.value==="balances"?balanceColumns.value:tab.value==="catalog"?itemColumns.value:historyColumns.value);
const visibleBalanceColumns=computed(()=>orderAndFilterColumns(balanceColumns.value,balancePreferences.state));
const visibleItemColumns=computed(()=>orderAndFilterColumns(itemColumns.value,catalogPreferences.state));
const visibleHistoryColumns=computed(()=>orderAndFilterColumns(historyColumns.value,historyPreferences.state));
let ctrl:AbortController|null=null,serial=0;let timer:ReturnType<typeof setTimeout>|null=null;
// The immediate company watcher calls bootstrap synchronously during setup.
// Initialize this guard before registering that watcher to avoid a TDZ exception.
let bootstrapGeneration=0;
watch(search,value=>{
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{page.value=1;debouncedSearch.value=value.trim();},300);
});
watch(()=>props.companyId,()=>{
  warehouses.value=[];items.value=[];history.value=[];
  tab.value="balances";page.value=1;settingsOpen.value=false;debouncedSearch.value="";
  issue.value="";notice.value="";itemOpen.value=false;movementOpen.value=false;
  void bootstrap();
},{immediate:true});
watch([tab,page,perPage,warehouseId,debouncedSearch],()=>{void load();});
async function bootstrap(){
  const companyId=props.companyId;
  if(!companyId)return;
  const current=++bootstrapGeneration;
  bootstrapping.value=true;
  try{
    const [facility,reference,skus]=await Promise.all([
      getFacilityNodes(companyId),referenceData(companyId),
      getStockItems(companyId,{page:1,per_page:100}),
    ]);
    // A slower response for the previous company must never replace this tenant's data.
    if(current!==bootstrapGeneration||props.companyId!==companyId)return;
    warehouses.value=facility.data.filter(n=>n.node_type==="warehouse");
    refs.value=reference;allItems.value=skus.data;
    if(!warehouses.value.some(w=>w.id===warehouseId.value))
      warehouseId.value=warehouses.value[0]?.id??"";
    await load();
  }catch(e){
    if(current===bootstrapGeneration)
      issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{
    if(current===bootstrapGeneration)bootstrapping.value=false;
  }
}
async function load(){
  ctrl?.abort();const controller=new AbortController();ctrl=controller;
  const current=++serial;
  if(!props.companyId){loading.value=false;return;}
  loading.value=true;issue.value="";total.value=0;
  try{
    if(tab.value==="balances"){
      if(!warehouseId.value){balances.value=[];return;}
      const data=await getStockBalances(props.companyId,warehouseId.value,{
        page:page.value,per_page:perPage.value,
      },controller.signal);
      if(current===serial&&!controller.signal.aborted){
        balances.value=data.data;total.value=data.total;lastPage.value=data.last_page;
      }
    }else if(tab.value==="catalog"){
      const data=await getStockItems(props.companyId,{
        page:page.value,per_page:perPage.value,search:debouncedSearch.value,
      },controller.signal);
      if(current===serial&&!controller.signal.aborted){
        items.value=data.data;total.value=data.total;lastPage.value=data.last_page;
      }
    }else{
      const data=await getStockTransactions(props.companyId,{
        page:page.value,per_page:perPage.value,warehouse_node_id:warehouseId.value||undefined,
      },controller.signal);
      if(current===serial&&!controller.signal.aborted){
        history.value=data.data;total.value=data.total;lastPage.value=data.last_page;
      }
    }
    if(current===serial&&page.value>lastPage.value&&total.value>0)page.value=lastPage.value;
  }catch(e){
    if(!controller.signal.aborted&&current===serial)
      issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{if(current===serial)loading.value=false;}
}
function selectTab(next:typeof tab.value){tab.value=next;page.value=1;issue.value="";}
function fmt(milli:number|null|undefined){const value=(milli??0)/1000;
  return new Intl.NumberFormat(ui.locale==="ka"?"ka-GE":ui.locale==="en"?"en-GB":"ru-RU",
    {maximumFractionDigits:3}).format(value);
}
function createItem(){
  itemFields.code="";itemFields.name="";itemFields.unit="pcs";
  itemFields.category_id="";itemFields.minimum_quantity="0";
  formError.value="";fieldErrors.value={};itemOpen.value=true;
}
function createMovement(item?:StockItem){
  moveFields.stock_item_id=item?.id??allItems.value[0]?.id??"";
  moveFields.operation="receipt";moveFields.quantity="1";moveFields.reason="";
  moveFields.warehouse_node_id=warehouseId.value||(warehouses.value[0]?.id??"");
  moveFields.target_warehouse_node_id="";
  formError.value="";fieldErrors.value={};movementOpen.value=true;
}
async function saveItem(){
  if(!canWrite.value||saving.value||!itemFields.code.trim()||!itemFields.name.trim())return;
  saving.value=true;formError.value="";fieldErrors.value={};
  try{
    await createStockItem(props.companyId,{
      code:itemFields.code.trim(),name:itemFields.name.trim(),unit:itemFields.unit,
      category_id:itemFields.category_id||null,minimum_quantity:itemFields.minimum_quantity||"0",
    });
    itemOpen.value=false;notice.value=ui.t("stock.createdItem");
    await bootstrap();selectTab("catalog");
  }catch(e){if(e instanceof InventoryApiError){fieldErrors.value=e.fields;formError.value=e.message;}
    else formError.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{saving.value=false;}
}
async function saveMovement(){
  if(!canWrite.value||saving.value||!moveFields.stock_item_id||!moveFields.warehouse_node_id)return;
  saving.value=true;formError.value="";fieldErrors.value={};
  try{
    await postStockTransaction(props.companyId,{
      stock_item_id:moveFields.stock_item_id,operation:moveFields.operation,
      warehouse_node_id:moveFields.warehouse_node_id,
      ...(moveFields.operation==="transfer"?{target_warehouse_node_id:moveFields.target_warehouse_node_id}:{}),
      quantity:moveFields.quantity,reason:moveFields.reason.trim(),
    });
    movementOpen.value=false;notice.value=ui.t("stock.completedOperation");
    await bootstrap();await load();
  }catch(e){if(e instanceof InventoryApiError){fieldErrors.value=e.fields;formError.value=e.message;}
    else formError.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{saving.value=false;}
}
onUnmounted(()=>{ctrl?.abort();if(timer)clearTimeout(timer)});
</script>

<template>
  <div class="warehouse-page">
    <div class="warehouse-header">
      <div><h2>{{ ui.t("stock.warehouseTitle") }}</h2>
        <p class="muted">{{ ui.t("stock.warehouseSubtitle") }}</p></div>
      <div class="header-actions">
        <BaseButton variant="secondary" :title="settingsTitle" :aria-label="settingsTitle"
          :disabled="!activePreferences.ready.value" @click="settingsOpen=true">
          <SlidersHorizontal :size="17" aria-hidden="true"/><span class="header-action-label">{{settingsTitle}}</span>
        </BaseButton>
        <BaseButton variant="secondary" :disabled="loading" :aria-label="ui.t('actions.refresh')" :title="ui.t('actions.refresh')" @click="bootstrap">
          <RefreshCw :size="17" aria-hidden="true"/><span class="header-action-label">{{ ui.t("actions.refresh") }}</span></BaseButton>
        <BaseButton v-if="canWrite" variant="secondary" :aria-label="ui.t('stock.newItem')" :title="ui.t('stock.newItem')" @click="createItem">
          <Plus :size="17" aria-hidden="true"/><span class="header-action-label">{{ ui.t("stock.newItem") }}</span></BaseButton>
        <BaseButton v-if="canWrite&&warehouses.length&&allItems.length" :aria-label="ui.t('stock.newOperation')" :title="ui.t('stock.newOperation')" @click="createMovement()">
          <ArrowLeftRight :size="17" aria-hidden="true"/><span class="header-action-label">{{ ui.t("stock.newOperation") }}</span></BaseButton>
      </div>
    </div>
    <p v-if="issue" class="error" role="alert">{{ issue }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <BaseCard v-if="bootstrapping" class="warehouse-empty">
      <BaseLoadingState :label="ui.t('generic.loading')"/>
    </BaseCard>
    <BaseCard v-else-if="!warehouses.length" class="warehouse-empty">
      <Warehouse :size="30" aria-hidden="true"/><h3>{{ ui.t("stock.warehouseMissing") }}</h3>
      <RouterLink to="/facilities">{{ ui.t("stock.warehouseGo") }}</RouterLink>
    </BaseCard>
    <template v-else>
      <div class="warehouse-metrics">
        <BaseCard><Warehouse :size="23" aria-hidden="true"/>
          <strong>{{ warehouses.length }}</strong><span class="muted">{{ ui.t("stock.warehouse") }}</span></BaseCard>
        <BaseCard><Boxes :size="23" aria-hidden="true"/>
          <strong>{{ allItems.length }}</strong><span class="muted">{{ ui.t("stock.totalPositions") }}</span></BaseCard>
      </div>
      <BaseCard class="warehouse-content">
        <div class="warehouse-toolbar">
          <div class="tabs" role="group" :aria-label="ui.t('stock.warehouseTitle')">
            <button v-for="option in tabOptions" :key="option.id" type="button"
              :aria-pressed="tab===option.id" :class="{selected:tab===option.id}"
              @click="selectTab(option.id)">{{ option.label }}</button>
          </div>
          <label class="warehouse-picker"><span>{{ ui.t("stock.warehouse") }}</span>
            <BaseSelect v-model="warehouseId" :aria-label="ui.t('stock.warehouse')" @change="page=1">
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}</option>
            </BaseSelect>
          </label>
        </div>
        <div v-if="tab==='catalog'" class="warehouse-search">
          <BaseSearchField v-model="search" :label="ui.t('table.search')"
            :placeholder="ui.t('table.search')"/>
        </div>
        <template v-if="tab==='balances'">
          <div class="section-title"><PackageCheck :size="19" aria-hidden="true"/>
            <h3>{{ selectedWarehouse?.name }}</h3></div>
          <BaseDataTable :rows="balances" row-key="id" :columns="visibleBalanceColumns"
            :loading="loading" :caption="ui.t('stock.tab.balances')"
            :empty-title="ui.t('stock.balanceZero')" :min-table-width="770">
            <template #cell-quantity_milli="{row}">
              <strong>{{ fmt(row.quantity_milli) }}</strong>
              <BaseStatusPill v-if="row.quantity_milli<row.minimum_quantity_milli" tone="warning">
                {{ ui.t("stock.lowBalance") }}</BaseStatusPill>
            </template>
            <template #cell-minimum_quantity_milli="{row}">{{ fmt(row.minimum_quantity_milli) }}</template>
          </BaseDataTable>
        </template>
        <BaseDataTable v-else-if="tab==='catalog'" :rows="items" row-key="id"
          :columns="visibleItemColumns" :loading="loading" :caption="ui.t('stock.tab.catalog')"
          :empty-title="ui.t('stock.catalogEmpty')" :min-table-width="930">
          <template #cell-balances_sum_quantity_milli="{row}">
            {{ fmt(row.balances_sum_quantity_milli) }}</template>
          <template #cell-minimum_quantity_milli="{row}">{{ fmt(row.minimum_quantity_milli) }}</template>
          <template #cell-actions="{row}">
            <BaseIconButton v-if="canWrite" type="button" :title="ui.t('stock.newOperation')"
              :aria-label="ui.t('stock.newOperation')+': '+row.name" @click="createMovement(row)">
              <ArrowLeftRight :size="17" aria-hidden="true"/>
            </BaseIconButton>
          </template>
        </BaseDataTable>
        <BaseDataTable v-else :rows="history" row-key="id" :columns="visibleHistoryColumns"
          :loading="loading" :caption="ui.t('stock.tab.history')"
          :empty-title="ui.t('stock.historyEmpty')" :min-table-width="1100">
          <template #cell-created_at="{row}">
            {{ new Date(row.created_at).toLocaleString(ui.locale) }}
          </template>
          <template #cell-operation="{row}">
            {{ ui.t("stock.operation."+row.operation) }}
          </template>
          <template #cell-stock_item_id="{row}">
            {{ allItems.find(item=>item.id===row.stock_item_id)?.name||row.stock_item_id }}
          </template>
          <template #cell-quantity_milli="{row}">{{ fmt(row.quantity_milli) }}</template>
        </BaseDataTable>
        <BasePagination v-if="!loading&&total>0" :page="page" :last-page="Math.max(1,lastPage)"
          :page-size="perPage" :total="total" :locale="ui.locale"
          :caption="ui.t('stock.warehouseTitle')"
          @change:page="page=$event" @change:size="perPage=$event;page=1"/>
      </BaseCard>
    </template>

    <TableSettingsDialog :open="settingsOpen" :columns="activeColumns"
      :hidden-columns="activePreferences.state.hidden_columns"
      :column-order="activePreferences.state.column_order"
      :busy="!activePreferences.ready.value||activePreferences.saving.value"
      @close="settingsOpen=false" @reset="activePreferences.reset()"
      @update:hidden-columns="activePreferences.state.hidden_columns=$event"
      @update:column-order="activePreferences.state.column_order=$event"/>
    <BaseDialog :open="itemOpen" :title="ui.t('stock.newItemTitle')" @close="!saving&&(itemOpen=false)">
      <form id="stock-item-form" class="warehouse-form" @submit.prevent="saveItem">
        <p v-if="formError" class="error" role="alert">{{ formError }}</p>
        <label><span>{{ ui.t("stock.skuCode") }} *</span>
          <input v-model="itemFields.code" required maxlength="80" :disabled="saving"/>
          <small v-if="fieldErrors.code">{{ fieldErrors.code[0] }}</small></label>
        <label><span>{{ ui.t("table.name") }} *</span>
          <input v-model="itemFields.name" required minlength="2" maxlength="255" :disabled="saving"/></label>
        <label><span>{{ ui.t("stock.unit") }} *</span>
          <BaseSelect v-model="itemFields.unit" :disabled="saving">
            <option v-for="unit in ['pcs','pack','kg','m','l']" :key="unit" :value="unit">{{ unit }}</option>
          </BaseSelect></label>
        <label><span>{{ ui.t("types.title") }}</span>
          <BaseSelect v-model="itemFields.category_id" :disabled="saving">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="cat in refs.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </BaseSelect></label>
        <label><span>{{ ui.t("stock.minimum") }}</span>
          <input v-model="itemFields.minimum_quantity" type="text" inputmode="decimal"
            pattern="[0-9]+(\.[0-9]{1,3})?" :disabled="saving"/>
          <small v-if="fieldErrors.minimum_quantity">{{ fieldErrors.minimum_quantity[0] }}</small></label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="itemOpen=false">{{ ui.t("actions.cancel") }}</BaseButton>
        <BaseButton type="submit" form="stock-item-form" :disabled="saving||!itemFields.code.trim()||!itemFields.name.trim()">
          {{ ui.t("actions.save") }}</BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog :open="movementOpen" :title="ui.t('stock.newOperationTitle')" @close="!saving&&(movementOpen=false)">
      <form id="stock-movement-form" class="warehouse-form" @submit.prevent="saveMovement">
        <p v-if="formError" class="error" role="alert">{{ formError }}</p>
        <label><span>{{ ui.t("stock.sku") }} *</span>
          <BaseSelect v-model="moveFields.stock_item_id" required :disabled="saving">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in allItems" :key="item.id" :value="item.id">{{ item.code }} · {{ item.name }}</option>
          </BaseSelect></label>
        <label><span>{{ ui.t("stock.operation") }} *</span>
          <BaseSelect v-model="moveFields.operation" :disabled="saving">
            <option value="receipt">{{ ui.t("stock.operation.receipt") }}</option>
            <option value="issue">{{ ui.t("stock.operation.issue") }}</option>
            <option value="transfer">{{ ui.t("stock.operation.transfer") }}</option>
          </BaseSelect></label>
        <label><span>{{ ui.t(moveFields.operation==='receipt'?'stock.warehouse':'stock.sourceWarehouse') }} *</span>
          <BaseSelect v-model="moveFields.warehouse_node_id" required :disabled="saving">
            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
          </BaseSelect></label>
        <label v-if="moveFields.operation==='transfer'"><span>{{ ui.t("stock.targetWarehouse") }} *</span>
          <BaseSelect v-model="moveFields.target_warehouse_node_id" required :disabled="saving">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="warehouse in warehouses.filter(w=>w.id!==moveFields.warehouse_node_id)"
              :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
          </BaseSelect></label>
        <label><span>{{ ui.t("stock.quantity") }} *</span>
          <input v-model="moveFields.quantity" inputmode="decimal" type="text"
            pattern="[0-9]+(\.[0-9]{1,3})?" required :disabled="saving"/>
          <small v-if="fieldErrors.quantity">{{ fieldErrors.quantity[0] }}</small></label>
        <label><span>{{ ui.t("stock.reason") }} *</span>
          <textarea v-model="moveFields.reason" required minlength="5" maxlength="1000" rows="3" :disabled="saving"/>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="movementOpen=false">{{ ui.t("actions.cancel") }}</BaseButton>
        <BaseButton type="submit" form="stock-movement-form" :disabled="saving||!moveFields.quantity||!moveFields.reason.trim()">
          {{ ui.t("actions.save") }}</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<style scoped>
.warehouse-page{display:grid;gap:19px;min-width:0}
.warehouse-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.warehouse-header h2{margin:0}.warehouse-header p{margin:6px 0 0}
.header-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.warehouse-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.warehouse-metrics :deep(.base-card){display:grid;gap:8px}
.warehouse-metrics svg{color:var(--color-primary)}
.warehouse-metrics strong{font-size:24px;font-weight:600}
.warehouse-content{min-width:0}
.warehouse-toolbar{display:flex;align-items:end;justify-content:space-between;gap:13px;flex-wrap:wrap;margin-bottom:17px}
.tabs{display:flex;gap:4px;flex-wrap:wrap}
.tabs button{background:transparent;border:1px solid transparent;border-radius:var(--radius-sm);
 padding:9px 14px;font-size:12px;color:var(--color-muted);min-height:39px;cursor:pointer}
.tabs button.selected{background:var(--color-accent-soft);color:var(--color-primary);border-color:var(--color-primary-stroke)}
.warehouse-picker{display:grid;gap:6px;font-size:12px;color:var(--color-muted);min-width:220px}
.warehouse-picker select{min-width:220px;width:100%}
.warehouse-search{margin-bottom:17px}
.section-title{display:flex;align-items:center;gap:10px;margin-bottom:16px;color:var(--color-primary)}
.section-title h3{color:var(--color-text);font-size:15px;margin:0}
.text-action{background:none;border:0;text-decoration:underline;text-underline-offset:3px;color:var(--color-text);font-size:12px}
.text-action:hover{color:var(--color-primary)}
.warehouse-empty{display:grid;justify-items:center;text-align:center;gap:10px;padding:35px}
.warehouse-empty svg{color:var(--color-muted)}
.warehouse-empty h3{font-size:14px;margin:0}
.warehouse-empty a{text-decoration:underline;color:var(--color-text);font-size:12px}
.warehouse-form{display:grid;gap:15px}
.warehouse-form label{display:grid;gap:7px;font-size:12px;font-weight:500}
.warehouse-form :is(input,select,textarea){width:100%;min-width:0}
.warehouse-form small{color:var(--color-danger);font-size:11px}
.warehouse-form textarea{resize:vertical}
@media(max-width:690px){.header-actions{width:100%}.header-actions :deep(.base-button){flex:1;min-width:44px;justify-content:center}.header-action-label{display:none}.warehouse-toolbar{flex-direction:column;align-items:stretch}.warehouse-picker,.warehouse-picker select{width:100%;min-width:0}.tabs button{flex:1}}
</style>

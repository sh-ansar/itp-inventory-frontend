<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Building2, MapPinned, Warehouse, Layers, DoorOpen, Grid2X2, Package, Boxes,
  Plus, Pencil, ChevronRight, ChevronLeft, Search, ZoomIn, ZoomOut,
  Maximize2, RefreshCw, LayoutGrid, Table2, ClipboardList, ArrowUpRight, Users, History, Map as MapIcon,
} from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BasePagination from "../components/ui/BasePagination.vue";
import EquipmentTypeIcon from "../components/ui/EquipmentTypeIcon.vue";
import FacilityEditorDialog from "../components/facilities/FacilityEditorDialog.vue";
import { companyAssets, referenceData } from "../api/inventory";
import type { Asset, ReferenceData } from "../api/inventory";
import { getFacilityNodes, getResponsiblePeople, getFacilityHistory, updateFacilityNode } from "../api/topology";
import type { FacilityNode, FacilityType, ResponsiblePerson } from "../api/topology";
import { useUiSettings } from "../stores/uiSettings";
import type { Component } from "vue";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings(),router=useRouter(),route=useRoute();
const nodes=ref<FacilityNode[]>([]);
const people=ref<ResponsiblePerson[]>([]);
const refs=ref<ReferenceData>({categories:[],accounting_locations:[],physical_locations:[]});
const busy=ref(false),error=ref(""),notice=ref("");
const dialogOpen=ref(false),editing=ref<FacilityNode|null>(null),parentToCreate=ref<string|null>(null);
const historyOpen=ref(false),historyEvents=ref<Array<{id:string;event_type:string;version:number;actor_name:string;created_at:string}>>([]);
const historyLoading=ref(false);
const view=ref<"scheme"|"table">("scheme"),zoom=ref(100);
const search=ref(""),tablePage=ref(1),tablePerPage=ref(25);
const assetRows=ref<Asset[]>([]),assetTotal=ref(0),assetBusy=ref(false);
const assetPage=ref(1),assetLast=ref(1);
const mapIcons:Record<FacilityType,Component>={
  site:MapPinned,building:Building2,pavilion:Boxes,
  floor:Layers,room:DoorOpen,warehouse:Warehouse,
  zone:Grid2X2,shelf:Package,
};
const canWrite=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const selectedId=computed(()=>{
  const id=route.query.node;
  return typeof id==="string"&&nodes.value.some(n=>n.id===id)?id:null;
});
const currentNode=computed(()=>nodes.value.find(n=>n.id===selectedId.value)??null);
const lookup=computed(()=>new Map(nodes.value.map(n=>[n.id,n])));
const children=computed(()=>nodes.value.filter(n=>n.parent_id===selectedId.value)
  .sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name)));
const lineage=computed(()=>{
  const path:FacilityNode[]=[];
  let node=currentNode.value;
  const seen=new Set<string>();
  while(node&&path.length<9&&!seen.has(node.id)){
    path.unshift(node);seen.add(node.id);
    node=node.parent_id?lookup.value.get(node.parent_id)??null:null;
  }
  return path;
});
const flatNodes=computed(()=>{
  const rows:{node:FacilityNode;depth:number}[]=[];
  const walk=(parent:string|null,depth:number,visited:Set<string>)=>{
    if(depth>9)return;
    for(const n of nodes.value.filter(n=>n.parent_id===parent)
      .sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name))){
      if(visited.has(n.id))continue;
      rows.push({node:n,depth});
      walk(n.id,depth+1,new Set([...visited,n.id]));
    }
  };
  walk(null,0,new Set());
  return rows;
});
const filteredNodes=computed(()=>{
  const needle=search.value.trim().toLowerCase();
  if(!needle)return flatNodes.value;
  return flatNodes.value.filter(row=>
    [row.node.name,row.node.code,row.node.address??"",row.node.responsible_person_name??""]
      .some(s=>s.toLowerCase().includes(needle))
  );
});
const tableRows=computed(()=>filteredNodes.value
  .slice((tablePage.value-1)*tablePerPage.value,tablePage.value*tablePerPage.value)
  .map(({node,depth})=>({...node,depth})));
const totalRows=computed(()=>filteredNodes.value.length);
const totalPages=computed(()=>Math.max(1,Math.ceil(totalRows.value/tablePerPage.value)));
const columns=computed(()=>[
  {key:"name",label:ui.t("table.name"),minWidth:260},
  {key:"node_type",label:ui.t("topology.type"),minWidth:125},
  {key:"address",label:ui.t("topology.address"),minWidth:220},
  {key:"responsible_person_name",label:ui.t("topology.responsible"),minWidth:160},
  {key:"direct_asset_count",label:ui.t("topology.assets"),minWidth:100},
  {key:"actions",label:ui.t("table.actions"),minWidth:160,align:"right" as const},
]);
let ctrl:AbortController|null=null;
let reqSerial=0;let assetCtrl:AbortController|null=null;let assetSerial=0;
let panStart:{x:number;left:number;el:HTMLElement}|null=null;

watch(()=>props.companyId,()=>{notice.value="";dialogOpen.value=false;nodes.value=[];people.value=[];
  void refresh();},{immediate:true});
watch(selectedId,()=>{assetPage.value=1;void loadAssets();},{immediate:true});
watch(search,()=>{tablePage.value=1});
async function refresh(){
  ctrl?.abort();
  const controller=new AbortController();ctrl=controller;
  const serial=++reqSerial;
  if(!props.companyId)return;
  busy.value=true;error.value="";
  try{
    const [map,persons,references]=await Promise.all([
      getFacilityNodes(props.companyId,controller.signal),
      getResponsiblePeople(props.companyId,{per_page:100,active:"1"},controller.signal),
      referenceData(props.companyId,controller.signal),
    ]);
    if(controller.signal.aborted||serial!==reqSerial)return;
    nodes.value=map.data;people.value=persons.data;refs.value=references;
    void loadAssets();
  }catch(e){if(!controller.signal.aborted&&serial===reqSerial)
    error.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{if(serial===reqSerial)busy.value=false;}
}
async function loadAssets(){
  assetCtrl?.abort();const controller=new AbortController();assetCtrl=controller;
  const serial=++assetSerial;
  assetRows.value=[];assetTotal.value=0;
  if(!props.companyId||!selectedId.value){assetBusy.value=false;return;}
  assetBusy.value=true;
  try{
    const data=await companyAssets(props.companyId,{
      page:assetPage.value,per_page:25,search:"",status:"active",
      sort:"inventory_number",direction:"asc",
      facility_node_id:selectedId.value,include_descendants:true,
    },controller.signal);
    if(controller.signal.aborted||serial!==assetSerial)return;
    assetRows.value=data.data;assetTotal.value=data.meta.total;assetLast.value=data.meta.last_page;
  }catch(e){if(!controller.signal.aborted&&serial===assetSerial)
    error.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{if(serial===assetSerial)assetBusy.value=false;}
}
function navigate(id:string|null){
  notice.value="";void router.replace({name:"facilities",query:id?{node:id}:{}});
}
function create(parent:string|null=selectedId.value){
  if(!canWrite.value)return;
  editing.value=null;parentToCreate.value=parent;dialogOpen.value=true;
}
function edit(node:FacilityNode){
  if(!canWrite.value)return;
  editing.value=node;parentToCreate.value=node.parent_id;dialogOpen.value=true;
}
function saved(node:FacilityNode){
  const isNew=!editing.value;dialogOpen.value=false;
  notice.value=ui.t(isNew?"topology.created":"topology.updated");
  void refresh().then(()=>{if(isNew)navigate(node.id);});
}
function openPlan(id:string|null=selectedId.value){
  if(!id)return;
  void router.push({name:"facility-plan",params:{nodeId:id}});
}
function stocktake(){
  if(!canWrite.value||!selectedId.value)return;
  void router.push({name:"stocktakes",query:{facility:selectedId.value}});
}
function zoomBy(amount:number){zoom.value=Math.max(65,Math.min(150,zoom.value+amount));}
function startPan(event:PointerEvent){
  if(event.button!==0||(event.target as HTMLElement).closest("button,a,input"))return;
  const el=event.currentTarget as HTMLElement;
  panStart={x:event.clientX,left:el.scrollLeft,el};
  el.setPointerCapture(event.pointerId);
}
function movePan(event:PointerEvent){
  if(!panStart)return;
  panStart.el.scrollLeft=panStart.left-(event.clientX-panStart.x);
}
function endPan(){panStart=null;}
function beginDrag(event:DragEvent,node:FacilityNode){
  if(!canWrite.value||!event.dataTransfer)return;
  event.dataTransfer.setData("text/plain","inventory-node:"+node.id);
  event.dataTransfer.effectAllowed="move";
}
async function dropOn(event:DragEvent,parent:FacilityNode|null){
  if(!canWrite.value||!event.dataTransfer)return;
  const raw=event.dataTransfer.getData("text/plain");
  if(!raw.startsWith("inventory-node:"))return;
  const id=raw.slice("inventory-node:".length);
  const item=lookup.value.get(id);
  if(!item||item.id===parent?.id||item.parent_id===parent?.id)return;
  if(!window.confirm(ui.t("topology.moveConfirm")))return;
  try{
    await updateFacilityNode(props.companyId,item.id,{
      code:item.code,name:item.name,node_type:item.node_type,parent_id:parent?.id??null,
      address:item.address,floor_number:item.floor_number,
      responsible_person_id:item.responsible_person_id,sort_order:item.sort_order,
    },item.version);
    notice.value=ui.t("topology.updated");await refresh();
  }catch(e){error.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
}
async function showHistory(node:FacilityNode){
  historyOpen.value=true;historyLoading.value=true;historyEvents.value=[];
  try{
    const result=await getFacilityHistory(props.companyId,node.id);
    if(historyOpen.value)historyEvents.value=result.data;
  }catch(e){error.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
  finally{historyLoading.value=false;}
}
function countNodes(id:string){
  const visited=new Set<string>([id]);const queue=[id];
  while(queue.length&&visited.size<3001){
    const parent=queue.shift()!;
    for(const n of nodes.value.filter(n=>n.parent_id===parent)){
      if(!visited.has(n.id)){visited.add(n.id);queue.push(n.id);}
    }
  }
  return visited.size-1;
}
onUnmounted(()=>{ctrl?.abort();assetCtrl?.abort();});
</script>

<template>
  <div class="facility-page">
    <div class="page-heading">
      <div><h2>{{ ui.t("topology.title") }}</h2>
        <p class="muted">{{ companyName }} · {{ ui.t("topology.subtitle") }}</p></div>
      <div class="heading-actions">
        <BaseButton variant="secondary" :disabled="busy" @click="refresh">
          <RefreshCw :size="17" aria-hidden="true"/>{{ ui.t("actions.refresh") }}</BaseButton>
        <BaseButton v-if="canWrite" @click="create(null)">
          <Plus :size="17" aria-hidden="true"/>{{ ui.t("topology.addRoot") }}</BaseButton>
      </div>
    </div>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <div class="map-layout">
      <BaseCard class="facility-nav">
        <div class="nav-heading"><strong>{{ ui.t("topology.objects") }}</strong>
          <span class="muted">{{ nodes.length }}</span></div>
        <label class="tree-search">
          <Search :size="16" aria-hidden="true"/>
          <input v-model="search" :placeholder="ui.t('topology.search')" :aria-label="ui.t('topology.search')"/>
        </label>
        <div class="tree-list" role="tree" :aria-label="ui.t('topology.objects')">
          <button type="button" class="tree-row" :class="{selected:!selectedId}"
            @click="navigate(null)">
            <MapPinned :size="17" aria-hidden="true"/>{{ ui.t("topology.allObjects") }}
          </button>
          <button v-for="{node,depth} in filteredNodes" :key="node.id" type="button"
            class="tree-row" role="treeitem" :aria-selected="selectedId===node.id"
            :class="{selected:selectedId===node.id}"
            :style="{paddingLeft:(12+Math.min(depth,5)*16)+'px'}"
            @click="navigate(node.id)">
            <component :is="mapIcons[node.node_type]" :size="16" aria-hidden="true"/>
            <span class="tree-text" :title="node.name">{{ node.name }}</span>
            <span v-if="node.direct_asset_count" class="tree-count">{{ node.direct_asset_count }}</span>
          </button>
        </div>
        <p class="tree-hint muted">{{ ui.t("topology.dragHelp") }}</p>
      </BaseCard>

      <div class="map-main">
        <BaseCard class="map-canvas-card">
          <div class="map-toolbar">
            <div class="breadcrumbs">
              <button type="button" @click="navigate(null)">
                <MapPinned :size="15" aria-hidden="true"/>{{ ui.t("topology.allObjects") }}
              </button>
              <template v-for="part in lineage" :key="part.id">
                <ChevronRight :size="15" aria-hidden="true"/>
                <button type="button" :title="part.name" @click="navigate(part.id)">{{ part.name }}</button>
              </template>
            </div>
            <div class="map-controls">
              <div class="view-switch" role="group" :aria-label="ui.t('topology.view')">
                <button type="button" :class="{active:view==='scheme'}"
                  :aria-pressed="view==='scheme'" :title="ui.t('topology.scheme')"
                  @click="view='scheme'"><LayoutGrid :size="18" aria-hidden="true"/></button>
                <button type="button" :class="{active:view==='table'}"
                  :aria-pressed="view==='table'" :title="ui.t('topology.table')"
                  @click="view='table'"><Table2 :size="18" aria-hidden="true"/></button>
              </div>
              <template v-if="view==='scheme'">
                <button class="control-icon" type="button" :aria-label="ui.t('topology.zoomOut')" @click="zoomBy(-10)">
                  <ZoomOut :size="17" aria-hidden="true"/></button>
                <span class="zoom-value">{{ zoom }}%</span>
                <button class="control-icon" type="button" :aria-label="ui.t('topology.zoomIn')" @click="zoomBy(10)">
                  <ZoomIn :size="17" aria-hidden="true"/></button>
                <button class="control-icon" type="button" :aria-label="ui.t('topology.resetZoom')" @click="zoom=100">
                  <Maximize2 :size="17" aria-hidden="true"/></button>
              </template>
            </div>
          </div>
          <div v-if="busy" class="empty-canvas muted">{{ ui.t("generic.loading") }}</div>
          <template v-else-if="view==='scheme'">
            <div class="diagram-scroll" @pointerdown="startPan" @pointermove="movePan"
              @pointerup="endPan" @pointercancel="endPan">
              <div class="diagram-inner" :style="{transform:'scale('+zoom/100+')',
                transformOrigin:'top center',minWidth:(zoom<100?'650px':'640px')}">
                <div v-if="currentNode" class="diagram-focus"
                  @dragover.prevent @drop.prevent="dropOn($event,currentNode)">
                  <component :is="mapIcons[currentNode.node_type]" :size="26" aria-hidden="true"/>
                  <div><small>{{ ui.t('topology.type.'+currentNode.node_type) }}</small>
                    <strong>{{ currentNode.name }}</strong>
                    <span>{{ currentNode.address||currentNode.responsible_person_name||currentNode.code }}</span>
                  </div>
                  <button v-if="canWrite" type="button" :title="ui.t('actions.edit')"
                    @click="edit(currentNode)"><Pencil :size="17" aria-hidden="true"/></button>
                </div>
                <div v-else class="diagram-focus diagram-root"
                  @dragover.prevent @drop.prevent="dropOn($event,null)">
                  <MapPinned :size="26" aria-hidden="true"/>
                  <div><small>{{ ui.t("topology.workspace") }}</small>
                    <strong>{{ companyName }}</strong>
                    <span>{{ ui.t("topology.allObjects") }}</span></div>
                </div>
                <div class="diagram-stem" v-if="children.length"/>
                <div class="diagram-children" v-if="children.length">
                  <button v-for="node in children" :key="node.id" type="button"
                    class="diagram-node" draggable="true" @dragstart="beginDrag($event,node)"
                    @dragover.prevent @drop.prevent.stop="dropOn($event,node)"
                    @click="navigate(node.id)">
                    <div class="node-top">
                      <component :is="mapIcons[node.node_type]" :size="22" aria-hidden="true"/>
                      <ChevronRight :size="16" class="node-chevron" aria-hidden="true"/>
                    </div>
                    <small>{{ ui.t("topology.type."+node.node_type) }}</small>
                    <strong :title="node.name">{{ node.name }}</strong>
                    <span class="node-address" :title="node.address||node.code">{{ node.address||node.code }}</span>
                    <span class="node-meta">{{ countNodes(node.id) }} {{ ui.t("topology.subnodes") }}
                      · {{ node.direct_asset_count }} {{ ui.t("topology.assetsShort") }}</span>
                    <span class="node-responsible" v-if="node.responsible_person_name">
                      <Users :size="13" aria-hidden="true"/>{{ node.responsible_person_name }}
                    </span>
                  </button>
                </div>
                <div v-else class="diagram-empty">
                  <Package :size="28" aria-hidden="true"/>
                  <p>{{ ui.t("topology.emptyInside") }}</p>
                </div>
              </div>
            </div>
            <div class="diagram-footer">
              <span class="muted">{{ ui.t("topology.schemeHint") }}</span>
              <div class="footer-actions">
                <BaseButton v-if="canWrite" variant="secondary" @click="create(selectedId)">
                  <Plus :size="17" aria-hidden="true"/>{{ ui.t("topology.addInside") }}</BaseButton>
                <BaseButton v-if="currentNode" variant="secondary" @click="openPlan()">
                  <MapIcon :size="17" aria-hidden="true"/>{{ ui.t("plan.title") }}</BaseButton>
                <BaseButton v-if="canWrite&&currentNode" variant="secondary"
                  @click="edit(currentNode)"><Pencil :size="17" aria-hidden="true"/>{{ ui.t("actions.edit") }}</BaseButton>
                <BaseButton v-if="canWrite&&currentNode" @click="stocktake">
                  <ClipboardList :size="17" aria-hidden="true"/>{{ ui.t("topology.startStocktake") }}</BaseButton>
              </div>
            </div>
          </template>
          <template v-else>
            <BaseDataTable :rows="tableRows" row-key="id" :columns="columns"
              :caption="ui.t('topology.objects')" :empty-title="ui.t('topology.empty')"
              :min-table-width="1050">
              <template #cell-name="{row}">
                <button type="button" class="table-node-name"
                  :style="{paddingLeft:Math.min(row.depth,6)*16+'px'}" @click="navigate(row.id)">
                  <component :is="mapIcons[row.node_type]" :size="17" aria-hidden="true"/>
                  <span :title="row.name">{{ row.name }}</span></button>
              </template>
              <template #cell-node_type="{row}">{{ ui.t("topology.type."+row.node_type) }}</template>
              <template #cell-address="{row}">{{ row.address||"—" }}</template>
              <template #cell-responsible_person_name="{row}">{{ row.responsible_person_name||"—" }}</template>
              <template #cell-actions="{row}">
                <div class="table-actions">
                  <button type="button" :title="ui.t('topology.openInside')" @click="navigate(row.id)">
                    <ArrowUpRight :size="17" aria-hidden="true"/></button>
                  <button type="button" :title="ui.t('plan.title')" @click="openPlan(row.id)">
                    <MapIcon :size="17" aria-hidden="true"/></button>
                  <button v-if="canWrite" type="button" :title="ui.t('topology.addInside')" @click="create(row.id)">
                    <Plus :size="17" aria-hidden="true"/></button>
                  <button v-if="canWrite" type="button" :title="ui.t('actions.edit')" @click="edit(row)">
                    <Pencil :size="17" aria-hidden="true"/></button>
                  <button type="button" :title="ui.t('actions.history')" @click="showHistory(row)">
                    <History :size="17" aria-hidden="true"/></button>
                </div>
              </template>
            </BaseDataTable>
            <BasePagination v-if="totalRows" :page="tablePage" :last-page="totalPages"
              :page-size="tablePerPage" :total="totalRows" :locale="ui.locale"
              :caption="ui.t('topology.objects')"
              @change:page="tablePage=$event" @change:size="tablePerPage=$event;tablePage=1"/>
          </template>
        </BaseCard>
        <BaseCard v-if="currentNode" class="object-details">
          <div class="detail-title">
            <div><h3>{{ currentNode.name }}</h3>
              <p class="muted">{{ ui.t("topology.type."+currentNode.node_type) }} · {{ currentNode.code }}</p></div>
            <div class="detail-actions">
              <BaseButton v-if="canWrite" variant="secondary" @click="create(currentNode.id)">
                <Plus :size="17" aria-hidden="true"/>{{ ui.t("topology.addInside") }}</BaseButton>
              <BaseButton variant="secondary" @click="showHistory(currentNode)">
                <History :size="17" aria-hidden="true"/>{{ ui.t("actions.history") }}</BaseButton>
            </div>
          </div>
          <div class="detail-fields">
            <div><span>{{ ui.t("topology.address") }}</span><strong>{{ currentNode.address||"—" }}</strong></div>
            <div><span>{{ ui.t("topology.responsible") }}</span>
              <strong>{{ currentNode.responsible_person_name||ui.t("form.none") }}</strong></div>
            <div><span>{{ ui.t("topology.subnodes") }}</span><strong>{{ countNodes(currentNode.id) }}</strong></div>
            <div><span>{{ ui.t("topology.assets") }}</span><strong>{{ assetTotal }}</strong></div>
          </div>
          <div class="object-assets-title">
            <h4>{{ ui.t("topology.insideAssets") }}</h4>
            <span class="muted">{{ assetTotal }} {{ ui.t("topology.assetsShort") }}</span>
          </div>
          <div v-if="assetBusy" class="muted">{{ ui.t("generic.loading") }}</div>
          <p v-else-if="!assetRows.length" class="muted">{{ ui.t("topology.noAssets") }}</p>
          <div v-else class="object-assets">
            <div v-for="asset in assetRows" :key="asset.id" class="object-asset">
              <div class="asset-type-icon">
                <EquipmentTypeIcon :size="20"
                  :icon-key="refs.categories.find(c=>c.id===asset.category_id)?.icon_key"
                  :icon-url="refs.categories.find(c=>c.id===asset.category_id)?.icon_url"/>
              </div>
              <div><strong :title="asset.name">{{ asset.name }}</strong>
                <span>{{ asset.inventory_number }} · {{ asset.responsible_person_name||ui.t('form.none') }}</span></div>
              <span class="object-asset-location">{{ asset.facility_node_name }}</span>
            </div>
          </div>
          <BasePagination v-if="assetTotal>25" :page="assetPage"
            :last-page="assetLast" :page-size="25" :total="assetTotal"
            :locale="ui.locale" :caption="ui.t('topology.insideAssets')"
            @change:page="assetPage=$event;loadAssets()"/>
        </BaseCard>
      </div>
    </div>
    <FacilityEditorDialog :open="dialogOpen" :company-id="companyId" :node="editing"
      :parent-id="parentToCreate" :nodes="nodes" :people="people"
      @close="dialogOpen=false" @saved="saved"/>
    <BaseDialog :open="historyOpen" :title="ui.t('actions.history')" @close="historyOpen=false">
      <div v-if="historyLoading" class="muted">{{ ui.t("generic.loading") }}</div>
      <p v-else-if="!historyEvents.length" class="muted">{{ ui.t("history.empty") }}</p>
      <ol v-else class="history-list">
        <li v-for="event in historyEvents" :key="event.id">
          <strong>{{ ui.t("topology.event."+event.event_type) }}</strong>
          <span>{{ event.actor_name }} · v{{ event.version }} · {{ new Date(event.created_at).toLocaleString(ui.locale) }}</span>
        </li>
      </ol>
    </BaseDialog>
  </div>
</template>

<style scoped>
.facility-page{display:grid;gap:20px;min-width:0}
.page-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.page-heading h2{margin:0}.page-heading p{margin:5px 0 0}
.heading-actions{display:flex;gap:9px;flex-wrap:wrap}
.map-layout{display:grid;grid-template-columns:minmax(220px,265px) minmax(0,1fr);gap:17px;min-width:0;align-items:start}
.facility-nav{position:sticky;top:12px;min-width:0;max-height:calc(100vh - 135px);display:flex;flex-direction:column}
.nav-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}
.nav-heading strong{font-size:14px;font-weight:600}
.tree-search{display:flex;align-items:center;gap:7px;min-width:0;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);padding:0 10px;margin-bottom:10px}
.tree-search input{width:100%;min-width:0;border:0;background:transparent;outline:none;box-shadow:none}
.tree-list{overflow:auto;flex:1;min-height:80px;display:grid;align-content:start;gap:2px}
.tree-row{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;border:1px solid transparent;background:transparent;border-radius:var(--radius-sm);color:var(--color-text);font-size:12px;text-align:left;padding:8px 10px;cursor:pointer}
.tree-row:hover{background:var(--color-hover)}
.tree-row.selected{background:var(--color-accent-soft);border-color:var(--color-primary-stroke);font-weight:600}
.tree-row svg{flex:none;color:var(--color-muted)}
.tree-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tree-count{margin-left:auto;color:var(--color-muted);font-size:11px}
.tree-hint{font-size:11px;line-height:16px;padding-top:8px;margin:8px 0 0;border-top:1px solid var(--color-stroke)}
.map-main{display:grid;gap:17px;min-width:0}
.map-canvas-card{min-width:0}
.map-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--color-stroke)}
.breadcrumbs{display:flex;align-items:center;flex-wrap:wrap;gap:4px;max-width:100%;min-width:0}
.breadcrumbs button{display:flex;align-items:center;gap:5px;max-width:160px;padding:5px;border:0;background:none;color:var(--color-text);font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.breadcrumbs button:hover{color:var(--color-primary)}
.breadcrumbs svg{flex:none;color:var(--color-muted)}
.map-controls{display:flex;align-items:center;gap:4px;flex:none}
.view-switch{display:flex;gap:2px;border:1px solid var(--color-stroke-strong);padding:3px;border-radius:var(--radius-sm);margin-right:8px}
.view-switch button,.control-icon{display:grid;place-items:center;width:32px;height:31px;border:0;border-radius:6px;background:transparent;color:var(--color-muted);cursor:pointer}
.view-switch button.active{background:var(--color-accent-soft);color:var(--color-primary)}
.view-switch button:hover,.control-icon:hover{color:var(--color-primary)}
.zoom-value{min-width:40px;text-align:center;font-size:11px;color:var(--color-muted)}
.diagram-scroll{min-width:0;overflow:auto;min-height:345px;max-height:610px;cursor:grab;padding:24px 0 36px}
.diagram-scroll:active{cursor:grabbing}
.diagram-inner{min-height:290px;min-width:640px;width:max-content;margin:auto;padding:0 24px}
.diagram-focus{display:flex;align-items:center;gap:15px;margin:8px auto 0;padding:17px 20px;border:1px solid var(--color-primary-stroke);border-radius:12px;background:var(--color-accent-soft);width:370px;max-width:90%;box-shadow:var(--shadow-control)}
.diagram-focus>svg{color:var(--color-primary);flex:none}
.diagram-focus div{display:grid;gap:5px;min-width:0;flex:1}
.diagram-focus small{font-size:11px;color:var(--color-muted)}
.diagram-focus strong{font-size:15px;white-space:normal;overflow-wrap:anywhere}
.diagram-focus span{font-size:11px;color:var(--color-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.diagram-focus button{border:0;background:transparent;color:var(--color-muted);padding:7px;cursor:pointer}
.diagram-focus button:hover{color:var(--color-primary)}
.diagram-root{background:var(--color-surface)}
.diagram-stem{height:26px;border-left:1px solid var(--color-primary-stroke);width:1px;margin:auto}
.diagram-children{display:flex;justify-content:center;align-items:stretch;gap:14px;min-width:100%;flex-wrap:nowrap;position:relative;padding-top:17px}
.diagram-children::before{content:"";position:absolute;top:0;left:calc(110px);right:calc(110px);border-top:1px solid var(--color-primary-stroke)}
.diagram-node{display:grid;align-content:start;gap:7px;width:210px;min-height:170px;padding:15px;border:1px solid var(--color-stroke-strong);border-radius:12px;background:var(--color-surface);text-align:left;color:var(--color-text);cursor:pointer;position:relative}
.diagram-node::before{content:"";position:absolute;top:-17px;left:50%;height:17px;border-left:1px solid var(--color-primary-stroke)}
.diagram-node:hover{border-color:var(--color-primary);background:var(--color-hover);box-shadow:var(--shadow-card)}
.node-top{display:flex;justify-content:space-between;align-items:center;color:var(--color-primary)}
.node-chevron{color:var(--color-muted)}
.diagram-node small{font-size:11px;color:var(--color-muted)}
.diagram-node strong{font-size:13px;font-weight:600;white-space:normal;overflow-wrap:anywhere}
.node-address{font-size:11px;color:var(--color-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.node-meta{font-size:11px;color:var(--color-text)}
.node-responsible{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--color-muted);overflow:hidden}
.diagram-empty{display:grid;justify-items:center;align-content:center;gap:8px;margin-top:25px;color:var(--color-muted);font-size:12px}
.diagram-empty p{margin:0}
.diagram-footer{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;padding-top:15px;border-top:1px solid var(--color-stroke)}
.diagram-footer .muted{font-size:11px}
.footer-actions{display:flex;gap:8px;flex-wrap:wrap}
.empty-canvas{padding:95px 24px;text-align:center}
.table-node-name{display:flex;align-items:center;gap:9px;max-width:340px;background:none;border:0;text-align:left;color:var(--color-text);cursor:pointer;font-size:12px}
.table-node-name:hover{color:var(--color-primary)}
.table-node-name>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.table-node-name svg{flex:none;color:var(--color-muted)}
.table-actions{display:flex;justify-content:flex-end;gap:6px}
.table-actions button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-text);cursor:pointer}
.table-actions button:hover{background:var(--color-accent-soft);color:var(--color-primary)}
.object-details{display:grid;gap:17px;min-width:0}
.detail-title{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.detail-title h3{margin:0;font-size:16px}
.detail-title p{margin:5px 0 0;font-size:12px}
.detail-actions{display:flex;gap:8px;flex-wrap:wrap}
.detail-fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.detail-fields>div{display:grid;gap:7px;padding:10px 12px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);min-width:0}
.detail-fields span{font-size:11px;color:var(--color-muted)}
.detail-fields strong{font-size:12px;font-weight:600;overflow-wrap:anywhere}
.object-assets-title{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid var(--color-stroke);padding-top:15px}
.object-assets-title h4{margin:0;font-size:14px}
.object-assets{display:grid;gap:5px}
.object-asset{display:flex;align-items:center;gap:12px;padding:9px 11px;border-radius:var(--radius-sm);background:var(--color-soft);min-width:0}
.asset-type-icon{display:grid;place-items:center;width:35px;height:35px;border-radius:8px;background:var(--color-surface);color:var(--color-primary);flex:none}
.object-asset>div:nth-child(2){display:grid;gap:5px;min-width:0;flex:1}
.object-asset strong{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.object-asset span{font-size:11px;color:var(--color-muted)}
.object-asset-location{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.history-list{display:grid;gap:8px;padding:0;list-style:none}
.history-list li{display:grid;gap:4px;padding:11px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);font-size:12px}
.history-list strong{font-weight:600}
.history-list span{color:var(--color-muted)}
@media(max-width:1240px){.map-layout{grid-template-columns:minmax(190px,225px) minmax(0,1fr)}.detail-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.map-layout{grid-template-columns:1fr}.facility-nav{position:static;max-height:270px}.tree-list{max-height:170px}.diagram-scroll{max-height:470px}}
@media(max-width:610px){
 .heading-actions{width:100%}.heading-actions :deep(.base-button){flex:1}
 .map-toolbar{align-items:flex-start}
 .map-controls{width:100%;justify-content:flex-end}
 .diagram-footer{align-items:stretch}.footer-actions{width:100%}
 .footer-actions :deep(.base-button){flex:1}
 .detail-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
 .detail-actions{width:100%}.detail-actions :deep(.base-button){flex:1}
 .object-asset-location{display:none}
}
</style>

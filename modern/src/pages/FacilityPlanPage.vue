<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  ArrowLeft, ArrowUpRight, Boxes, Building2, Check, Clock3,
  Grid2X2, ImagePlus, Maximize, Minus, Move, Plus,
  RefreshCw, Save, Search, Trash2, Warehouse, X, ZoomIn, ZoomOut,
} from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import EquipmentTypeIcon from "../components/ui/EquipmentTypeIcon.vue";
import { InventoryApiError } from "../api/client";
import {
  clearFacilityPlanBackground, getFacilityPlan, getFacilityPlanEvents,
  movePlanElement, placePlanElement, removePlanElement, resizeFacilityPlan,
  uploadFacilityPlanBackground,
} from "../api/facilityPlans";
import type { FacilityPlan, PlanElement, PlanEvent, PlanRect } from "../api/facilityPlans";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings(),route=useRoute(),router=useRouter();
const nodeId=computed(()=>typeof route.params.nodeId==="string"?route.params.nodeId:"");
const canEdit=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const plan=ref<FacilityPlan|null>(null),loading=ref(false),saving=ref(false);
const error=ref(""),notice=ref(""),query=ref(""),zoom=ref(85),grid=ref(true);
const selectedId=ref<string|null>(null);
const canvasWidth=ref(1200),canvasHeight=ref(800);
const backgroundInput=ref<HTMLInputElement|null>(null);
const historyOpen=ref(false),historyLoading=ref(false),history=ref<PlanEvent[]>([]);
const surface=ref<HTMLDivElement|null>(null);
const scrollport=ref<HTMLDivElement|null>(null);
const placed=computed(()=>plan.value?.elements.filter(el=>el.placement_id!==null)??[]);
const available=computed(()=>{
  const needle=query.value.trim().toLowerCase();
  return (plan.value?.elements??[]).filter(el=>el.placement_id===null &&
    (!needle||[el.name,el.code].some(text=>text.toLowerCase().includes(needle))));
});
const selected=computed(()=>placed.value.find(el=>el.id===selectedId.value)??null);
const stats=computed(()=>({
  placed:placed.value.length,
  available:(plan.value?.elements.length??0)-placed.value.length,
}));
const stageStyle=computed(()=>({
  width:Math.round((plan.value?.canvas_width??1200)*zoom.value/100)+"px",
  height:Math.round((plan.value?.canvas_height??800)*zoom.value/100)+"px",
}));
const surfaceStyle=computed(()=>({
  width:(plan.value?.canvas_width??1200)+"px",
  height:(plan.value?.canvas_height??800)+"px",
  transform:"scale("+zoom.value/100+")",
  transformOrigin:"0 0",
}));
type Drag={id:string;kind:"move"|"resize";initial:PlanRect;startX:number;startY:number;changed:boolean};
let drag:Drag|null=null,abort:AbortController|null=null,requestSerial=0;

watch([()=>props.companyId,nodeId],()=>{selectedId.value=null;historyOpen.value=false;
  error.value="";notice.value="";void load();},{immediate:true});
async function load(){
  abort?.abort();const controller=new AbortController();abort=controller;
  const serial=++requestSerial;
  plan.value=null;loading.value=true;error.value="";
  if(!props.companyId||!nodeId.value){loading.value=false;return;}
  try{
    const result=await getFacilityPlan(props.companyId,nodeId.value,controller.signal);
    if(controller.signal.aborted||serial!==requestSerial)return;
    plan.value=result.data;
    canvasWidth.value=result.data.canvas_width;canvasHeight.value=result.data.canvas_height;
    if(selectedId.value&&!result.data.elements.some(e=>e.id===selectedId.value&&e.placement_id))
      selectedId.value=null;
  }catch(e){if(!controller.signal.aborted&&serial===requestSerial)
    error.value=message(e);
  }finally{if(serial===requestSerial)loading.value=false;}
}
function message(e:unknown){
  if(e instanceof InventoryApiError&&e.status===409)return ui.t("plan.conflict");
  return e instanceof Error?e.message:ui.t("generic.unknownError");
}
function snapshot(el:PlanElement):PlanRect{
  return {x:el.x??0,y:el.y??0,width:el.width??100,height:el.height??80};
}
function bound(value:number,max:number,snap=true):number{
  const clamped=Math.max(0,Math.min(Math.floor(value),max));
  return snap?Math.min(Math.round(clamped/10)*10,max):clamped;
}
function rectStyle(el:PlanElement):Record<string,string>{
  return {
    left:(el.x??0)+"px",top:(el.y??0)+"px",
    width:(el.width??100)+"px",height:(el.height??80)+"px",
  };
}
function focus(el:PlanElement){selectedId.value=el.id;}
function openChild(el:PlanElement){if(el.kind==="node")
  void router.push({name:"facility-plan",params:{nodeId:el.id}});
}
function toMap(){void router.push({name:"facilities",query:{node:nodeId.value}});}
function zoomBy(step:number){
  zoom.value=Math.min(150,Math.max(50,zoom.value+step));
}
function startPointer(event:PointerEvent,el:PlanElement,kind:"move"|"resize"){
  focus(el);
  if(!canEdit.value||saving.value||!plan.value||!el.placement_id||event.button!==0)return;
  const target=surface.value;if(!target)return;
  event.preventDefault();
  target.setPointerCapture(event.pointerId);
  drag={id:el.id,kind,initial:snapshot(el),
    startX:event.clientX,startY:event.clientY,changed:false};
}
function pointerMove(event:PointerEvent){
  if(!drag||!canEdit.value||!plan.value)return;
  const el=plan.value.elements.find(item=>item.id===drag?.id);
  if(!el)return;
  const deltaX=(event.clientX-drag.startX)*100/zoom.value;
  const deltaY=(event.clientY-drag.startY)*100/zoom.value;
  const width=plan.value.canvas_width,height=plan.value.canvas_height;
  const minWidth=el.kind==="asset"?64:100,minHeight=el.kind==="asset"?64:80;
  if(drag.kind==="move"){
    el.x=bound(drag.initial.x+deltaX,width-drag.initial.width);
    el.y=bound(drag.initial.y+deltaY,height-drag.initial.height);
  }else{
    el.width=Math.max(minWidth,bound(drag.initial.width+deltaX,width-drag.initial.x));
    el.height=Math.max(minHeight,bound(drag.initial.height+deltaY,height-drag.initial.y));
  }
  drag.changed=JSON.stringify(snapshot(el))!==JSON.stringify(drag.initial);
}
function pointerEnd(){
  const operation=drag;drag=null;
  if(!operation?.changed||!plan.value)return;
  const el=plan.value.elements.find(item=>item.id===operation.id);
  if(el)void savePosition(el,operation.initial);
}
function pointerCancel(){
  if(!drag||!plan.value)return;
  const el=plan.value.elements.find(item=>item.id===drag?.id);
  if(el)Object.assign(el,drag.initial);
  drag=null;
}
async function savePosition(el:PlanElement,previous:PlanRect){
  if(!el.placement_id||!plan.value||saving.value)return;
  saving.value=true;error.value="";notice.value="";
  try{
    const result=await movePlanElement(props.companyId,nodeId.value,el.placement_id,{
      ...snapshot(el),expected_version:plan.value.version,
    });
    plan.value.version=result.data.version;
    notice.value=ui.t("plan.saved");
  }catch(e){
    Object.assign(el,previous);
    error.value=message(e);
    if(e instanceof InventoryApiError&&e.status===409)await load();
  }finally{saving.value=false;}
}
async function keyboardMove(event:KeyboardEvent,el:PlanElement){
  if(!canEdit.value||saving.value||!plan.value||!el.placement_id)return;
  const keys:Record<string,[number,number]>={
    ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],
  };
  const delta=keys[event.key];if(!delta)return;
  event.preventDefault();focus(el);
  const initial=snapshot(el),step=event.shiftKey?1:10;
  el.x=bound(initial.x+delta[0]*step,plan.value.canvas_width-initial.width,false);
  el.y=bound(initial.y+delta[1]*step,plan.value.canvas_height-initial.height,false);
  if(el.x!==initial.x||el.y!==initial.y)await savePosition(el,initial);
}
function freePosition(width:number,height:number):{x:number;y:number}|null{
  if(!plan.value)return null;
  const others=placed.value;
  for(let y=30;y+height<=plan.value.canvas_height;y+=100){
    for(let x=30;x+width<=plan.value.canvas_width;x+=120){
      if(others.every(other=>{
        const r=snapshot(other);
        return x+width+10<=r.x||r.x+r.width+10<=x||
          y+height+10<=r.y||r.y+r.height+10<=y;
      }))return {x,y};
    }
  }
  return null;
}
async function add(el:PlanElement){
  if(!canEdit.value||saving.value||!plan.value)return;
  const w=el.kind==="node"?230:100,h=el.kind==="node"?150:100;
  const pos=freePosition(w,h);
  if(!pos){error.value=ui.t("plan.noSpace");return;}
  saving.value=true;error.value="";notice.value="";
  try{
    const result=await placePlanElement(props.companyId,nodeId.value,{
      id:el.id,kind:el.kind,x:pos.x,y:pos.y,
      width:w,height:h,expected_version:plan.value.version,
    });
    el.x=pos.x;el.y=pos.y;el.width=w;el.height=h;
    el.placement_id=result.data.placement.id;
    plan.value.version=result.data.version;
    focus(el);notice.value=ui.t("plan.saved");
  }catch(e){
    error.value=message(e);
    if(e instanceof InventoryApiError&&e.status===409)await load();
  }finally{saving.value=false;}
}
async function removeSelected(){
  const el=selected.value;
  if(!canEdit.value||saving.value||!plan.value||!el?.placement_id)return;
  if(!window.confirm(ui.t("plan.confirmRemove")))return;
  saving.value=true;error.value="";notice.value="";
  try{
    const result=await removePlanElement(props.companyId,nodeId.value,
      el.placement_id,plan.value.version);
    el.x=null;el.y=null;el.width=null;el.height=null;el.placement_id=null;
    plan.value.version=result.data.version;
    selectedId.value=null;notice.value=ui.t("plan.saved");
  }catch(e){error.value=message(e);if(e instanceof InventoryApiError&&e.status===409)await load();}
  finally{saving.value=false;}
}
async function updateSize(){
  if(!canEdit.value||saving.value||!plan.value)return;
  saving.value=true;error.value="";notice.value="";
  try{
    const result=await resizeFacilityPlan(props.companyId,nodeId.value,{
      canvas_width:canvasWidth.value,canvas_height:canvasHeight.value,
      expected_version:plan.value.version,
    });
    plan.value.canvas_width=result.data.canvas_width;
    plan.value.canvas_height=result.data.canvas_height;
    plan.value.version=result.data.version;
    notice.value=ui.t("plan.saved");
  }catch(e){error.value=message(e);if(e instanceof InventoryApiError&&e.status===409)await load();}
  finally{saving.value=false;}
}
function chooseImage(){if(canEdit.value&&!saving.value)backgroundInput.value?.click();}
async function upload(event:Event){
  const input=event.target as HTMLInputElement;
  const file=input.files?.[0];input.value="";
  if(!file||!plan.value||!canEdit.value||saving.value)return;
  if(!["image/png","image/webp"].includes(file.type)||file.size>2*1024*1024){
    error.value=ui.t("plan.backgroundHint");return;
  }
  saving.value=true;error.value="";notice.value="";
  try{
    const r=await uploadFacilityPlanBackground(props.companyId,nodeId.value,file,plan.value.version);
    plan.value.version=r.data.version;plan.value.background_url=r.data.background_url;
    notice.value=ui.t("plan.uploaded");
  }catch(e){error.value=message(e);if(e instanceof InventoryApiError&&e.status===409)await load();}
  finally{saving.value=false;}
}
async function removeImage(){
  if(!canEdit.value||!plan.value?.background_url||saving.value)return;
  saving.value=true;error.value="";notice.value="";
  try{
    const r=await clearFacilityPlanBackground(props.companyId,nodeId.value,plan.value.version);
    plan.value.version=r.data.version;plan.value.background_url=null;
    notice.value=ui.t("plan.deleted");
  }catch(e){error.value=message(e);if(e instanceof InventoryApiError&&e.status===409)await load();}
  finally{saving.value=false;}
}
async function openHistory(){
  historyOpen.value=true;historyLoading.value=true;history.value=[];
  try{const data=await getFacilityPlanEvents(props.companyId,nodeId.value);
    if(historyOpen.value)history.value=data.data;
  }catch(e){error.value=message(e);}finally{historyLoading.value=false;}
}
onUnmounted(()=>{abort?.abort();drag=null});
</script>

<template>
  <div class="plan-page">
    <header class="plan-header">
      <div class="plan-heading">
        <button type="button" class="icon-control" :title="ui.t('plan.back')" @click="toMap">
          <ArrowLeft :size="19" aria-hidden="true"/>
        </button>
        <div><h2>{{ plan?.node_name||ui.t("plan.title") }}</h2>
          <p class="muted">{{ companyName }} · {{ ui.t("plan.subtitle") }}</p></div>
      </div>
      <div class="plan-actions">
        <span class="plan-mode">{{ ui.t(canEdit?"plan.edit":"plan.view") }}</span>
        <BaseButton variant="secondary" :disabled="loading||saving" @click="load">
          <RefreshCw :size="16" aria-hidden="true"/>{{ ui.t("plan.refresh") }}
        </BaseButton>
        <BaseButton variant="secondary" :disabled="loading" @click="openHistory">
          <Clock3 :size="16" aria-hidden="true"/>{{ ui.t("plan.history") }}
        </BaseButton>
      </div>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <div v-if="loading" class="plan-loading muted">{{ ui.t("generic.loading") }}</div>
    <div v-else-if="!plan" class="plan-loading">{{ ui.t("plan.noNode") }}</div>
    <template v-else>
      <div class="plan-statbar">
        <span><Check :size="16" aria-hidden="true"/>{{ ui.t("plan.positions") }}: <strong>{{ stats.placed }}</strong></span>
        <span><Boxes :size="16" aria-hidden="true"/>{{ ui.t("plan.available") }}: <strong>{{ stats.available }}</strong></span>
        <span>{{ ui.t("plan.versions") }}: <strong>{{ plan.version }}</strong></span>
        <span v-if="saving" role="status">{{ ui.t("plan.saving") }}</span>
      </div>
      <div class="plan-layout">
        <div class="plan-main">
          <BaseCard class="plan-editor-card">
            <div class="plan-toolbar">
              <div class="plan-toolbar-title">
                <Grid2X2 :size="19" aria-hidden="true"/>
                <strong>{{ ui.t("plan.canvas") }}</strong>
                <span class="muted">{{ plan.canvas_width }} × {{ plan.canvas_height }}</span>
              </div>
              <div class="zoom-controls" role="group" :aria-label="ui.t('topology.view')">
                <button type="button" :title="ui.t('plan.zoomOut')" :aria-label="ui.t('plan.zoomOut')" @click="zoomBy(-10)">
                  <ZoomOut :size="17" aria-hidden="true"/></button>
                <span>{{ zoom }}%</span>
                <button type="button" :title="ui.t('plan.zoomIn')" :aria-label="ui.t('plan.zoomIn')" @click="zoomBy(10)">
                  <ZoomIn :size="17" aria-hidden="true"/></button>
                <button type="button" :title="ui.t('plan.resetZoom')" :aria-label="ui.t('plan.resetZoom')" @click="zoom=100">
                  <Maximize :size="17" aria-hidden="true"/></button>
              </div>
            </div>
            <div class="canvas-scroll" ref="scrollport" :aria-label="ui.t('plan.canvas')">
              <div class="canvas-stage" :style="stageStyle">
                <div ref="surface" class="canvas-surface" :class="{gridded:grid}"
                  :style="surfaceStyle" @pointermove="pointerMove" @pointerup="pointerEnd"
                  @pointercancel="pointerCancel" @lostpointercapture="pointerEnd">
                  <img v-if="plan.background_url" class="canvas-image" :src="plan.background_url"
                    :alt="ui.t('plan.background')" draggable="false"/>
                  <div v-for="el in placed" :key="el.kind+el.id" class="plan-object"
                    :class="[el.kind==='node'?'plan-object--room':'plan-object--equipment',
                      {selected:selectedId===el.id,editable:canEdit}]"
                    :style="rectStyle(el)" role="group" :aria-label="el.name">
                    <button type="button" class="plan-object-body"
                      :title="el.name+' · '+el.code" :aria-label="el.name+' · '+el.code"
                      :disabled="saving"
                      @click="focus(el)" @keydown="keyboardMove($event,el)"
                      @pointerdown="startPointer($event,el,'move')">
                      <div class="plan-object-top">
                        <EquipmentTypeIcon v-if="el.kind==='asset'" :size="21"
                          :icon-key="el.icon_key" :icon-url="el.icon_url"/>
                        <Building2 v-else-if="el.node_type==='building'" :size="20" aria-hidden="true"/>
                        <Warehouse v-else-if="el.node_type==='warehouse'" :size="20" aria-hidden="true"/>
                        <Grid2X2 v-else :size="20" aria-hidden="true"/>
                        <Move v-if="canEdit" :size="14" class="grab-symbol" aria-hidden="true"/>
                      </div>
                      <strong>{{ el.name }}</strong>
                      <span>{{ el.code }}</span>
                    </button>
                    <button v-if="el.kind==='node'" type="button" class="plan-enter"
                      :aria-label="ui.t('plan.enter')+': '+el.name" :title="ui.t('plan.enter')"
                      @pointerdown.stop @click.stop="openChild(el)">
                      <ArrowUpRight :size="15" aria-hidden="true"/>
                    </button>
                    <button v-if="canEdit&&el.kind==='node'" type="button" class="plan-resize-handle"
                      :aria-label="ui.t('plan.resize')+': '+el.name" :title="ui.t('plan.resize')"
                      @pointerdown.stop.prevent="startPointer($event,el,'resize')">
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                        <path d="M6 16L16 6M11 16L16 11" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                  <div v-if="!placed.length" class="plan-empty">
                    <Grid2X2 :size="34" aria-hidden="true"/>
                    <span>{{ ui.t("plan.noPlacements") }}</span>
                  </div>
                </div>
              </div>
            </div>
            <footer class="plan-footnote">
              <label class="grid-checkbox"><input v-model="grid" type="checkbox"/>
                {{ ui.t("plan.grid") }}</label>
              <span class="muted">{{ ui.t(canEdit?"plan.editorHint":"plan.readonly") }}</span>
            </footer>
          </BaseCard>
          <BaseCard class="plan-options" v-if="canEdit">
            <div class="option-title"><h3>{{ ui.t("plan.canvasSize") }}</h3></div>
            <form class="canvas-options-row" @submit.prevent="updateSize">
              <label>{{ ui.t("plan.width") }}
                <input v-model.number="canvasWidth" type="number" min="600" max="2400" step="10" required :disabled="saving"/></label>
              <label>{{ ui.t("plan.height") }}
                <input v-model.number="canvasHeight" type="number" min="400" max="1800" step="10" required :disabled="saving"/></label>
              <BaseButton type="submit" variant="secondary" :disabled="saving||!Number.isFinite(canvasWidth)||!Number.isFinite(canvasHeight)">
                <Save :size="16" aria-hidden="true"/>{{ ui.t("plan.applySize") }}</BaseButton>
            </form>
            <div class="background-settings">
              <div><h3>{{ ui.t("plan.background") }}</h3>
                <p class="muted">{{ ui.t("plan.backgroundHint") }}</p></div>
              <div class="option-buttons">
                <BaseButton variant="secondary" :disabled="saving" @click="chooseImage">
                  <ImagePlus :size="16" aria-hidden="true"/>{{ ui.t("plan.upload") }}</BaseButton>
                <BaseButton v-if="plan.background_url" variant="secondary" :disabled="saving" @click="removeImage">
                  <Trash2 :size="16" aria-hidden="true"/>{{ ui.t("plan.removeBackground") }}</BaseButton>
              </div>
              <input ref="backgroundInput" type="file" accept="image/png,image/webp" class="visually-hidden"
                :aria-label="ui.t('plan.upload')" @change="upload"/>
            </div>
          </BaseCard>
        </div>

        <aside class="plan-side">
          <BaseCard class="catalog-card">
            <div class="catalog-heading"><h3>{{ ui.t("plan.catalog") }}</h3>
              <strong>{{ available.length }}</strong></div>
            <label class="catalog-search"><Search :size="16" aria-hidden="true"/>
              <input v-model="query" :placeholder="ui.t('plan.search')"
                :aria-label="ui.t('plan.search')"/></label>
            <p v-if="!plan.elements.length" class="muted">{{ ui.t("plan.noItems") }}</p>
            <p v-else-if="!available.length" class="muted">{{ ui.t("plan.emptyCatalog") }}</p>
            <div v-else class="catalog-list">
              <div v-for="el in available" :key="el.kind+el.id" class="catalog-item">
                <div class="catalog-icon">
                  <EquipmentTypeIcon v-if="el.kind==='asset'" :icon-key="el.icon_key" :icon-url="el.icon_url" :size="21"/>
                  <Building2 v-else :size="21" aria-hidden="true"/>
                </div>
                <div class="catalog-description">
                  <strong :title="el.name">{{ el.name }}</strong>
                  <span>{{ el.code }}</span>
                  <small>{{ ui.t(el.kind==='node'?'plan.children':'plan.assets') }}</small>
                </div>
                <button v-if="canEdit" type="button" class="catalog-add"
                  :disabled="saving" :aria-label="ui.t('plan.place')+': '+el.name"
                  :title="ui.t('plan.place')" @click="add(el)">
                  <Plus :size="18" aria-hidden="true"/>
                </button>
              </div>
            </div>
          </BaseCard>
          <BaseCard v-if="selected" class="selection-card">
            <div class="catalog-heading"><h3>{{ selected.name }}</h3>
              <button class="icon-control" type="button" :title="ui.t('actions.cancel')"
                @click="selectedId=null"><X :size="17" aria-hidden="true"/></button></div>
            <p class="muted">{{ selected.code }}</p>
            <div class="selected-stats">
              <div><span>{{ ui.t("plan.coordinates") }}</span>
                <strong>{{ selected.x }}, {{ selected.y }}</strong></div>
              <div><span>{{ ui.t("plan.dimensions") }}</span>
                <strong>{{ selected.width }} × {{ selected.height }}</strong></div>
            </div>
            <p v-if="selected.responsible_name" class="muted">{{ selected.responsible_name }}</p>
            <div class="selection-actions">
              <BaseButton v-if="selected.kind==='node'" variant="secondary" @click="openChild(selected)">
                <ArrowUpRight :size="16" aria-hidden="true"/>{{ ui.t("plan.enter") }}</BaseButton>
              <BaseButton v-if="canEdit" variant="secondary" :disabled="saving" @click="removeSelected">
                <Minus :size="16" aria-hidden="true"/>{{ ui.t("plan.unplace") }}</BaseButton>
              </div>
          </BaseCard>
          <BaseCard class="plan-info">
            <p>{{ ui.t("plan.locationNote") }}</p>
            <RouterLink to="/registry">{{ ui.t("plan.goAssets") }} <ArrowUpRight :size="14" aria-hidden="true"/></RouterLink>
          </BaseCard>
        </aside>
      </div>
    </template>
    <BaseDialog :open="historyOpen" :title="ui.t('plan.history')" @close="historyOpen=false">
      <div v-if="historyLoading" class="muted">{{ ui.t("generic.loading") }}</div>
      <p v-else-if="!history.length" class="muted">{{ ui.t("plan.historyEmpty") }}</p>
      <ol v-else class="plan-event-list">
        <li v-for="event in history" :key="event.id">
          <strong>{{ ui.t("plan.event."+event.event_type) }}</strong>
          <span>{{ event.actor_name }} · v{{ event.version }} · {{ new Date(event.created_at).toLocaleString(ui.locale) }}</span>
        </li>
      </ol>
    </BaseDialog>
  </div>
</template>

<style scoped>
.plan-page{display:grid;gap:17px;min-width:0}
.plan-header,.plan-heading,.plan-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.plan-header{justify-content:space-between}
.plan-heading h2{font-size:20px;margin:0;line-height:1.35}
.plan-heading p{margin:5px 0 0;font-size:12px}
.plan-actions{gap:8px}
.plan-mode{font-size:11px;color:var(--color-muted);background:var(--color-soft);border:1px solid var(--color-stroke);padding:8px 10px;border-radius:var(--radius-sm)}
.icon-control{display:grid;place-items:center;width:36px;height:36px;flex:none;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);color:var(--color-text);background:var(--color-surface);cursor:pointer}
.icon-control:hover{color:var(--color-primary);background:var(--color-hover)}
.plan-loading{min-height:330px;display:grid;place-items:center}
.plan-statbar{display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-size:12px}
.plan-statbar>span{display:flex;align-items:center;gap:6px;color:var(--color-muted)}
.plan-statbar strong{color:var(--color-text)}
.plan-statbar svg{color:var(--color-primary)}
.plan-layout{display:grid;grid-template-columns:minmax(0,1fr) 274px;gap:17px;align-items:start}
.plan-main{display:grid;gap:17px;min-width:0}
.plan-side{display:grid;gap:17px;min-width:0;position:sticky;top:12px}
.plan-toolbar,.plan-toolbar-title,.zoom-controls{display:flex;align-items:center;gap:9px}
.plan-toolbar{justify-content:space-between;flex-wrap:wrap;padding-bottom:15px;border-bottom:1px solid var(--color-stroke)}
.plan-toolbar-title strong{font-size:13px;font-weight:600}
.plan-toolbar-title svg{color:var(--color-primary)}
.plan-toolbar-title .muted{font-size:11px}
.zoom-controls{gap:3px}
.zoom-controls button{border:0;background:transparent;color:var(--color-muted);border-radius:6px;width:32px;height:33px;display:grid;place-items:center;cursor:pointer}
.zoom-controls button:hover{background:var(--color-hover);color:var(--color-primary)}
.zoom-controls span{font-size:11px;min-width:37px;text-align:center}
.canvas-scroll{width:100%;overflow:auto;min-height:390px;max-height:calc(100vh - 265px);max-height:650px;padding:19px 9px 22px;overscroll-behavior:contain}
.canvas-stage{margin:0 auto;position:relative;max-width:none}
.canvas-surface{position:relative;isolation:isolate;background:var(--color-soft);border:1px solid var(--color-stroke-strong);
  box-shadow:var(--shadow-card);border-radius:10px;overflow:hidden}
.canvas-surface.gridded{background-image:linear-gradient(to right,var(--color-stroke-strong) 1px,transparent 1px),
  linear-gradient(to bottom,var(--color-stroke-strong) 1px,transparent 1px);background-size:25px 25px}
.canvas-image{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none;opacity:.78}
.plan-object{position:absolute;z-index:2;display:grid;align-content:stretch;min-width:0;border:1px solid var(--color-primary-stroke);
  border-radius:10px;box-shadow:var(--shadow-control);background:var(--color-surface-raised);color:var(--color-text)}
.plan-object--room{background:var(--color-accent-soft);border:2px solid var(--color-primary-stroke)}
.plan-object--equipment{background:var(--color-surface);border:1px solid var(--color-stroke-strong)}
.plan-object.selected{border-color:var(--color-primary);box-shadow:0 0 0 2px var(--color-primary-stroke)}
.plan-object.editable{cursor:grab}
.plan-object.editable:active{cursor:grabbing}
.plan-object-body{min-height:0;width:100%;height:100%;padding:8px 9px;display:grid;grid-template-rows:auto min-content min-content;
 align-content:center;justify-items:start;gap:3px;border:0;background:transparent;text-align:left;color:inherit;cursor:inherit;overflow:hidden}
.plan-object-body strong{font-size:11px;line-height:15px;font-weight:600;min-width:0;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.plan-object-body span{font-size:10px;line-height:13px;color:var(--color-muted);width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.plan-object-top{display:flex;justify-content:space-between;align-items:center;width:100%;gap:5px;color:var(--color-primary)}
.grab-symbol{margin-left:auto;color:var(--color-muted)}
.plan-enter{position:absolute;right:7px;top:6px;display:grid;place-items:center;width:23px;height:23px;background:var(--color-surface);border:1px solid var(--color-stroke);
  border-radius:6px;color:var(--color-primary);cursor:pointer}
.plan-resize-handle{position:absolute;right:0;bottom:0;width:24px;height:24px;display:grid;place-items:center;border:0;background:transparent;color:var(--color-primary);cursor:nwse-resize;touch-action:none}
.plan-object-body{touch-action:none}
.plan-empty{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:grid;justify-items:center;gap:10px;
  width:min(360px,80%);padding:20px;background:var(--color-surface-raised);border:1px dashed var(--color-stroke-strong);
  border-radius:10px;color:var(--color-muted);text-align:center;font-size:12px;pointer-events:none}
.plan-empty svg{color:var(--color-primary)}
.plan-footnote{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;
 border-top:1px solid var(--color-stroke);padding-top:14px}
.plan-footnote .muted{font-size:11px;line-height:17px;max-width:560px}
.grid-checkbox{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--color-text)}
.plan-options{display:grid;gap:20px;min-width:0}
.option-title h3,.background-settings h3{font-size:14px;margin:0;font-weight:600}
.canvas-options-row{display:flex;align-items:end;gap:12px;flex-wrap:wrap}
.canvas-options-row label{display:grid;gap:5px;font-size:11px;color:var(--color-muted);max-width:145px}
.canvas-options-row input{width:100%}
.background-settings{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:13px;border-top:1px solid var(--color-stroke)}
.background-settings p{font-size:11px;margin:6px 0 0}
.option-buttons{display:flex;gap:8px;flex-wrap:wrap}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(100%);white-space:nowrap}
.catalog-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px}
.catalog-heading h3{font-size:13px;line-height:18px;margin:0;min-width:0;overflow-wrap:anywhere;font-weight:600}
.catalog-heading>strong{font-size:12px;color:var(--color-muted)}
.catalog-search{display:flex;align-items:center;gap:8px;padding:0 9px;min-width:0;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);margin-bottom:11px}
.catalog-search input{background:transparent;outline:none;box-shadow:none;border:0;min-width:0;width:100%;font-size:12px}
.catalog-list{display:grid;gap:6px;max-height:440px;overflow-y:auto}
.catalog-item{display:flex;align-items:center;gap:9px;min-width:0;padding:10px 8px;background:var(--color-soft);border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
.catalog-icon{width:33px;height:33px;flex:none;display:grid;place-items:center;color:var(--color-primary);background:var(--color-surface);border-radius:8px}
.catalog-description{display:grid;gap:3px;min-width:0;flex:1}
.catalog-description strong{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;font-weight:600}
.catalog-description span,.catalog-description small{font-size:10px;color:var(--color-muted)}
.catalog-add{width:30px;height:30px;flex:none;border:1px solid var(--color-stroke-strong);color:var(--color-primary);border-radius:var(--radius-sm);background:var(--color-surface);display:grid;place-items:center;cursor:pointer}
.catalog-add:hover{background:var(--color-accent-soft)}
.catalog-card>.muted{font-size:12px}
.selection-card>.muted{font-size:11px;margin:0 0 10px}
.selected-stats{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.selected-stats>div{display:grid;gap:5px;padding:10px;background:var(--color-soft);border-radius:var(--radius-sm)}
.selected-stats span{font-size:10px;color:var(--color-muted)}
.selected-stats strong{font-size:12px}
.selection-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}
.plan-info p{font-size:11px;line-height:18px;color:var(--color-muted);margin:0 0 12px}
.plan-info a{display:flex;gap:5px;align-items:center;color:var(--color-text);text-decoration:underline;text-underline-offset:3px;font-size:12px}
.plan-info a:hover{color:var(--color-primary)}
.plan-event-list{list-style:none;padding:0;display:grid;gap:9px}
.plan-event-list li{display:grid;gap:5px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);padding:11px}
.plan-event-list strong{font-size:12px}
.plan-event-list span{font-size:11px;color:var(--color-muted)}
@media(max-width:1170px){.plan-layout{grid-template-columns:minmax(0,1fr) 235px}}
@media(max-width:930px){.plan-layout{grid-template-columns:1fr}.plan-side{position:static;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}
  .plan-info{grid-column:1 / -1}.catalog-list{max-height:280px}.canvas-scroll{max-height:490px}}
@media(max-width:600px){
 .plan-heading{width:100%}.plan-heading>div{min-width:0;flex:1}
 .plan-heading h2{font-size:17px;overflow-wrap:anywhere}
 .plan-actions{width:100%}.plan-actions :deep(.base-button){flex:1}
 .plan-statbar{gap:10px}.plan-toolbar{gap:10px}.zoom-controls{width:100%;justify-content:flex-end}
 .canvas-scroll{min-height:340px;max-height:445px}
 .plan-side{grid-template-columns:1fr}
 .plan-info{grid-column:auto}
 .canvas-options-row label{width:calc(50% - 9px);max-width:none}
 .canvas-options-row :deep(.base-button){width:100%}
 .option-buttons{width:100%}
 .option-buttons :deep(.base-button){flex:1}
}
@media(prefers-reduced-motion:reduce){.plan-object{transition:none}}
</style>

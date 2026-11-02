<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { BarChart3, Download, Printer, RefreshCw, Package, Warehouse, ClipboardCheck, AlertTriangle } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BaseSelect from "../components/ui/BaseSelect.vue";
import BaseStatusPill from "../components/ui/BaseStatusPill.vue";
import { getInventorySummary, summaryCsvHref, summaryPrintDocument } from "../api/reports";
import type { InventorySummary } from "../api/reports";
import { getFacilityNodes, getResponsiblePeople } from "../api/topology";
import type { FacilityNode, ResponsiblePerson } from "../api/topology";
import { useUiSettings } from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const loading=ref(false),error=ref(""),report=ref<InventorySummary|null>(null);
const facilities=ref<FacilityNode[]>([]),people=ref<ResponsiblePerson[]>([]);
const filters=reactive({status:"",facility_node_id:"",responsible_person_id:""});
let request:AbortController|null=null,serial=0;

const t=computed(()=>ui.locale==="ka"
  ? {title:"ანგარიშები",subtitle:"ქონების, საწყობებისა და ინვენტარიზაციების შეჯამება",
      refresh:"განახლება",csv:"Excel / CSV",print:"ბეჭდვა / PDF",status:"სტატუსი",
      all:"ყველა",facility:"ობიექტი",person:"პასუხისმგებელი",assets:"აქტივები",
      stockItems:"სასაწყობე პოზიციები",lowStock:"დაბალი ნაშთი",stocktakes:"ინვენტარიზაციები",
      statusGroup:"სტატუსების მიხედვით",categoryGroup:"კატეგორიების მიხედვით",
      facilityGroup:"ობიექტების მიხედვით",personGroup:"პასუხისმგებლების მიხედვით",
      warehouseGroup:"საწყობები",sessionGroup:"ინვენტარიზაციები",
      name:"დასახელება",count:"რაოდენობა",item:"პოზიციები",quantity:"რაოდენობა",
      expected:"გეგმური",counted:"დათვლილი",discrepancies:"სხვაობა",
      noData:"ჩანაწერები არ არის",unassigned:"მითითებული არ არის",date:"მომზადებულია",
      popup:"ბრაუზერმა დაბლოკა ბეჭდვის ფანჯარა"}
  : ui.locale==="en"
    ? {title:"Reports",subtitle:"Asset, warehouse and stocktake summaries",
        refresh:"Refresh",csv:"Excel / CSV",print:"Print / PDF",status:"Status",
        all:"All",facility:"Facility",person:"Custodian",assets:"Assets",
        stockItems:"Warehouse SKUs",lowStock:"Low stock",stocktakes:"Stocktakes",
        statusGroup:"By status",categoryGroup:"By category",facilityGroup:"By facility",
        personGroup:"By custodian",warehouseGroup:"Warehouses",sessionGroup:"Stocktakes",
        name:"Name",count:"Count",item:"SKUs",quantity:"Quantity",expected:"Expected",
        counted:"Counted",discrepancies:"Discrepancies",noData:"No data",
        unassigned:"Unassigned",date:"Generated",popup:"The browser blocked the print window"}
    : {title:"Отчёты",subtitle:"Сводка по имуществу, складам и инвентаризациям",
        refresh:"Обновить",csv:"Excel / CSV",print:"Печать / PDF",status:"Статус",
        all:"Все",facility:"Объект",person:"Ответственное лицо",assets:"Активы",
        stockItems:"Позиций на складе",lowStock:"Малые остатки",stocktakes:"Инвентаризации",
        statusGroup:"По статусам",categoryGroup:"По категориям",facilityGroup:"По объектам",
        personGroup:"По ответственным",warehouseGroup:"Склады",sessionGroup:"Инвентаризации",
        name:"Наименование",count:"Количество",item:"Позиций",quantity:"Количество",
        expected:"По плану",counted:"Проверено",discrepancies:"Расхождения",
        noData:"Нет данных",unassigned:"Не назначено",date:"Сформирован",
        popup:"Браузер заблокировал окно печати"});

const groups=computed(()=>[
  {key:"by_status",title:t.value.statusGroup,rows:report.value?.assets.by_status??[]},
  {key:"by_category",title:t.value.categoryGroup,rows:report.value?.assets.by_category??[]},
  {key:"by_facility",title:t.value.facilityGroup,rows:report.value?.assets.by_facility??[]},
  {key:"by_responsible",title:t.value.personGroup,rows:report.value?.assets.by_responsible??[]},
]);
const groupColumns=computed(()=>[
  {key:"name",label:t.value.name,minWidth:170},
  {key:"total",label:t.value.count,minWidth:100,align:"right" as const},
]);
const warehouseColumns=computed(()=>[
  {key:"name",label:t.value.name,minWidth:170},
  {key:"items",label:t.value.item,minWidth:110,align:"right" as const},
  {key:"quantity_milli",label:t.value.quantity,minWidth:120,align:"right" as const},
]);
const sessionColumns=computed(()=>[
  {key:"status",label:t.value.status,minWidth:150},
  {key:"sessions",label:t.value.count,minWidth:110,align:"right" as const},
  {key:"items",label:t.value.expected,minWidth:110,align:"right" as const},
  {key:"counted",label:t.value.counted,minWidth:110,align:"right" as const},
  {key:"discrepancies",label:t.value.discrepancies,minWidth:130,align:"right" as const},
]);
const totalSessions=computed(()=>report.value?.stocktakes.reduce((a,row)=>a+row.sessions,0)??0);
const csvHref=computed(()=>summaryCsvHref(props.companyId,filters));
async function load(){
  request?.abort();
  const controller=new AbortController();request=controller;
  const current=++serial;
  if(!props.companyId){report.value=null;return;}
  loading.value=true;error.value="";
  try{
    const result=await getInventorySummary(props.companyId,{...filters},controller.signal);
    if(current===serial&&!controller.signal.aborted)report.value=result.data;
  }catch(e){
    if(current===serial&&!controller.signal.aborted)error.value=e instanceof Error?e.message:String(e);
  }finally{
    if(current===serial)loading.value=false;
  }
}
watch(()=>props.companyId,async id=>{
  filters.status="";filters.facility_node_id="";filters.responsible_person_id="";
  report.value=null;facilities.value=[];people.value=[];
  if(!id)return;
  try{
    const [nodes,persons]=await Promise.all([
      getFacilityNodes(id),getResponsiblePeople(id,{page:1,per_page:100,active:"1"}),
    ]);
    if(id===props.companyId){facilities.value=nodes.data;people.value=persons.data;}
  }catch{ /* Reports remain usable if optional filter dictionaries are unavailable. */ }
},{immediate:true});
watch([()=>props.companyId,filters],()=>{void load();},{immediate:true,deep:true});
onUnmounted(()=>request?.abort());

function printReport(){
  if(!report.value||loading.value)return;
  // The data is already loaded. Open synchronously in response to the click.
  const popup=window.open("","_blank","width=950,height=880");
  if(!popup){error.value=t.value.popup;return;}
  popup.opener=null;
  popup.document.open();
  popup.document.write(summaryPrintDocument(report.value,ui.locale));
  popup.document.close();
  popup.focus();
  popup.print();
}
function dateLabel(value:string){
  const locale=ui.locale==="ka"?"ka-GE":ui.locale==="en"?"en-GB":"ru-RU";
  return new Date(value).toLocaleString(locale);
}
</script>

<template>
  <div class="report-page">
    <header class="report-heading">
      <div><h2>{{t.title}}</h2><p class="muted">{{t.subtitle}}</p></div>
      <div class="report-actions">
        <BaseButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw :size="17" aria-hidden="true"/>{{t.refresh}}
        </BaseButton>
        <a :href="csvHref" class="report-export" download :aria-label="t.csv" :title="t.csv">
          <Download :size="17" aria-hidden="true"/>{{t.csv}}
        </a>
        <BaseButton :disabled="!report||loading" @click="printReport">
          <Printer :size="17" aria-hidden="true"/>{{t.print}}
        </BaseButton>
      </div>
    </header>
    <div v-if="error" class="report-error" role="alert">{{error}}</div>
    <BaseCard class="report-filters">
      <label><span>{{t.status}}</span>
        <BaseSelect v-model="filters.status" :aria-label="t.status">
          <option value="">{{t.all}}</option>
          <option value="active">{{ui.t("status.active")}}</option>
          <option value="written_off">{{ui.t("status.written_off")}}</option>
          <option value="disposed">{{ui.t("status.disposed")}}</option>
        </BaseSelect>
      </label>
      <label><span>{{t.facility}}</span>
        <BaseSelect v-model="filters.facility_node_id" :aria-label="t.facility">
          <option value="">{{t.all}}</option>
          <option v-for="node in facilities" :key="node.id" :value="node.id">{{node.name}}</option>
        </BaseSelect>
      </label>
      <label><span>{{t.person}}</span>
        <BaseSelect v-model="filters.responsible_person_id" :aria-label="t.person">
          <option value="">{{t.all}}</option>
          <option v-for="person in people" :key="person.id" :value="person.id">{{person.name}}</option>
        </BaseSelect>
      </label>
    </BaseCard>
    <div class="report-metrics">
      <BaseCard><Package :size="23" aria-hidden="true"/><strong>{{report?.assets.total??0}}</strong><span>{{t.assets}}</span></BaseCard>
      <BaseCard><Warehouse :size="23" aria-hidden="true"/><strong>{{report?.warehouses.total_items??0}}</strong><span>{{t.stockItems}}</span></BaseCard>
      <BaseCard><AlertTriangle :size="23" aria-hidden="true"/><strong>{{report?.warehouses.low_stock_items??0}}</strong><span>{{t.lowStock}}</span></BaseCard>
      <BaseCard><ClipboardCheck :size="23" aria-hidden="true"/><strong>{{totalSessions}}</strong><span>{{t.stocktakes}}</span></BaseCard>
    </div>
    <p v-if="report" class="generated-at">{{report.company.name}} · {{t.date}} {{dateLabel(report.generated_at)}}</p>
    <div class="report-groups">
      <BaseCard v-for="group in groups" :key="group.key" class="report-panel">
        <div class="panel-header"><BarChart3 :size="18" aria-hidden="true"/><h3>{{group.title}}</h3></div>
        <BaseDataTable :rows="group.rows" row-key="id" :columns="groupColumns"
          :loading="loading" :caption="group.title" :empty-title="t.noData" :min-table-width="350">
          <template #cell-name="{row}">{{row.name||t.unassigned}}</template>
        </BaseDataTable>
      </BaseCard>
      <BaseCard class="report-panel">
        <div class="panel-header"><Warehouse :size="18" aria-hidden="true"/><h3>{{t.warehouseGroup}}</h3></div>
        <BaseDataTable :rows="report?.warehouses.by_warehouse??[]" row-key="id"
          :columns="warehouseColumns" :loading="loading" :caption="t.warehouseGroup"
          :empty-title="t.noData" :min-table-width="430">
          <template #cell-name="{row}">{{row.name||t.unassigned}}</template>
          <template #cell-quantity_milli="{row}">{{(row.quantity_milli/1000).toLocaleString(ui.locale)}}</template>
        </BaseDataTable>
      </BaseCard>
      <BaseCard class="report-panel">
        <div class="panel-header"><ClipboardCheck :size="18" aria-hidden="true"/><h3>{{t.sessionGroup}}</h3></div>
        <BaseDataTable :rows="report?.stocktakes??[]" row-key="status" :columns="sessionColumns"
          :loading="loading" :caption="t.sessionGroup" :empty-title="t.noData" :min-table-width="650">
          <template #cell-status="{row}">
            <BaseStatusPill :tone="row.status==='completed'?'success':'warning'">
              {{ui.t(row.status==='completed'?'stock.completed':'stock.inProgress')}}
            </BaseStatusPill>
          </template>
        </BaseDataTable>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.report-page{display:grid;gap:18px;min-width:0}
.report-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.report-heading h2{margin:0}.report-heading p{margin:6px 0 0}
.report-actions{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
.report-export{display:flex;align-items:center;gap:8px;min-height:40px;padding:8px 12px;font-size:13px;
  border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface);
  text-decoration:none;color:var(--color-text)}
.report-export:hover{background:var(--color-hover)}
.report-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}
.report-filters label{display:grid;gap:6px;color:var(--color-muted);font-size:12px;min-width:0}
.report-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.report-metrics :deep(.base-card){display:grid;gap:7px}
.report-metrics svg,.panel-header svg{color:var(--color-primary)}
.report-metrics strong{font-size:25px;font-weight:600;color:var(--color-text)}
.report-metrics span{font-size:12px;color:var(--color-muted)}
.generated-at{margin:0;font-size:12px;color:var(--color-muted)}
.report-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
.report-panel{min-width:0}
.panel-header{display:flex;align-items:center;gap:9px;margin:0 0 13px}
.panel-header h3{font-size:14px;margin:0}
.report-error{color:var(--color-danger)}
@media(max-width:1050px){.report-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){.report-filters{grid-template-columns:1fr}.report-groups{grid-template-columns:1fr}}
@media(max-width:580px){.report-actions{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.report-actions :deep(.base-button),.report-export{justify-content:center;min-width:0;font-size:12px;padding:8px 5px}
.report-metrics{gap:9px}}
</style>

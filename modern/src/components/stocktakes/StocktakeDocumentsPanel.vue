<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, Paperclip, Upload } from "lucide-vue-next";
import BaseButton from "../ui/BaseButton.vue";
import BaseCard from "../ui/BaseCard.vue";
import { useUiSettings } from "../../stores/uiSettings";
import {reportDocuments, reportDocumentHref, uploadReportDocument} from "../../api/parity";
import type {ReportDocument} from "../../api/parity";
import {getInventorySession} from "../../api/stocktakes";
import type {InventorySession} from "../../api/stocktakes";

const props=defineProps<{
  companyId:string;
  stocktake:InventorySession;
  canWrite:boolean;
  active:boolean;
}>();
const emit=defineEmits<{ "session-updated": [session:InventorySession] }>();
const ui=useUiSettings();
const documents=ref<ReportDocument[]>([]);
const documentFile=ref<File|null>(null);
const documentInput=ref<HTMLInputElement|null>(null);
const documentBusy=ref(false);
const documentError=ref("");
let request=0;
const documentText=computed(()=>ui.locale==="ru"
  ? {title:"Подписанные отчёты и вложения",upload:"Прикрепить документ",
      info:"Документы доступны участникам этой компании после завершения инвентаризации."}
  : ui.locale==="ka"
    ? {title:"ხელმოწერილი ანგარიშები და ფაილები",upload:"დოკუმენტის ატვირთვა",
        info:"ფაილები ხელმისაწვდომია კომპანიის წევრებისთვის ინვენტარიზაციის დასრულების შემდეგ."}
    : {title:"Signed reports and attachments",upload:"Attach document",
        info:"Files are available to company members after completing the stocktake."});

async function loadDocuments(){
  const token=++request;
  documents.value=[];documentFile.value=null;documentError.value="";
  const company=props.companyId,id=props.stocktake.id;
  try {
    const result=await reportDocuments(company,id);
    if(token===request&&props.companyId===company&&props.stocktake.id===id)
      documents.value=result.data;
  }catch(e){
    if(token===request)documentError.value=e instanceof Error?e.message:String(e);
  }
}
watch([()=>props.companyId,()=>props.stocktake.id],()=>void loadDocuments(),{immediate:true});
function chooseDocument(event:Event){
  documentFile.value=(event.target as HTMLInputElement).files?.[0]??null;
}
async function uploadDocument(){
  if(!props.companyId||!documentFile.value||!props.canWrite||props.active||documentBusy.value)return;
  const company=props.companyId,id=props.stocktake.id;
  documentBusy.value=true;documentError.value="";
  try {
    await uploadReportDocument(company,id,props.stocktake.version,documentFile.value);
    // Never publish stale data after a tenant / session change.
    if(company!==props.companyId||id!==props.stocktake.id)return;
    documentFile.value=null;
    if(documentInput.value)documentInput.value.value="";
    const refreshed=await getInventorySession(company,id);
    if(company!==props.companyId||id!==props.stocktake.id)return;
    emit("session-updated",refreshed.data);
    await loadDocuments();
  }catch(e){
    if(company===props.companyId&&id===props.stocktake.id)
      documentError.value=e instanceof Error?e.message:String(e);
  }finally{documentBusy.value=false;}
}
</script>

<template>
  <BaseCard class="document-panel">
    <div class="document-header">
      <h3><Paperclip :size="18" aria-hidden="true"/>{{ documentText.title }}</h3>
      <p class="muted">{{ documentText.info }}</p>
    </div>
    <p v-if="documentError" class="error" role="alert">{{ documentError }}</p>
    <div v-if="documents.length" class="document-list">
      <a v-for="doc in documents" :key="doc.id" class="download-link"
        :href="reportDocumentHref(companyId,stocktake.id,doc.id)"
        :download="doc.original_name">
        <Download :size="16" aria-hidden="true"/>{{ doc.original_name }}
      </a>
    </div>
    <form v-if="canWrite&&!active" class="document-upload" @submit.prevent="uploadDocument">
      <input ref="documentInput" type="file" accept=".pdf,.png,.jpg,.jpeg"
        required :disabled="documentBusy" @change="chooseDocument"/>
      <BaseButton type="submit" :disabled="documentBusy||!documentFile">
        <Upload :size="16" aria-hidden="true"/>{{ documentText.upload }}
      </BaseButton>
    </form>
  </BaseCard>
</template>

<style scoped>
.document-panel{display:grid;gap:12px}
.document-header h3{display:flex;align-items:center;gap:9px;margin:0}
.document-header p{margin:6px 0 0}
.document-list{display:flex;gap:8px;flex-wrap:wrap}
.document-upload{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.document-upload input{max-width:100%}
.download-link{display:flex;align-items:center;gap:8px;min-height:var(--control-height);padding:8px 12px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);color:var(--color-text);background:var(--color-surface);font-size:12px;text-decoration:none}
.download-link:hover{background:var(--color-accent-soft)}
</style>

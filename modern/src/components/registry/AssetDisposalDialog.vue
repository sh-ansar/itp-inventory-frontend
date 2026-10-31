<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  ArrowDownToLine, Check, Clock3, FileCheck2, FileText,
  RefreshCw, RotateCcw, Send, ShieldCheck, Upload,
} from "lucide-vue-next";
import BaseButton from "../ui/BaseButton.vue";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseLoadingState from "../ui/BaseLoadingState.vue";
import BaseStatusPill from "../ui/BaseStatusPill.vue";
import { InventoryApiError } from "../../api/client";
import {
  approveDisposalCase, completeDisposalCase, createDisposalCase, disposalDocumentUrl,
  getDisposalCase, getDisposalEvents, returnDisposalCase, submitDisposalCase,
  updateDisposalCase, uploadDisposalDocument,
} from "../../api/disposals";
import type {
  DisposalCase, DisposalDocumentType, DisposalDraft,
  DisposalEvent, DisposalMethod,
} from "../../api/disposals";
import { useUiSettings } from "../../stores/uiSettings";

const props=defineProps<{
  assetId:string|null;
  companyId:string;
  role:string;
  assetVersion?:number;
  assetName?:string;
  inventoryNumber?:string;
  assetStatus?:"active"|"written_off"|"disposed";
}>();
const emit=defineEmits<{close:[];changed:[]}>();
const ui=useUiSettings();
const canWrite=computed(()=>["company_admin","inventory_manager"].includes(props.role));
const admin=computed(()=>props.role==="company_admin");
const record=ref<DisposalCase|null>(null);
const loading=ref(false),busy=ref(false),error=ref(""),notice=ref("");
const fields=reactive<DisposalDraft>({reason:"",order_number:"",order_date:""});
const savedForm=ref("");
const formErrors=ref<Record<string,string[]>>({});
const docFile=ref<HTMLInputElement|null>(null);
const uploadType=ref<DisposalDocumentType>("write_off_order");
const file=ref<File|null>(null);
const returnReason=ref("");
const disposalAct=ref(""),disposalDate=ref(""),method=ref<DisposalMethod>("recycling");
const historyOpen=ref(false),historyBusy=ref(false),events=ref<DisposalEvent[]>([]);
const hasCase=computed(()=>record.value!==null);
const isDraft=computed(()=>record.value?.status==="draft");
const canEditDraft=computed(()=>canWrite.value&&(!record.value||isDraft.value)&&
  (record.value?.asset.status??props.assetStatus??"active")==="active");
const changed=computed(()=>JSON.stringify(fields)!==savedForm.value);
const canSubmit=computed(()=>isDraft.value&&canWrite.value&&!busy.value&&!changed.value&&
  Boolean(record.value?.order_number&&record.value?.order_date&&
    record.value.documents.some(d=>d.document_type==="write_off_order")));
const canUpload=computed(()=>canWrite.value&&!!record.value&&
  ["draft","submitted","approved"].includes(record.value.status));
const currentName=computed(()=>record.value?.asset.name??props.assetName??"");
const currentNumber=computed(()=>record.value?.asset.inventory_number??props.inventoryNumber??"");
let serial=0,ctrl:AbortController|null=null;

watch([()=>props.companyId,()=>props.assetId],()=>{
  serial++;ctrl?.abort();record.value=null;error.value="";notice.value="";
  formErrors.value={};fields.reason="";fields.order_number="";fields.order_date="";
  savedForm.value=JSON.stringify(fields);returnReason.value="";file.value=null;
  disposalAct.value="";disposalDate.value="";method.value="recycling";
  historyOpen.value=false;events.value=[];
  if(props.companyId&&props.assetId)void load();
},{immediate:true});

function sync(data:DisposalCase){
  record.value=data;
  fields.reason=data.reason;
  fields.order_number=data.order_number??"";
  fields.order_date=data.order_date??"";
  savedForm.value=JSON.stringify(fields);
  formErrors.value={};
  uploadType.value=data.status==="approved"?"disposal_act":
    data.status==="draft"?"write_off_order":"supporting";
}
async function load(){
  ctrl?.abort();const controller=new AbortController();ctrl=controller;
  const current=++serial;
  if(!props.assetId||!props.companyId)return;
  loading.value=true;error.value="";notice.value="";
  try{
    const result=await getDisposalCase(props.companyId,props.assetId,controller.signal);
    if(current===serial&&!controller.signal.aborted)sync(result.data);
  }catch(e){
    if(current!==serial||controller.signal.aborted)return;
    if(e instanceof InventoryApiError&&e.status===404){
      record.value=null;
    }else error.value=describe(e);
  }finally{if(current===serial)loading.value=false;}
}
function describe(e:unknown){
  if(e instanceof InventoryApiError){
    formErrors.value=e.fields;
    if(e.status===409)return ui.t("disposal.conflict");
    return e.message;
  }
  return e instanceof Error?e.message:ui.t("generic.unknownError");
}
function close(){
  if(busy.value)return;
  if(canEditDraft.value&&changed.value&&!window.confirm(ui.t("disposal.unsaved")))return;
  emit("close");
}
async function perform(action:()=>Promise<{data:DisposalCase}>,success:string){
  if(busy.value||!props.assetId||!props.companyId)return;
  busy.value=true;error.value="";notice.value="";formErrors.value={};
  const context=props.companyId+"|"+props.assetId;
  try{
    const result=await action();
    if(context!==props.companyId+"|"+props.assetId)return;
    sync(result.data);
    notice.value=ui.t(success);
    emit("changed");
  }catch(e){
    if(context!==props.companyId+"|"+props.assetId)return;
    error.value=describe(e);
  }finally{busy.value=false;}
}
async function save(){
  if(!canEditDraft.value||fields.reason.trim().length<10||busy.value)return;
  const data:DisposalDraft={
    reason:fields.reason.trim(),order_number:fields.order_number?.trim()||null,
    order_date:fields.order_date||null,
  };
  if(record.value){
    if(!changed.value)return;
    await perform(()=>updateDisposalCase(props.companyId,record.value!.asset_id,
      record.value!.version,data),"disposal.saved");
  }else{
    if(!props.assetId||!props.assetVersion)return;
    await perform(()=>createDisposalCase(props.companyId,props.assetId!,
      props.assetVersion!,data),"disposal.saved");
  }
}
async function submit(){
  if(!record.value||!canSubmit.value)return;
  await perform(()=>submitDisposalCase(props.companyId,record.value!.asset_id,
    record.value!.version),"disposal.stageAdvanced");
}
async function approve(){
  if(!admin.value||record.value?.status!=="submitted"||busy.value)return;
  if(!window.confirm(ui.t("disposal.approveConfirm")))return;
  await perform(()=>approveDisposalCase(props.companyId,record.value!.asset_id,
    record.value!.version,record.value!.asset.version),"disposal.stageAdvanced");
}
async function sendBack(){
  if(!admin.value||record.value?.status!=="submitted"||returnReason.value.trim().length<5)return;
  await perform(()=>returnDisposalCase(props.companyId,record.value!.asset_id,
    record.value!.version,returnReason.value.trim()),"disposal.stageAdvanced");
  if(!error.value)returnReason.value="";
}
async function dispose(){
  if(!admin.value||record.value?.status!=="approved"||busy.value||
    disposalAct.value.trim().length<2||!disposalDate.value)return;
  if(!window.confirm(ui.t("disposal.disposeConfirm")))return;
  await perform(()=>completeDisposalCase(props.companyId,record.value!.asset_id,
    record.value!.version,record.value!.asset.version,{
      disposal_act_number:disposalAct.value.trim(),
      disposal_date:disposalDate.value,
      disposal_method:method.value,
    }),"disposal.stageAdvanced");
}
async function upload(){
  if(!canUpload.value||!file.value||busy.value||!record.value)return;
  if(file.value.size>5*1024*1024||
    !["application/pdf","image/png","image/jpeg"].includes(file.value.type)){
    error.value=ui.t("disposal.fileHint");return;
  }
  const accepted=record.value.status==="approved"?
    ["disposal_act","supporting"]:record.value.status==="draft"?
      ["write_off_order","supporting"]:["supporting"];
  if(!accepted.includes(uploadType.value)){
    error.value=ui.t("disposal.invalid");return;
  }
  await perform(()=>uploadDisposalDocument(props.companyId,record.value!.asset_id,
    record.value!.version,uploadType.value,file.value!),"disposal.fileUploaded");
  if(!error.value){file.value=null;if(docFile.value)docFile.value.value="";}
}
function chooseFile(e:Event){file.value=(e.target as HTMLInputElement).files?.[0]??null;}
async function showHistory(){
  if(!record.value||busy.value)return;
  if(historyOpen.value){historyOpen.value=false;return;}
  historyOpen.value=true;historyBusy.value=true;events.value=[];
  const context=props.companyId+"|"+props.assetId;
  try{
    const r=await getDisposalEvents(props.companyId,record.value.asset_id);
    if(context===props.companyId+"|"+props.assetId)events.value=r.data;
  }catch(e){if(context===props.companyId+"|"+props.assetId)error.value=describe(e);}
  finally{historyBusy.value=false;}
}
function hasDocument(type:DisposalDocumentType){
  return record.value?.documents.some(doc=>doc.document_type===type)??false;
}
function date(value:string){return new Date(value).toLocaleString(
  ui.locale==="ka"?"ka-GE":ui.locale==="en"?"en-GB":"ru-RU");
}
function tone(status:string):"success"|"warning"|"neutral"{
  return status==="disposed"?"success":status==="submitted"?"warning":"neutral";
}
</script>

<template>
  <BaseDialog :open="!!assetId" :title="ui.t('disposal.title')" size="wide" @close="close">
    <div class="disposal-drawer">
      <div class="asset-heading">
        <div><strong>{{ currentNumber||ui.t("disposal.asset") }}</strong>
          <p class="muted">{{ currentName }}</p></div>
        <BaseStatusPill v-if="record" :tone="tone(record.status)">
          {{ ui.t("disposal.stage."+record.status) }}
        </BaseStatusPill>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}
        <BaseButton v-if="record" variant="secondary" :disabled="busy" @click="load">
          <RefreshCw :size="16" aria-hidden="true"/>{{ ui.t("actions.refresh") }}
        </BaseButton>
      </p>
      <p v-if="notice" role="status" class="notice">{{ notice }}</p>
      <BaseLoadingState v-if="loading" :label="ui.t('generic.loading')"/>
      <template v-else>
        <template v-if="!hasCase">
          <p v-if="(assetStatus??'active')!=='active'" class="muted">{{ ui.t("disposal.legacy") }}</p>
          <p v-else class="muted">{{ ui.t("disposal.noCase") }}</p>
        </template>
        <form v-if="canEditDraft" id="disposal-draft-form" class="disposal-form"
          @submit.prevent="save">
          <label class="field">
            <span>{{ ui.t("disposal.reason") }} *</span>
            <textarea v-model="fields.reason" rows="3" minlength="10" maxlength="2000"
              required :disabled="busy"/>
            <small v-if="formErrors.reason" role="alert">{{ formErrors.reason[0] }}</small>
          </label>
          <div class="two-fields">
            <label class="field"><span>{{ ui.t("disposal.orderNumber") }}</span>
              <input v-model="fields.order_number" maxlength="120" :disabled="busy"/>
              <small v-if="formErrors.order_number" role="alert">{{ formErrors.order_number[0] }}</small>
            </label>
            <label class="field"><span>{{ ui.t("disposal.orderDate") }}</span>
              <input v-model="fields.order_date" type="date" :disabled="busy"/>
              <small v-if="formErrors.order_date" role="alert">{{ formErrors.order_date[0] }}</small>
            </label>
          </div>
          <div class="form-buttons">
            <BaseButton type="submit" :disabled="busy||fields.reason.trim().length<10||
              (!!record&&!changed)||(!record&&!assetVersion)">
              <Check :size="16" aria-hidden="true"/>
              {{ ui.t(record?"disposal.updateDraft":"disposal.saveDraft") }}
            </BaseButton>
          </div>
          <p class="muted small-note">{{ ui.t("disposal.orderNote") }}</p>
        </form>
        <div v-else-if="record" class="case-summary">
          <div><span>{{ ui.t("disposal.reason") }}</span><strong>{{ record.reason }}</strong></div>
          <div><span>{{ ui.t("disposal.orderNumber") }}</span><strong>{{ record.order_number||"—" }}</strong></div>
          <div><span>{{ ui.t("disposal.orderDate") }}</span><strong>{{ record.order_date||"—" }}</strong></div>
          <div><span>{{ ui.t("disposal.currentStatus") }}</span>
            <strong>{{ ui.t("status."+record.asset.status) }}</strong></div>
        </div>
        <section v-if="record" class="document-section" :aria-label="ui.t('disposal.documents')">
          <div class="section-heading"><FileText :size="19" aria-hidden="true"/>
            <h3>{{ ui.t("disposal.documents") }}</h3><span class="muted">{{ record.documents.length }}</span>
          </div>
          <p v-if="!record.documents.length" class="muted">{{ ui.t("disposal.docMissing") }}</p>
          <ul v-else class="document-list">
            <li v-for="doc in record.documents" :key="doc.id">
              <FileCheck2 :size="19" aria-hidden="true" class="doc-icon"/>
              <div class="document-meta">
                <strong :title="doc.original_name">{{ doc.original_name }}</strong>
                <span>{{ ui.t("disposal.doc."+doc.document_type) }} · {{ doc.uploaded_by_name }}</span>
                <small>{{ date(doc.created_at) }} · {{ Math.ceil(doc.bytes/1024) }} KB</small>
              </div>
              <a class="download-icon" :href="disposalDocumentUrl(companyId,record.asset_id,doc.id)"
                download :aria-label="ui.t('disposal.download')+': '+doc.original_name"
                :title="ui.t('disposal.download')">
                <ArrowDownToLine :size="17" aria-hidden="true"/>
              </a>
            </li>
          </ul>
          <form v-if="canUpload" class="upload-form" @submit.prevent="upload">
            <label class="field"><span>{{ ui.t("disposal.docType") }}</span>
              <select v-model="uploadType" :disabled="busy">
                <option v-if="record.status==='draft'" value="write_off_order">{{ ui.t("disposal.doc.write_off_order") }}</option>
                <option v-if="record.status==='approved'" value="disposal_act">{{ ui.t("disposal.doc.disposal_act") }}</option>
                <option value="supporting">{{ ui.t("disposal.doc.supporting") }}</option>
              </select>
            </label>
            <label class="field"><span>{{ ui.t("disposal.file") }}</span>
              <input ref="docFile" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                :disabled="busy" @change="chooseFile"/>
              <small class="muted">{{ ui.t("disposal.fileHint") }}</small>
            </label>
            <BaseButton type="submit" variant="secondary" :disabled="busy||!file">
              <Upload :size="16" aria-hidden="true"/>{{ ui.t("disposal.upload") }}
            </BaseButton>
          </form>
        </section>

        <section v-if="record?.status==='draft'" class="workflow-section">
          <div class="section-heading"><Send :size="19" aria-hidden="true"/>
            <h3>{{ ui.t("disposal.stage.submitted") }}</h3></div>
          <p v-if="!canSubmit" class="muted">{{ ui.t("disposal.orderMissing") }}</p>
          <BaseButton v-if="canWrite" :disabled="!canSubmit" @click="submit">
            <Send :size="16" aria-hidden="true"/>{{ ui.t("disposal.submit") }}
          </BaseButton>
        </section>

        <section v-if="record?.status==='submitted'" class="workflow-section">
          <p v-if="!admin" class="muted">{{ ui.t("disposal.adminOnly") }}</p>
          <template v-else>
            <div class="section-heading"><ShieldCheck :size="19" aria-hidden="true"/>
              <h3>{{ ui.t("disposal.stage.submitted") }}</h3></div>
            <BaseButton :disabled="busy" @click="approve">
              <Check :size="16" aria-hidden="true"/>{{ ui.t("disposal.approve") }}
            </BaseButton>
            <label class="field"><span>{{ ui.t("disposal.returnReason") }}</span>
              <textarea v-model="returnReason" rows="2" minlength="5" maxlength="1000"
                :disabled="busy"/>
            </label>
            <BaseButton variant="secondary" :disabled="busy||returnReason.trim().length<5" @click="sendBack">
              <RotateCcw :size="16" aria-hidden="true"/>{{ ui.t("disposal.returnConfirm") }}
            </BaseButton>
          </template>
        </section>

        <section v-if="record?.status==='approved'" class="workflow-section">
          <div class="section-heading"><ShieldCheck :size="19" aria-hidden="true"/>
            <h3>{{ ui.t("disposal.dispose") }}</h3></div>
          <p v-if="!admin" class="muted">{{ ui.t("disposal.adminOnly") }}</p>
          <form v-else class="disposal-form" @submit.prevent="dispose">
            <div class="two-fields">
              <label class="field"><span>{{ ui.t("disposal.actNumber") }} *</span>
                <input v-model="disposalAct" minlength="2" maxlength="120" required :disabled="busy"/>
              </label>
              <label class="field"><span>{{ ui.t("disposal.disposalDate") }} *</span>
                <input v-model="disposalDate" type="date" required :disabled="busy"/>
              </label>
            </div>
            <label class="field"><span>{{ ui.t("disposal.method") }} *</span>
              <select v-model="method" :disabled="busy" required>
                <option v-for="value in (['recycling','destruction','waste_transfer','other'] as const)"
                  :key="value" :value="value">{{ ui.t("disposal.method."+value) }}</option>
              </select>
            </label>
            <p v-if="!hasDocument('disposal_act')" class="muted">{{ ui.t("disposal.actMissing") }}</p>
            <BaseButton type="submit" :disabled="busy||disposalAct.trim().length<2||
              !disposalDate||!hasDocument('disposal_act')">
              <ShieldCheck :size="16" aria-hidden="true"/>{{ ui.t("disposal.dispose") }}
            </BaseButton>
          </form>
        </section>

        <section v-if="record" class="history-section">
          <div class="section-heading">
            <Clock3 :size="19" aria-hidden="true"/><h3>{{ ui.t("disposal.history") }}</h3>
            <button type="button" class="plain-button" :disabled="historyBusy||busy" @click="showHistory">
              {{ historyOpen?ui.t("actions.close"):ui.t("disposal.history") }}
            </button>
          </div>
          <BaseLoadingState v-if="historyBusy" :label="ui.t('generic.loading')"/>
          <p v-else-if="historyOpen&&!events.length" class="muted">{{ ui.t("disposal.historyEmpty") }}</p>
          <ol v-else-if="historyOpen" class="event-timeline">
            <li v-for="ev in events" :key="ev.id">
              <div class="event-title"><strong>{{ ui.t("disposal.event."+ev.event_type) }}</strong>
                <span>v{{ ev.version }}</span></div>
              <p>{{ ev.actor_name }} · {{ date(ev.created_at) }}</p>
              <small v-if="ev.reason">{{ ev.reason }}</small>
            </li>
          </ol>
        </section>

        <p class="disposal-note muted">{{ ui.t("disposal.controlNote") }}</p>
      </template>
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="close">
        {{ ui.t("actions.close") }}</BaseButton>
    </template>
  </BaseDialog>
</template>

<style scoped>
.disposal-drawer{display:grid;gap:20px;min-width:0}
.asset-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding-bottom:12px;border-bottom:1px solid var(--color-stroke)}
.asset-heading>div{min-width:0}.asset-heading strong{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.asset-heading p{margin:5px 0 0;font-size:12px;overflow-wrap:anywhere}
.disposal-form,.workflow-section,.document-section,.history-section{display:grid;gap:13px;min-width:0}
.field{display:grid;gap:6px;min-width:0;font-size:12px;color:var(--color-text)}
.field>span{font-size:12px;font-weight:500}
.field input,.field select,.field textarea{width:100%;min-width:0;background:var(--color-surface-raised);color:var(--color-text);border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);padding:9px 11px;font:inherit}
.field textarea{resize:vertical;min-height:80px}
.field input[type=file]{padding:7px 8px}
.field small{font-size:11px;color:var(--color-danger);font-weight:400}
.field small.muted{color:var(--color-muted)}
.two-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.form-buttons{display:flex;justify-content:flex-end;gap:8px}
.small-note{font-size:11px;margin:0;line-height:17px}
.section-heading{display:flex;align-items:center;gap:9px;min-width:0}
.section-heading svg{color:var(--color-primary);flex:none}
.section-heading h3{font-size:14px;line-height:20px;font-weight:600;margin:0;min-width:0}
.section-heading>span{margin-left:auto;font-size:12px}
.document-section,.workflow-section,.history-section{padding-top:14px;border-top:1px solid var(--color-stroke)}
.document-list{list-style:none;display:grid;gap:8px;padding:0;margin:0}
.document-list li{display:flex;gap:11px;align-items:center;padding:10px 12px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);min-width:0}
.doc-icon{color:var(--color-primary);flex:none}
.document-meta{display:grid;gap:4px;min-width:0;flex:1}
.document-meta strong{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.document-meta span,.document-meta small{font-size:11px;color:var(--color-muted)}
.download-icon{display:grid;place-items:center;width:34px;height:34px;flex:none;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);color:var(--color-text)}
.download-icon:hover{color:var(--color-primary);background:var(--color-hover)}
.upload-form{display:grid;gap:10px;padding:13px;background:var(--color-soft);border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
.case-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.case-summary>div{display:grid;gap:5px;min-width:0}
.case-summary span{font-size:11px;color:var(--color-muted)}
.case-summary strong{font-size:12px;font-weight:500;overflow-wrap:anywhere}
.workflow-section>p,.document-section>p{margin:0;font-size:12px;line-height:18px}
.workflow-section :deep(.base-button),.upload-form :deep(.base-button){justify-self:start}
.event-timeline{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.event-timeline li{padding:11px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
.event-title{display:flex;justify-content:space-between;gap:9px}
.event-title strong{font-size:12px}.event-title span{font-size:11px;color:var(--color-muted)}
.event-timeline p,.event-timeline small{font-size:11px;line-height:17px;color:var(--color-muted);margin:5px 0 0}
.plain-button{margin-left:auto;border:0;background:transparent;color:var(--color-text);font-size:12px;text-decoration:underline;cursor:pointer}
.disposal-note{font-size:11px;line-height:18px;margin:0;border-top:1px solid var(--color-stroke);padding-top:14px}
.error,.notice{padding:11px;border-radius:var(--radius-sm);font-size:12px;line-height:18px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.error{border:1px solid var(--color-danger-border);color:var(--color-danger);background:var(--color-danger-surface)}
.notice{border:1px solid var(--color-success);color:var(--color-success);background:var(--color-success-surface)}
@media(max-width:540px){.two-fields,.case-summary{grid-template-columns:1fr}.form-buttons :deep(.base-button){width:100%}
  .workflow-section :deep(.base-button){width:100%}.upload-form :deep(.base-button){width:100%}
  .asset-heading{align-items:flex-start;flex-wrap:wrap}}
</style>

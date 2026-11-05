<script setup lang="ts">
import {computed,onMounted,reactive,ref,watch} from "vue";
import {Download,UploadCloud,CreditCard,ClipboardCheck,RefreshCcw} from "lucide-vue-next";
import {commercialApi,commercialBlob,previewPdf} from "../api/commercial";
import type {Invoice,LegalRecord} from "../api/commercial";
import {inventoryRequest} from "../api/client";
import {useUiSettings} from "../stores/uiSettings";
import {commercialT} from "../commercialTranslations";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const t=(k:string)=>commercialT(ui.locale,k);
const locale=computed(()=>ui.locale==="ka"?"ge":ui.locale);
const busy=ref(false),error=ref(""),notice=ref("");
const subscription=ref<any|null>(null),invoices=ref<Invoice[]>([]);
const legal=ref<LegalRecord[]>([]),consents=ref<any[]>([]);
const choices=reactive<Record<string,boolean>>({});
const uploading=ref<number|null>(null),file=ref<File|null>(null);
const page=ref(1),lastPage=ref(1);
const isAdmin=computed(()=>props.role==="company_admin");
const currency=(value:number,unit:string)=>{
 try{return new Intl.NumberFormat(ui.locale==="ka"?"ka-GE":ui.locale,{style:"currency",currency:unit}).format(value/100)}
 catch{return value/100+" "+unit}
};
const short=(text?:string|null)=>text?new Date(text).toLocaleDateString(ui.locale==="ka"?"ka-GE":ui.locale):"—";
function status(v:string){const k="status_"+v;return t(k)===k?v:t(k)}
async function load(){
 if(!props.companyId)return;
 busy.value=true;error.value="";
 try{
  const [s,b,d,c]=await Promise.all([
   commercialApi.subscription(props.companyId),
   commercialApi.ownInvoices(props.companyId,page.value),
   commercialApi.legal(locale.value),
   commercialApi.ownConsents(),
  ]);
  subscription.value=s.data;invoices.value=b.data;lastPage.value=b.last_page;
  legal.value=d.data;consents.value=c.data;
 }catch(e){error.value=e instanceof Error?e.message:t("errors")}
 finally{busy.value=false}
}
async function download(invoice:Invoice){
 error.value="";
 try{previewPdf(await commercialBlob('/api/v1/commercial/invoices/'+invoice.id+'/pdf'),
   'inventory-invoice-'+invoice.id+'.pdf')}
 catch(e){error.value=e instanceof Error?e.message:t("errors")}
}
function selectedFile(event:Event,invoiceId:number){
 const target=event.target as HTMLInputElement;
 file.value=target.files?.[0]||null;
 uploading.value=file.value?invoiceId:null;
 if(file.value&&file.value.size>10*1024*1024){
  error.value=t("fileLimit")+" 10 MiB";file.value=null;uploading.value=null;
 }
}
async function submitProof(invoiceId:number){
 if(!file.value||!isAdmin.value)return;
 busy.value=true;error.value="";notice.value="";
 try{
  const form=new FormData();form.append("file",file.value);
  await inventoryRequest('/api/v1/commercial/invoices/'+invoiceId+'/proof',{method:"POST",body:form});
  notice.value=t("saved");uploading.value=null;file.value=null;
  await load();
 }catch(e){error.value=e instanceof Error?e.message:t("errors")}
 finally{busy.value=false}
}
async function acceptDocuments(){
 if(!legal.value.length)return;
 busy.value=true;error.value="";notice.value="";
 try{
  await commercialApi.acceptLegal(locale.value,{...choices});
  notice.value=t("saved");const result=await commercialApi.ownConsents();
  consents.value=result.data;
 }catch(e){error.value=e instanceof Error?e.message:t("errors")}
 finally{busy.value=false}
}
onMounted(load);
watch(()=>[props.companyId,ui.locale],load);
</script>
<template>
<div class="inv-company-billing">
 <div class="inv-billing-head"><h2>{{t("adminPayments")}}</h2>
  <button type="button" :disabled="busy" @click="load" :aria-label="t('refresh')">
   <RefreshCcw :size="17"/></button>
 </div>
 <p v-if="error" class="inv-billing-error" role="alert">{{error}}</p>
 <p v-if="notice" class="inv-billing-success" role="status">{{notice}}</p>
 <section class="inv-billing-panel">
  <div class="inv-billing-panel-title"><CreditCard :size="20"/><h3>{{t("plans")}}</h3></div>
  <template v-if="subscription">
   <dl>
    <div><dt>{{t("plans")}}</dt><dd>{{subscription.snapshot?.terms?.names?.[locale]||subscription.snapshot?.code||"—"}}</dd></div>
    <div><dt>{{t("status")}}</dt><dd>{{status(subscription.status)}}</dd></div>
    <div><dt>{{t("endsAt")}}</dt><dd>{{short(subscription.ends_at)}}</dd></div>
    <div><dt>{{t("users")}}</dt><dd>{{subscription.snapshot?.terms?.limits?.users??t("unlimited")}}</dd></div>
   </dl>
   <p v-if="subscription.status==='pending_payment'">{{t("noCommercial")}}</p>
  </template><p v-else>{{t("noCommercial")}}</p>
 </section>
 <section class="inv-billing-panel">
  <div class="inv-billing-panel-title"><CreditCard :size="20"/><h3>{{t("adminPayments")}}</h3></div>
  <div class="inv-billing-scroll">
   <table><thead><tr><th>{{t("numberInvoice")}}</th><th>{{t("status")}}</th>
    <th>{{t("total")}}</th><th>{{t("dueDate")}}</th><th>{{t("actions")}}</th></tr></thead>
    <tbody>
     <tr v-for="invoice in invoices" :key="invoice.id">
      <td>{{invoice.number||"#"+invoice.id}}</td>
      <td>{{status(invoice.status)}}</td>
      <td>{{currency(invoice.total_minor,invoice.currency)}}</td>
      <td>{{short(invoice.due_date)}}</td>
      <td>
       <button type="button" @click="download(invoice)" :aria-label="t('download')+' '+invoice.id">
        <Download :size="16"/>{{t("download")}}
       </button>
       <template v-if="isAdmin&&['issued','awaiting_payment','overdue'].includes(invoice.status)">
        <input :id="'proof-'+invoice.id" type="file" accept=".pdf,.jpg,.jpeg,.png"
          :aria-label="t('proofFile')" @change="selectedFile($event,invoice.id)"/>
        <button v-if="uploading===invoice.id" type="button" :disabled="busy"
           @click="submitProof(invoice.id)"><UploadCloud :size="16"/>{{t("proofUpload")}}</button>
       </template>
      </td>
     </tr>
     <tr v-if="!invoices.length"><td colspan="5">{{t("empty")}}</td></tr>
    </tbody>
   </table>
  </div>
  <nav class="inv-billing-pagination" :aria-label="t('adminPayments')">
   <button type="button" :disabled="page<=1" @click="page--;load()">{{t("prev")}}</button>
   <span>{{page}} / {{lastPage}}</span>
   <button type="button" :disabled="page>=lastPage" @click="page++;load()">{{t("next")}}</button>
  </nav>
 </section>
 <section class="inv-billing-panel">
  <div class="inv-billing-panel-title"><ClipboardCheck :size="20"/><h3>{{t("documents")}}</h3></div>
  <p v-if="!legal.length">{{t("legalEmpty")}}</p>
  <form v-else @submit.prevent="acceptDocuments" class="inv-billing-legal">
   <label v-for="document in legal" :key="document.id">
    <input v-model="choices[document.type]" type="checkbox" :required="document.required"/>
    <RouterLink :to="'/legal/'+document.type" target="_blank" rel="noopener">
     {{document.title}} · v{{document.version}}
    </RouterLink>
   </label>
   <button type="submit" :disabled="busy">{{t("yes")}}</button>
  </form>
  <details><summary>{{t("adminConsents")}} · {{consents.length}}</summary>
   <ul><li v-for="row in consents" :key="row.id">{{row.title}} · v{{row.version}} · {{short(row.created_at)}}</li></ul>
  </details>
 </section>
</div>
</template>
<style scoped>
.inv-company-billing{max-width:1250px;margin:0 auto;padding:8px 12px 45px;color:var(--text-primary,#254c5c)}
.inv-billing-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 24px}
.inv-billing-head h2{font-size:25px;margin:0;letter-spacing:-.03em}
.inv-billing-head button,.inv-billing-pagination button{background:white;border:1px solid #dce7ed;border-radius:7px;
 padding:9px 13px;cursor:pointer;color:#168abe}
.inv-billing-panel{background:var(--surface,#fff);border:1px solid var(--border,#dce7ed);border-radius:12px;
 padding:23px;margin-bottom:18px}
.inv-billing-panel-title{display:flex;align-items:center;gap:10px;color:#148cc0;margin-bottom:20px}
.inv-billing-panel-title h3{font-size:18px;margin:0;color:var(--text-primary,#2b4e5c)}
.inv-billing-panel dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;margin:0 0 14px}
.inv-billing-panel dl dt{color:#7e99a6;font-size:12px}
.inv-billing-panel dl dd{font-weight:650;margin:7px 0 0}
.inv-billing-scroll{overflow-x:auto}
.inv-billing-panel table{border-collapse:collapse;min-width:620px;width:100%}
.inv-billing-panel th{text-align:left;background:#f2f8fa;color:#7294a4;font-size:12px;font-weight:600;padding:12px}
.inv-billing-panel td{padding:12px;border-top:1px solid #e1ecf0;font-size:13px;vertical-align:middle}
.inv-billing-panel td:last-child{min-width:200px}
.inv-billing-panel td button,.inv-billing-legal button{display:inline-flex;gap:6px;align-items:center;cursor:pointer;
 border:1px solid #c7e1ed;color:#1186b9;border-radius:7px;background:white;padding:8px 11px;font:inherit}
.inv-billing-panel td input[type=file]{max-width:180px;font-size:11px}
.inv-billing-pagination{display:flex;justify-content:flex-end;align-items:center;gap:14px;padding-top:14px}
.inv-billing-legal{display:grid;gap:14px}
.inv-billing-legal label{display:flex;gap:12px;align-items:center;font-size:13px}
.inv-billing-legal input{width:17px;height:17px;accent-color:#009cde}
.inv-billing-legal a{color:#008fbe}
.inv-billing-legal button{width:max-content;background:#009cde;color:white;margin:10px 0 20px}
.inv-billing-panel details{margin-top:14px;color:#75909e;font-size:12px}
.inv-billing-error,.inv-billing-success{padding:12px;border-radius:8px;background:#fff4f4;color:#993e3e}
.inv-billing-success{color:#20734f;background:#f0fff7}
</style>
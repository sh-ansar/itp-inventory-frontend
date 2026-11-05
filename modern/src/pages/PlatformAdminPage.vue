<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from "vue";
import {useRoute,useRouter} from "vue-router";
import {Boxes,Building2,CreditCard,FileText,ShieldCheck,ClipboardCheck,ArrowLeft,
  RefreshCw,Search,X,ChevronRight,Download,Globe2,LogOut} from "lucide-vue-next";
import {useUiSettings} from "../stores/uiSettings";
import {commercialT} from "../commercialTranslations";
import {logout} from "../api/session";
import {commercialApi,commercialBlob,previewPdf} from "../api/commercial";
import type {AdminOverview,Plan,Organization,Invoice,LegalRecord} from "../api/commercial";
import AdminDialog from "../components/commercial/AdminDialog.vue";
import PlanEditor from "../components/commercial/PlanEditor.vue";
import BillingEditor from "../components/commercial/BillingEditor.vue";
import InvoiceEditor from "../components/commercial/InvoiceEditor.vue";
import LegalEditor from "../components/commercial/LegalEditor.vue";
import SiteContentEditor from "../components/commercial/SiteContentEditor.vue";

type Section="companies"|"plans"|"payments"|"documents"|"consents"|"access"|"site";
type Editor={kind:"plan"|"supplier"|"buyer"|"invoice"|"legal";data:any};
type Decision={text:string;action:()=>Promise<unknown>};
const ui=useUiSettings(),route=useRoute(),router=useRouter();
const logoUrl=import.meta.env.BASE_URL+"brand/inventory-logo.svg";
const t=(key:string)=>commercialT(ui.locale,key);
const locale=()=>ui.locale==="ka"?"ge":ui.locale;
const sections=[
 {id:"companies",permission:"companies.read",title:"adminCompanies",icon:Building2},
 {id:"plans",permission:"plans.read",title:"adminPlans",icon:Boxes},
 {id:"payments",permission:"billing.read",title:"adminPayments",icon:CreditCard},
 {id:"documents",permission:"legal.read",title:"adminDocuments",icon:FileText},
 {id:"consents",permission:"legal.read",title:"adminConsents",icon:ClipboardCheck},
 {id:"access",permission:"platform.manage",title:"adminAccess",icon:ShieldCheck},
 {id:"site",permission:"site.read",title:"adminSite",icon:Globe2},
] as const;
const overview=ref<AdminOverview|null>(null);
const loading=ref(true),busy=ref(false),error=ref(""),notice=ref("");
const signoutBusy=ref(false);
async function signOut(){
 if(signoutBusy.value)return;
 signoutBusy.value=true;error.value="";
 try {
  await logout();
  await router.replace("/auth/login");
 } catch(e) {
  error.value=e instanceof Error?e.message:t("errors");
 } finally {signoutBusy.value=false;}
}
const section=computed<Section>(()=>sections.find(s=>s.id===route.params.section)?.id as Section||"companies");
const permitted=(permission:string)=>!!overview.value?.permissions.some(p=>p==="platform.manage"||p===permission);
const availableSections=computed(()=>sections.filter(s=>permitted(s.permission)));
const columns:Record<Section,string[]>={
 companies:["company","email","users","assetsCount","plans","status","createdAt"],
 plans:["planCode","planName","version","status","price","publicPlan"],
 payments:["numberInvoice","company","status","total","dueDate"],
 documents:["planName","documentType","language","version","status","effectiveAt"],
 consents:["email","planName","version","acceptance","createdAt"],
 access:["email","permission","createdAt"],
 site:[],
};
const data=ref<any[]>([]);
const page=ref(1),lastPage=ref(1),total=ref(0),query=ref(""),sort=ref("created_at");
const selectedCompany=ref<any|null>(null),companyUsers=ref<any[]>([]);
const companyUsersPage=ref(1),companyUsersPages=ref(1);
const assignPlan=ref<number|undefined>();
const endsAt=ref("");
const publishedPlans=ref<Plan[]>([]);
const editor=ref<Editor|null>(null);
const decision=ref<Decision|null>(null),approvalNote=ref("");
const proofs=ref<{invoice:Invoice;items:any[]}|null>(null);
const reviewNote=ref("");
const userId=ref<number|undefined>(),grantPermission=ref("companies.read");
const permissions=["platform.manage","companies.read","users.write","plans.read","plans.write",
 "subscriptions.write","billing.read","billing.write","site.read","site.write","legal.read","legal.write","legal.approve","legal.publish"];
let revision=0,debounce:ReturnType<typeof setTimeout>|undefined;
function shortDate(text:string|null|undefined){
 if(!text)return "—";
 const parsed=new Date(text);return Number.isNaN(parsed.getTime())?text:
  new Intl.DateTimeFormat(ui.locale==="ka"?"ka-GE":ui.locale,{dateStyle:"medium"}).format(parsed);
}
function formatMoney(minor:number,currency="KZT"){
 try{return new Intl.NumberFormat(ui.locale==="ka"?"ka-GE":ui.locale,{
  style:"currency",currency,maximumFractionDigits:2,
 }).format(Number(minor||0)/100);}
 catch{return String(Number(minor||0)/100)+" "+currency;}
}
function status(code:string|null|undefined){
 if(!code)return "—";
 const key="status_"+code;
 const found=t(key);
 return found===key?code:found;
}
function planName(plan:Plan){return plan.terms.names?.[locale()]||plan.terms.names?.en||plan.code;}
function cell(row:any,key:string):string|number{
 switch(key){
  case "company":return row.name||row.company_id||"—";
  case "email":return row.email||"—";
  case "users":return row.users_count??"—";
  case "assetsCount":return row.assets_count??"—";
  case "plans":return row.plan_code||row.code||"—";
  case "planCode":return row.code||"—";
  case "planName":return row.terms?planName(row):row.title||"—";
  case "version":return row.version??"—";
  case "status":return status(row.status??row.subscription_status);
  case "price":return formatMoney(row.terms?.price_minor,row.terms?.currency);
  case "publicPlan":return row.is_public?t("booleanYes"):t("booleanNo");
  case "numberInvoice":return row.number||"#"+row.id;
  case "total":return formatMoney(row.total_minor,row.currency);
  case "dueDate":return shortDate(row.due_date);
  case "documentType":return t(row.type||"");
  case "language":return (row.locale||"").toUpperCase();
  case "effectiveAt":return shortDate(row.effective_at);
  case "acceptance":return row.action||"—";
  case "permission":return row.permission||"—";
  case "createdAt":return shortDate(row.created_at);
  default:return row[key]??"—";
 }
}
async function loadOverview(){
 overview.value=await commercialApi.overview();
}
async function load(){
 const current=++revision;loading.value=true;error.value="";notice.value="";
 try{
  if(!overview.value)await loadOverview();
  if(!permitted(sections.find(s=>s.id===section.value)?.permission||"companies.read")){
   data.value=[];error.value=t("forbidden");return;
  }
  if(section.value==="site"){data.value=[];lastPage.value=1;total.value=0;return;}
  const result=section.value==="companies"?await commercialApi.companies(page.value,query.value,sort.value)
   :section.value==="plans"?await commercialApi.adminPlans()
   :section.value==="payments"?await commercialApi.invoices(page.value)
   :section.value==="documents"?await commercialApi.legalVersions(page.value)
   :section.value==="consents"?await commercialApi.consents(page.value,query.value)
   :await commercialApi.grants(page.value);
  if(current!==revision)return;
  data.value=result.data||[];lastPage.value="last_page" in result?result.last_page:1;
  total.value="total" in result?result.total:data.value.length;
 }catch(e){if(current===revision)error.value=e instanceof Error?e.message:t("errors")}
 finally{if(current===revision)loading.value=false}
}
async function mutation(action:()=>Promise<unknown>){
 if(busy.value)return;
 busy.value=true;error.value="";notice.value="";
 try{
  await action();notice.value=t("saved");
  await load(); // load() clears notice; set after it has finished.
  notice.value=t("saved");
 }catch(e){error.value=e instanceof Error?e.message:t("errors")}
 finally{busy.value=false}
}
function ask(text:string,action:()=>Promise<unknown>){
 decision.value={text,action};approvalNote.value="";
}
async function confirmDecision(){
 const pending=decision.value;
 if(!pending)return;
 await mutation(pending.action);
 if(!error.value)decision.value=null;
}
async function companyOpen(company:Organization){
 try{
  const result=await commercialApi.company(company.id);
  selectedCompany.value=result;
  companyUsersPage.value=1;
  await loadCompanyUsers();
  if(permitted("subscriptions.write")){
   publishedPlans.value=(await commercialApi.adminPlans()).data.filter(p=>p.status==="published");
  }
  assignPlan.value=result.subscription?.plan_version_id??undefined;
  endsAt.value=result.subscription?.ends_at?.slice(0,16)||"";
 }catch(e){error.value=e instanceof Error?e.message:t("errors")}
}
async function loadCompanyUsers(){
 if(!selectedCompany.value)return;
 try{
  const result=await commercialApi.companyUsers(selectedCompany.value.organization.id,companyUsersPage.value);
  companyUsers.value=result.data;companyUsersPages.value=result.last_page||1;
 }catch(e){error.value=e instanceof Error?e.message:t("errors")}
}
async function openEditor(row:any){
 if(section.value==="companies"){await companyOpen(row);return}
 if(section.value==="plans")editor.value={kind:"plan",data:row};
 if(section.value==="documents"){
  try{const result=await commercialApi.adminLegal(row.id);editor.value={kind:"legal",data:result.data}}
  catch(e){error.value=e instanceof Error?e.message:t("errors")}
 }
}
async function create(kind:Editor["kind"]){
 try{
  if(kind==="invoice"){
   const companies=await commercialApi.companies(1,"","name");
   organizationOptions.value=companies.data;
  }
  if(kind==="supplier"){
   const response=await commercialApi.supplier();editor.value={kind,data:response.data};return;
  }
  editor.value={kind,data:null};
 }catch(e){error.value=e instanceof Error?e.message:t("errors")}
}
const organizationOptions=ref<Organization[]>([]);
async function saveEditor(payload:unknown){
 const kind=editor.value?.kind;
 if(!kind)return;
 const selected=selectedCompany.value?.organization.id;
 await mutation(async()=>{
  if(kind==="plan")await commercialApi.savePlan(payload);
  else if(kind==="legal")await commercialApi.saveLegal(payload);
  else if(kind==="invoice")await commercialApi.newInvoice(payload);
  else if(kind==="supplier")await commercialApi.updateSupplier(payload);
  else if(kind==="buyer"&&selected)await commercialApi.updateBuyer(selected,payload);
 });
 if(!error.value){
  editor.value=null;
  if(selectedCompany.value&&selected)selectedCompany.value=await commercialApi.company(selected);
 }
}
async function issueInvoice(row:Invoice,status:"issued"|"cancelled"){
 await commercialApi.invoiceStatus(row.id,status);
}
async function documentAction(row:LegalRecord,status:"approved"|"published"){
 await commercialApi.legalStatus(row.id,status,approvalNote.value);
}
async function openProofs(row:Invoice){
 try{const result=await commercialApi.proofs(row.id);proofs.value={invoice:row,items:result.data}}
 catch(e){error.value=e instanceof Error?e.message:t("errors")}
}
async function reviewProof(id:number,status:"accepted"|"rejected"){
 await commercialApi.proofReview(id,status,reviewNote.value);
 if(proofs.value){
  const result=await commercialApi.proofs(proofs.value.invoice.id);
  proofs.value.items=result.data;reviewNote.value="";
 }
}
async function pdf(path:string,name:string){
 try{previewPdf(await commercialBlob(path),name)}
 catch(e){error.value=e instanceof Error?e.message:t("errors")}
}
watch(()=>route.params.section,()=>{page.value=1;query.value="";void load()},{immediate:true});
watch([query,sort],()=>{
 if(section.value!=="companies"&&section.value!=="consents")return;
 if(debounce)clearTimeout(debounce);
 debounce=setTimeout(()=>{page.value=1;void load()},300);
});
onBeforeUnmount(()=>{revision++;if(debounce)clearTimeout(debounce)});
onMounted(()=>document.title="ITP Inventory · "+t("adminTitle"));
</script>

<template>
<div class="inventory-platform-admin">
 <aside class="inv-admin-sidebar" :aria-label="t('adminTitle')">
  <RouterLink to="/"><img :src="logoUrl" alt="ITP Inventory" /></RouterLink>
  <small>{{t("adminTitle")}}</small>
  <nav>
   <RouterLink v-for="item in availableSections" :key="item.id" :to="'/admin/'+item.id">
    <component :is="item.icon" :size="18" /><span>{{t(item.title)}}</span>
   </RouterLink>
  </nav>
  <RouterLink to="/registry"><ArrowLeft :size="15"/> {{t("adminDashboard")}}</RouterLink>
 </aside>
 <main class="inv-admin-main">
  <header class="inv-admin-topbar">
   <div><p>{{t("adminTitle")}}</p>
    <h1>{{t(sections.find(s=>s.id===section)?.title||"adminCompanies")}}</h1></div>
   <div class="inv-admin-top-actions">
    <button type="button" class="inv-btn inv-btn-secondary" :disabled="signoutBusy" @click="signOut">
     <LogOut :size="16" aria-hidden="true" />{{ui.t("auth.logout")}}
    </button>
    <button type="button" class="inv-btn inv-btn-secondary" :aria-label="t('refresh')" @click="load"><RefreshCw :size="16"/></button>
    <button v-if="section==='plans'&&permitted('plans.write')" class="inv-btn inv-btn-primary" @click="create('plan')">{{t("createPlan")}}</button>
    <button v-if="section==='payments'&&permitted('billing.write')" class="inv-btn inv-btn-primary" @click="create('invoice')">{{t("createInvoice")}}</button>
    <button v-if="section==='documents'&&permitted('legal.write')" class="inv-btn inv-btn-primary" @click="create('legal')">{{t("createDocument")}}</button>
   </div>
  </header>
  <div v-if="overview" class="inv-admin-stat-grid" aria-label="statistics">
   <article v-for="metric in [
      {key:'adminCompanies',value:overview.statistics.companies},
      {key:'users',value:overview.statistics.users},
      {key:'adminPlans',value:overview.statistics.published_plans}
    ]" :key="metric.key" class="inv-admin-stat">
    <p>{{t(metric.key)}}</p><strong>{{metric.value}}</strong>
   </article>
  </div>
  <p v-if="['plans','payments'].includes(section)" class="inv-admin-notice">
   {{t("noCommercial")}}
  </p>
  <p v-if="error" role="alert" class="inv-error">{{error}}</p>
  <p v-if="notice" role="status" class="inv-success">{{notice}}</p>
  <SiteContentEditor v-if="section==='site'&&permitted('site.read')" />
  <div v-if="section!=='site'" class="inv-admin-toolbar">
   <input v-if="['companies','consents'].includes(section)" v-model="query" :placeholder="t('searchCompany')" :aria-label="t('search')"/>
   <select v-if="section==='companies'" v-model="sort" :aria-label="t('filter')">
    <option value="created_at">{{t("createdAt")}}</option><option value="name">{{t("planName")}}</option>
   </select>
   <button v-if="section==='payments'&&permitted('billing.write')" type="button" class="inv-btn inv-btn-secondary"
    @click="create('supplier')">{{t("supplier")}}</button>
   <span style="margin-left:auto;color:#819ca7;font-size:12px">{{total}}</span>
  </div>
  <form v-if="section==='access'&&permitted('platform.manage')" class="inv-admin-toolbar" @submit.prevent="mutation(()=>commercialApi.grant(Number(userId),grantPermission))">
   <input v-model.number="userId" :aria-label="t('userId')" :placeholder="t('userId')" type="number" min="1" required />
   <select v-model="grantPermission" :aria-label="t('permission')"><option v-for="p in permissions" :key="p" :value="p">{{p}}</option></select>
   <button type="submit" class="inv-btn inv-btn-primary" :disabled="busy">{{t("grant")}}</button>
  </form>
  <div v-if="section!=='site'" class="inv-admin-card">
   <div class="inv-admin-scroll"><table class="inv-admin-table">
    <thead><tr><th v-for="col in columns[section]" :key="col">{{t(col)}}</th><th>{{t("actions")}}</th></tr></thead>
    <tbody>
     <tr v-for="row in data" :key="row.id">
      <td v-for="(col,i) in columns[section]" :key="col">
       <button v-if="section==='companies'&&i===0" type="button"
        style="border:0;background:none;color:#008bbc;cursor:pointer;text-align:left;font-weight:650"
        @click="openEditor(row)">{{cell(row,col)}}</button>
       <template v-else>{{cell(row,col)}}</template>
      </td>
      <td><div class="inv-admin-row-actions">
       <button v-if="['companies','plans','documents'].includes(section)" type="button"
        class="inv-btn inv-btn-secondary" @click="openEditor(row)">
        {{t(section==='companies'?'view':'newVersion')}}
       </button>
       <template v-if="section==='plans'&&permitted('plans.write')">
        <button v-if="row.status==='draft'" class="inv-btn inv-btn-primary" type="button"
          @click="ask(t('publish'),()=>commercialApi.planStatus(row.id,'published'))">{{t("publish")}}</button>
        <button v-if="row.status==='published'" class="inv-btn inv-btn-secondary" type="button"
          @click="ask(t('archive'),()=>commercialApi.planStatus(row.id,'archived'))">{{t("archive")}}</button>
       </template>
       <template v-if="section==='payments'">
        <button type="button" class="inv-btn inv-btn-secondary" @click="openProofs(row)">{{t("proofs")}}</button>
        <button type="button" class="inv-btn inv-btn-secondary" @click="pdf('/api/v1/platform-admin/invoices/'+row.id+'/pdf','inventory-invoice-'+row.id+'.pdf')"><Download :size="15"/></button>
        <button v-if="row.status==='draft'&&permitted('billing.write')" type="button" class="inv-btn inv-btn-primary"
          :disabled="!overview?.flags.invoice_issuance_enabled"
          @click="ask(t('issue'),()=>issueInvoice(row,'issued'))">{{t("issue")}}</button>
        <button v-if="['issued','awaiting_payment','overdue'].includes(row.status)&&permitted('billing.write')"
          type="button" class="inv-btn inv-btn-secondary"
          @click="ask(t('cancel'),()=>issueInvoice(row,'cancelled'))">{{t("cancel")}}</button>
       </template>
       <template v-if="section==='documents'">
        <button type="button" class="inv-btn inv-btn-secondary" @click="pdf('/api/v1/platform-admin/legal/'+row.id+'/pdf','inventory-legal-'+row.id+'.pdf')">
         <Download :size="15"/></button>
        <button v-if="row.status==='draft'&&permitted('legal.approve')" type="button"
          class="inv-btn inv-btn-primary" @click="ask(t('approve'),()=>documentAction(row,'approved'))">{{t("approve")}}</button>
        <button v-if="row.status==='approved'&&permitted('legal.publish')" class="inv-btn inv-btn-primary"
          :disabled="!overview?.flags.legal_publication_enabled" @click="ask(t('publish'),()=>documentAction(row,'published'))">{{t("publish")}}</button>
       </template>
       <button v-if="section==='access'&&permitted('platform.manage')" class="inv-btn inv-btn-secondary"
        type="button" @click="ask(t('revoke'),()=>commercialApi.revoke(row.id))">{{t("revoke")}}</button>
      </div></td>
     </tr>
     <tr v-if="!data.length"><td :colspan="columns[section].length+1">
       <div class="inv-admin-empty">{{loading?t("load"):t("empty")}}</div>
     </td></tr>
    </tbody>
   </table></div>
   <nav class="inv-admin-pagination" :aria-label="t('pages')">
    <button type="button" class="inv-btn inv-btn-secondary" :disabled="page<=1||loading" @click="page--;load()">{{t("prev")}}</button>
    <span>{{page}} / {{lastPage}}</span>
    <button type="button" class="inv-btn inv-btn-secondary" :disabled="page>=lastPage||loading" @click="page++;load()">{{t("next")}}</button>
   </nav>
  </div>
 </main>

 <AdminDialog v-if="selectedCompany&&!editor" :title="selectedCompany.organization.name" @close="selectedCompany=null">
  <dl class="inv-admin-details">
   <dt>{{t("company")}}</dt><dd>{{selectedCompany.organization.name}}</dd>
   <dt>{{t("plans")}}</dt><dd>{{selectedCompany.subscription?.snapshot?.terms?.names?.[locale()]||selectedCompany.subscription?.snapshot?.code||"—"}}</dd>
   <dt>{{t("status")}}</dt><dd>{{status(selectedCompany.subscription?.status)}}</dd>
  </dl>
  <section v-if="permitted('subscriptions.write')" class="inv-admin-detail-section">
   <h3>{{t("assignPlan")}}</h3>
   <div class="inv-admin-inline-fields">
    <label>{{t("plans")}}<select v-model.number="assignPlan">
     <option v-for="p in publishedPlans" :key="p.id" :value="p.id">{{planName(p)}} · v{{p.version}}</option>
    </select></label>
    <label>{{t("endsAt")}}<input v-model="endsAt" type="datetime-local"/></label>
    <button type="button" class="inv-btn inv-btn-primary" :disabled="!assignPlan||busy"
     @click="ask(t('assignPlan'),()=>commercialApi.assignPlan(selectedCompany.organization.id,Number(assignPlan),endsAt||null))">
      {{t("save")}}</button>
   </div>
  </section>
  <section class="inv-admin-detail-section">
   <h3>{{t("companyUsers")}}</h3>
   <div class="inv-admin-scroll"><table class="inv-admin-table">
    <thead><tr><th>{{t("email")}}</th><th>{{t("role")}}</th><th>{{t("emailVerified")}}</th></tr></thead>
    <tbody><tr v-for="person in companyUsers" :key="person.id">
     <td>{{person.email}}</td><td>{{person.role_code}}</td><td>{{person.email_verified_at?"✓":"—"}}</td>
    </tr></tbody>
   </table></div>
   <nav class="inv-admin-pagination">
    <button class="inv-btn inv-btn-secondary" :disabled="companyUsersPage<=1" @click="companyUsersPage--;loadCompanyUsers()">{{t("prev")}}</button>
    <span>{{companyUsersPage}} / {{companyUsersPages}}</span>
    <button class="inv-btn inv-btn-secondary" :disabled="companyUsersPage>=companyUsersPages" @click="companyUsersPage++;loadCompanyUsers()">{{t("next")}}</button>
   </nav>
  </section>
  <section v-if="permitted('billing.write')" class="inv-admin-detail-section">
   <button type="button" class="inv-btn inv-btn-secondary"
    @click="editor={kind:'buyer',data:selectedCompany.billing_profile}">{{t("buyer")}}</button>
  </section>
  <section class="inv-admin-detail-section">
   <h3>{{t("history")}}</h3><ul>
     <li v-for="event in selectedCompany.audit" :key="event.id">{{shortDate(event.created_at)}} · {{event.action}}</li>
   </ul>
  </section>
 </AdminDialog>

 <AdminDialog v-if="editor" :title="t(editor.kind==='plan'?'createPlan':editor.kind==='legal'?'createDocument':editor.kind==='invoice'?'createInvoice':editor.kind==='buyer'?'buyer':'supplier')" @close="editor=null">
  <p v-if="error" role="alert" class="inv-error">{{error}}</p>
  <PlanEditor v-if="editor.kind==='plan'" :key="'plan-'+(editor.data?.id||'new')" :plan="editor.data"
   :modules="overview?.modules||[]" :busy="busy" @save="saveEditor"/>
  <BillingEditor v-if="['supplier','buyer'].includes(editor.kind)" :key="editor.kind"
   :profile="editor.data" :busy="busy" @save="saveEditor"/>
  <InvoiceEditor v-if="editor.kind==='invoice'" :organizations="organizationOptions" :busy="busy" @save="saveEditor"/>
  <LegalEditor v-if="editor.kind==='legal'" :key="'legal-'+(editor.data?.id||'new')"
   :document="editor.data" :busy="busy" @save="saveEditor"/>
 </AdminDialog>

 <AdminDialog v-if="proofs" :title="t('proofs')" @close="proofs=null">
  <h3>{{proofs.invoice.number||'#'+proofs.invoice.id}}</h3>
  <p v-if="!proofs.items.length">{{t("empty")}}</p>
  <section v-for="proof in proofs.items" :key="proof.id" class="inv-admin-detail-section">
   <p>#{{proof.id}} · {{status(proof.status)}} · {{shortDate(proof.created_at)}}</p>
   <a :href="'/inventory-api/api/v1/platform-admin/proofs/'+proof.id+'/file'"
    target="_blank" rel="noopener" class="inv-btn inv-btn-secondary">{{t("download")}}</a>
   <p v-if="proof.review_note">{{proof.review_note}}</p>
   <div v-if="proof.status==='pending'&&permitted('billing.write')" class="inv-admin-inline-fields">
    <label>{{t("proofNote")}}<input v-model="reviewNote" maxlength="2000" /></label>
    <button type="button" class="inv-btn inv-btn-primary" @click="ask(t('approve'),()=>reviewProof(proof.id,'accepted'))">{{t("approve")}}</button>
    <button type="button" class="inv-btn inv-btn-secondary" @click="ask(t('archive'),()=>reviewProof(proof.id,'rejected'))">{{t("archive")}}</button>
   </div>
  </section>
 </AdminDialog>

 <AdminDialog v-if="decision" :title="t('confirm')" @close="decision=null">
  <div class="inv-admin-confirm">{{decision.text}}</div>
  <label v-if="section==='documents'" class="inv-admin-form" style="margin-top:15px">
   {{t("approvalNote")}}<textarea v-model="approvalNote" rows="3" minlength="10" /></label>
  <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px">
   <button type="button" class="inv-btn inv-btn-secondary" @click="decision=null">{{t("no")}}</button>
   <button type="button" class="inv-btn inv-btn-primary" :disabled="busy"
    @click="confirmDecision">{{t("yes")}}</button>
  </div>
 </AdminDialog>
</div>
</template>
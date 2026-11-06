<script setup lang="ts">
import {SiteLegalContent} from "@itpmining/vue-basic-components";
import {onMounted,ref,watch} from "vue";
import {useRoute,useRouter} from "vue-router";
import PublicLayout from "../../components/commercial/PublicLayout.vue";
import {commercialApi} from "../../api/commercial";
import type {LegalRecord} from "../../api/commercial";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";

const ui=useUiSettings(),route=useRoute(),router=useRouter();
function navigateLegal(_item:unknown,event:MouseEvent){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();void router.push("/legal")}
const t=(key:string)=>commercialT(ui.locale,key);
const documents=ref<LegalRecord[]>([]);
const selected=ref<LegalRecord|null>(null);
const loading=ref(true),documentLoading=ref(false),error=ref("");
let sequence=0;
async function selectDocument(){
 const current=++sequence;
 const type=String(route.params.document||"");
 const entry=documents.value.find(doc=>doc.type===type);
 selected.value=null;
 if(!type||!entry)return;
 documentLoading.value=true;
 try{
  // The list intentionally contains no full document body.
  const response=await commercialApi.legalDocument(entry.id);
  if(current===sequence && response.data.status==="published" && response.data.id===entry.id)
   selected.value=response.data;
 }catch(e){
  if(current===sequence)error.value=e instanceof Error?e.message:t("errors");
 }finally{
  if(current===sequence)documentLoading.value=false;
 }
}
async function load(){
 const current=++sequence;
 loading.value=true;error.value="";selected.value=null;
 try{
  const response=await commercialApi.legal(ui.locale==="ka"?"ge":ui.locale);
  if(current===sequence){
   documents.value=response.data;
   loading.value=false;
   await selectDocument();
  }
 }catch(e){
  if(current===sequence){error.value=e instanceof Error?e.message:t("errors");loading.value=false;}
 }
}
watch(()=>route.params.document,()=>{void selectDocument()});
watch(()=>ui.locale,()=>{void load()});
onMounted(load);
</script>
<template><PublicLayout>
 <div v-if="!selected" class="inv-page-intro">
  <div class="inv-breadcrumb"><RouterLink to="/">{{t("home")}}</RouterLink> / {{t("documents")}}</div>
  <h1>{{route.params.document?t(String(route.params.document)):t("legalLabel")}}</h1>
  <p>{{t("privacyNotice")}}</p>
 </div>
 <div class="inv-secondary-page">
  <p v-if="loading||documentLoading" role="status">{{t("load")}}</p>
  <p v-else-if="error" role="alert" class="inv-error">{{error}}
    <button class="inv-btn inv-btn-secondary" type="button" @click="load">{{t("retry")}}</button>
  </p>
  <SiteLegalContent v-else-if="selected" :title="selected.title" :back-href="router.resolve('/legal').href" :back-label="t('documents')" @navigate="navigateLegal">
    <p style="color:#7993a0;font-size:12px">
      {{t("version")}} {{selected.version}} · {{selected.jurisdiction}} ·
      {{t("effective")}} {{selected.effective_at?.slice(0,10)||"—"}}
    </p>
    <div style="white-space:pre-wrap;overflow-wrap:anywhere">{{selected.body}}</div>
  </SiteLegalContent>
  <template v-else-if="route.params.document">
    <p class="inv-empty-plans">{{t("legalEmpty")}}</p>
    <RouterLink to="/legal" class="inv-public-pricing-link">{{t("back")}}</RouterLink>
  </template>
  <nav v-else-if="documents.length" class="inv-legal-list" :aria-label="t('legalLabel')">
    <RouterLink v-for="doc in documents" :key="doc.id" :to="'/legal/'+doc.type">
      {{doc.title}} · v{{doc.version}}
    </RouterLink>
  </nav>
  <p v-else class="inv-empty-plans">{{t("legalEmpty")}}</p>
 </div>
</PublicLayout></template>

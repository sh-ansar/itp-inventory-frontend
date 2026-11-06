<script setup lang="ts">
import {computed,reactive,ref,watch,onMounted} from "vue";
import {useRoute,useRouter} from "vue-router";
import PublicLayout from "../../components/commercial/PublicLayout.vue";
import {commercialApi} from "../../api/commercial";
import type {LegalRecord} from "../../api/commercial";
import {login} from "../../api/session";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";
const ui=useUiSettings(),route=useRoute(),router=useRouter();
const t=(k:string)=>commercialT(ui.locale,k);
const registering=computed(()=>route.path.endsWith("/register"));
const verifying=computed(()=>route.path==="/verify-email");
const values=reactive({
 name:"",company_name:"",email:"",password:"",password_confirmation:"",
 plan_code:"",website:"",
});
const busy=ref(false),error=ref(""),success=ref(false);
const legalDocs=ref<LegalRecord[]>([]);
const legalChoices=reactive<Record<string,boolean>>({});
async function loadLegal(){
 try{const result=await commercialApi.legal(ui.locale==="ka"?"ge":ui.locale);
  legalDocs.value=result.data.filter(doc=>doc.required);
 }catch{legalDocs.value=[];}
}
watch(()=>ui.locale,()=>{if(registering.value)void loadLegal()});
onMounted(()=>{if(registering.value)void loadLegal()});
const chosenPlan=computed(()=>String(route.query.plan||sessionStorage.getItem("inventory.planCode")||""));
watch(chosenPlan,v=>{values.plan_code=v},{immediate:true});
async function submit(){
 if(busy.value)return;
 busy.value=true;error.value="";
 try {
  if(registering.value){
   await commercialApi.register({...values,locale:ui.locale==="ka"?"ge":ui.locale,
      legal_choices:{...legalChoices}});
   success.value=true;
  }else{
   await login(values.email.trim(),values.password);
   const requested=String(route.query.next||"");
   await router.replace(/^\/admin(?:\/|$)/.test(requested)?requested:"/registry");
  }
 }catch(e){error.value=e instanceof Error?e.message:t(registering.value?"registerError":"loginError")}
 finally{busy.value=false}
}
async function verify(){
 const token=String(route.query.token||"");
 if(!token||busy.value)return;
 busy.value=true;error.value="";
 try{await commercialApi.verify(token);success.value=true}
 catch(e){error.value=e instanceof Error?e.message:t("verifyError")}
 finally{busy.value=false}
}
async function resend(){
 if(!values.email||busy.value)return;
 busy.value=true;error.value="";
 try{await commercialApi.resend(values.email);success.value=true}
 catch(e){error.value=e instanceof Error?e.message:t("registerError")}
 finally{busy.value=false}
}
</script>
<template><PublicLayout><div class="inv-auth-card">
  <div class="inv-breadcrumb"><RouterLink to="/">{{t("home")}}</RouterLink> / {{verifying?t("verifyTitle"):registering?t("signUp"):t("signIn")}}</div>
  <h1>{{verifying?t("verifyTitle"):registering?t("registerTitle"):t("loginTitle")}}</h1>
  <div v-if="error" class="inv-error" role="alert">{{error}}</div>
  <div v-if="success" class="inv-success" role="status">
    {{verifying?t("verifySuccess"):t("registerSent")}}
    <div class="inv-auth-actions">
      <RouterLink class="inv-btn inv-btn-primary" to="/auth/login">{{t("signIn")}}</RouterLink>
    </div>
  </div>
  <template v-else-if="verifying">
    <p>{{t("emailHint")}}</p>
    <button type="button" :disabled="busy" class="inv-btn inv-btn-primary" @click="verify">
      {{busy?t("load"):t("verifyTitle")}}</button>
  </template>
  <template v-else>
    <form class="inv-auth-form" @submit.prevent="submit">
      <label v-if="registering">{{t("name")}}
        <input v-model.trim="values.name" type="text" autocomplete="name" minlength="2" maxlength="150" required />
      </label>
      <label v-if="registering">{{t("company")}}
        <input v-model.trim="values.company_name" type="text" autocomplete="organization" minlength="2" maxlength="255" required />
      </label>
      <label>{{t("email")}}
        <input v-model.trim="values.email" type="email" autocomplete="username" maxlength="255" required />
      </label>
      <label>{{t("password")}}
        <input v-model="values.password" type="password" :autocomplete="registering?'new-password':'current-password'"
          :minlength="registering?12:8" required />
      </label>
      <label v-if="registering">{{t("passwordConfirm")}}
        <input v-model="values.password_confirmation" type="password" autocomplete="new-password" minlength="12" required />
      </label>
      <input v-if="registering" v-model="values.website" tabindex="-1" autocomplete="off" type="text"
        aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;width:1px;height:1px" />
      <p v-if="registering">{{t("emailHint")}}</p>
      <label v-for="doc in (registering?legalDocs:[])" :key="doc.id" style="display:flex;flex-direction:row;align-items:center;gap:9px">
       <input v-model="legalChoices[doc.type]" type="checkbox" :required="doc.required" style="width:18px;height:18px;flex:none"/>
       <RouterLink :to="'/legal/'+doc.type" target="_blank" rel="noopener">{{doc.title}} · v{{doc.version}}</RouterLink>
      </label>
      <button class="inv-btn inv-btn-primary" type="submit" :disabled="busy">
        {{busy?t("load"):registering?t("signUp"):t("signIn")}}
      </button>
    </form>
    <div class="inv-auth-actions">
      <RouterLink :to="registering?'/auth/login':'/auth/register'">
        {{registering?t("signIn"):t("signUp")}}</RouterLink>
      <RouterLink v-if="registering" to="/legal">{{t("documents")}}</RouterLink>
      <button v-if="registering" type="button" style="border:0;background:none;cursor:pointer" :disabled="busy"
        @click="resend">{{t("resend")}}</button>
    </div>
  </template>
</div></PublicLayout></template>
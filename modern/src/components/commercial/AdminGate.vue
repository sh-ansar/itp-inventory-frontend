<script setup lang="ts">
import {onMounted,ref} from "vue";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";
import {commercialApi} from "../../api/commercial";
import {currentUser} from "../../api/session";
import PlatformAdminPage from "../../pages/PlatformAdminPage.vue";

const ui=useUiSettings(),t=(key:string)=>commercialT(ui.locale,key);
const state=ref<"loading"|"permitted"|"login"|"forbidden"|"error">("loading");
const logo=import.meta.env.BASE_URL+"brand/inventory-logo.svg";
async function check() {
 state.value="loading";
 try{
  await currentUser();
 }catch(e:any){
  state.value=e?.status===401?"login":"error";
  return;
 }
 try{
  const overview=await commercialApi.overview();
  state.value=overview.permissions.length>0?"permitted":"forbidden";
 }catch(e:any){
  state.value=e?.status===401?"login":e?.status===403?"forbidden":"error";
 }
}
onMounted(check);
</script>
<template>
 <PlatformAdminPage v-if="state==='permitted'" />
 <div v-else class="inv-admin-access">
  <img :src="logo" alt="ITP Inventory" width="220" height="50" />
  <p v-if="state==='loading'" role="status">{{t("load")}}</p>
  <template v-else>
   <h1>{{state==="forbidden"?t("forbidden"):state==="login"?t("loginTitle"):t("errors")}}</h1>
   <RouterLink v-if="state==='login'" class="inv-btn inv-btn-primary" to="/auth/login">{{t("signIn")}}</RouterLink>
   <RouterLink v-else class="inv-btn inv-btn-secondary" to="/registry">{{t("adminDashboard")}}</RouterLink>
   <button v-if="state==='error'" type="button" class="inv-btn inv-btn-secondary" @click="check">{{t("retry")}}</button>
  </template>
 </div>
</template>
<style scoped>
.inv-admin-access{display:flex;flex-direction:column;align-items:center;gap:22px;justify-content:center;
 min-height:100dvh;padding:25px;background:#f6fafc;color:#153441;text-align:center}
.inv-admin-access h1{font-size:24px}
</style>
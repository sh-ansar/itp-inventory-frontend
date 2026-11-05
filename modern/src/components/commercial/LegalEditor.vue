<script setup lang="ts">
import {reactive} from "vue";
import {commercialT} from "../../commercialTranslations";
import {useUiSettings} from "../../stores/uiSettings";
import type {LegalRecord} from "../../api/commercial";
const props=defineProps<{document:LegalRecord|null;busy:boolean}>();
const emit=defineEmits<{save:[value:unknown]}>();
const ui=useUiSettings(),t=(k:string)=>commercialT(ui.locale,k);
const types=["offer","tariff_policy","acceptable_use","personal_data_consent","privacy"];
const value=reactive({
 type:props.document?.type||"offer",
 locale:props.document?.locale||"ru",
 jurisdiction:props.document?.jurisdiction||"KZ",
 title:props.document?.title||"",
 body:props.document?.body||"",
 acceptance:props.document?.acceptance||"acknowledged",
 required:props.document?.required??true,
 effective_at:props.document?.effective_at?.slice(0,16)||"",
});
</script>
<template><form class="inv-admin-form" @submit.prevent="emit('save',{...value,effective_at:value.effective_at||null})">
 <div class="inv-admin-grid-3">
  <label>{{t("documentType")}}<select v-model="value.type">
   <option v-for="kind in types" :key="kind" :value="kind">{{t(kind)}}</option>
  </select></label>
  <label>{{t("language")}}<select v-model="value.locale"><option value="ru">RU</option>
    <option value="en">EN</option><option value="ge">GE</option></select></label>
  <label>{{t("jurisdiction")}}<select v-model="value.jurisdiction"><option>KZ</option><option>GE</option></select></label>
 </div>
 <label>{{t("planName")}}<input v-model.trim="value.title" required maxlength="250"/></label>
 <label>{{t("body")}}<textarea v-model="value.body" rows="12" required minlength="50" maxlength="250000"/></label>
 <div class="inv-admin-grid-2">
  <label>{{t("acceptance")}}<select v-model="value.acceptance">
    <option value="accepted">accepted</option><option value="acknowledged">acknowledged</option><option value="consented">consented</option></select></label>
  <label>{{t("effectiveAt")}}<input v-model="value.effective_at" type="datetime-local"/></label>
 </div>
 <label><input v-model="value.required" type="checkbox" />{{t("requiredDoc")}}</label>
 <footer><button class="inv-btn inv-btn-primary" type="submit" :disabled="busy">{{t("saveDraft")}}</button></footer>
</form></template>
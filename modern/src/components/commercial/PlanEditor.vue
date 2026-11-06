<script setup lang="ts">
import {reactive,ref} from "vue";
import type {Plan} from "../../api/commercial";
import {commercialT} from "../../commercialTranslations";
import {useUiSettings} from "../../stores/uiSettings";
const props=defineProps<{plan:Plan|null;modules:string[];busy:boolean}>();
const emit=defineEmits<{save:[payload:unknown]}>();
const ui=useUiSettings(),t=(k:string)=>commercialT(ui.locale,k);
const before=props.plan;
const names=before?.terms.names||{};
const limits=before?.terms.limits||{};
const modules=props.modules;
const defaults=Object.fromEntries(modules.map(module=>[module,true]));
const value=reactive({
 code:before?.code||"",
 names:{ru:names.ru||"",en:names.en||"",ge:names.ge||""},
 description:before?.terms.description||"",
 descriptions:{
  ru:before?.terms.descriptions?.ru||before?.terms.description||"",
  en:before?.terms.descriptions?.en||before?.terms.description||"",
  ge:before?.terms.descriptions?.ge||before?.terms.description||"",
 },
 price_minor:before?.terms.price_minor||0,
 currency:before?.terms.currency||"KZT",
 period_months:before?.terms.period_months||1,
 is_public:before?.is_public??true,
 display_order:before?.display_order||0,
 limits:{
  users:limits.users??null,companies:limits.companies??null,
  storage_bytes:limits.storage_bytes??null,max_file_bytes:limits.max_file_bytes??null,
 },
 modules:{...defaults,...before?.terms.modules},
});
const price=ref((value.price_minor/100).toFixed(2));
const amountUnits:Record<string,number>={users:1,companies:1,storage_bytes:1073741824,max_file_bytes:1048576};
const limitFields=[
 ["users","seats"],["companies","organizations"],
 ["storage_bytes","storageGb"],["max_file_bytes","maxFileMb"],
] as const;
function limitValue(k:keyof typeof value.limits):string{
 const num=value.limits[k];return num===null?"":String(Number(num)/amountUnits[k]);
}
function setLimit(k:keyof typeof value.limits,e:Event){
 const raw=(e.target as HTMLInputElement).value;
 value.limits[k]=raw===""?null:Math.round(Number(raw)*amountUnits[k]);
}
function save(){
 const m=/^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(price.value);
 if(!m)return;
 value.price_minor=Number(m[1])*100+Number((m[2]||"").padEnd(2,"0"));
 emit("save",{...value,names:{...value.names},descriptions:{...value.descriptions},limits:{...value.limits},modules:{...value.modules}});
}
</script>
<template><form class="inv-admin-form" @submit.prevent="save">
 <label>{{t("planCode")}}<input v-model.trim="value.code" pattern="[a-z][a-z0-9_-]{1,39}" required maxlength="40"/></label>
 <div class="inv-admin-grid-3">
  <label v-for="lang in ['ru','en','ge'] as const" :key="lang">{{t("planName")}} ({{lang.toUpperCase()}})
   <input v-model.trim="value.names[lang]" maxlength="120" required />
  </label>
 </div>
 <div class="inv-admin-grid-3">
  <label v-for="lang in ['ru','en','ge'] as const" :key="'desc-'+lang">{{t("description")}} ({{lang.toUpperCase()}})
   <textarea v-model="value.descriptions[lang]" rows="3" maxlength="4000"/>
  </label>
 </div>
 <div class="inv-admin-grid-3">
  <label>{{t("price")}}<input v-model="price" type="text" inputmode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" /></label>
  <label>{{t("currency")}}<select v-model="value.currency"><option v-for="c in ['KZT','GEL','USD','EUR']" :key="c">{{c}}</option></select></label>
  <label>{{t("period")}}<input v-model.number="value.period_months" type="number" min="1" max="120" required /></label>
 </div>
 <fieldset><legend>{{t("features")}}</legend><div class="inv-admin-grid-2">
  <label v-for="module in modules" :key="module">
   <input v-model="value.modules[module]" type="checkbox" />{{t(module)}}
  </label>
 </div></fieldset>
 <fieldset><legend>{{t("planTitle")}}</legend><div class="inv-admin-grid-2">
  <label v-for="[key,label] in limitFields" :key="key">{{t(label)}}
   <input type="number" min="0" step="any" :value="limitValue(key)" :placeholder="t('unlimited')" @change="setLimit(key,$event)" />
  </label>
 </div></fieldset>
 <div class="inv-admin-grid-2">
  <label><input v-model="value.is_public" type="checkbox" />{{t("publicPlan")}}</label>
  <label>{{t("order")}}<input v-model.number="value.display_order" type="number" min="-10000" max="10000" /></label>
 </div>
 <p style="color:#7e98a5;font-size:12px">{{t("newVersion")}} · {{t("status_draft")}}</p>
 <footer><button type="submit" class="inv-btn inv-btn-primary" :disabled="busy">{{t("saveDraft")}}</button></footer>
</form></template>
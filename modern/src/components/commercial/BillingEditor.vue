<script setup lang="ts">
import {reactive} from "vue";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";
const props=defineProps<{profile:Record<string,string>|null;busy:boolean}>();
const emit=defineEmits<{save:[value:Record<string,string>]}>();
const ui=useUiSettings(),t=(k:string)=>commercialT(ui.locale,k);
const fields=["name","bin","address","bank","iban","bic","email","phone"] as const;
const values=reactive(Object.fromEntries(fields.map(k=>[k,String(props.profile?.[k]||"")])));
</script>
<template><form class="inv-admin-form" @submit.prevent="emit('save',{...values})">
 <div class="inv-admin-grid-2">
  <label v-for="field in fields" :key="field">{{t(field)}}
   <input v-model.trim="values[field]" :type="field==='email'?'email':'text'"
    :required="field==='name'" maxlength="500"/>
  </label>
 </div>
 <footer><button class="inv-btn inv-btn-primary" type="submit" :disabled="busy">{{t("save")}}</button></footer>
</form></template>
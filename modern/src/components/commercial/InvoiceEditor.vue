<script setup lang="ts">
import {reactive,ref} from "vue";
import type {Organization} from "../../api/commercial";
import {commercialT} from "../../commercialTranslations";
import {useUiSettings} from "../../stores/uiSettings";
const props=defineProps<{organizations:Organization[];busy:boolean;initialCompany?:string}>();
const emit=defineEmits<{save:[value:unknown]}>();
const ui=useUiSettings(),t=(k:string)=>commercialT(ui.locale,k);
const value=reactive({
 company_id:props.initialCompany||"",basis:"",
 period_from:"",period_to:"",due_date:"",
 items:[{description:"",quantity:1,price:"0.00"}],
});
const errors=ref("");
function save(){
 errors.value="";
 const items=[];
 for(const item of value.items){
  const m=/^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(item.price);
  if(!m){errors.value=t("price");return;}
  items.push({description:item.description,quantity:Number(item.quantity),
   unit_minor:Number(m[1])*100+Number((m[2]||"").padEnd(2,"0"))});
 }
 emit("save",{...value,items});
}
</script>
<template><form class="inv-admin-form" @submit.prevent="save">
 <p style="font-size:12px;color:#6c8d9a">{{t("serviceDisabled")}}</p>
 <p v-if="errors" class="inv-error" role="alert">{{errors}}</p>
 <label>{{t("company")}}<select v-model="value.company_id" required>
  <option value="" disabled>{{t("selectCompany")}}</option>
  <option v-for="org in organizations" :key="org.id" :value="org.id">{{org.name}}</option>
 </select></label>
 <div class="inv-admin-grid-3">
  <label>{{t("dateFrom")}}<input v-model="value.period_from" type="date" required /></label>
  <label>{{t("dateTo")}}<input v-model="value.period_to" type="date" :min="value.period_from" required /></label>
  <label>{{t("dueDate")}}<input v-model="value.due_date" type="date" required /></label>
 </div>
 <label>{{t("basis")}}<input v-model.trim="value.basis" maxlength="300" required /></label>
 <fieldset v-for="(item,i) in value.items" :key="i">
  <legend>{{t("invoiceItems")}} · {{i+1}}</legend>
  <label>{{t("description")}}<input v-model.trim="item.description" maxlength="500" required /></label>
  <div class="inv-admin-grid-2">
   <label>{{t("quantity")}}<input v-model.number="item.quantity" type="number" min="1" max="1000000" required/></label>
   <label>{{t("unitPrice")}}<input v-model.trim="item.price" inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" required/></label>
  </div>
  <button v-if="value.items.length>1" type="button" class="inv-btn inv-btn-secondary" @click="value.items.splice(i,1)">
    {{t("archive")}}</button>
 </fieldset>
 <button type="button" class="inv-btn inv-btn-secondary"
  @click="value.items.push({description:'',quantity:1,price:'0.00'})">{{t("add")}}</button>
 <footer><button type="submit" class="inv-btn inv-btn-primary" :disabled="busy">{{t("saveDraft")}}</button></footer>
</form></template>
<script setup lang="ts">
import {ref,watch,computed} from "vue";
import {ShieldCheck,RefreshCw,Save} from "lucide-vue-next";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import {companyMembers,updateMemberRole} from "../api/parity";
import type {Member} from "../api/parity";
import {useUiSettings} from "../stores/uiSettings";

const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const members=ref<Member[]>([]),loading=ref(false),saving=ref<number|null>(null),error=ref(""),notice=ref("");
const drafts=ref<Record<number,string>>({}),reasons=ref<Record<number,string>>({});
const isAdmin=computed(()=>props.role==="company_admin");
const words=computed(()=>ui.locale==="ru"?{
  title:"Пользователи и роли",intro:"Назначение доступа к имуществу компании",
  save:"Сохранить роль",reason:"Причина изменения",locked:"Доступно только администратору компании",
  noUsers:"Пользователей пока нет",name:"Сотрудник",role:"Роль",viewer:"Просмотр",
  manager:"Менеджер инвентаризации",admin:"Администратор",refresh:"Обновить",saved:"Роль изменена"
}:ui.locale==="ka"?{
  title:"მომხმარებლები და როლები",intro:"კომპანიის ქონებაზე წვდომის მართვა",
  save:"როლის შენახვა",reason:"ცვლილების მიზეზი",locked:"მხოლოდ კომპანიის ადმინისტრატორისთვის",
  noUsers:"მომხმარებლები არ არის",name:"თანამშრომელი",role:"როლი",viewer:"მხოლოდ ნახვა",
  manager:"ინვენტარიზაციის მენეჯერი",admin:"ადმინისტრატორი",refresh:"განახლება",saved:"როლი განახლებულია"
}:{
  title:"Users and roles",intro:"Manage access to company assets",
  save:"Save role",reason:"Reason for change",locked:"Company administrators only",
  noUsers:"No members",name:"Member",role:"Role",viewer:"Viewer",manager:"Inventory manager",
  admin:"Administrator",refresh:"Refresh",saved:"Role updated"
});
let serial=0;
async function load(){
  const current=++serial;members.value=[];error.value="";notice.value="";
  if(!isAdmin.value)return;
  loading.value=true;
  try{
    const x=await companyMembers(props.companyId);
    if(current!==serial)return;
    members.value=x.data;drafts.value=Object.fromEntries(x.data.map(m=>[m.user_id,m.role_code]));
    reasons.value={};
  }catch(e){if(current===serial)error.value=e instanceof Error?e.message:String(e);}
  finally{if(current===serial)loading.value=false;}
}
async function save(m:Member){
  if(!isAdmin.value||saving.value!==null||!drafts.value[m.user_id]||!reasons.value[m.user_id]?.trim())return;
  saving.value=m.user_id;error.value="";notice.value="";
  try{
    await updateMemberRole(props.companyId,m.user_id,drafts.value[m.user_id],reasons.value[m.user_id]);
    notice.value=words.value.saved;
    await load();
    notice.value=words.value.saved;
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{saving.value=null;}
}
watch(()=>[props.companyId,props.role],()=>void load(),{immediate:true});
</script>

<template>
<section class="roles-page">
  <header class="page-heading"><div><h2>{{words.title}}</h2><p class="muted">{{words.intro}} · {{companyName}}</p></div>
    <BaseButton variant="secondary" :disabled="loading" @click="load"><RefreshCw :size="16"/>{{words.refresh}}</BaseButton>
  </header>
  <p v-if="error" role="alert" class="error">{{error}}</p>
  <p v-if="notice" role="status" class="notice">{{notice}}</p>
  <BaseCard v-if="!isAdmin"><ShieldCheck :size="22"/><p>{{words.locked}}</p></BaseCard>
  <BaseCard v-else>
    <p v-if="!loading&&!members.length" class="muted">{{words.noUsers}}</p>
    <div v-for="m in members" :key="m.user_id" class="member">
      <div class="identity"><strong>{{m.name}}</strong><small>{{m.email}}</small></div>
      <label>{{words.role}}<select v-model="drafts[m.user_id]" :disabled="saving!==null">
        <option value="viewer">{{words.viewer}}</option>
        <option value="inventory_manager">{{words.manager}}</option>
        <option value="company_admin">{{words.admin}}</option>
      </select></label>
      <label v-if="drafts[m.user_id]!==m.role_code">{{words.reason}}
        <input v-model.trim="reasons[m.user_id]" minlength="5" maxlength="1000" required />
      </label>
      <BaseButton v-if="drafts[m.user_id]!==m.role_code" :disabled="saving!==null||(reasons[m.user_id]||'').length<5"
        @click="save(m)"><Save :size="16"/>{{words.save}}</BaseButton>
    </div>
  </BaseCard>
</section>
</template>

<style scoped>
.roles-page{display:grid;gap:18px;min-width:0}.page-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.page-heading h2{margin:0}.page-heading p{margin:6px 0 0}.member{display:grid;grid-template-columns:minmax(170px,1.3fr) minmax(180px,1fr) minmax(180px,1fr) auto;gap:14px;padding:16px 0;align-items:end;border-bottom:1px solid var(--color-stroke)}.identity{display:grid;gap:6px;min-width:0}.identity small{color:var(--color-muted);overflow-wrap:anywhere}.member label{display:grid;gap:7px;font-size:12px;color:var(--color-muted)}.member select,.member input{min-width:0;width:100%}.notice{color:var(--color-success)}.error{color:var(--color-danger)}@media(max-width:1000px){.member{grid-template-columns:1fr 1fr}}@media(max-width:560px){.member{grid-template-columns:1fr}}
</style>

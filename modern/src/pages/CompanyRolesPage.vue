<script setup lang="ts">
import BaseSelect from "../components/ui/BaseSelect.vue";
import BaseConfirmDialog from "../components/ui/BaseConfirmDialog.vue";
import { useConfirmDialog } from "../composables/useConfirmDialog";

import {ref,watch,computed} from "vue";
import {ShieldCheck,RefreshCw,Save,UserPlus,UserMinus} from "lucide-vue-next";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import {companyMembers,updateMemberRole,addCompanyMember,removeCompanyMember} from "../api/parity";
import type {Member} from "../api/parity";
import {useUiSettings} from "../stores/uiSettings";

const { open: confirmOpen, message: confirmMessage, title: confirmTitle,
  confirmLabel: confirmLabel, danger: confirmDanger, ask: askConfirmation,
  settle: settleConfirmation } = useConfirmDialog();
const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const members=ref<Member[]>([]),loading=ref(false),saving=ref<number|null>(null),error=ref(""),notice=ref("");
const drafts=ref<Record<number,string>>({}),reasons=ref<Record<number,string>>({});
const addEmail=ref(""),addRole=ref("viewer"),addReason=ref(""),addBusy=ref(false),removeReason=ref<Record<number,string>>({});
const isAdmin=computed(()=>props.role==="company_admin");
const words=computed(()=>ui.locale==="ru"?{
  title:"Пользователи и роли",intro:"Назначение доступа к имуществу компании",
  save:"Сохранить роль",reason:"Причина изменения",locked:"Доступно только администратору компании",
  noUsers:"Пользователей пока нет",name:"Сотрудник",role:"Роль",viewer:"Просмотр",
  manager:"Менеджер инвентаризации",admin:"Администратор",refresh:"Обновить",saved:"Роль изменена",add:"Предоставить доступ",remove:"Отозвать доступ",email:"Почта существующего пользователя",removeNote:"Укажите причину и подтвердите отзыв доступа",added:"Доступ предоставлен",removed:"Доступ отозван"
}:ui.locale==="ka"?{
  title:"მომხმარებლები და როლები",intro:"კომპანიის ქონებაზე წვდომის მართვა",
  save:"როლის შენახვა",reason:"ცვლილების მიზეზი",locked:"მხოლოდ კომპანიის ადმინისტრატორისთვის",
  noUsers:"მომხმარებლები არ არის",name:"თანამშრომელი",role:"როლი",viewer:"მხოლოდ ნახვა",
  manager:"ინვენტარიზაციის მენეჯერი",admin:"ადმინისტრატორი",refresh:"განახლება",saved:"როლი განახლებულია",add:"წვდომის მინიჭება",remove:"წვდომის გაუქმება",email:"არსებული მომხმარებლის ელ. ფოსტა",removeNote:"მიუთითეთ მიზეზი და დაადასტურეთ",added:"წვდომა მინიჭებულია",removed:"წვდომა გაუქმებულია"
}:{
  title:"Users and roles",intro:"Manage access to company assets",
  save:"Save role",reason:"Reason for change",locked:"Company administrators only",
  noUsers:"No members",name:"Member",role:"Role",viewer:"Viewer",manager:"Inventory manager",
  admin:"Administrator",refresh:"Refresh",saved:"Role updated",add:"Grant access",remove:"Revoke access",email:"Existing user email",removeNote:"Provide a reason and confirm access revocation",added:"Access granted",removed:"Access revoked"
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
async function addMember() {
  if(!isAdmin.value||addBusy.value||addReason.value.trim().length<5)return;
  addBusy.value=true;error.value="";notice.value="";
  try{await addCompanyMember(props.companyId,addEmail.value.trim(),addRole.value,addReason.value.trim());
    addEmail.value="";addReason.value="";await load();notice.value=words.value.added;
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{addBusy.value=false;}
}
async function removeMember(m:Member) {
  const reason=removeReason.value[m.user_id]?.trim();
  if(!isAdmin.value||saving.value!==null||!reason||reason.length<5)return;
  if(!(await askConfirmation(words.value.removeNote+" — "+m.name+"?", {danger:true,confirmLabel:words.value.remove})))return;
  saving.value=m.user_id;error.value="";notice.value="";
  try{await removeCompanyMember(props.companyId,m.user_id,reason);
    await load();notice.value=words.value.removed;
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
    <form class="grant-form" @submit.prevent="addMember">
      <h3><UserPlus :size="18"/>{{words.add}}</h3>
      <label>{{words.email}}<input v-model.trim="addEmail" type="email" autocomplete="off" required maxlength="255" /></label>
      <label>{{words.role}}<BaseSelect v-model="addRole">
        <option value="viewer">{{words.viewer}}</option>
        <option value="inventory_manager">{{words.manager}}</option>
        <option value="company_admin">{{words.admin}}</option>
      </BaseSelect></label>
      <label>{{words.reason}}<input v-model.trim="addReason" required minlength="5" maxlength="1000"/></label>
      <BaseButton type="submit" :disabled="addBusy||addReason.trim().length<5"><UserPlus :size="16"/>{{words.add}}</BaseButton>
    </form>
    <p v-if="!loading&&!members.length" class="muted">{{words.noUsers}}</p>
    <div v-for="m in members" :key="m.user_id" class="member">
      <div class="identity"><strong>{{m.name}}</strong><small>{{m.email}}</small></div>
      <label>{{words.role}}<BaseSelect v-model="drafts[m.user_id]" :disabled="saving!==null">
        <option value="viewer">{{words.viewer}}</option>
        <option value="inventory_manager">{{words.manager}}</option>
        <option value="company_admin">{{words.admin}}</option>
      </BaseSelect></label>
      <label v-if="drafts[m.user_id]!==m.role_code">{{words.reason}}
        <input v-model.trim="reasons[m.user_id]" minlength="5" maxlength="1000" required />
      </label>
      <BaseButton v-if="drafts[m.user_id]!==m.role_code" :disabled="saving!==null||(reasons[m.user_id]||'').length<5"
        @click="save(m)"><Save :size="16"/>{{words.save}}</BaseButton>
      <label v-if="m.role_code!=='company_admin'">{{words.removeNote}}
        <input v-model.trim="removeReason[m.user_id]" minlength="5" maxlength="1000"/>
      </label>
      <BaseButton v-if="m.role_code!=='company_admin'" variant="secondary"
        :disabled="saving!==null||(removeReason[m.user_id]||'').length<5" @click="removeMember(m)">
        <UserMinus :size="16"/>{{words.remove}}</BaseButton>
    </div>
  </BaseCard>
</section>

  <BaseConfirmDialog :open="confirmOpen" :message="confirmMessage" :title="confirmTitle"
    :confirm-label="confirmLabel" :danger="confirmDanger"
    @confirm="settleConfirmation(true)" @cancel="settleConfirmation(false)" />
</template>

<style scoped>
.grant-form{display:grid;grid-template-columns:repeat(3,minmax(145px,1fr)) auto;gap:12px;align-items:end;padding-bottom:20px;border-bottom:1px solid var(--color-stroke)}.grant-form h3{grid-column:1/-1;margin:0;display:flex;gap:8px;align-items:center}.grant-form label{display:grid;gap:7px;font-size:12px}.grant-form select,.grant-form input{min-width:0;width:100%}@media(max-width:1000px){.grant-form{grid-template-columns:1fr 1fr}}@media(max-width:560px){.grant-form{grid-template-columns:1fr}}
.roles-page{display:grid;gap:18px;min-width:0}.page-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.page-heading h2{margin:0}.page-heading p{margin:6px 0 0}.member{display:grid;grid-template-columns:minmax(170px,1.3fr) minmax(180px,1fr) minmax(180px,1fr) auto;gap:14px;padding:16px 0;align-items:end;border-bottom:1px solid var(--color-stroke)}.identity{display:grid;gap:6px;min-width:0}.identity small{color:var(--color-muted);overflow-wrap:anywhere}.member label{display:grid;gap:7px;font-size:12px;color:var(--color-muted)}.member select,.member input{min-width:0;width:100%}.notice{color:var(--color-success)}.error{color:var(--color-danger)}@media(max-width:1000px){.member{grid-template-columns:1fr 1fr}}@media(max-width:560px){.member{grid-template-columns:1fr}}
</style>

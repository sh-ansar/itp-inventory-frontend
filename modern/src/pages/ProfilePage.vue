<script setup lang="ts">
import { onMounted, reactive, ref, computed } from "vue";
import { Save, KeyRound, UserRound, ShieldCheck } from "lucide-vue-next";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseSelect from "../components/ui/BaseSelect.vue";
import { myProfile, updateMyProfile, changeMyPassword } from "../api/profile";
import type { MyProfile } from "../api/profile";
import { InventoryApiError } from "../api/client";
import { useUiSettings } from "../stores/uiSettings";

const emit=defineEmits<{updated:[name:string]}>();
const ui=useUiSettings();
const t=(ru:string,en:string,ka:string)=>ui.locale==="en"?en:ui.locale==="ka"?ka:ru;
const profile=ref<MyProfile|null>(null);
const loading=ref(true),saving=ref(false),passwordBusy=ref(false);
const message=ref(""),error=ref("");
const name=ref("");
const fields=reactive({current_password:"",password:"",password_confirmation:""});
const validation=ref<Record<string,string[]>>({});
const canSave=computed(()=>name.value.trim().length>=2&&name.value.trim()!==profile.value?.name);
async function refresh(){
  loading.value=true;error.value="";
  try{const result=await myProfile();profile.value=result.data;name.value=result.data.name;}
  catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{loading.value=false;}
}
onMounted(()=>{void refresh()});
async function saveName(){
  if(!canSave.value||saving.value)return;
  saving.value=true;error.value="";message.value="";
  try{const result=await updateMyProfile(name.value.trim());
    profile.value=result.data;name.value=result.data.name;
    emit("updated",result.data.name);
    message.value=t("Имя обновлено","Name updated","სახელი განახლებულია");
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{saving.value=false;}
}
async function savePassword(){
  if(passwordBusy.value||fields.password.length<12||fields.password!==fields.password_confirmation)return;
  passwordBusy.value=true;error.value="";message.value="";validation.value={};
  try{
    await changeMyPassword(fields.current_password,fields.password,fields.password_confirmation);
    fields.current_password="";fields.password="";fields.password_confirmation="";
    message.value=t("Пароль успешно изменён","Password changed successfully","პაროლი შეიცვალა");
  }catch(e){
    if(e instanceof InventoryApiError){validation.value=e.fields;error.value=e.message;}
    else error.value=e instanceof Error?e.message:String(e);
  }finally{passwordBusy.value=false;}
}
</script>

<template>
  <section class="profile-page">
    <div class="profile-heading"><UserRound :size="24" aria-hidden="true"/>
      <div><h2>{{t("Личный кабинет","My account","პირადი კაბინეტი")}}</h2>
        <p>{{t("Личные данные и настройки безопасности","Personal details and security","პირადი მონაცემები და უსაფრთხოება")}}</p></div>
    </div>
    <p v-if="error" class="error" role="alert">{{error}}</p>
    <p v-if="message" class="notice" role="status">{{message}}</p>
    <div class="profile-grid">
      <BaseCard>
        <h3>{{t("Мой профиль","My profile","ჩემი პროფილი")}}</h3>
        <div v-if="loading">{{t("Загрузка","Loading","იტვირთება")}}</div>
        <form v-else class="profile-form" @submit.prevent="saveName">
          <label>{{t("Имя и фамилия","Full name","სახელი და გვარი")}}
            <input v-model="name" autocomplete="name" minlength="2" maxlength="255" required :disabled="saving"/>
          </label>
          <label>{{t("Электронная почта","Email","ელფოსტა")}}
            <input :value="profile?.email" type="email" disabled autocomplete="email"/>
            <small>{{t("Смена почты выполняется администратором, чтобы не потерять доступ.","Email changes are handled by an administrator.","ელფოსტას ადმინისტრატორი ცვლის.")}}</small>
          </label>
          <div class="profile-actions">
            <BaseButton type="submit" :disabled="saving||!canSave"><Save :size="16"/>{{t("Сохранить","Save","შენახვა")}}</BaseButton>
          </div>
        </form>
      </BaseCard>
      <BaseCard>
        <h3><KeyRound :size="18" aria-hidden="true"/>{{t("Смена пароля","Change password","პაროლის შეცვლა")}}</h3>
        <form class="profile-form" @submit.prevent="savePassword">
          <label>{{t("Текущий пароль","Current password","მიმდინარე პაროლი")}}
            <input v-model="fields.current_password" type="password" autocomplete="current-password" required :disabled="passwordBusy"/>
            <small v-if="validation.current_password" role="alert">{{validation.current_password[0]}}</small>
          </label>
          <label>{{t("Новый пароль","New password","ახალი პაროლი")}}
            <input v-model="fields.password" type="password" autocomplete="new-password" minlength="12" required :disabled="passwordBusy"/>
            <small>{{t("От 12 символов: заглавные, строчные буквы, цифры и спецсимволы.","At least 12 characters: upper/lowercase, digits and symbols.","მინიმუმ 12 სიმბოლო: ასოები, ციფრები და ნიშნები.")}}</small>
            <small v-if="validation.password" role="alert">{{validation.password[0]}}</small>
          </label>
          <label>{{t("Повторите новый пароль","Confirm new password","გაიმეორეთ ახალი პაროლი")}}
            <input v-model="fields.password_confirmation" type="password" autocomplete="new-password" required :disabled="passwordBusy"/>
          </label>
          <div class="profile-actions">
            <BaseButton type="submit" :disabled="passwordBusy||fields.password.length<12||fields.password!==fields.password_confirmation||!fields.current_password">
              <ShieldCheck :size="16"/>{{t("Изменить пароль","Update password","პაროლის შეცვლა")}}
            </BaseButton>
          </div>
        </form>
      </BaseCard>
      <BaseCard class="profile-preferences">
        <h3>{{t("Мои параметры","My preferences","ჩემი პარამეტრები")}}</h3>
        <div class="profile-form">
          <label>{{t("Язык интерфейса","Interface language","ინტერფეისის ენა")}}
            <BaseSelect v-model="ui.locale">
              <option value="ru">Русский</option><option value="en">English</option><option value="ka">ქართული</option>
            </BaseSelect>
          </label>
          <label>{{t("Тема оформления","Appearance","გარეგნობა")}}
            <BaseSelect v-model="ui.theme">
              <option value="light">{{t("Светлая","Light","ნათელი")}}</option>
              <option value="dark">{{t("Тёмная","Dark","მუქი")}}</option>
            </BaseSelect>
          </label>
          <p class="help">{{t("Язык и тема сохраняются в этом браузере.","Language and theme are saved in this browser.","ენა და თემა ამ ბრაუზერში ინახება.")}}</p>
        </div>
      </BaseCard>
    </div>
  </section>
</template>
<style scoped>
.profile-page{display:grid;gap:20px;max-width:1150px;margin-inline:auto;min-width:0}
.profile-heading{display:flex;gap:12px;align-items:center}
.profile-heading h2,.profile-grid h3{margin:0}
.profile-heading p{font-size:13px;margin:4px 0;color:var(--color-muted)}
.profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.profile-grid h3{display:flex;gap:9px;align-items:center;margin-bottom:18px;font-size:16px}
.profile-form{display:grid;gap:15px}
.profile-form label{display:grid;gap:7px;font-size:13px;font-weight:500;min-width:0}
.profile-form input{width:100%;max-width:100%;min-height:40px;padding:8px 12px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-text)}
.profile-form input:disabled{opacity:.7}
.profile-form small,.help{color:var(--color-muted);font-size:12px;font-weight:400;margin:0}
.profile-actions{display:flex;justify-content:flex-end}
.profile-preferences{grid-column:1/-1}
@media(max-width:760px){.profile-grid{grid-template-columns:minmax(0,1fr)}}
</style>

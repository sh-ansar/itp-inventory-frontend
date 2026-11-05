<script setup lang="ts">
import {onMounted,reactive,ref,watch} from "vue";
import {Globe2,Save,ExternalLink,RefreshCw} from "lucide-vue-next";
import {commercialApi} from "../../api/commercial";
import {commercialT} from "../../commercialTranslations";
import {useUiSettings} from "../../stores/uiSettings";

const ui=useUiSettings();
const t=(key:string)=>commercialT(ui.locale,key);
const locale=ref<"ru"|"en"|"ge">("ru");
const busy=ref(false),error=ref(""),message=ref("");
const sections=[
 {title:{ru:"Главная страница",en:"Landing page",ge:"მთავარი გვერდი"},keys:[
  "heroTitle","heroSub","heroText","cardsTitle","cardsDescription","moduleTitle","moduleSubtitle",
 ]},
 {title:{ru:"Демонстрация и возможности",en:"Demo and features",ge:"დემო და შესაძლებლობები"},keys:[
  "demoTitle","demoDescription","mapTitle","mapText","scanTitle","scanText",
  "summaryTitle","summaryText",
 ]},
 {title:{ru:"Тарифы и документы",en:"Pricing and legal",ge:"ფასები და დოკუმენტები"},keys:[
  "howTitle","cta","planTitle","planText","privacyNotice",
 ]},
] as const;
const values=reactive<Record<string,string>>({});
const overrides=ref<Record<string,string>>({});
const long=new Set(["heroSub","heroText","cardsDescription","moduleSubtitle",
 "demoDescription","mapText","scanText","summaryText","planText","privacyNotice"]);
const labels:Record<string,Record<string,string>>={
 heroTitle:{ru:"Заголовок первого экрана",en:"Hero title",ge:"პირველი ეკრანის სათაური"},
 heroSub:{ru:"Подзаголовок",en:"Subtitle",ge:"ქვესათაური"},
 heroText:{ru:"Описание",en:"Description",ge:"აღწერა"},
 cardsTitle:{ru:"Заголовок возможностей",en:"Features title",ge:"შესაძლებლობების სათაური"},
 cardsDescription:{ru:"Описание возможностей",en:"Features description",ge:"შესაძლებლობების აღწერა"},
 moduleTitle:{ru:"Конструктор модулей",en:"Module builder title",ge:"მოდულების კონსტრუქტორი"},
 moduleSubtitle:{ru:"Описание конструктора",en:"Module builder description",ge:"მოდულების აღწერა"},
 demoTitle:{ru:"Демонстрация — заголовок",en:"Demo title",ge:"დემოს სათაური"},
 demoDescription:{ru:"Демонстрация — описание",en:"Demo description",ge:"დემოს აღწერა"},
 mapTitle:{ru:"Карта объектов — заголовок",en:"Facilities map title",ge:"ობიექტების რუკის სათაური"},
 mapText:{ru:"Карта объектов — текст",en:"Facilities map text",ge:"ობიექტების რუკის ტექსტი"},
 scanTitle:{ru:"QR-коды — заголовок",en:"QR title",ge:"QR სათაური"},
 scanText:{ru:"QR-коды — текст",en:"QR text",ge:"QR ტექსტი"},
 summaryTitle:{ru:"Аналитика — заголовок",en:"Analytics title",ge:"ანალიტიკის სათაური"},
 summaryText:{ru:"Аналитика — текст",en:"Analytics text",ge:"ანალიტიკის ტექსტი"},
 howTitle:{ru:"Как начать — заголовок",en:"Getting started title",ge:"დაწყების სათაური"},
 cta:{ru:"Призыв к действию",en:"Call to action",ge:"მოქმედების მოწოდება"},
 planTitle:{ru:"Тарифы — заголовок",en:"Plans title",ge:"ტარიფების სათაური"},
 planText:{ru:"Тарифы — описание",en:"Plans description",ge:"ტარიფების აღწერა"},
 privacyNotice:{ru:"Документы — подсказка",en:"Legal notice",ge:"დოკუმენტების შეტყობინება"},
};
let revision=0;
async function load(){
 const current=++revision;busy.value=true;error.value="";message.value="";
 try{
  const res=await commercialApi.adminSiteContent(locale.value);
  if(current!==revision)return;
  overrides.value=res.data;
  for(const section of sections)for(const key of section.keys) {
    values[key]=res.data[key]??commercialT(locale.value==="ge"?"ka":locale.value,key);
  }
 }catch(e){if(current===revision)error.value=e instanceof Error?e.message:String(e)}
 finally{if(current===revision)busy.value=false}
}
async function save(){
 if(busy.value)return;
 busy.value=true;error.value="";message.value="";
 try{
  const updates:Record<string,string>={};
  for(const section of sections)for(const key of section.keys)updates[key]=values[key]||"";
  await commercialApi.saveSiteContent(locale.value,updates);
  message.value={ru:"Тексты сайта сохранены и доступны сразу после обновления страницы.",
    en:"Website copy saved. Changes are visible on page reload.",
    ge:"საიტის ტექსტები შენახულია."}[locale.value];
 }catch(e){error.value=e instanceof Error?e.message:String(e)}
 finally{busy.value=false}
}
watch(locale,load);
onMounted(load);
</script>
<template>
 <section class="inv-site-editor">
  <div class="inv-site-toolbar">
    <div><Globe2 :size="19"/><strong>{{{ru:"Редактирование сайта",en:"Website copy",ge:"საიტის ტექსტები"}[locale]}}</strong></div>
    <div class="inv-site-toolbar-actions">
     <label :aria-label="t('language')">
      <select v-model="locale" :disabled="busy"><option value="ru">RU</option><option value="en">EN</option><option value="ge">GE</option></select>
     </label>
     <a class="inv-btn inv-btn-secondary" href="/inventory/" rel="noopener" target="_blank">
       <ExternalLink :size="16" />{{t("view")}}
     </a>
     <button type="button" class="inv-btn inv-btn-secondary" :disabled="busy" @click="load">
       <RefreshCw :size="16" />{{t("refresh")}}
     </button>
    </div>
  </div>
  <p class="inv-site-description">{{{ru:"Редактируйте тексты главной и тарифной страницы без публикации новой версии сайта. Пустое значение сбрасывается к системному переводу.",
  en:"Edit landing and pricing copy without a code deployment. Clearing a field restores the default translation.",
  ge:"შეცვალეთ მთავარი გვერდის ტექსტები კოდის განახლების გარეშე."}[locale]}}</p>
  <p v-if="error" role="alert" class="inv-error">{{error}}</p>
  <p v-if="message" role="status" class="inv-success">{{message}}</p>
  <form @submit.prevent="save">
   <fieldset v-for="section in sections" :key="section.keys[0]" :disabled="busy">
    <legend>{{section.title[locale]}}</legend>
    <div class="inv-site-grid">
     <label v-for="key in section.keys" :key="key">
      <span>{{labels[key]?.[locale]||key}}</span>
      <textarea v-if="long.has(key)" v-model="values[key]" rows="3" maxlength="1000" />
      <input v-else v-model="values[key]" type="text" maxlength="1000" />
     </label>
    </div>
   </fieldset>
   <div class="inv-site-actions">
    <button type="submit" :disabled="busy" class="inv-btn inv-btn-primary"><Save :size="16"/>{{t("save")}}</button>
   </div>
  </form>
 </section>
</template>
<style scoped>
.inv-site-editor{min-width:0;max-width:1150px;margin:0 auto;padding-bottom:45px}
.inv-site-toolbar,.inv-site-toolbar>div,.inv-site-toolbar-actions{display:flex;align-items:center;gap:12px}
.inv-site-toolbar{justify-content:space-between;flex-wrap:wrap;background:var(--surface,#fff);
 border:1px solid var(--border,#e0ebf0);border-radius:12px;padding:16px 20px}
.inv-site-toolbar>div{color:var(--text-primary,#244959);font-size:15px}
.inv-site-toolbar-actions{flex-wrap:wrap}
.inv-site-toolbar select{border:1px solid #d0e3ec;border-radius:7px;background:white;color:#244c5c;padding:8px 12px;min-height:36px}
.inv-site-description{color:#718d9a;font-size:13px;line-height:1.65;margin:15px 4px}
.inv-site-editor fieldset{margin:18px 0;padding:18px 20px;border:1px solid #dde9ef;border-radius:12px;background:var(--surface,#fff);min-width:0}
.inv-site-editor legend{font-weight:650;font-size:15px;color:var(--text-primary,#244959);padding:0 9px}
.inv-site-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,325px),1fr));gap:18px}
.inv-site-grid label{display:flex;flex-direction:column;gap:7px;font-size:12px;color:#72909c}
.inv-site-grid textarea,.inv-site-grid input{display:block;width:100%;min-width:0;border:1px solid #d8e7ec;border-radius:8px;padding:10px 12px;
 font:inherit;font-size:13px;color:var(--text-primary,#274958);background:var(--surface,#fff)}
.inv-site-grid textarea{min-height:77px;resize:vertical}
.inv-site-grid :is(input,textarea):focus{outline:2px solid #b1e4f7;outline-offset:1px}
.inv-site-actions{display:flex;justify-content:flex-end;padding:12px 0}
.inv-site-actions button{display:flex;gap:8px;align-items:center}
</style>

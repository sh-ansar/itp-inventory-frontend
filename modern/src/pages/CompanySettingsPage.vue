<script setup lang="ts">
import { ref,computed,watch } from "vue";
import { Building2,FileText,Plus,Send,Eye,RefreshCw } from "lucide-vue-next";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseSelect from "../components/ui/BaseSelect.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BaseIconButton from "../components/ui/BaseIconButton.vue";
import {
  getCompanySettings,saveCompanySettings,listDocumentTemplates,createDocumentTemplate,
  publishDocumentTemplate,previewDocumentTemplate,
} from "../api/companyConfiguration";
import type { CompanySettings,DocumentTemplate } from "../api/companyConfiguration";
import { InventoryApiError } from "../api/client";
import { useUiSettings } from "../stores/uiSettings";
const props=defineProps<{companyId:string;companyName:string;role:string}>();
const ui=useUiSettings();
const t=(ru:string,en:string,ka:string)=>ui.locale==="en"?en:ui.locale==="ka"?ka:ru;
const canWrite=computed(()=>props.role==="company_admin");
const supportedIntl=(Intl as typeof Intl & {supportedValuesOf?:(key:string)=>string[]}).supportedValuesOf;
const timezones=[...new Set(["Asia/Almaty","Asia/Tbilisi","UTC",...(supportedIntl?.("timeZone")??[])])].sort();
const currencies=[...new Set(["KZT","GEL","USD","EUR",...(supportedIntl?.("currency")??[])])].sort();

const busy=ref(false),saving=ref(false),error=ref(""),message=ref("");
const company=ref<CompanySettings|null>(null);
const templates=ref<DocumentTemplate[]>([]);
const formOpen=ref(false),templateBusy=ref(false),previewOpen=ref(false);
const preview=ref({title:"",body:"",revision:0,status:"",locale:""});
const fields=ref({kind:"stocktake",locale:"ru",title:"",body:""});
let serial=0;
const columns=computed(()=>[
 {key:"kind",label:t("Тип документа","Document type","დოკუმენტის ტიპი"),minWidth:140},
 {key:"locale",label:t("Язык","Language","ენა"),minWidth:85},
 {key:"revision",label:t("Версия","Revision","ვერსია"),minWidth:85},
 {key:"title",label:t("Название","Title","სათაური"),minWidth:180},
 {key:"status",label:t("Статус","Status","სტატუსი"),minWidth:105},
 {key:"actions",label:t("Действия","Actions","ქმედებები"),minWidth:125,align:"right" as const},
]);
const kindOptions=[
 {value:"stocktake",ru:"Инвентаризация",en:"Stocktake",ka:"ინვენტარიზაცია"},
 {value:"movement",ru:"Перемещение",en:"Movement",ka:"გადაადგილება"},
 {value:"disposal",ru:"Списание",en:"Disposal",ka:"ჩამოწერა"},
 {value:"receipt",ru:"Поступление",en:"Receipt",ka:"მიღება"},
 {value:"issue",ru:"Выдача",en:"Issue",ka:"გაცემა"},
];
async function load(){
  const id=props.companyId,current=++serial;
  if(!id){company.value=null;templates.value=[];return;}
  busy.value=true;error.value="";
  try{
    const [cfg,docs]=await Promise.all([getCompanySettings(id),listDocumentTemplates(id)]);
    if(current===serial){company.value=cfg.data;templates.value=docs.data;}
  }catch(e){if(current===serial)error.value=e instanceof Error?e.message:String(e);}
  finally{if(current===serial)busy.value=false;}
}
watch(()=>props.companyId,()=>{formOpen.value=false;previewOpen.value=false;void load();},{immediate:true});
async function save(){
  if(!canWrite.value||!company.value||saving.value)return;
  saving.value=true;error.value="";message.value="";
  try{
    const response=await saveCompanySettings(props.companyId,company.value);
    company.value=response.data;
    message.value=t("Настройки сохранены","Settings saved","პარამეტრები შენახულია");
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{saving.value=false;}
}
function create(){
  if(!canWrite.value)return;
  fields.value={kind:"stocktake",locale:ui.locale,title:"",body:""};
  error.value="";formOpen.value=true;
}
async function submitTemplate(){
  if(templateBusy.value||!canWrite.value)return;
  templateBusy.value=true;error.value="";
  try{
    await createDocumentTemplate(props.companyId,fields.value);
    formOpen.value=false;await load();
    message.value=t("Черновик создан","Draft created","შავი ვერსია შეიქმნა");
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{templateBusy.value=false;}
}
async function publish(row:DocumentTemplate){
  if(!canWrite.value||row.status!=="draft"||templateBusy.value)return;
  templateBusy.value=true;error.value="";
  try{
    await publishDocumentTemplate(props.companyId,row.id,row.revision);await load();
    message.value=t("Шаблон опубликован","Template published","შაბლონი გამოქვეყნდა");
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
  finally{templateBusy.value=false;}
}
async function showPreview(row:DocumentTemplate){
  previewOpen.value=true;preview.value={title:row.title,body:row.body,revision:row.revision,status:row.status,locale:row.locale};
  try{const response=await previewDocumentTemplate(props.companyId,row.id);
    preview.value=response.data;
  }catch(e){error.value=e instanceof Error?e.message:String(e);}
}
</script>

<template>
  <section class="company-settings">
    <header class="settings-heading">
      <div><h2><Building2 :size="22"/>{{t("Настройки компании","Company settings","კომპანიის პარამეტრები")}}</h2>
        <p>{{companyName}}</p></div>
      <BaseButton variant="secondary" :disabled="busy" @click="load">
        <RefreshCw :size="16"/>{{t("Обновить","Refresh","განახლება")}}</BaseButton>
    </header>
    <p v-if="error&&!formOpen" role="alert" class="error">{{error}}</p>
    <p v-if="message" role="status" class="notice">{{message}}</p>
    <BaseCard>
      <h3>{{t("Параметры организации","Organization preferences","ორგანიზაციის პარამეტრები")}}</h3>
      <p v-if="busy&&!company">{{t("Загрузка","Loading","იტვირთება")}}</p>
      <form v-if="company" class="settings-form" @submit.prevent="save">
        <label>{{t("Юридическое наименование","Legal name","იურიდიული დასახელება")}}
          <input v-model="company.legal_name" required minlength="2" maxlength="255" :disabled="!canWrite||saving"/>
        </label>
        <label>{{t("Страна","Country","ქვეყანა")}}
          <input v-model="company.country_code" required pattern="[A-Z]{2}" maxlength="2" :disabled="!canWrite||saving"/>
        </label>
        <label>{{t("Часовой пояс","Time zone","დროის სარტყელი")}}
          <BaseSelect v-model="company.timezone" :disabled="!canWrite||saving">
            <option v-for="zone in timezones" :key="zone" :value="zone">{{zone}}</option>
          </BaseSelect>
        </label>
        <label>{{t("Валюта","Currency","ვალუტა")}}
          <BaseSelect v-model="company.currency" :disabled="!canWrite||saving">
            <option v-for="currency in currencies" :key="currency" :value="currency">{{currency}}</option>
          </BaseSelect>
        </label>
        <label>{{t("Префикс инвентарного номера","Asset number prefix","ინვენტარის პრეფიქსი")}}
          <input v-model="company.asset_number_prefix" required pattern="(?:[A-Z0-9_]|-)+" maxlength="30" :disabled="!canWrite||saving"/>
        </label>
        <label>{{t("Префикс документов","Document prefix","დოკუმენტის პრეფიქსი")}}
          <input v-model="company.document_number_prefix" required pattern="(?:[A-Z0-9_]|-)+" maxlength="30" :disabled="!canWrite||saving"/>
        </label>
        <label>{{t("Язык документов по умолчанию","Default document language","დოკუმენტის ენა")}}
          <BaseSelect v-model="company.default_locale" :disabled="!canWrite||saving">
            <option value="ru">Русский</option><option value="en">English</option><option value="ka">ქართული</option>
          </BaseSelect>
        </label>
        <div v-if="canWrite" class="settings-action"><BaseButton type="submit" :disabled="saving">
          {{t("Сохранить настройки","Save settings","შენახვა")}}</BaseButton></div>
      </form>
    </BaseCard>
    <BaseCard>
      <div class="template-heading"><div><h3><FileText :size="18"/>{{t("Шаблоны документов","Document templates","დოკუმენტის შაბლონები")}}</h3>
        <p>{{t("Редакции документов сохраняются отдельно. Публикация не удаляет предыдущую.","Each revision is retained. Publishing never deletes previous versions.","ვერსიები ინახება.")}}</p>
      </div><BaseButton v-if="canWrite" @click="create"><Plus :size="16"/>{{t("Новый шаблон","New template","ახალი შაბლონი")}}</BaseButton></div>
      <BaseDataTable :rows="templates" row-key="id" :columns="columns" :loading="busy"
        :caption="t('Шаблоны документов','Document templates','დოკუმენტის შაბლონები')" :min-table-width="780">
        <template #cell-status="{row}">{{row.status==="draft"?t("Черновик","Draft","შავი ვარიანტი"):row.status==="published"?t("Опубликован","Published","გამოქვეყნებული"):t("Архив","Archived","არქივი")}}</template>
        <template #cell-actions="{row}">
          <div class="template-actions">
            <BaseIconButton :title="t('Просмотр','Preview','დათვალიერება')" @click="showPreview(row)"><Eye :size="16"/></BaseIconButton>
            <BaseIconButton v-if="canWrite&&row.status==='draft'" :title="t('Опубликовать','Publish','გამოქვეყნება')" :disabled="templateBusy" @click="publish(row)"><Send :size="16"/></BaseIconButton>
          </div>
        </template>
      </BaseDataTable>
    </BaseCard>
    <BaseDialog :open="formOpen" :title="t('Новый шаблон','New template','ახალი შაბლონი')" size="wide" @close="formOpen=false">
      <form id="document-template-form" class="template-form" @submit.prevent="submitTemplate">
        <p v-if="error" role="alert" class="error">{{error}}</p>
        <label>{{t("Тип документа","Document type","დოკუმენტის ტიპი")}}
          <BaseSelect v-model="fields.kind"><option v-for="item in kindOptions" :key="item.value" :value="item.value">{{ui.locale==="ka"?item.ka:ui.locale==="en"?item.en:item.ru}}</option></BaseSelect>
        </label>
        <label>{{t("Язык","Language","ენა")}}
          <BaseSelect v-model="fields.locale"><option value="ru">RU</option><option value="en">EN</option><option value="ka">GE</option></BaseSelect>
        </label>
        <label>{{t("Название","Title","სათაური")}} *
          <input v-model="fields.title" required minlength="2" maxlength="200"/>
        </label>
        <label>{{t("Текст шаблона","Template text","შაბლონის ტექსტი")}} *
          <textarea v-model="fields.body" required minlength="5" maxlength="12000" rows="10"/>
        </label>
        <small v-pre>Поля / Placeholders: {{company_name}}, {{legal_name}}, {{asset_number}}, {{asset_name}}, {{date}}, {{document_number}}, {{responsible_person}}, {{facility_name}}</small>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="formOpen=false">{{t("Отмена","Cancel","გაუქმება")}}</BaseButton>
        <BaseButton type="submit" form="document-template-form" :disabled="templateBusy||!fields.title.trim()||!fields.body.trim()">{{t("Сохранить черновик","Save draft","შენახვა")}}</BaseButton>
      </template>
    </BaseDialog>
    <BaseDialog :open="previewOpen" :title="preview.title" size="wide" @close="previewOpen=false">
      <pre class="template-preview">{{preview.body}}</pre>
    </BaseDialog>
  </section>
</template>
<style scoped>
.company-settings{display:grid;gap:18px;min-width:0}
.settings-heading,.template-heading{display:flex;align-items:start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.settings-heading h2,.template-heading h3{margin:0;display:flex;align-items:center;gap:9px}
.settings-heading p,.template-heading p{color:var(--color-muted);font-size:12px;margin:5px 0 0}
.company-settings h3{font-size:16px}
.settings-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.settings-form label,.template-form label{display:grid;gap:7px;min-width:0;font-size:12px}
.settings-form input,.template-form input,.template-form textarea{width:100%;min-height:40px;padding:9px 11px;border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-text)}
.settings-action{grid-column:1/-1;display:flex;justify-content:flex-end}
.template-actions{display:flex;gap:7px;justify-content:flex-end}
.template-form{display:grid;gap:14px}
.template-form small{font-size:12px;color:var(--color-muted);overflow-wrap:anywhere}
.template-preview{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.6}
@media(max-width:720px){.settings-form{grid-template-columns:1fr}}
</style>

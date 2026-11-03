<script setup lang="ts">
import BaseSelect from "../components/ui/BaseSelect.vue";
import BaseConfirmDialog from "../components/ui/BaseConfirmDialog.vue";
import { useConfirmDialog } from "../composables/useConfirmDialog";
import { computed, onUnmounted, ref, watch } from "vue";
import { BookOpen, Plus, RefreshCw, Pencil, Upload, Sparkles, Archive, Users, Warehouse, Building2, Settings2 } from "lucide-vue-next";
import BaseButton from "../components/ui/BaseButton.vue";
import BaseIconButton from "../components/ui/BaseIconButton.vue";
import BaseCard from "../components/ui/BaseCard.vue";
import BaseDataTable from "../components/ui/BaseDataTable.vue";
import BaseDialog from "../components/ui/BaseDialog.vue";
import EquipmentTypeIcon from "../components/ui/EquipmentTypeIcon.vue";
import { InventoryApiError } from "../api/client";
import { createLocation, updateLocation, archiveReference, referenceData } from "../api/inventory";
import {
  createEquipmentType, getEquipmentPresets, initializeEquipmentPresets,
  updateEquipmentType, uploadEquipmentIcon,
} from "../api/topology";
import type { RefItem, ReferenceData } from "../api/inventory";
import { useUiSettings } from "../stores/uiSettings";

const { open: confirmOpen, message: confirmMessage, title: confirmTitle,
  confirmLabel: confirmLabel, danger: confirmDanger, ask: askConfirmation,
  settle: settleConfirmation } = useConfirmDialog();
const props = defineProps<{companyId: string; companyName: string; role: string}>();
const ui = useUiSettings();
type Kind = keyof ReferenceData;
const kinds: Kind[] = ["categories", "accounting_locations", "physical_locations"];
const dictionary = ref<ReferenceData>({categories:[],accounting_locations:[],physical_locations:[]});
const current = ref<Kind>("categories");
const busy = ref(false),saving = ref(false),presetsBusy=ref(false);
const issue = ref(""), message = ref("");
const open = ref(false),editing=ref<RefItem|null>(null);
const code = ref(""),name = ref(""),iconKey=ref("box");
const icons=ref<string[]>(["box","monitor","laptop","printer","server","network","smartphone","wrench","factory","package"]);
const errors = ref<Record<string,string[]>>({});
const uploadingId=ref<string|null>(null);
const fileInput=ref<HTMLInputElement|null>(null);
let serial = 0;
let controller: AbortController | null = null;
const canWrite = computed(() => ["company_admin", "inventory_manager"].includes(props.role));
const showArchived = ref(false);
const rows = computed<RefItem[]>(() => dictionary.value[current.value].filter(item => showArchived.value || item.is_active !== false));
const dictionaryGroups = computed(() => ([
  {key:"property",label:ui.locale === "ru" ? "Имущество и номенклатура" : ui.locale === "ka" ? "ქონება და ნომენკლატურა" : "Assets and catalog",items:[{path:"/warehouses",label:ui.t("nav.warehouses"),icon:Warehouse}]},
  {key:"places",label:ui.locale === "ru" ? "Объекты и расположение" : ui.locale === "ka" ? "ობიექტები და მდებარეობა" : "Facilities and locations",items:[{path:"/facilities",label:ui.t("nav.facilities"),icon:Building2}]},
  {key:"people",label:ui.locale === "ru" ? "Ответственные и доступ" : ui.locale === "ka" ? "პასუხისმგებელი პირები და წვდომა" : "People and access",items:[{path:"/people",label:ui.t("nav.people"),icon:Users},{path:"/company-roles",label:ui.t("roles.title"),icon:Settings2}]},
]));
const columns = computed(() => [
  ...(current.value==="categories"?[{key:"icon_key",label:ui.t("types.icon"),minWidth:85}]:[]),
  {key:"code",label:ui.t("table.code"),minWidth:125},
  {key:"name",label:ui.t("table.name"),minWidth:300},
  ...(current.value==="categories"?[{key:"is_base",label:ui.t("references.kind"),minWidth:110}]:[]),
  {key:"is_active",label:ui.locale==="ru"?"Статус":ui.locale==="ka"?"სტატუსი":"Status",minWidth:125},
  {key:"actions",label:ui.t("table.actions"),minWidth:150,align:"right" as const},
]);
const title = computed(() => ui.t(current.value === "categories" ? "types.title" :
  current.value === "accounting_locations" ? "references.accounting" : "references.physical"));

function nameFor(kind: Kind) {
  return ui.t(kind === "categories" ? "types.title" :
    kind === "accounting_locations" ? "references.accounting" : "references.physical");
}
async function refresh() {
  controller?.abort();
  const next = new AbortController();
  controller = next;
  const mySerial = ++serial;
  dictionary.value = {categories:[],accounting_locations:[],physical_locations:[]};
  issue.value = "";
  if (!props.companyId) { busy.value = false; return; }
  busy.value = true;
  try {
    const data = await referenceData(props.companyId, next.signal, true);
    if (serial === mySerial && !next.signal.aborted) dictionary.value = data;
  } catch(e) {
    if (serial === mySerial && !next.signal.aborted)
      issue.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally {
    if (serial === mySerial) busy.value = false;
  }
}
watch(() => props.companyId, () => {
  open.value = false; current.value = "categories";uploadingId.value=null;
  message.value = ""; void refresh();
  if(props.companyId)void getEquipmentPresets(props.companyId).then(data=>{
    icons.value=data.icon_keys;
  }).catch(()=>{});
}, {immediate:true});
onUnmounted(() => controller?.abort());

function showCreate(item:RefItem|null=null) {
  if (!canWrite.value) return;
  editing.value=item;
  code.value=item?.code??""; name.value=item?.name??"";
  iconKey.value=item?.icon_key??"box";
  errors.value = {};issue.value = ""; open.value = true;
}
async function close() {
  if (saving.value) return;
  if ((code.value.trim() || name.value.trim()) && !(await askConfirmation(ui.t("form.unsaved")))) return;
  open.value = false;
}
async function save() {
  if (!canWrite.value || saving.value || !name.value.trim()||(!editing.value&&!code.value.trim())) return;
  saving.value = true; errors.value = {}; issue.value = "";
  try {
    if (current.value === "categories") {
      if(editing.value){
        await updateEquipmentType(props.companyId,editing.value.id,{
          name:name.value.trim(),icon_key:iconKey.value,version:editing.value.version??1,
        });
      }else{
        await createEquipmentType(props.companyId,{
          code:code.value.trim(),name:name.value.trim(),icon_key:iconKey.value,
        });
      }
    } else if (editing.value) {
      await updateLocation(props.companyId,editing.value.id,editing.value.version??1,name.value.trim());
    } else {
      await createLocation(props.companyId,
        current.value === "accounting_locations" ? "accounting" : "physical",
        code.value.trim(), name.value.trim());
    }
    code.value = ""; name.value = ""; open.value = false;
    message.value = ui.t(editing.value?"types.updated":"form.created");
    editing.value=null;
    await refresh();
  } catch(e) {
    if (e instanceof InventoryApiError) {
      errors.value = e.fields; issue.value = e.message;
    } else issue.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { saving.value = false; }
}
async function archiveItem(item: RefItem) {
  if (!canWrite.value || saving.value || item.is_active === false) return;
  const label = ui.locale === "ru" ? "Архивировать справочную запись «"+item.name+"»? Привязанные активы сохранят историю."
    : ui.locale === "ka" ? "გადავიტანოთ ჩანაწერი არქივში: "+item.name+"?"
    : "Archive reference “"+item.name+"”? Existing assets keep their history.";
  if (!(await askConfirmation(label))) return;
  saving.value = true; issue.value = ""; message.value = "";
  try {
    await archiveReference(props.companyId,current.value,item.id,item.version??1);
    await refresh();
    message.value = ui.locale === "ru" ? "Запись архивирована" : ui.locale === "ka" ? "ჩანაწერი დაარქივებულია" : "Reference archived";
  } catch(e) {
    issue.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { saving.value = false; }
}

async function installPresets(){
  if(!canWrite.value||presetsBusy.value)return;
  presetsBusy.value=true;issue.value="";
  try{
    const result=await initializeEquipmentPresets(props.companyId);
    message.value=ui.t("types.presetsAdded")+" ("+result.added+")";
    await refresh();
  }catch(e){issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");}
  finally{presetsBusy.value=false;}
}
function selectUpload(item:RefItem){
  if(!canWrite.value)return;
  uploadingId.value=item.id;fileInput.value?.click();
}
async function upload(event:Event){
  const input=event.target as HTMLInputElement;
  const file=input.files?.[0]??null;
  input.value="";
  const item=dictionary.value.categories.find(c=>c.id===uploadingId.value);
  if(!file||!item||!canWrite.value)return;
  if(!["image/png","image/webp"].includes(file.type)||file.size>512*1024){
    issue.value=ui.t("types.uploadHint");return;
  }
  saving.value=true;issue.value="";
  try{
    await uploadEquipmentIcon(props.companyId,item.id,file,item.version??1);
    message.value=ui.t("types.uploaded");
    await refresh();
  }catch(e){
    issue.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{saving.value=false;uploadingId.value=null;}
}
</script>

<template>
  <div class="references-page">
    <div class="page-heading">
      <div><h2>{{ ui.t("heading.references") }}</h2></div>
      <div class="page-actions">
        <BaseButton variant="secondary" :disabled="busy"
          :title="ui.t('actions.refresh')" :aria-label="ui.t('actions.refresh')" @click="refresh">
          <RefreshCw :size="17" aria-hidden="true"/><span class="action-label">{{ ui.t("actions.refresh") }}</span>
        </BaseButton>
        <BaseButton v-if="canWrite&&current==='categories'" variant="secondary"
          :disabled="presetsBusy" :title="ui.t('types.presets')" :aria-label="ui.t('types.presets')" @click="installPresets">
          <Sparkles :size="17" aria-hidden="true"/><span class="action-label">{{ ui.t("types.presets") }}</span>
        </BaseButton>
        <BaseButton v-if="canWrite" :title="ui.t('actions.add')" :aria-label="ui.t('actions.add')" @click="showCreate()">
          <Plus :size="17" aria-hidden="true"/><span class="action-label">{{ ui.t("actions.add") }}</span></BaseButton>
      </div>
    </div>
    <div class="reference-hub" aria-label="Reference sections">
      <section v-for="group in dictionaryGroups" :key="group.key" class="reference-hub-group">
        <h3>{{group.label}}</h3>
        <div class="reference-hub-links">
          <RouterLink v-for="item in group.items" :key="item.path" :to="item.path" class="reference-hub-link">
            <component :is="item.icon" :size="17" aria-hidden="true"/>{{item.label}}
          </RouterLink>
        </div>
      </section>
    </div>
    <div class="reference-tabs" role="group" :aria-label="ui.t('references.kind')">
      <button v-for="kind in kinds" :key="kind" type="button"
        :class="{selected: current===kind}" :aria-pressed="current===kind"
        @click="current=kind">
        {{ nameFor(kind) }}
        <span class="count">{{ dictionary[kind].length }}</span>
      </button>
    </div>
    <label class="archive-toggle">
      <input v-model="showArchived" type="checkbox"/>
      {{ui.locale==="ru"?"Показывать архивные записи":ui.locale==="ka"?"არქივირებული ჩანაწერების ჩვენება":"Show archived references"}}
    </label>
    <p v-if="message" class="notice" role="status">{{ message }}</p>
    <div v-if="issue && !open" class="error" role="alert">{{ issue }}</div>
    <BaseCard class="reference-card">
      <div class="reference-heading"><BookOpen :size="21" aria-hidden="true"/><h3>{{ title }}</h3></div>
      <BaseDataTable :rows="rows" row-key="id" :columns="columns" :loading="busy"
        :caption="title" :empty-title="ui.t('references.empty')" :min-table-width="current==='categories'?890:460">
        <template #cell-icon_key="{row}">
          <EquipmentTypeIcon :size="24" :icon-key="row.icon_key" :icon-url="row.icon_url"
            :alt="row.name"/>
        </template>
        <template #cell-is_base="{row}">
          <span class="muted">{{ ui.t(row.is_base?'types.base':'types.custom') }}</span>
        </template>
        <template #cell-is_active="{row}">
          <span :class="row.is_active===false?'ref-archived':'ref-active'">
            {{row.is_active===false?(ui.locale==="ru"?"Архив":ui.locale==="ka"?"არქივი":"Archived"):(ui.locale==="ru"?"Активен":ui.locale==="ka"?"აქტიური":"Active")}}
          </span>
        </template>
        <template #cell-actions="{row}">
          <div v-if="canWrite && row.is_active!==false" class="category-actions">
            <BaseIconButton type="button" :title="ui.t('types.edit')"
              :aria-label="ui.t('types.edit')+': '+row.name" @click="showCreate(row)">
              <Pencil :size="16" aria-hidden="true"/>
            </BaseIconButton>
            <BaseIconButton v-if="current==='categories'" type="button" :title="ui.t('types.customIcon')"
              :aria-label="ui.t('types.customIcon')+': '+row.name" @click="selectUpload(row)">
              <Upload :size="16" aria-hidden="true"/>
            </BaseIconButton>
            <BaseIconButton type="button" :title="ui.locale==='ru'?'Архивировать':ui.locale==='ka'?'არქივში გადატანა':'Archive'"
              :aria-label="(ui.locale==='ru'?'Архивировать: ':ui.locale==='ka'?'არქივში: ':'Archive: ')+row.name"
              :disabled="saving" @click="archiveItem(row)">
              <Archive :size="16" aria-hidden="true"/>
            </BaseIconButton>
          </div>
        </template>
      </BaseDataTable>
    </BaseCard>
    <input ref="fileInput" type="file" accept="image/png,image/webp" class="sr-file"
      :aria-label="ui.t('types.customIcon')" @change="upload"/>
    <BaseDialog :open="open" :title="current==='categories'?
      ui.t(editing?'types.edit':'types.create'):title" @close="close">
      <form id="reference-create-form" class="reference-form" @submit.prevent="save">
        <p v-if="issue" class="error" role="alert">{{ issue }}</p>
        <label v-if="!editing">{{ ui.t("table.code") }} *
          <input v-model="code" autocomplete="off" required maxlength="60" :disabled="saving"/>
          <small v-if="errors.code">{{ errors.code[0] }}</small>
        </label>
        <label>{{ ui.t("table.name") }} *
          <input v-model="name" autocomplete="off" required minlength="2" maxlength="200" :disabled="saving"/>
          <small v-if="errors.name">{{ errors.name[0] }}</small>
        </label>
        <label v-if="current==='categories'">{{ ui.t("types.icon") }}
          <div class="icon-picker">
            <EquipmentTypeIcon :size="30" :icon-key="iconKey"/>
            <BaseSelect v-model="iconKey" :disabled="saving">
              <option v-for="value in icons" :key="value" :value="value">{{ value }}</option>
            </BaseSelect>
          </div>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
        <BaseButton type="submit" form="reference-create-form" :disabled="saving || !name.trim() || (!editing&&!code.trim())">
          {{ saving ? ui.t("generic.loading") : ui.t("actions.save") }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>

  <BaseConfirmDialog :open="confirmOpen" :message="confirmMessage" :title="confirmTitle"
    :confirm-label="confirmLabel" :danger="confirmDanger"
    @confirm="settleConfirmation(true)" @cancel="settleConfirmation(false)" />
</template>

<style scoped>
.reference-hub{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:12px}
.reference-hub-group{padding:15px;border:1px solid var(--color-stroke);border-radius:var(--radius-md);background:var(--color-surface-raised);min-width:0}
.reference-hub-group h3{margin:0 0 10px;font-size:13px;line-height:20px;font-weight:600}
.reference-hub-links{display:flex;flex-wrap:wrap;gap:7px}
.reference-hub-link{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:7px 10px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm);color:var(--color-text);text-decoration:none;font-size:12px}
.reference-hub-link:hover,.reference-hub-link:focus-visible{border-color:var(--color-primary);color:var(--color-primary);outline-offset:2px}
.archive-toggle{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--color-muted);width:fit-content;cursor:pointer}
.archive-toggle input{width:17px;height:17px;min-height:0;margin:0;accent-color:var(--color-primary)}
.ref-archived{color:var(--color-muted)}.ref-active{color:var(--color-primary)}

.references-page{display:grid;gap:20px;min-width:0}
.page-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.page-heading h2,.reference-heading h3{margin:0}
.page-heading p{margin:5px 0}
.page-actions{display:flex;gap:9px;flex-wrap:wrap}
.reference-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--color-stroke-strong);padding-bottom:9px}
.reference-tabs button{display:flex;align-items:center;gap:9px;border:1px solid transparent;border-radius:var(--radius-sm);padding:9px 12px;min-height:39px;background:transparent;color:var(--color-muted);cursor:pointer;font-size:13px}
.reference-tabs button.selected{color:var(--color-primary);background:var(--color-accent-soft);border-color:var(--color-primary-stroke)}
.count{display:grid;place-items:center;min-width:23px;height:23px;padding:0 5px;border-radius:50%;background:var(--color-soft);color:var(--color-text);font-size:11px}
.reference-heading{display:flex;align-items:center;gap:9px;margin-bottom:15px}
.reference-card{min-width:0}
.reference-form{display:grid;gap:20px}
.reference-form label{display:grid;gap:7px;font-size:13px;font-weight:500}
.reference-form input,.reference-form select{width:100%}
.reference-form small{color:var(--color-danger);font-size:12px}
.category-actions{display:flex;align-items:center;justify-content:end;gap:7px}
.icon-picker{display:flex;align-items:center;gap:13px}
.icon-picker svg{flex:none;color:var(--color-primary)}
.sr-file{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(100%)}
@media(max-width:650px){.page-actions{width:100%}.page-actions :deep(.base-button){flex:1;min-width:0;justify-content:center}.page-actions .action-label{display:none}.reference-tabs button{flex:1;min-width:120px}}
</style>

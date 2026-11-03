<script setup lang="ts">
import BaseSelect from "../ui/BaseSelect.vue";
import BaseConfirmDialog from "../ui/BaseConfirmDialog.vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { computed, reactive, ref, watch } from "vue";
import { Save } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import { InventoryApiError } from "../../api/client";
import { createAsset, updateAsset } from "../../api/inventory";
import { listAssetFields, getAssetAttributes } from "../../api/assetFields";
import type { AssetFieldDefinition } from "../../api/assetFields";
import type { Asset, AssetInput, ReferenceData } from "../../api/inventory";
import type { FacilityNode, ResponsiblePerson } from "../../api/topology";
import type { IndustryCatalogItem } from "../../api/industryCatalogs";
import { useUiSettings } from "../../stores/uiSettings";

const { open: confirmOpen, message: confirmMessage, title: confirmTitle,
  confirmLabel: confirmLabel, danger: confirmDanger, ask: askConfirmation,
  settle: settleConfirmation } = useConfirmDialog();
const props = defineProps<{
  open: boolean;
  companyId: string;
  asset: Asset | null;
  references: ReferenceData;
  facilities: FacilityNode[];
  people: ResponsiblePerson[];
  manufacturers: IndustryCatalogItem[];
  models: IndustryCatalogItem[];
}>();
const emit = defineEmits<{close: []; saved: [asset: Asset]}>();
const ui = useUiSettings();
const fields = reactive({
  inventory_number: "", name: "", serial_number: "", description: "",
  category_id: "", accounting_location_id: "", physical_location_id: "",
  manufacturer_id:"", model_id:"",
  facility_node_id:"", responsible_person_id:"",
});
const dynamicFields=ref<AssetFieldDefinition[]>([]);
const attributeInputs=reactive<Record<string,string>>({});
const fieldsLoading=ref(false);
let attributeSerial=0;
const busy = ref(false);
const error = ref("");
const validation = ref<Record<string,string[]>>({});
const original = ref("");

function normalize() {
  const asset = props.asset;
  fields.inventory_number = asset?.inventory_number ?? "";
  fields.name = asset?.name ?? "";
  fields.serial_number = asset?.serial_number ?? "";
  fields.description = asset?.description ?? "";
  fields.category_id = asset?.category_id ?? "";
  fields.manufacturer_id=asset?.manufacturer_id??"";
  fields.model_id=asset?.model_id??"";
  fields.accounting_location_id = asset?.accounting_location_id ?? "";
  fields.physical_location_id = asset?.physical_location_id ?? "";
  fields.facility_node_id=asset?.facility_node_id??"";
  fields.responsible_person_id=asset?.responsible_person_id??"";
  for(const id of Object.keys(attributeInputs))delete attributeInputs[id];
  dynamicFields.value=[];
  original.value = JSON.stringify({fields,attributes:attributeInputs});
  error.value = "";
  validation.value = {};
}
watch(() => [props.open,props.asset?.id,props.companyId], normalize, { immediate:true });
const dirty = computed(() => JSON.stringify({fields,attributes:attributeInputs}) !== original.value);
watch([()=>props.open,()=>fields.category_id,()=>props.companyId],async()=>{
  const generation=++attributeSerial;
  dynamicFields.value=[];
  for(const id of Object.keys(attributeInputs))delete attributeInputs[id];
  if(!props.open||!props.companyId||!fields.category_id){return;}
  fieldsLoading.value=true;
  try{
    const [definitions,existing]=await Promise.all([
      listAssetFields(props.companyId,fields.category_id),
      props.asset?getAssetAttributes(props.companyId,props.asset.id):Promise.resolve({data:{}}),
    ]);
    if(generation!==attributeSerial)return;
    dynamicFields.value=definitions.data;
    for(const def of definitions.data){
      const value=existing.data[def.id];
      attributeInputs[def.id]=value===null||value===undefined?"":String(value);
    }
    original.value=JSON.stringify({fields,attributes:attributeInputs});
  }catch(e){if(generation===attributeSerial)error.value=e instanceof Error?e.message:String(e);}
  finally{if(generation===attributeSerial)fieldsLoading.value=false;}
});
const fieldName=(f:AssetFieldDefinition)=>ui.locale==="ka"?(f.label_ka||f.label_ru)
  :ui.locale==="en"?(f.label_en||f.label_ru):f.label_ru;
const optionsFor=(f:AssetFieldDefinition)=>f.options??[];
function attributePayload(){
  const result:Record<string,string|number|boolean|null>={};
  for(const field of dynamicFields.value){
    const value=attributeInputs[field.id]??"";
    if(value===""){result[field.id]=null;continue;}
    result[field.id]=field.field_type==="number"?Number(value)
      :field.field_type==="boolean"?value==="true":value;
  }
  return result;
}
const formTitle = computed(() => props.asset ? ui.t("form.editTitle") : ui.t("form.createTitle"));

async function close() {
  if (busy.value) return;
  if (dirty.value && !(await askConfirmation(ui.t("form.unsaved"), {danger:true}))) return;
  emit("close");
}
function inputData(): AssetInput {
  return {
    inventory_number: fields.inventory_number.trim(),
    name: fields.name.trim(),
    serial_number: fields.serial_number.trim() || null,
    description: fields.description.trim() || null,
    category_id: fields.category_id || null,
    manufacturer_id: fields.manufacturer_id || null,
    model_id: fields.model_id || null,
    accounting_location_id: fields.accounting_location_id || null,
    physical_location_id: fields.physical_location_id || null,
    facility_node_id: fields.facility_node_id || null,
    responsible_person_id: fields.responsible_person_id || null,
    attributes:attributePayload(),
  };
}
async function save() {
  if (busy.value||fieldsLoading.value) return;
  busy.value = true;
  error.value = "";
  validation.value = {};
  try {
    const response = props.asset
      ? await updateAsset(props.companyId, props.asset.id, props.asset.version, inputData())
      : await createAsset(props.companyId, inputData());
    original.value = JSON.stringify({fields,attributes:attributeInputs});
    emit("saved", response.data);
  } catch (e) {
    if (e instanceof InventoryApiError) {
      validation.value = e.fields;
      error.value = e.status === 409 ? ui.t("form.conflict") : e.message;
    } else error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { busy.value = false; }
}
</script>

<template>
  <BaseDialog :open="open" :title="formTitle" size="wide" @close="close">
    <form id="asset-editor-form" class="asset-form" @submit.prevent="save">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="form-grid">
        <label class="field">
          <span>{{ ui.t("table.number") }} *</span>
          <input v-model="fields.inventory_number" required maxlength="100" :disabled="busy" autocomplete="off" />
          <small v-if="validation.inventory_number" role="alert">{{ validation.inventory_number[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("table.name") }} *</span>
          <input v-model="fields.name" required minlength="2" maxlength="255" :disabled="busy" autocomplete="off" />
          <small v-if="validation.name" role="alert">{{ validation.name[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("table.serial") }}</span>
          <input v-model="fields.serial_number" maxlength="160" :disabled="busy" autocomplete="off" />
          <small v-if="validation.serial_number" role="alert">{{ validation.serial_number[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("form.category") }}</span>
          <BaseSelect v-model="fields.category_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in references.categories" :key="item.id" :value="item.id">{{ item.name }}</option>
          </BaseSelect>
          <small v-if="validation.category_id" role="alert">{{ validation.category_id[0] }}</small>
        </label>
        <label class="field">
          <span>{{ui.locale==="ru"?"Производитель":ui.locale==="ka"?"მწარმოებელი":"Manufacturer"}}</span>
          <BaseSelect v-model="fields.manufacturer_id" :disabled="busy"
            @change="fields.model_id=''">
            <option value="">{{ui.t("form.none")}}</option>
            <option v-for="manufacturer in manufacturers.filter(m=>m.is_active||m.id===asset?.manufacturer_id)"
              :key="manufacturer.id" :value="manufacturer.id">{{manufacturer.name}}</option>
          </BaseSelect>
          <small v-if="validation.manufacturer_id" role="alert">{{validation.manufacturer_id[0]}}</small>
        </label>
        <label class="field">
          <span>{{ui.locale==="ru"?"Модель":ui.locale==="ka"?"მოდელი":"Model"}}</span>
          <BaseSelect v-model="fields.model_id" :disabled="busy||!fields.manufacturer_id">
            <option value="">{{ui.t("form.none")}}</option>
            <option v-for="model in models.filter(m=>m.parent_id===fields.manufacturer_id&&(m.is_active||m.id===asset?.model_id))"
              :key="model.id" :value="model.id">{{model.name}}</option>
          </BaseSelect>
          <small v-if="validation.model_id" role="alert">{{validation.model_id[0]}}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("asset.facilityNode") }}</span>
          <BaseSelect v-model="fields.facility_node_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in facilities" :key="item.id" :value="item.id">
              {{ ui.t("topology.type."+item.node_type) }} · {{ item.name }}
            </option>
          </BaseSelect>
          <small v-if="validation.facility_node_id" role="alert">{{ validation.facility_node_id[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("asset.responsiblePerson") }}</span>
          <BaseSelect v-model="fields.responsible_person_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="person in people.filter(p=>p.is_active)" :key="person.id" :value="person.id">
              {{ person.name }} · {{ person.code }}
            </option>
          </BaseSelect>
          <small v-if="validation.responsible_person_id" role="alert">{{ validation.responsible_person_id[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("form.accounting") }}</span>
          <BaseSelect v-model="fields.accounting_location_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in references.accounting_locations" :key="item.id" :value="item.id">{{ item.name }}</option>
          </BaseSelect>
          <small v-if="validation.accounting_location_id" role="alert">{{ validation.accounting_location_id[0] }}</small>
        </label>
        <label class="field">
          <span>{{ ui.t("form.physical") }}</span>
          <BaseSelect v-model="fields.physical_location_id" :disabled="busy">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="item in references.physical_locations" :key="item.id" :value="item.id">{{ item.name }}</option>
          </BaseSelect>
          <small v-if="validation.physical_location_id" role="alert">{{ validation.physical_location_id[0] }}</small>
        </label>
      </div>
      <div v-if="fieldsLoading" class="dynamic-status">{{ui.t("generic.loading")}}</div>
      <section v-if="dynamicFields.length" class="custom-attributes">
        <h3>{{ui.locale==="ru"?"Характеристики":ui.locale==="ka"?"მახასიათებლები":"Specifications"}}</h3>
        <div class="form-grid">
          <label v-for="definition in dynamicFields" :key="definition.id" class="field">
            <span>{{fieldName(definition)}} {{definition.required?"*":""}}</span>
            <BaseSelect v-if="definition.field_type==='boolean'" v-model="attributeInputs[definition.id]" :disabled="busy">
              <option value="">{{ui.t("form.none")}}</option>
              <option value="true">{{ui.locale==="ru"?"Да":ui.locale==="ka"?"დიახ":"Yes"}}</option>
              <option value="false">{{ui.locale==="ru"?"Нет":ui.locale==="ka"?"არა":"No"}}</option>
            </BaseSelect>
            <BaseSelect v-else-if="definition.field_type==='select'" v-model="attributeInputs[definition.id]" :disabled="busy">
              <option value="">{{ui.t("form.none")}}</option>
              <option v-for="value in optionsFor(definition)" :key="value" :value="value">{{value}}</option>
            </BaseSelect>
            <input v-else v-model="attributeInputs[definition.id]"
              :type="definition.field_type==='number'?'number':definition.field_type==='date'?'date':'text'"
              :step="definition.field_type==='number'?'any':undefined"
              :maxlength="definition.field_type==='text'?1000:undefined"
              :required="definition.required" :disabled="busy||fieldsLoading"/>
            <small v-if="validation['attributes.'+definition.id]" role="alert">{{validation['attributes.'+definition.id][0]}}</small>
          </label>
        </div>
      </section>
      <label class="field">
        <span>{{ ui.t("form.description") }}</span>
        <textarea v-model="fields.description" maxlength="3000" rows="4" :disabled="busy"></textarea>
        <small v-if="validation.description" role="alert">{{ validation.description[0] }}</small>
      </label>
    </form>
    <template #footer>
      <BaseButton variant="secondary" :disabled="busy" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
      <BaseButton form="asset-editor-form" type="submit" :disabled="busy || fieldsLoading || !fields.name.trim() || !fields.inventory_number.trim()">
        <Save :size="16" aria-hidden="true" /> {{ busy ? ui.t("generic.loading") : ui.t("actions.save") }}
      </BaseButton>
    </template>
  </BaseDialog>
  <BaseConfirmDialog :open="confirmOpen" :message="confirmMessage" :title="confirmTitle"
    :confirm-label="confirmLabel" :danger="confirmDanger"
    @confirm="settleConfirmation(true)" @cancel="settleConfirmation(false)" />
</template>

<style scoped>
.asset-form{display:grid;gap:20px}
.custom-attributes{display:grid;gap:14px;padding:16px;border:1px solid var(--color-stroke);border-radius:var(--radius-md)}
.custom-attributes h3{font-size:14px;margin:0}
.dynamic-status{font-size:12px;color:var(--color-muted)}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
.field{display:grid;gap:7px;min-width:0;color:var(--color-text);font-size:var(--font-label-size);font-weight:500}
.field input,.field select,.field textarea{min-width:0;width:100%;background:var(--color-surface-raised);border:1px solid var(--color-stroke-strong);border-radius:var(--radius-sm);min-height:40px;padding:9px 12px;color:var(--color-text);font-weight:400}
.field textarea{resize:vertical;line-height:1.45}
.field small{color:var(--color-danger);font-size:12px;font-weight:400}
.error{margin:0}
@media(max-width:600px){.form-grid{grid-template-columns:1fr}}
</style>

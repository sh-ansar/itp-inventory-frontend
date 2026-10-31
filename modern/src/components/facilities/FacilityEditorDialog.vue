<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Save } from "lucide-vue-next";
import BaseDialog from "../ui/BaseDialog.vue";
import BaseButton from "../ui/BaseButton.vue";
import { InventoryApiError } from "../../api/client";
import { createFacilityNode, updateFacilityNode } from "../../api/topology";
import type { FacilityNode, FacilityType, ResponsiblePerson, FacilityInput } from "../../api/topology";
import { useUiSettings } from "../../stores/uiSettings";

const props=defineProps<{
  open:boolean;companyId:string;node:FacilityNode|null;parentId:string|null;
  nodes:FacilityNode[];people:ResponsiblePerson[];
}>();
const emit=defineEmits<{close:[];saved:[node:FacilityNode]}>();
const ui=useUiSettings();
const types:FacilityType[]=["site","building","pavilion","floor","room","warehouse","zone","shelf"];
const fields=reactive({
  name:"",code:"",node_type:"site" as FacilityType,parent_id:"" as string,
  address:"",floor_number:"",responsible_person_id:"",sort_order:"0",
});
const loading=ref(false),error=ref(""),fieldErrors=ref<Record<string,string[]>>({});
const original=ref("");
const selectedParent=computed(()=>props.nodes.find(n=>n.id===fields.parent_id)||null);
const defaultChoices=computed(()=>{
  if(!fields.parent_id) return types.filter(t=>["site","building","warehouse"].includes(t));
  const allowed:Record<FacilityType,FacilityType[]>={
    site:["building","pavilion","warehouse","zone"],
    building:["floor","room","warehouse","zone"],
    pavilion:["floor","room","zone"],
    floor:["room","pavilion","zone"],
    room:["zone","shelf"],
    warehouse:["zone","shelf"],
    zone:["zone","shelf"],
    shelf:[],
  };
  return allowed[selectedParent.value?.node_type??"site"]||[];
});
const parentOptions=computed(()=>{
  const exclude=new Set<string>();
  if(props.node){
    // Parent changes are revalidated by the server against all descendants.
    exclude.add(props.node.id);
    const pending=[props.node.id];
    while(pending.length){
      const parent=pending.shift()!;
      for(const node of props.nodes.filter(n=>n.parent_id===parent)){
        if(!exclude.has(node.id)){exclude.add(node.id);pending.push(node.id);}
      }
    }
  }
  return props.nodes.filter(n=>!exclude.has(n.id));
});
const dirty=computed(()=>JSON.stringify(fields)!==original.value);
const title=computed(()=>ui.t(props.node?"topology.editNode":"topology.addNode"));
function reset(){
  const node=props.node;
  fields.name=node?.name??"";
  fields.code=node?.code??"";
  fields.parent_id=node?.parent_id??props.parentId??"";
  fields.node_type=node?.node_type??(fields.parent_id?
    (props.nodes.find(n=>n.id===fields.parent_id)?.node_type==="building"?"floor":"room"):"site");
  fields.address=node?.address??"";
  fields.floor_number=node?.floor_number!=null?String(node.floor_number):"";
  fields.responsible_person_id=node?.responsible_person_id??"";
  fields.sort_order=String(node?.sort_order??0);
  if(!node&&!defaultChoices.value.includes(fields.node_type)){
    fields.node_type=defaultChoices.value[0]??"site";
  }
  original.value=JSON.stringify(fields);error.value="";fieldErrors.value={};
}
watch(()=>[props.open,props.node?.id,props.companyId,props.parentId],()=>{if(props.open)reset();},{immediate:true});
watch(()=>fields.parent_id,()=>{
  if(!defaultChoices.value.includes(fields.node_type)){
    fields.node_type=defaultChoices.value[0]??"site";
  }
});
function close(){
  if(loading.value)return;
  if(dirty.value&&!window.confirm(ui.t("form.unsaved")))return;
  emit("close");
}
async function save(){
  if(loading.value||!fields.name.trim()||!fields.code.trim()||!defaultChoices.value.length)return;
  loading.value=true;error.value="";fieldErrors.value={};
  const input:FacilityInput={
    code:fields.code.trim(),name:fields.name.trim(),
    node_type:fields.node_type,parent_id:fields.parent_id||null,
    address:fields.address.trim()||null,
    floor_number:fields.floor_number!==""?Number(fields.floor_number):null,
    responsible_person_id:fields.responsible_person_id||null,
    sort_order:Number(fields.sort_order)||0,
  };
  try{
    const response=props.node?
      await updateFacilityNode(props.companyId,props.node.id,input,props.node.version):
      await createFacilityNode(props.companyId,input);
    original.value=JSON.stringify(fields);emit("saved",response.data);
  }catch(e){
    if(e instanceof InventoryApiError){error.value=e.message;fieldErrors.value=e.fields;}
    else error.value=e instanceof Error?e.message:ui.t("generic.unknownError");
  }finally{loading.value=false;}
}
</script>

<template>
  <BaseDialog :open="open" :title="title" size="wide" @close="close">
    <form id="facility-form" class="facility-form" @submit.prevent="save">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="facility-form-grid">
        <label class="field"><span>{{ ui.t("table.name") }} *</span>
          <input v-model="fields.name" type="text" required minlength="2" maxlength="200" :disabled="loading"/>
          <small v-if="fieldErrors.name">{{ fieldErrors.name[0] }}</small></label>
        <label class="field"><span>{{ ui.t("table.code") }} *</span>
          <input v-model="fields.code" type="text" required maxlength="80" :disabled="loading"/>
          <small v-if="fieldErrors.code">{{ fieldErrors.code[0] }}</small></label>
        <label class="field"><span>{{ ui.t("topology.parent") }}</span>
          <select v-model="fields.parent_id" :disabled="loading">
            <option value="">{{ ui.t("topology.root") }}</option>
            <option v-for="item in parentOptions" :key="item.id" :value="item.id">
              {{ item.code }} · {{ item.name }}</option>
          </select>
          <small v-if="fieldErrors.parent_id">{{ fieldErrors.parent_id[0] }}</small></label>
        <label class="field"><span>{{ ui.t("topology.type") }} *</span>
          <select v-model="fields.node_type" required :disabled="loading||!defaultChoices.length">
            <option v-for="type in defaultChoices" :key="type" :value="type">
              {{ ui.t("topology.type."+type) }}</option>
          </select>
          <small v-if="fieldErrors.node_type">{{ fieldErrors.node_type[0] }}</small></label>
        <label class="field" v-if="['site','building','pavilion','warehouse'].includes(fields.node_type)">
          <span>{{ ui.t("topology.address") }}</span>
          <input v-model="fields.address" type="text" maxlength="500" :disabled="loading"
            :placeholder="ui.t('topology.addressHint')"/>
          <small v-if="fieldErrors.address">{{ fieldErrors.address[0] }}</small></label>
        <label class="field" v-if="fields.node_type==='floor'">
          <span>{{ ui.t("topology.floorNumber") }}</span>
          <input v-model="fields.floor_number" type="number" min="-15" max="250" step="1"
            :disabled="loading"/>
          <small v-if="fieldErrors.floor_number">{{ fieldErrors.floor_number[0] }}</small></label>
        <label class="field"><span>{{ ui.t("topology.responsible") }}</span>
          <select v-model="fields.responsible_person_id" :disabled="loading">
            <option value="">{{ ui.t("form.none") }}</option>
            <option v-for="person in people.filter(p=>p.is_active)" :key="person.id"
              :value="person.id">{{ person.name }}</option>
          </select></label>
        <label class="field"><span>{{ ui.t("topology.order") }}</span>
          <input v-model="fields.sort_order" type="number" min="0" max="999999" step="1"
            :disabled="loading"/></label>
      </div>
      <p class="muted facility-hint">{{ ui.t("topology.editHint") }}</p>
    </form>
    <template #footer>
      <BaseButton variant="secondary" :disabled="loading" @click="close">{{ ui.t("actions.cancel") }}</BaseButton>
      <BaseButton type="submit" form="facility-form"
        :disabled="loading||!fields.name.trim()||!fields.code.trim()||!defaultChoices.length">
        <Save :size="17" aria-hidden="true"/>{{ ui.t("actions.save") }}</BaseButton>
    </template>
  </BaseDialog>
</template>
<style scoped>
.facility-form{display:grid;gap:18px}
.facility-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.field{display:grid;gap:7px;font-size:12px;font-weight:500;min-width:0}
.field :is(input,select){width:100%;min-width:0}
.field small{color:var(--color-danger);font-size:11px}
.facility-hint{margin:0;font-size:12px;padding:10px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
@media(max-width:610px){.facility-form-grid{grid-template-columns:1fr}}
</style>

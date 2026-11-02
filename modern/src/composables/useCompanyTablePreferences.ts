import { computed, onUnmounted, reactive, ref, watch } from "vue";
import type { Ref } from "vue";
import type { TablePreferenceSettings } from "../api/preferences";
import { clearTablePreferences, readTablePreferences, writeTablePreferences } from "../api/preferences";

export const defaultTablePreferences: TablePreferenceSettings = {
  search:"", status:"", facility_node_id:"", responsible_person_id:"",
  warehouse_node_id:"", sort_key:"", sort_direction:"asc",
  per_page:25, hidden_columns:[], column_order:[],
};

export type PreferenceView = "assets" | "stocktakes" | "disposals" |
  "warehouse_balances" | "warehouse_items" | "warehouse_history" | "people";

const allowedPageSizes = new Set([10,25,50,100]);
export function normalizeTablePreferences(
  defaults:TablePreferenceSettings, raw:Partial<TablePreferenceSettings>|null,
):TablePreferenceSettings {
  if (!raw || typeof raw !== "object") return {...defaults,
    hidden_columns:[...defaults.hidden_columns],column_order:[...defaults.column_order]};
  const clean = {...defaults};
  for(const key of ["search","status","facility_node_id","responsible_person_id","warehouse_node_id","sort_key"] as const){
    if(typeof raw[key]==="string")clean[key]=raw[key].slice(0,120);
  }
  if(raw.sort_direction==="asc"||raw.sort_direction==="desc")clean.sort_direction=raw.sort_direction;
  if(typeof raw.per_page==="number"&&allowedPageSizes.has(raw.per_page))
    clean.per_page=raw.per_page as TablePreferenceSettings["per_page"];
  for(const key of ["hidden_columns","column_order"] as const){
    const value=raw[key];
    clean[key]=Array.isArray(value) ? [...new Set(value.filter((v):v is string=>typeof v==="string"))].slice(0,20) : [...defaults[key]];
  }
  return clean;
}

export function orderAndFilterColumns<T extends {key:string}>(
  columns: T[], settings: Pick<TablePreferenceSettings,"column_order"|"hidden_columns">,
):T[] {
  const order=new Map(settings.column_order.map((key,index)=>[key,index]));
  return columns.filter(column=>!settings.hidden_columns.includes(column.key))
    .sort((a,b)=>(order.get(a.key)??1000)-(order.get(b.key)??1000));
}

/** Single source of truth for a table across reloads, user accounts, and companies. */
export function useCompanyTablePreferences(
  companyId:Ref<string>,view:PreferenceView, defaults:Partial<TablePreferenceSettings>={},
) {
  const base:TablePreferenceSettings={...defaultTablePreferences,...defaults,
    hidden_columns:[...(defaults.hidden_columns??[])],
    column_order:[...(defaults.column_order??[])]};
  const state=reactive<TablePreferenceSettings>(normalizeTablePreferences(base,null));
  const ready=ref(false);
  const saving=ref(false);
  const error=ref("");
  let generation=0;
  let delay:ReturnType<typeof setTimeout>|undefined;
  let abort:AbortController|null=null;
  let lastSave:Promise<unknown>=Promise.resolve();

  watch(companyId,async id=>{
    generation++;
    const current=generation;
    if(delay)clearTimeout(delay);
    abort?.abort();
    abort=new AbortController();
    ready.value=false;
    error.value="";
    Object.assign(state,normalizeTablePreferences(base,null));
    if(!id)return;
    try{
      const result=await readTablePreferences(id,view,abort.signal);
      if(generation!==current||abort.signal.aborted)return;
      Object.assign(state,normalizeTablePreferences(base,result.data.settings));
    }catch(e){
      if(generation!==current||abort.signal.aborted)return;
      error.value=e instanceof Error?e.message:String(e);
    }finally{
      if(generation===current)ready.value=true;
    }
  },{immediate:true});

  watch(state,()=>{
    if(!ready.value||!companyId.value)return;
    if(delay)clearTimeout(delay);
    const company=companyId.value;
    const copy=normalizeTablePreferences(base,{...state});
    const expectedGeneration=generation;
    delay=setTimeout(()=>{
      if(generation!==expectedGeneration)return;
      saving.value=true;
      // Serialize updates so a slow earlier response cannot overwrite newer settings.
      lastSave=lastSave.catch(()=>undefined)
        .then(()=>writeTablePreferences(company,view,copy))
        .then(()=>{if(generation===expectedGeneration)error.value="";})
        .catch(e=>{if(generation===expectedGeneration)error.value=e instanceof Error?e.message:String(e);})
        .finally(()=>{if(generation===expectedGeneration)saving.value=false;});
    },450);
  },{deep:true});

  async function reset(){
    const company=companyId.value;
    if(!company||!ready.value)return;
    if(delay)clearTimeout(delay);
    const current=++generation;
    ready.value=false;
    saving.value=true;
    error.value="";
    try{
      await lastSave.catch(()=>undefined);
      await clearTablePreferences(company,view);
      if(current===generation)Object.assign(state,normalizeTablePreferences(base,null));
    }catch(e){
      if(current===generation)error.value=e instanceof Error?e.message:String(e);
    }finally{
      if(current===generation){ready.value=true;saving.value=false;}
    }
  }

  onUnmounted(()=>{generation++;abort?.abort();if(delay)clearTimeout(delay);});
  return {state,ready,saving,error,reset,visibleColumns:computed(()=>state.hidden_columns)};
}

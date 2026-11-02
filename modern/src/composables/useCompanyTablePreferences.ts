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

/** Company/user settings loaded before and persisted after edits. Never auto-save hydration. */
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
  let applying=false;
  let editedWhileLoading=false;
  let delay:ReturnType<typeof setTimeout>|undefined;
  let abort:AbortController|null=null;
  let lastSave:Promise<unknown>=Promise.resolve();
  let queued=0;

  const snapshot=():TablePreferenceSettings=>normalizeTablePreferences(base,{...state});

  // One ordered write queue: resetting or switching companies cannot be undone
  // by an older network response arriving after a newer update.
  function queueWrite(company:string,settings:TablePreferenceSettings,gen:number){
    queued++;
    saving.value=true;
    lastSave=lastSave.catch(()=>undefined)
      .then(()=>writeTablePreferences(company,view,settings))
      .then(()=>{if(gen===generation)error.value="";})
      .catch(e=>{if(gen===generation)error.value=e instanceof Error?e.message:String(e);})
      .finally(()=>{queued=Math.max(0,queued-1);if(gen===generation)saving.value=queued>0||!!delay;});
  }

  function schedule(){
    if(!ready.value||!companyId.value)return;
    if(delay)clearTimeout(delay);
    const company=companyId.value,gen=generation;
    delay=setTimeout(()=>{
      delay=undefined;
      if(gen!==generation||companyId.value!==company)return;
      queueWrite(company,snapshot(),gen);
    },300);
    saving.value=true;
  }

  watch(companyId,async (id,previous)=>{
    // If the user changes companies before the debounce expires, preserve the
    // previous company's last edited state instead of silently discarding it.
    if(delay){
      clearTimeout(delay);
      delay=undefined;
      if(previous)queueWrite(previous,snapshot(),generation);
    }
    generation++;
    const current=generation;
    abort?.abort();
    abort=new AbortController();
    ready.value=false;
    error.value="";
    editedWhileLoading=false;
    applying=true;
    Object.assign(state,normalizeTablePreferences(base,null));
    applying=false;
    if(!id){saving.value=false;return;}
    try{
      const result=await readTablePreferences(id,view,abort.signal);
      if(generation!==current||abort.signal.aborted)return;
      const saved=normalizeTablePreferences(base,result.data.settings);
      const currentDraft=snapshot();
      const touchedKeys=(Object.keys(base) as (keyof TablePreferenceSettings)[])
        .filter(key=>JSON.stringify(currentDraft[key])!==JSON.stringify(base[key]));
      applying=true;
      for(const key of Object.keys(base) as (keyof TablePreferenceSettings)[]){
        if(editedWhileLoading&&touchedKeys.includes(key))continue;
        // Assigning through the strongly typed reactive object preserves all
        // fields, including the column arrays and numeric page size.
        (state as Record<string,unknown>)[key]=saved[key];
      }
      applying=false;
    }catch(e){
      if(generation!==current||abort.signal.aborted)return;
      error.value=e instanceof Error?e.message:String(e);
    }finally{
      applying=false;
      if(generation===current){
        ready.value=true;
        saving.value=queued>0;
        if(editedWhileLoading)schedule();
      }
    }
  },{immediate:true});

  watch(state,()=>{
    if(applying||!companyId.value)return;
    if(!ready.value){editedWhileLoading=true;return;}
    schedule();
  },{deep:true,flush:"sync"});

  async function reset(){
    const company=companyId.value;
    if(!company||!ready.value)return;
    if(delay){clearTimeout(delay);delay=undefined;}
    const current=++generation;
    ready.value=false;
    saving.value=true;
    error.value="";
    try{
      await lastSave.catch(()=>undefined);
      await clearTablePreferences(company,view);
      if(current!==generation)return;
      applying=true;
      Object.assign(state,normalizeTablePreferences(base,null));
      applying=false;
    }catch(e){
      if(current===generation)error.value=e instanceof Error?e.message:String(e);
    }finally{
      applying=false;
      if(current===generation){ready.value=true;saving.value=false;}
    }
  }

  onUnmounted(()=>{
    if(delay){
      clearTimeout(delay);
      delay=undefined;
      if(companyId.value)queueWrite(companyId.value,snapshot(),generation);
    }
    generation++;
    abort?.abort();
  });
  return {state,ready,saving,error,reset,visibleColumns:computed(()=>state.hidden_columns)};
}

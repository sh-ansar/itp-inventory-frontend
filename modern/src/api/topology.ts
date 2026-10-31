import { inventoryRequest } from "./client";

export type FacilityType = "site"|"building"|"pavilion"|"floor"|"room"|"warehouse"|"zone"|"shelf";
export interface FacilityNode {
  id:string; company_id:string; parent_id:string|null;
  code:string; name:string; node_type:FacilityType;
  address:string|null; floor_number:number|null;
  responsible_person_id:string|null; responsible_person_name:string|null;
  sort_order:number; version:number; direct_asset_count:number;
  created_at:string; updated_at:string;
}
export interface FacilityInput {
  code:string;name:string;node_type:FacilityType;parent_id:string|null;
  address:string|null;floor_number:number|null;
  responsible_person_id:string|null;sort_order:number;
}
export interface ResponsiblePerson {
  id:string;company_id:string;code:string;name:string;
  position:string|null;email:string|null;
  source:"manual"|"hrm";external_employee_id:string|null;
  is_active:boolean;version:number;assets_count?:number;
}
export interface ResponsibleInput {
  code:string;name:string;position:string|null;
  email:string|null;is_active:boolean;
}
export interface EquipmentPreset {
  base_key:string;code:string;name:string;icon_key:string;
}
export interface EquipmentType {
  id:string;code:string;name:string;icon_key:string;
  icon_url?:string|null;is_base?:boolean;version?:number;
}
export interface StockItem {
  id:string;code:string;name:string;unit:"pcs"|"pack"|"kg"|"m"|"l";
  category_id:string|null;minimum_quantity_milli:number;
  is_active:boolean;version:number;balances_sum_quantity_milli?:number|null;
}
export interface StockBalance {
  id:string;code:string;name:string;unit:StockItem["unit"];
  minimum_quantity_milli:number;quantity_milli:number;
}
export interface StockTransaction {
  id:string;company_id:string;stock_item_id:string;
  operation:"receipt"|"issue"|"transfer";
  source_warehouse_node_id:string|null;
  destination_warehouse_node_id:string|null;
  quantity_milli:number;
  actor_name:string;reason:string;created_at:string;
  before_source_milli:number|null;after_source_milli:number|null;
  before_destination_milli:number|null;after_destination_milli:number|null;
}
export interface LaravelPage<T> {
  data:T[];current_page:number;last_page:number;
  total:number;per_page:number;first_page_url:string|null;
}
export interface StockMovementInput {
  stock_item_id:string;
  operation:"receipt"|"issue"|"transfer";
  warehouse_node_id:string;
  target_warehouse_node_id?:string|null;
  quantity:string;reason:string;
}

const company=(companyId:string)=>"/api/v1/companies/"+encodeURIComponent(companyId);
const params=(obj:Record<string,string|number|undefined|null>)=>{
  const p=new URLSearchParams();
  Object.entries(obj).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=="")p.set(key,String(value))});
  return p.toString();
};

export const getFacilityNodes=(companyId:string,signal?:AbortSignal)=>
  inventoryRequest<{data:FacilityNode[];total:number}>(company(companyId)+"/facility-nodes",{signal});
export const createFacilityNode=(companyId:string,input:FacilityInput)=>
  inventoryRequest<{data:FacilityNode}>(company(companyId)+"/facility-nodes",{
    method:"POST",body:JSON.stringify(input),
  });
export const updateFacilityNode=(companyId:string,id:string,input:FacilityInput,version:number)=>
  inventoryRequest<{data:FacilityNode}>(company(companyId)+"/facility-nodes/"+encodeURIComponent(id),{
    method:"PUT",body:JSON.stringify({...input,version}),
  });
export const getFacilityHistory=(companyId:string,id:string)=>
  inventoryRequest<{data:Array<{
    id:string;event_type:string;actor_name:string;version:number;created_at:string;
    before:Record<string,unknown>|null;after:Record<string,unknown>|null
  }> }>(company(companyId)+"/facility-nodes/"+encodeURIComponent(id)+"/events");
export const getResponsiblePeople=(companyId:string,filters:{
  page?:number;per_page?:number;search?:string;active?:string
}={},signal?:AbortSignal)=>
  inventoryRequest<LaravelPage<ResponsiblePerson>>(company(companyId)+"/responsible-people?"+params(filters),{signal});
export const createResponsiblePerson=(companyId:string,input:ResponsibleInput)=>
  inventoryRequest<{data:ResponsiblePerson}>(company(companyId)+"/responsible-people",{
    method:"POST",body:JSON.stringify(input),
  });
export const updateResponsiblePerson=(companyId:string,id:string,input:ResponsibleInput,version:number)=>
  inventoryRequest<{data:ResponsiblePerson}>(company(companyId)+"/responsible-people/"+encodeURIComponent(id),{
    method:"PUT",body:JSON.stringify({...input,version}),
  });

export const getEquipmentPresets=(companyId:string)=>
  inventoryRequest<{data:EquipmentPreset[];icon_keys:string[]}>(company(companyId)+"/equipment-presets");
export const initializeEquipmentPresets=(companyId:string)=>
  inventoryRequest<{added:number}>(company(companyId)+"/equipment-presets/initialize",{method:"POST"});
export const updateEquipmentType=(companyId:string,id:string,input:{
  name:string;icon_key:string;version:number
})=>inventoryRequest<{data:EquipmentType}>(company(companyId)+"/categories/"+encodeURIComponent(id),{
  method:"PUT",body:JSON.stringify(input),
});
export const uploadEquipmentIcon=(companyId:string,id:string,file:File,version:number)=>{
  const body=new FormData();
  body.set("icon",file);body.set("version",String(version));
  return inventoryRequest<{data:{id:string;version:number;icon_url:string}}>(
    company(companyId)+"/categories/"+encodeURIComponent(id)+"/icon",{method:"POST",body},
  );
};
export const createEquipmentType=(companyId:string,data:{
  code:string;name:string;icon_key:string
})=>inventoryRequest<{id:string;code:string;name:string;icon_key:string;version:number}>(
  company(companyId)+"/categories",{method:"POST",body:JSON.stringify(data)},
);

export const getStockItems=(companyId:string,filters:{
  page?:number;per_page?:number;search?:string;active?:string
}={},signal?:AbortSignal)=>
  inventoryRequest<LaravelPage<StockItem>>(company(companyId)+"/stock-items?"+params(filters),{signal});
export const createStockItem=(companyId:string,input:{
  code:string;name:string;unit:StockItem["unit"];
  category_id?:string|null;minimum_quantity?:string
})=>inventoryRequest<{data:StockItem}>(company(companyId)+"/stock-items",{
  method:"POST",body:JSON.stringify(input),
});
export const getStockBalances=(companyId:string,warehouseId:string,filters:{
  page?:number;per_page?:number
}={},signal?:AbortSignal)=>
  inventoryRequest<LaravelPage<StockBalance>>(company(companyId)+"/stock-balances?"+
    params({...filters,warehouse_node_id:warehouseId}),{signal});
export const getStockTransactions=(companyId:string,filters:{
  stock_item_id?:string;warehouse_node_id?:string;page?:number;per_page?:number
}={},signal?:AbortSignal)=>
  inventoryRequest<LaravelPage<StockTransaction>>(company(companyId)+"/stock-transactions?"+params(filters),{signal});
export const postStockTransaction=(companyId:string,input:StockMovementInput)=>
  inventoryRequest<{data:StockTransaction}>(company(companyId)+"/stock-transactions",{
    method:"POST",body:JSON.stringify(input),
  });

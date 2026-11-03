import {inventoryRequest} from "./client";

const companyPath=(companyId:string)=>"/api/v1/companies/"+encodeURIComponent(companyId);

export type FieldType="text"|"number"|"date"|"boolean"|"select";
export interface AssetFieldDefinition {
  id:string;company_id:string;category_id:string;code:string;
  label_ru:string;label_en:string|null;label_ka:string|null;
  field_type:FieldType;options:string[];required:boolean;is_active:boolean;
  sort_order:number;version:number;
}
export const listAssetFields=(companyId:string,categoryId:string,includeArchived=false,signal?:AbortSignal)=>
  inventoryRequest<{data:AssetFieldDefinition[]}>(
    companyPath(companyId)+"/asset-fields?category_id="+encodeURIComponent(categoryId)
    +(includeArchived?"&include_archived=1":""),{signal});
export const createAssetField=(companyId:string,data:{
  category_id:string;code:string;label_ru:string;label_en?:string;label_ka?:string;
  field_type:FieldType;options?:string[];required?:boolean;sort_order?:number;
})=>inventoryRequest<{data:AssetFieldDefinition}>(companyPath(companyId)+"/asset-fields",{
  method:"POST",body:JSON.stringify(data),
});
export const updateAssetField=(companyId:string,id:string,data:{
  version:number;label_ru:string;label_en?:string;label_ka?:string;
  sort_order?:number;is_active?:boolean;
})=>inventoryRequest<{data:AssetFieldDefinition}>(companyPath(companyId)+"/asset-fields/"+encodeURIComponent(id),{
  method:"PUT",body:JSON.stringify(data),
});
export type AssetAttributeValue=string|number|boolean|null;
export type AssetAttributeValues=Record<string,AssetAttributeValue>;
export const getAssetAttributes=(companyId:string,assetId:string)=>
  inventoryRequest<{data:AssetAttributeValues;asset_version:number}>(
    companyPath(companyId)+"/assets/"+encodeURIComponent(assetId)+"/attributes");
export const putAssetAttributes=(companyId:string,assetId:string,version:number,values:AssetAttributeValues)=>
  inventoryRequest<{data:AssetAttributeValues;asset_version:number}>(
    companyPath(companyId)+"/assets/"+encodeURIComponent(assetId)+"/attributes",{
    method:"PUT",body:JSON.stringify({version,values}),
  });

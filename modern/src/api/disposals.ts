import { inventoryRequest } from "./client";
import type { Page } from "./inventory";

export interface AssetDisposal {
  id:string;asset_id:string;inventory_number:string;asset_name:string;
  asset_status:"written_off"|"disposed";stage:"write_off"|"disposal";
  document_number:string;document_date:string;reason:string;disposal_method:string|null;
  actor_name:string;created_at:string;asset_version:number;
  documents:{id:string;original_name:string;file_size:number;mime_type:string;uploaded_by_name:string}[];
}
const root=(company:string)=>"/api/v1/companies/"+encodeURIComponent(company);
export function listDisposals(company:string,filters:{page:number;search:string;stage:string},signal?:AbortSignal){
  const q=new URLSearchParams({page:String(filters.page),per_page:"25"});
  if(filters.search.trim())q.set("search",filters.search.trim());
  if(filters.stage)q.set("stage",filters.stage);
  return inventoryRequest<Page<AssetDisposal>>(root(company)+"/asset-disposals?"+q,{signal});
}
export async function submitDisposal(company:string,asset:string,input:{
  stage:"write_off"|"disposal";version:number;document_number:string;
  document_date:string;reason:string;disposal_method:string;document:File;
}):Promise<{data:AssetDisposal}>{
  const form=new FormData();
  form.append("stage",input.stage);form.append("version",String(input.version));
  form.append("document_number",input.document_number);
  form.append("document_date",input.document_date);form.append("reason",input.reason);
  if(input.stage==="disposal")form.append("disposal_method",input.disposal_method);
  form.append("document",input.document);
  return inventoryRequest(root(company)+"/assets/"+encodeURIComponent(asset)+"/disposals",{
    method:"POST",body:form
  });
}
export const disposalDocumentHref=(company:string,disposal:string,document:string)=>
  "/inventory-api"+root(company)+"/asset-disposals/"+encodeURIComponent(disposal)+"/documents/"+encodeURIComponent(document);

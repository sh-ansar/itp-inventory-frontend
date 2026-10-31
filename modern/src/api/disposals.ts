import { inventoryRequest } from "./client";

export type DisposalStatus = "draft" | "submitted" | "approved" | "disposed";
export type DisposalDocumentType = "write_off_order" | "disposal_act" | "supporting";
export type DisposalMethod = "recycling" | "destruction" | "waste_transfer" | "other";

export interface DisposalDocument {
  id: string;
  document_type: DisposalDocumentType;
  original_name: string;
  bytes: number;
  sha256: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface DisposalCase {
  id: string;
  asset_id: string;
  status: DisposalStatus;
  reason: string;
  order_number: string | null;
  order_date: string | null;
  disposal_act_number: string | null;
  disposal_date: string | null;
  disposal_method: DisposalMethod | null;
  version: number;
  created_at: string;
  updated_at: string;
  asset: {
    id: string;
    inventory_number: string;
    name: string;
    status: "active" | "written_off" | "disposed";
    version: number;
  };
  documents: DisposalDocument[];
}

export interface DisposalEvent {
  id: string;
  event_type: "created" | "updated" | "document_uploaded" |
    "submitted" | "returned" | "approved" | "disposed";
  version: number;
  actor_name: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface DisposalDraft {
  reason: string;
  order_number: string | null;
  order_date: string | null;
}
export interface DisposalCompletion {
  disposal_act_number: string;
  disposal_date: string;
  disposal_method: DisposalMethod;
}

const base=(companyId:string,assetId:string)=>
  "/api/v1/companies/"+encodeURIComponent(companyId)+
  "/assets/"+encodeURIComponent(assetId)+"/disposal-case";

const queue=(companyId:string)=>
  "/api/v1/companies/"+encodeURIComponent(companyId)+"/disposal-cases";

export const listDisposalCases=(companyId:string,filters:{
  search:string;status:string;page:number;per_page:number;
},signal?:AbortSignal)=>{
  const query=new URLSearchParams({
    page:String(filters.page),per_page:String(filters.per_page),
  });
  if(filters.search.trim())query.set("search",filters.search.trim());
  if(filters.status)query.set("status",filters.status);
  return inventoryRequest<{data:DisposalCase[];meta:{
    total:number;current_page:number;last_page:number;per_page:number;
  }}>(queue(companyId)+"?"+query.toString(),{signal});
};

export const getDisposalCase=(companyId:string,assetId:string,signal?:AbortSignal)=>
  inventoryRequest<{data:DisposalCase}>(base(companyId,assetId),{signal});

export const createDisposalCase=(companyId:string,assetId:string,assetVersion:number,input:DisposalDraft)=>
  inventoryRequest<{data:DisposalCase}>(base(companyId,assetId),{
    method:"POST",body:JSON.stringify({...input,asset_version:assetVersion}),
  });

export const updateDisposalCase=(companyId:string,assetId:string,version:number,input:DisposalDraft)=>
  inventoryRequest<{data:DisposalCase}>(base(companyId,assetId),{
    method:"PUT",body:JSON.stringify({...input,version}),
  });

export const submitDisposalCase=(companyId:string,assetId:string,version:number)=>
  inventoryRequest<{data:DisposalCase}>(base(companyId,assetId)+"/submit",{
    method:"POST",body:JSON.stringify({version}),
  });

export const returnDisposalCase=(companyId:string,assetId:string,version:number,reason:string)=>
  inventoryRequest<{data:DisposalCase}>(base(companyId,assetId)+"/return",{
    method:"POST",body:JSON.stringify({version,reason}),
  });

export const approveDisposalCase=(companyId:string,assetId:string,version:number,assetVersion:number)=>
  inventoryRequest<{data:DisposalCase}>(base(companyId,assetId)+"/approve",{
    method:"POST",body:JSON.stringify({version,asset_version:assetVersion}),
  });

export const completeDisposalCase=(companyId:string,assetId:string,version:number,
  assetVersion:number,input:DisposalCompletion)=>
  inventoryRequest<{data:DisposalCase}>(base(companyId,assetId)+"/dispose",{
    method:"POST",body:JSON.stringify({...input,version,asset_version:assetVersion}),
  });

export const uploadDisposalDocument=(companyId:string,assetId:string,version:number,
  type:DisposalDocumentType,file:File)=>{
    const form=new FormData();
    form.set("version",String(version));
    form.set("document_type",type);
    form.set("file",file);
    return inventoryRequest<{data:DisposalCase}>(base(companyId,assetId)+"/documents",{
      method:"POST",body:form,
    });
  };

export const disposalDocumentUrl=(companyId:string,assetId:string,documentId:string)=>
  "/inventory-api"+base(companyId,assetId)+"/documents/"+encodeURIComponent(documentId);

export const getDisposalEvents=(companyId:string,assetId:string)=>
  inventoryRequest<{data:DisposalEvent[]}>(base(companyId,assetId)+"/events");

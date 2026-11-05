import { initializeCsrf, inventoryRequest } from "./client";

export type Terms = {
  names:Record<string,string>;
  description?:string;
  price_minor:number;
  currency:string;
  period_months:number;
  limits:Record<string,number|null>;
  modules:Record<string,boolean>;
};
export type Plan = {
  id:number;code:string;version:number;terms:Terms;
  status:"draft"|"published"|"archived";
  is_public:boolean;display_order:number;
};
export type Page<T> = {
  data:T[];current_page:number;last_page:number;per_page:number;total:number;
};
export type Organization = {
  id:string;name:string;email?:string;users_count?:number;
  assets_count?:number;plan_code?:string|null;subscription_status?:string|null;created_at?:string;
};
export type LegalRecord = {
  id:number;type:string;locale:"ru"|"en"|"ge";jurisdiction:"KZ"|"GE";
  title:string;body?:string;version:number;status:string;
  required:boolean;acceptance:string;effective_at:string|null;
  sha256?:string;approval_note?:string;
};
export type Invoice = {
  id:number;company_id:string;number?:string|null;status:string;
  currency:string;total_minor:number;due_date:string;period_from:string;
  period_to:string;basis:string;items:unknown;created_at:string;
};
export type AdminOverview = {
  permissions:string[];modules:string[];
  flags:Record<string,boolean>;
  statistics:{companies:number;users:number;published_plans:number};
};

function query(params: Record<string,string|number|boolean|null|undefined>={}):string {
  const entries=Object.entries(params).filter(([,value])=>value!==null&&value!==undefined&&value!=="");
  if (!entries.length) return "";
  return "?"+new URLSearchParams(entries.map(([key,value])=>[key,String(value)])).toString();
}
const commercial="/api/v1/commercial";
const admin="/api/v1/platform-admin";
const json=(body:unknown,method="POST"):RequestInit=>({method,body:JSON.stringify(body)});

export const commercialApi = {
  plans:()=>inventoryRequest<{data:Plan[]}>(commercial+"/plans"),
  legal:(locale:string,jurisdiction="KZ")=>
    inventoryRequest<{data:LegalRecord[]}>(commercial+"/legal"+query({locale,jurisdiction})),
  legalDocument:(version:number)=>
    inventoryRequest<{data:LegalRecord}>(commercial+"/legal/"+version),
  subscription:(company:string)=>
    inventoryRequest<{data:unknown}>(commercial+"/subscription"+query({company_id:company})),
  ownInvoices:(company:string,page=1)=>inventoryRequest<Page<Invoice>>(commercial+"/invoices"+query({company_id:company,page})),
  ownConsents:()=>inventoryRequest<Page<unknown>>(commercial+"/consents"),
  acceptLegal:(locale:string,choices:Record<string,boolean>,jurisdiction="KZ")=>
    inventoryRequest<{ok:boolean}>(commercial+"/legal/accept",json({locale,choices,jurisdiction})),
  register:(values:unknown)=>inventoryRequest<{message:string}>("/auth/register",json(values)),
  verify:(token:string)=>inventoryRequest<{ok:boolean;user_id:number}>("/auth/verify-email",json({token})),
  resend:(email:string)=>inventoryRequest<{message:string}>("/auth/resend-verification",json({email})),
  overview:()=>inventoryRequest<AdminOverview>(admin+"/overview"),
  companies:(page=1,search="",sort="created_at")=>inventoryRequest<Page<Organization>>(
    admin+"/organizations"+query({page,search,sort})),
  company:(company:string)=>inventoryRequest<{organization:Organization;subscription:any;companies:any[];billing_profile:any;audit:any[]}>(
    admin+"/organizations/"+company),
  companyUsers:(company:string,page=1)=>inventoryRequest<Page<any>>(admin+"/organizations/"+company+"/users"+query({page})),
  resendUser:(company:string,userId:number)=>inventoryRequest<{ok:boolean}>(admin+"/organizations/"+company+"/users/"+userId+"/resend",json({})),
  adminPlans:()=>inventoryRequest<{data:Plan[]}>(admin+"/plans"),
  savePlan:(values:unknown)=>inventoryRequest<{data:Plan}>(admin+"/plans",json(values)),
  planStatus:(id:number,status:"published"|"archived")=>
    inventoryRequest<{data:Plan}>(admin+"/plans/"+id+"/status",json({status},"PUT")),
  assignPlan:(company:string,plan:number,ends:string|null)=>
    inventoryRequest<{ok:boolean}>(admin+"/organizations/"+company+"/subscription",
      json({plan_version_id:plan,ends_at:ends},"PUT")),
  supplier:()=>inventoryRequest<{data:any}>(admin+"/billing/supplier"),
  updateSupplier:(values:unknown)=>inventoryRequest<{data:any}>(admin+"/billing/supplier",json(values,"PUT")),
  updateBuyer:(company:string,values:unknown)=>inventoryRequest<{data:any}>(
    admin+"/organizations/"+company+"/billing",json(values,"PUT")),
  invoices:(page=1)=>inventoryRequest<Page<Invoice>>(admin+"/invoices"+query({page})),
  newInvoice:(values:unknown)=>inventoryRequest<{data:Invoice}>(admin+"/invoices",json(values)),
  invoiceStatus:(id:number,status:"issued"|"cancelled")=>inventoryRequest<{ok:boolean}>(
    admin+"/invoices/"+id+"/status",json({status},"PUT")),
  proofs:(invoiceId:number)=>inventoryRequest<{data:any[]}>(admin+"/invoices/"+invoiceId+"/proofs"),
  proofReview:(id:number,status:"accepted"|"rejected",review_note:string)=>inventoryRequest<{ok:boolean}>(
    admin+"/proofs/"+id+"/review",json({status,review_note},"PUT")),
  legalVersions:(page=1)=>inventoryRequest<Page<LegalRecord>>(admin+"/legal"+query({page})),
  adminLegal:(id:number)=>inventoryRequest<{data:LegalRecord}>(admin+"/legal/"+id),
  saveLegal:(values:unknown)=>inventoryRequest<{data:LegalRecord}>(admin+"/legal",json(values)),
  legalStatus:(id:number,status:"approved"|"published",approval_note="")=>inventoryRequest<{ok:boolean}>(
    admin+"/legal/"+id+"/status",json({status,approval_note},"PUT")),
  consents:(page=1,search="")=>inventoryRequest<Page<any>>(admin+"/consents"+query({page,search})),
  grants:(page=1)=>inventoryRequest<Page<any>>(admin+"/grants"+query({page})),
  grant:(user_id:number,permission:string)=>inventoryRequest<{ok:boolean}>(
    admin+"/grants",json({user_id,permission})),
  revoke:(id:number)=>inventoryRequest<{ok:boolean}>(admin+"/grants/"+id,{method:"DELETE"}),
};

export async function commercialBlob(path:string):Promise<Blob> {
  // Always Inventory-only and same origin; no Portal tokens/cookies.
  if (!path.startsWith("/api/v1/")||path.includes("..")||path.includes("\\")||path.startsWith("//"))
    throw new Error("Invalid Inventory PDF path");
  const response=await fetch("/inventory-api"+path,{
    method:"GET",credentials:"same-origin",headers:{Accept:"application/pdf"},
  });
  if (!response.ok) throw new Error("HTTP "+response.status);
  return response.blob();
}
export function previewPdf(blob:Blob,filename:string):void {
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download=filename;
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}

import { inventoryRequest } from "./client";

const company = (id:string)=>"/api/v1/companies/"+encodeURIComponent(id);
export const registryExportHref=(id:string,query:Record<string,string>)=>
  "/inventory-api"+company(id)+"/assets/export.xlsx?"+new URLSearchParams(query).toString();
export function bulkAssignCustodian(id:string,assets:{id:string;version:number}[],person:string|null,reason:string){
  return inventoryRequest<{updated:number}>(company(id)+"/assets/bulk-responsible",{
    method:"POST",body:JSON.stringify({assets,responsible_person_id:person,reason})
  });
}
export interface ReportDocument{
  id:string;original_name:string;mime_type:string;file_size:number;sha256:string;uploaded_by_name:string;created_at:string
}
export const reportDocuments=(id:string,session:string)=>
  inventoryRequest<{data:ReportDocument[]}>(company(id)+"/inventory-sessions/"+encodeURIComponent(session)+"/documents");
export const reportDocumentHref=(id:string,session:string,document:string)=>
  "/inventory-api"+company(id)+"/inventory-sessions/"+encodeURIComponent(session)+"/documents/"+encodeURIComponent(document);
export const uploadReportDocument=(id:string,session:string,version:number,file:File)=>{
  const data=new FormData();data.append("version",String(version));data.append("file",file);
  return inventoryRequest<{data:ReportDocument}>(company(id)+"/inventory-sessions/"+encodeURIComponent(session)+"/documents",{
    method:"POST",body:data
  });
};
export interface Member{user_id:number;name:string;email:string;active:boolean;role_code:string}
export const companyMembers=(id:string)=>inventoryRequest<{data:Member[]}>(company(id)+"/members");
export const updateMemberRole=(id:string,user:number,role_code:string,reason:string)=>
  inventoryRequest<{ok:boolean;changed:boolean}>(company(id)+"/members/"+user,{
    method:"PUT",body:JSON.stringify({role_code,reason})
  });

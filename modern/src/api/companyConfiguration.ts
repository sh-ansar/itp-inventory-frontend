import {inventoryRequest} from "./client";

const base=(companyId:string)=>"/api/v1/companies/"+encodeURIComponent(companyId);
export interface CompanySettings {
 company_id:string;legal_name:string;country_code:string;timezone:string;
 currency:string;asset_number_prefix:string;document_number_prefix:string;
 default_locale:"ru"|"en"|"ka";version:number;
}
export interface DocumentTemplate {
 id:string;company_id:string;kind:string;locale:"ru"|"en"|"ka";
 revision:number;title:string;body:string;
 status:"draft"|"published"|"archived";published_at?:string|null;
}
export const getCompanySettings=(companyId:string)=>
  inventoryRequest<{data:CompanySettings}>(base(companyId)+"/configuration");
export const saveCompanySettings=(companyId:string,data:CompanySettings)=>
  inventoryRequest<{data:CompanySettings}>(base(companyId)+"/configuration",{
    method:"PUT",body:JSON.stringify(data),
  });
export const listDocumentTemplates=(companyId:string)=>
  inventoryRequest<{data:DocumentTemplate[]}>(base(companyId)+"/document-templates");
export const createDocumentTemplate=(companyId:string,data:{
  kind:string;locale:string;title:string;body:string;
})=>inventoryRequest<{data:DocumentTemplate}>(base(companyId)+"/document-templates",{
  method:"POST",body:JSON.stringify(data),
});
export const publishDocumentTemplate=(companyId:string,id:string,revision:number)=>
  inventoryRequest<{data:DocumentTemplate}>(base(companyId)+"/document-templates/"+encodeURIComponent(id)+"/publish",{
  method:"POST",body:JSON.stringify({revision}),
});
export const previewDocumentTemplate=(companyId:string,id:string,data:Record<string,string>={})=>
  inventoryRequest<{data:{title:string;body:string;revision:number;status:string;locale:string}}>(
    base(companyId)+"/document-templates/"+encodeURIComponent(id)+"/preview",{
    method:"POST",body:JSON.stringify(data),
  });

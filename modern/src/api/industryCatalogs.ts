import { inventoryRequest } from "./client";

export type IndustryKind = "unit" | "manufacturer" | "model" | "department";

export interface IndustryCatalogItem {
  id: string;
  company_id: string;
  kind: IndustryKind;
  code: string;
  name: string;
  parent_id?: string | null;
  precision?: number | null;
  source?: string;
  is_active: boolean;
  is_system?: boolean;
  version: number;
}

const path = (companyId: string, kind: IndustryKind) =>
  "/api/v1/companies/" + encodeURIComponent(companyId)
  + "/industry-catalogs/" + encodeURIComponent(kind);

export const listIndustryCatalog = (
  companyId: string, kind: IndustryKind, includeArchived = false, signal?: AbortSignal
) => inventoryRequest<{ data: IndustryCatalogItem[] }>(
  path(companyId, kind) + (includeArchived ? "?include_archived=1" : ""), {signal}
);

export const createIndustryCatalogItem = (
  companyId: string, kind: IndustryKind, data: {
    code: string; name: string; parent_id?: string; precision?: number;
  }
) => inventoryRequest<{data: IndustryCatalogItem}>(path(companyId,kind), {
  method: "POST", body: JSON.stringify(data),
});

export const updateIndustryCatalogItem = (
  companyId: string, kind: IndustryKind, id: string, version: number, name: string
) => inventoryRequest<{data: IndustryCatalogItem}>(path(companyId,kind)+"/"+encodeURIComponent(id), {
  method: "PUT", body: JSON.stringify({version,name}),
});

export const archiveIndustryCatalogItem = (
  companyId: string, kind: IndustryKind, id: string, version: number
) => inventoryRequest<{data: IndustryCatalogItem}>(
  path(companyId,kind)+"/"+encodeURIComponent(id)+"/archive", {
    method: "POST", body: JSON.stringify({version}),
  }
);

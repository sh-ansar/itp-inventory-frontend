import { inventoryRequest } from "./client";

export interface TablePreferenceSettings {
  search: string;
  status: string;
  facility_node_id: string;
  responsible_person_id: string;
  warehouse_node_id: string;
  sort_key: string;
  sort_direction: "asc" | "desc";
  per_page: number;
  hidden_columns: string[];
  column_order: string[];
}

const path = (companyId: string, view: string): string =>
  "/api/v1/companies/" + encodeURIComponent(companyId) +
  "/preferences/" + encodeURIComponent(view);

export async function readTablePreferences(companyId: string, view: string, signal?: AbortSignal) {
  return inventoryRequest<{data: {view: string; settings: Partial<TablePreferenceSettings> | null}}>(
    path(companyId,view),{signal},
  );
}

export async function writeTablePreferences(companyId: string, view: string, settings: TablePreferenceSettings) {
  return inventoryRequest<{data: {view:string; settings:Partial<TablePreferenceSettings>}}>(
    path(companyId,view),{method:"PUT",body:JSON.stringify({settings})},
  );
}

export async function clearTablePreferences(companyId:string,view:string) {
  return inventoryRequest<void>(path(companyId,view),{method:"DELETE"});
}

import { inventoryRequest } from "./client";

export interface Asset {
  id: string;
  public_id: string;
  inventory_number: string;
  name: string;
  serial_number: string | null;
  description: string | null;
  status: "active" | "written_off" | "disposed";
  category_id: string | null;
  manufacturer_id?: string | null;
  manufacturer_name?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  category_name?: string | null;
  accounting_location_id: string | null;
  accounting_location_name?: string | null;
  physical_location_id: string | null;
  physical_location_name?: string | null;
  facility_node_id: string|null;
  facility_node_name?: string|null;
  responsible_person_id: string|null;
  responsible_person_name?: string|null;
  version: number;
  has_disposal_case?: boolean;
  created_at: string;
  updated_at: string;
}

export type AssetInput = {attributes?:Record<string,string|number|boolean|null>} & Pick<Asset, "inventory_number" | "name"> &
  Partial<Pick<Asset, "serial_number" | "description" | "category_id" | "manufacturer_id" | "model_id" |
    "accounting_location_id" | "physical_location_id" | "facility_node_id" | "responsible_person_id">>;

export interface Page<T> {
  data: T[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
}

export interface RefItem { id: string; code: string; name: string; icon_key?:string; icon_url?:string|null; is_base?:boolean; is_active?:boolean; version?:number }
export interface ReferenceData {
  categories: RefItem[];
  accounting_locations: RefItem[];
  physical_locations: RefItem[];
}
export interface AssetMovement {
  id: string;
  asset_id: string;
  from_location_id: string | null;
  to_location_id: string;
  from_location_name: string | null;
  to_location_name: string;
  actor_name: string;
  reason: string;
  version: number;
  created_at: string;
}

export interface AssetEvent {
  id: string;
  event_type: "created" | "updated" | "archived" | "moved";
  version: number;
  actor_name: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}
export interface AssetFilters {
  page: number; per_page: number;
  search: string; status?: string;
  sort: string; direction: "asc" | "desc";
  facility_node_id?:string; include_descendants?:boolean; responsible_person_id?:string;
  statuses?:string[]; facility_node_ids?:string[]; responsible_person_ids?:string[];
}

const companyPath = (companyId: string) =>
  "/api/v1/companies/" + encodeURIComponent(companyId);
const assetPath = (companyId: string, assetId: string) =>
  companyPath(companyId) + "/assets/" + encodeURIComponent(assetId);

export function companyAssets(
  companyId: string, filters: AssetFilters, signal?: AbortSignal
): Promise<Page<Asset>> {
  const query = new URLSearchParams({
    page: String(filters.page), per_page: String(filters.per_page),
    sort: filters.sort, direction: filters.direction,
  });
  if (filters.search.trim()) query.set("search", filters.search.trim());
  if (filters.status) query.set("status", filters.status);
  if (filters.facility_node_id) query.set("facility_node_id",filters.facility_node_id);
  if (filters.include_descendants!==undefined) query.set("include_descendants",filters.include_descendants?"1":"0");
  if (filters.responsible_person_id) query.set("responsible_person_id",filters.responsible_person_id);
  for(const key of ["statuses","facility_node_ids","responsible_person_ids"] as const){
    for(const item of filters[key]??[])query.append(key+"[]",item);
  }
  return inventoryRequest<Page<Asset>>(companyPath(companyId) + "/assets?" + query, { signal });
}

export const referenceData = (companyId: string, signal?: AbortSignal, includeArchived = false) =>
  inventoryRequest<ReferenceData>(companyPath(companyId)
    + "/reference-data" + (includeArchived ? "?include_archived=1" : ""), { signal });

export const createAsset = (companyId: string, input: AssetInput) =>
  inventoryRequest<{ data: Asset }>(companyPath(companyId) + "/assets", {
    method: "POST", body: JSON.stringify(input),
  });
export const updateAsset = (companyId: string, assetId: string, version: number, input: AssetInput) =>
  inventoryRequest<{ data: Asset }>(assetPath(companyId, assetId), {
    method: "PUT", body: JSON.stringify({ ...input, version }),
  });
export const archiveAsset = (companyId: string, assetId: string, version: number, reason: string) =>
  inventoryRequest<{ ok: true }>(assetPath(companyId, assetId), {
    method: "DELETE", body: JSON.stringify({ version, reason }),
  });
export const assetEvents = (companyId: string, assetId: string) =>
  inventoryRequest<Page<AssetEvent>>(assetPath(companyId, assetId) + "/events");

/** QR public_id identifies an asset but never bypasses tenant membership. */
export const resolveQrAsset = (companyId: string, publicId: string) =>
  inventoryRequest<{data: Asset}>(companyPath(companyId) + "/assets/scan/" + encodeURIComponent(publicId));

export const assetMovements = (companyId: string, assetId: string) =>
  inventoryRequest<Page<AssetMovement>>(assetPath(companyId, assetId) + "/movements");

export const moveAsset = (
  companyId: string, assetId: string, version: number,
  toLocationId: string, reason: string
) => inventoryRequest<{ data: { asset: Asset; movement: AssetMovement } }>(
  assetPath(companyId, assetId) + "/movements",
  { method: "POST", body: JSON.stringify({ version, to_location_id: toLocationId, reason }) },
);

export const createCategory = (companyId: string, code: string, name: string) =>
  inventoryRequest<RefItem>(companyPath(companyId) + "/categories", {
    method: "POST", body: JSON.stringify({code,name}),
  });
export const createLocation = (companyId: string, kind: "physical" | "accounting", code: string, name: string) =>
  inventoryRequest<RefItem>(companyPath(companyId) + "/locations", {
    method: "POST", body: JSON.stringify({kind,code,name}),
  });

export const updateLocation = (companyId: string, locationId: string, version: number, name: string) =>
  inventoryRequest<{ data: RefItem }>(companyPath(companyId) + "/locations/" + locationId, {
    method: "PUT", body: JSON.stringify({version,name}),
  });
export const archiveReference = (companyId: string, kind: "categories"|"accounting_locations"|"physical_locations", itemId: string, version: number) =>
  inventoryRequest<{ data: RefItem }>(companyPath(companyId)
    + (kind === "categories" ? "/categories/" : "/locations/") + itemId + "/archive", {
    method: "POST", body: JSON.stringify({version}),
  });

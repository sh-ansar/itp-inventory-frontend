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
  category_name?: string | null;
  accounting_location_id: string | null;
  accounting_location_name?: string | null;
  physical_location_id: string | null;
  physical_location_name?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type AssetInput = Pick<Asset, "inventory_number" | "name"> &
  Partial<Pick<Asset, "serial_number" | "description" | "category_id" |
    "accounting_location_id" | "physical_location_id">>;

export interface Page<T> {
  data: T[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
}

export interface RefItem { id: string; code: string; name: string }
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
  search: string; status: string;
  sort: string; direction: "asc" | "desc";
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
  return inventoryRequest<Page<Asset>>(companyPath(companyId) + "/assets?" + query, { signal });
}

export const referenceData = (companyId: string, signal?: AbortSignal) =>
  inventoryRequest<ReferenceData>(companyPath(companyId) + "/reference-data", { signal });

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
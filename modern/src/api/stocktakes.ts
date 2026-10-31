import { inventoryRequest } from "./client";
import type { Page } from "./inventory";

export interface InventorySession {
  id: string;
  company_id: string;
  name: string;
  status: "in_progress" | "completed";
  scope_type: "all" | "location" | "facility" | "selected";
  scope_location_id: string | null;
  scope_location_name: string | null;
  scope_facility_node_id:string|null;
  scope_facility_node_name:string|null;
  total_items: number;
  counted_items: number;
  missing_items: number;
  discrepancies: number;
  version: number;
  created_by_name: string;
  completed_by_name: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventorySessionItem {
  id: string;
  session_id: string;
  asset_id: string;
  inventory_number: string;
  name: string;
  expected_location_id: string | null;
  expected_location_name: string | null;
  expected_facility_node_id:string|null;
  expected_facility_node_name:string|null;
  actual_facility_node_id:string|null;
  actual_facility_node_name:string|null;
  actual_location_id: string | null;
  actual_location_name: string | null;
  is_counted: boolean;
  is_discrepancy: boolean;
  version: number;
  note: string | null;
  counted_by_name: string | null;
  counted_at: string | null;
}

export interface InventorySessionEvent {
  id: string;
  session_id: string;
  item_id: string | null;
  event_type: "created" | "counted" | "recounted" | "completed" | "reopened";
  version: number;
  actor_name: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}
export interface InventorySessionFilters {
  search: string;
  status: string;
  page: number;
  per_page: number;
}
export interface InventoryItemFilters {
  search: string;
  counted: string;
  discrepancy: string;
  page: number;
  per_page: number;
}

const companyPath = (companyId: string) =>
  "/api/v1/companies/" + encodeURIComponent(companyId);
const sessionsPath = (companyId: string) =>
  companyPath(companyId) + "/inventory-sessions";
const sessionPath = (companyId: string, sessionId: string) =>
  sessionsPath(companyId) + "/" + encodeURIComponent(sessionId);
const itemPath = (companyId: string, sessionId: string, itemId: string) =>
  sessionPath(companyId, sessionId) + "/items/" + encodeURIComponent(itemId);

function searchQuery(filters: {search: string; page: number; per_page: number}): URLSearchParams {
  const params = new URLSearchParams({
    page: String(filters.page), per_page: String(filters.per_page),
  });
  if (filters.search.trim()) params.set("search", filters.search.trim());
  return params;
}

export function inventorySessions(
  companyId: string, filters: InventorySessionFilters, signal?: AbortSignal,
): Promise<Page<InventorySession>> {
  const query = searchQuery(filters);
  if (filters.status) query.set("status", filters.status);
  return inventoryRequest<Page<InventorySession>>(sessionsPath(companyId) + "?" + query, {signal});
}
export const createInventorySession = (
  companyId: string, values: {name: string; scope_location_id?: string | null; facility_node_id?:string|null; asset_ids?: string[]},
) => inventoryRequest<{data: InventorySession}>(sessionsPath(companyId), {
  method:"POST",body:JSON.stringify(values),
});
export const getInventorySession = (companyId: string, sessionId: string) =>
  inventoryRequest<{data: InventorySession}>(sessionPath(companyId, sessionId));

export function inventorySessionItems(
  companyId: string, sessionId: string, filters: InventoryItemFilters, signal?: AbortSignal,
): Promise<Page<InventorySessionItem>> {
  const query = searchQuery(filters);
  if (filters.counted) query.set("counted", filters.counted);
  if (filters.discrepancy) query.set("discrepancy", filters.discrepancy);
  return inventoryRequest<Page<InventorySessionItem>>(sessionPath(companyId, sessionId)+"/items?"+query,{signal});
}
export const countInventoryItem = (
  companyId: string, sessionId: string, itemId: string, values: {
    version: number; actual_location_id?: string; actual_facility_node_id?:string; note?: string | null; reason?: string | null;
  },
) => inventoryRequest<{data:{session:InventorySession;item:InventorySessionItem}}>(
  itemPath(companyId, sessionId, itemId),{method:"PUT",body:JSON.stringify(values)},
);
export const scanInventoryQr = (
  companyId: string, sessionId: string, values: {
    public_id: string;actual_location_id?: string;actual_facility_node_id?:string;note?:string | null;
  },
) => inventoryRequest<{data:{session:InventorySession;item:InventorySessionItem}}>(
  sessionPath(companyId,sessionId)+"/scan",{method:"POST",body:JSON.stringify(values)},
);
export const completeInventorySession = (
  companyId: string, sessionId: string, version: number,
) => inventoryRequest<{data:InventorySession}>(sessionPath(companyId,sessionId)+"/complete",{
  method:"POST",body:JSON.stringify({version}),
});
export const reopenInventorySession = (
  companyId: string, sessionId: string, version: number, reason: string,
) => inventoryRequest<{data:InventorySession}>(sessionPath(companyId,sessionId)+"/reopen",{
  method:"POST",body:JSON.stringify({version,reason}),
});
export const inventorySessionEvents = (companyId: string, sessionId: string) =>
  inventoryRequest<Page<InventorySessionEvent>>(sessionPath(companyId,sessionId)+"/events");

/** Same-origin cookie-protected download, no session or token in the URL. */
export function inventoryReportHref(companyId: string, sessionId: string): string {
  return "/inventory-api"+sessionPath(companyId,sessionId)+"/report.csv";
}

import { initializeCsrf, inventoryRequest } from "./client";

export interface InventoryUser { id: number; name: string }
export interface Health { status: "ok"; service: string; browser_login: boolean }
export interface CompanyAccess { id: string; name: string; role_code: string }

export const health = () => inventoryRequest<Health>("/api/v1/health");
export const currentUser = () => inventoryRequest<InventoryUser>("/api/v1/me");

export async function login(email: string, password: string): Promise<InventoryUser> {
  await initializeCsrf();
  return inventoryRequest<InventoryUser>("/auth/login", {
    method: "POST", body: JSON.stringify({email,password}),
  });
}
export const logout = () => inventoryRequest<{ok:boolean}>("/auth/logout", { method: "POST" });
export const companies = () => inventoryRequest<CompanyAccess[]>("/api/v1/companies");
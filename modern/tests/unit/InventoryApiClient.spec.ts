import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryApiError, inventoryRequest, initializeCsrf } from "../../src/api/client";
import { companyAssets, resolveQrAsset, moveAsset } from "../../src/api/inventory";

beforeEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "INVENTORY-XSRF-TOKEN=;max-age=0;path=/";
});

describe("Inventory API client", () => {
  it("always calls the own same-origin /inventory-api base and server-side query params", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data:[],meta:{current_page:1,last_page:1,total:0,per_page:25},links:{},
    }), {status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    await companyAssets("comp-1", {
      page:1,per_page:25,search:"артикул с пробелом",status:"active",
      sort:"inventory_number",direction:"asc",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url,options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/inventory-api/api/v1/companies/comp-1/assets?");
    expect(url).toContain("per_page=25");
    expect(url).toContain("search=");
    expect(url).not.toContain("http");
    expect(options.credentials).toBe("same-origin");
  });

  it("rejects URLs that escape the internal API base", async () => {
    await expect(inventoryRequest("//attacker.example")).rejects.toThrow("Invalid Inventory API path");
    await expect(inventoryRequest("https://example.com")).rejects.toThrow("Invalid Inventory API path");
  });

  it("uses the Inventory-specific XSRF header on unsafe requests", async () => {
    const seen: Array<{url: string; headers: Headers}> = [];
    vi.stubGlobal("fetch",vi.fn(async (url: string,options: RequestInit) => {
      seen.push({url,headers:new Headers(options.headers)});
      if (url.endsWith("/sanctum/csrf-cookie")) {
        document.cookie = "INVENTORY-XSRF-TOKEN=qa-token;path=/";
        return new Response(null,{status:204});
      }
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{"Content-Type":"application/json"}});
    }));
    await initializeCsrf();
    await inventoryRequest("/auth/logout",{method:"POST"});
    expect(seen).toHaveLength(2);
    expect(seen[1].headers.get("X-XSRF-TOKEN")).toBe("qa-token");
    expect(seen[1].url).toBe("/inventory-api/auth/logout");
    expect(seen[1].headers.has("Authorization")).toBe(false);
  });

  it("preserves HTTP conflict and validation field metadata", async () => {
    vi.stubGlobal("fetch",vi.fn(async () => new Response(JSON.stringify({
      message:"Conflict",code:"CONFLICT",errors:{name:["Name invalid"]},
    }),{status:409,headers:{"Content-Type":"application/json","X-Request-ID":"request-qa"}})));
    try {
      await inventoryRequest("/api/v1/companies");
      throw new Error("Expected API error");
    } catch(error) {
      expect(error).toBeInstanceOf(InventoryApiError);
      const apiError = error as InventoryApiError;
      expect(apiError.status).toBe(409);
      expect(apiError.code).toBe("CONFLICT");
      expect(apiError.fields.name).toEqual(["Name invalid"]);
      expect(apiError.requestId).toBe("request-qa");
    }
  });
});


describe("Tenant-scoped QR and movement API", () => {
  it("resolves a QR under the selected company and not via a public external endpoint", async () => {
    const mock = vi.fn(async () => new Response(JSON.stringify({data:{id:"asset-1"}}), {
      status:200,headers:{"Content-Type":"application/json"},
    }));
    vi.stubGlobal("fetch",mock);
    await resolveQrAsset("company-123", "public-uuid");
    const [url,options] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/inventory-api/api/v1/companies/company-123/assets/scan/public-uuid");
    expect(options.credentials).toBe("same-origin");
    expect(options.method).toBe("GET");
  });

  it("sends a physical movement with version, reason and Inventory CSRF header", async () => {
    document.cookie = "INVENTORY-XSRF-TOKEN=qa-token;path=/";
    const mock = vi.fn(async () => new Response(JSON.stringify({
      data:{asset:{id:"asset-1"},movement:{id:"movement-1"}},
    }), {status:201,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",mock);
    const result = await moveAsset("company-123", "asset-1", 4, "physical-2", "Moved to new office");
    const [url,options] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/inventory-api/api/v1/companies/company-123/assets/asset-1/movements");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("same-origin");
    expect(new Headers(options.headers).get("X-XSRF-TOKEN")).toBe("qa-token");
    expect(JSON.parse(options.body as string)).toEqual({
      version:4,to_location_id:"physical-2",reason:"Moved to new office",
    });
    expect(result.data.movement.id).toBe("movement-1");
  });
});
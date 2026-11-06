import {describe, expect, it} from "vitest";
import {router} from "../../src/router";

/**
 * Guards the deployment's deep-link contracts and the route-level splitting
 * that prevents all inventory screens from downloading on first login.
 */
describe("Inventory router", () => {
  const pages = [
    "profile","company-settings","company-roles","disposals","references",
    "facilities","facility-plan","people","warehouses","reports","stocktakes",
    "stocktake","scan",
  ] as const;

  it("keeps the initial registry eagerly available", () => {
    const registry=router.getRoutes().find(route=>route.name==="assets");
    expect(registry?.path).toBe("/registry");
    expect(typeof registry?.components?.default).not.toBe("function");
  });

  it.each(pages)("loads %s as a lazy page chunk", name => {
    const route=router.getRoutes().find(item=>item.name===name);
    expect(route, "missing named route "+name).toBeDefined();
    expect(typeof route?.components?.default).toBe("function");
  });

  it("preserves the two dynamic deep-link routes", () => {
    expect(router.hasRoute("facility-plan")).toBe(true);
    expect(router.getRoutes().find(x=>x.name==="facility-plan")?.path).toBe("/facilities/:nodeId/plan");
    expect(router.getRoutes().find(x=>x.name==="stocktake")?.path).toBe("/stocktakes/:sessionId");
    expect(router.getRoutes().find(x=>x.name==="scan")?.path).toBe("/scan/:publicId");
  });
});

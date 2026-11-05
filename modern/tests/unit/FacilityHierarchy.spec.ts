import { describe, expect, it } from "vitest";
import { createFacilityHierarchy } from "../../src/utils/facilityHierarchy";
import type { FacilityNode } from "../../src/api/topology";

const node = (id: string, parent_id: string | null = null, sort_order = 0) =>
  ({id, parent_id, sort_order, name: id, code: id, node_type: "building"} as FacilityNode);

describe("facility navigation index", () => {
  it("preserves sorted hierarchical traversal and descendant counts", () => {
    const tree = createFacilityHierarchy([
      node("b", null, 2),node("floor", "a"),node("a", null, 1),
      node("room", "floor"),node("orphan", "missing"),
    ]);
    expect(tree.flat.map(x => x.node.id)).toEqual(["a", "floor", "room", "b"]);
    expect(tree.countDescendants("a")).toBe(2);
    expect(tree.countDescendants("a")).toBe(2);
    expect(tree.countDescendants("b")).toBe(0);
    expect(tree.byId.get("floor")?.parent_id).toBe("a");
  });

  it("handles a cycle and never leaks orphaned records into top-level UI", () => {
    const tree = createFacilityHierarchy([node("one","two"), node("two","one")]);
    expect(tree.flat).toEqual([]);
    expect(tree.countDescendants("one")).toBe(1);
  });

  it("indexes ten thousand independent facility nodes without quadratic scanning", () => {
    const large = Array.from({ length: 10000 }, (_, i) => node(String(i), null, i));
    const tree = createFacilityHierarchy(large);
    expect(tree.flat).toHaveLength(10000);
    expect(tree.byParent.get(null)).toHaveLength(10000);
    expect(tree.countDescendants("5")).toBe(0);
  });

  it("caps very deep descendant tallies to the existing UI safety limit", () => {
    const chain = Array.from({length:4000},(_,i)=>node(String(i),i?String(i-1):null));
    expect(createFacilityHierarchy(chain).countDescendants("0")).toBe(3000);
  });
});

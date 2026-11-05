import type { FacilityNode } from "../api/topology";

export interface FacilityTreeRow {
  node: FacilityNode;
  depth: number;
}

/**
 * A tenant-scoped facility tree is indexed once per response rather than
 * filtering the entire collection for every visible child or subtree.
 * Orphaned/cyclic nodes never escape into the root-level navigation.
 */
export function createFacilityHierarchy(nodes: readonly FacilityNode[]) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const byParent = new Map<string | null, FacilityNode[]>();
  for (const node of nodes) {
    const items = byParent.get(node.parent_id) ?? [];
    items.push(node);
    byParent.set(node.parent_id, items);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  const flat: FacilityTreeRow[] = [];
  const visit = (parent: string | null, depth: number, visited: Set<string>) => {
    if (depth > 9) return;
    for (const node of byParent.get(parent) ?? []) {
      if (visited.has(node.id)) continue;
      flat.push({ node, depth });
      visit(node.id, depth + 1, new Set([...visited, node.id]));
    }
  };
  visit(null, 0, new Set());

  const descendantCache = new Map<string, number>();
  function countDescendants(id: string): number {
    const cached = descendantCache.get(id);
    if (cached !== undefined) return cached;
    const visited = new Set([id]);
    const queue = [id];
    let head = 0;
    // Mirror previous display cap; reject repeated IDs in corrupted trees.
    while (head < queue.length && visited.size < 3001) {
      const parent = queue[head++]!;
      for (const child of byParent.get(parent) ?? []) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        queue.push(child.id);
        if (visited.size >= 3001) break;
      }
    }
    const result = visited.size - 1;
    descendantCache.set(id, result);
    return result;
  }

  return { byId, byParent, flat, countDescendants };
}

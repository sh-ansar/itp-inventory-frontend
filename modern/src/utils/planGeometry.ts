import type { FacilityPlan, PlanElement, PlanRect } from "../api/facilityPlans";

export function snapshot(el: PlanElement): PlanRect {
  return { x: el.x ?? 0, y: el.y ?? 0, width: el.width ?? 100, height: el.height ?? 80 };
}

export function bound(value: number, max: number, snap = true): number {
  const clamped = Math.max(0, Math.min(Math.floor(value), max));
  return snap ? Math.min(Math.round(clamped / 10) * 10, max) : clamped;
}

export function rectStyle(el: PlanElement): Record<string, string> {
  return {
    left: (el.x ?? 0) + "px", top: (el.y ?? 0) + "px",
    width: (el.width ?? 100) + "px", height: (el.height ?? 80) + "px",
  };
}

/** Find a nonoverlapping position without mutating a plan or its audit data. */
export function freePosition(
  plan: Pick<FacilityPlan, "canvas_width" | "canvas_height"> | null,
  placed: readonly PlanElement[],
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (!plan) return null;
  for (let y = 30; y + height <= plan.canvas_height; y += 100) {
    for (let x = 30; x + width <= plan.canvas_width; x += 120) {
      if (placed.every(other => {
        const r = snapshot(other);
        return x + width + 10 <= r.x || r.x + r.width + 10 <= x ||
          y + height + 10 <= r.y || r.y + r.height + 10 <= y;
      })) return { x, y };
    }
  }
  return null;
}

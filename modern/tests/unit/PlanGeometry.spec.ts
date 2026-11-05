import {describe, expect, it} from "vitest";
import {bound, freePosition, rectStyle, snapshot} from "../../src/utils/planGeometry";
import type {PlanElement} from "../../src/api/facilityPlans";

const el = (x:number,y:number,width=100,height=80) =>
  ({x,y,width,height,id:"asset-1",kind:"asset",placement_id:"placed"} as PlanElement);

describe("facility canvas geometry",()=>{
  it("preserves stable rect fallbacks and snapped bounds",()=>{
    expect(snapshot(el(3,5))).toEqual({x:3,y:5,width:100,height:80});
    expect(rectStyle(el(3,5))).toEqual({left:"3px",top:"5px",width:"100px",height:"80px"});
    expect(bound(-10,100)).toBe(0);
    expect(bound(27,100)).toBe(30);
    expect(bound(27,100,false)).toBe(27);
    expect(bound(220,100)).toBe(100);
  });
  it("avoids placed objects and respects canvas limits",()=>{
    const canvas={canvas_width:600,canvas_height:400};
    expect(freePosition(canvas,[],100,100)).toEqual({x:30,y:30});
    expect(freePosition(canvas,[el(20,20,140,140)],100,100)).not.toEqual({x:30,y:30});
    expect(freePosition(canvas,[],2000,100)).toBeNull();
    expect(freePosition(null,[],100,100)).toBeNull();
  });
});

import { inventoryRequest } from "./client";

export interface PlanElement {
  kind: "node"|"asset";
  id:string;
  placement_id:string|null;
  name:string;
  code:string;
  node_type:string|null;
  icon_key:string|null;
  icon_url:string|null;
  responsible_name:string|null;
  x:number|null;
  y:number|null;
  width:number|null;
  height:number|null;
}

export interface FacilityPlan {
  node_id:string;
  node_name:string;
  node_type:string;
  parent_id:string|null;
  canvas_width:number;
  canvas_height:number;
  version:number;
  background_url:string|null;
  elements:PlanElement[];
}

export interface PlanRect {
  x:number;y:number;width:number;height:number;
}

export interface PlanEvent {
  id:string;event_type:string;version:number;
  actor_name:string;created_at:string;
  before:Record<string,unknown>|null;
  after:Record<string,unknown>|null;
}

const base=(company:string,node:string)=>
  "/api/v1/companies/"+encodeURIComponent(company)+
  "/facility-nodes/"+encodeURIComponent(node)+"/plan";

export const getFacilityPlan=(company:string,node:string,signal?:AbortSignal)=>
  inventoryRequest<{data:FacilityPlan}>(base(company,node),{signal});

export const resizeFacilityPlan=(company:string,node:string,input:{
  canvas_width:number;canvas_height:number;expected_version:number
})=>inventoryRequest<{data:{
  version:number;canvas_width:number;canvas_height:number
}}>(base(company,node),{method:"PUT",body:JSON.stringify(input)});

export const placePlanElement=(company:string,node:string,input:PlanRect&{
  kind:"node"|"asset";id:string;expected_version:number
})=>inventoryRequest<{data:{placement:PlanRect&{id:string};version:number}}>(
  base(company,node)+"/placements",{
    method:"POST",body:JSON.stringify({
      ...(input.kind==="asset"?{asset_id:input.id}:{child_node_id:input.id}),
      x:input.x,y:input.y,width:input.width,height:input.height,
      expected_version:input.expected_version,
    }),
  });

export const movePlanElement=(company:string,node:string,placementId:string,input:PlanRect&{
  expected_version:number
})=>inventoryRequest<{data:{placement:PlanRect&{id:string};version:number}}>(
  base(company,node)+"/placements/"+encodeURIComponent(placementId),{
    method:"PATCH",body:JSON.stringify(input),
  });

export const removePlanElement=(company:string,node:string,placementId:string,version:number)=>
  inventoryRequest<{data:{version:number}}>(
    base(company,node)+"/placements/"+encodeURIComponent(placementId),{
      method:"DELETE",body:JSON.stringify({expected_version:version}),
    });

export const getFacilityPlanEvents=(company:string,node:string)=>
  inventoryRequest<{data:PlanEvent[]}>(base(company,node)+"/events");

export const uploadFacilityPlanBackground=(company:string,node:string,file:File,version:number)=>{
  const body=new FormData();
  body.set("file",file);body.set("expected_version",String(version));
  return inventoryRequest<{data:{version:number;background_url:string}}>(
    base(company,node)+"/background",{method:"POST",body});
};

export const clearFacilityPlanBackground=(company:string,node:string,version:number)=>
  inventoryRequest<{data:{version:number;background_url:null}}>(
    base(company,node)+"/background",{method:"DELETE",
      body:JSON.stringify({expected_version:version}),
    });

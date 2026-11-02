import {describe,it,expect,vi,afterEach} from "vitest";
import {getAllActiveResponsiblePeople} from "../../src/api/topology";
import {getAllInventorySessions} from "../../src/api/stocktakes";

afterEach(()=>vi.unstubAllGlobals());

describe("complete Inventory selector directories",()=>{
  it("loads all active custodians across pages instead of dropping entry 101",async()=>{
    const fetcher=vi.fn(async(url:string)=>{
      const page=new URL(url,"http://localhost").searchParams.get("page");
      return {
        ok:true,status:200,
        json:async()=>({
          data:page==="1"?
            Array.from({length:100},(_,i)=>({id:"person-"+i,name:"Person "+i})):
            [{id:"person-100",name:"Person 100"}],
          current_page:Number(page),last_page:2,total:101,per_page:100,
        }),
      };
    });
    vi.stubGlobal("fetch",fetcher);
    const values=await getAllActiveResponsiblePeople("company-a");
    expect(values).toHaveLength(101);
    expect(values.at(-1)?.id).toBe("person-100");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("loads every stocktake for printing, including page two",async()=>{
    const fetcher=vi.fn(async(url:string)=>{
      const page=new URL(url,"http://localhost").searchParams.get("page");
      return {
        ok:true,status:200,
        json:async()=>({
          data:page==="1"?Array.from({length:100},(_,i)=>({id:"session-"+i})):
            [{id:"session-100"}],
          meta:{current_page:Number(page),last_page:2,total:101,per_page:100},
        }),
      };
    });
    vi.stubGlobal("fetch",fetcher);
    const values=await getAllInventorySessions("company-a");
    expect(values).toHaveLength(101);
    expect(values.at(-1)?.id).toBe("session-100");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

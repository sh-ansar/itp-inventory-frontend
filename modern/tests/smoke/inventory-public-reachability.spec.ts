import { test } from "@playwright/test";
import { lookup } from "node:dns/promises";

/** Read-only public reachability from the external GitHub Actions runner.
 * An unreachable public hostname does not mean the private Windows server is down. */
test("public Inventory DNS and HTTP endpoints are observed independently",async()=>{
  const host="platform.itpmining.kz";
  try{
    const result=await lookup(host);
    console.log("INVENTORY_PUBLIC_DNS_OK",result.address);
  }catch(error){
    console.log("INVENTORY_PUBLIC_DNS_FAILED",error instanceof Error?error.message:String(error));
  }
  const targets=["/inventory/","/inventory-api/api/v1/health","/hrm/"];
  await Promise.all(targets.map(async path=>{
    try {
      const response=await fetch("https://"+host+path,{
        method:"GET",redirect:"follow",signal:AbortSignal.timeout(10000),
      });
      console.log("INVENTORY_PUBLIC_HTTP",path,response.status,response.url);
    }catch(error){
      const diagnostic=error as Error & {cause?:Error & {code?:string}};
      console.log("INVENTORY_PUBLIC_HTTP_FAILED",path,
        diagnostic.message,diagnostic.cause?.code??"",diagnostic.cause?.message??"");
    }
  }));
});

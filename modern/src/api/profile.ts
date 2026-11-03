import { inventoryRequest } from "./client";

export interface MyProfile { id:number; name:string; email:string }
export const myProfile=()=>inventoryRequest<{data:MyProfile}>("/api/v1/profile");
export const updateMyProfile=(name:string)=>inventoryRequest<{data:MyProfile}>("/api/v1/profile",{
  method:"PUT",body:JSON.stringify({name}),
});
export const changeMyPassword=(current_password:string,password:string,password_confirmation:string)=>
  inventoryRequest<{ok:boolean}>("/api/v1/profile/password",{
    method:"PUT",body:JSON.stringify({current_password,password,password_confirmation}),
  });

import {describe,it,expect} from "vitest";
import {commercialKeys,commercialT} from "../../src/commercialTranslations";

describe("Inventory commercial locale parity",()=>{
 it("has the same translation keys in Russian, English and Georgian",()=>{
  const ru=new Set(commercialKeys("ru"));
  for(const locale of ["en","ka"] as const){
   expect(new Set(commercialKeys(locale))).toEqual(ru);
  }
 });
 it("contains no untranslated empty labels",()=>{
  for(const locale of ["ru","en","ka"] as const){
   for(const key of commercialKeys(locale)){
    const value=commercialT(locale,key);
    expect(value.trim().length,key).toBeGreaterThan(0);
   }
  }
 });
 it("has localized public and super-admin headings",()=>{
  for(const locale of ["ru","en","ka"] as const){
   expect(commercialT(locale,"heroTitle")).not.toEqual("heroTitle");
   expect(commercialT(locale,"adminTitle")).not.toEqual("adminTitle");
   expect(commercialT(locale,"planTitle")).not.toEqual("planTitle");
  }
 });
});
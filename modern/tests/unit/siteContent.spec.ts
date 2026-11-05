import {describe,it,expect} from "vitest";
import {commercialT,setCommercialSiteText} from "../../src/commercialTranslations";
describe("Website content overrides",()=>{
 it("overrides one locale and leaves other languages unchanged",()=>{
  const ru=commercialT("ru","heroTitle"),en=commercialT("en","heroTitle");
  setCommercialSiteText("ru",{heroTitle:"Контроль"});
  expect(commercialT("ru","heroTitle")).toBe("Контроль");
  expect(commercialT("en","heroTitle")).toBe(en);
  setCommercialSiteText("ru",{});
  expect(commercialT("ru","heroTitle")).toBe(ru);
 });
 it("falls back for missing keys",()=>{
  setCommercialSiteText("ka",{});
  expect(commercialT("ka","heroTitle").length).toBeGreaterThan(0);
 });
});

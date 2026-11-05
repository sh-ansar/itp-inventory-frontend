import {describe, expect, it} from "vitest";
import {formatStocktakeDate, scanUuid} from "../../src/utils/stocktakeFormat";

describe("stocktake QR and locale formatting",()=>{
  it("extracts only a UUID from the QR payload",()=>{
    const id="123e4567-e89b-12d3-a456-426614174000";
    expect(scanUuid("/inventory/scan/"+id)).toBe(id);
    expect(scanUuid("ABC-123")).toBeNull();
  });
  it("shows empty date consistently in all locales",()=>{
    for(const locale of ["ru","en","ka"] as const)
      expect(formatStocktakeDate(null,locale)).toBe("—");
  });
});

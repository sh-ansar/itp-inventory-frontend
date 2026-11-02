import { describe, expect, it } from "vitest";
import { bulkQrPrintDocument, inventoryQrUrl } from "../../src/utils/inventoryQr";
import type { PrintableQrLabel } from "../../src/utils/inventoryQr";

const label = (name="Laptop"):PrintableQrLabel => ({
  publicId:"abc-123", inventoryNumber:"INV-001", name,
  image:"data:image/png;base64,aGVsbG8=",
});

describe("Inventory batch QR printing", () => {
  it("builds only same-origin scan routes and encodes public IDs", () => {
    expect(inventoryQrUrl("abc/def?x=1", "/inventory/", "https://platform.itpmining.kz"))
      .toBe("https://platform.itpmining.kz/inventory/scan/abc%2Fdef%3Fx%3D1");
    expect(inventoryQrUrl("abc", "/inventory", "https://platform.itpmining.kz"))
      .toBe("https://platform.itpmining.kz/inventory/scan/abc");
    expect(inventoryQrUrl("  ", "/inventory/", "https://platform.itpmining.kz")).toBe("");
  });

  it("renders one printable A4 label per selected asset without remote resources", () => {
    const result=bulkQrPrintDocument([label(),{...label(),publicId:"other",inventoryNumber:"INV-002"}],"ru");
    expect(result).toContain("@page{size:A4 portrait");
    expect((result.match(/<article class="qr-label">/g)||[])).toHaveLength(2);
    expect(result).toContain("INV-002");
    expect(result).not.toContain('src="http');
    expect(result).not.toContain("<script");
  });

  it("escapes untrusted asset names and inventory numbers in the print document", () => {
    const result=bulkQrPrintDocument([{
      ...label('<script>alert("x")</script>'),
      inventoryNumber:'INV-"><img src=x onerror=alert(1)>',
    }],"en");
    expect(result).not.toContain("<script>");
    const html = new DOMParser().parseFromString(result, "text/html");
    expect(html.querySelectorAll("img")).toHaveLength(1);
    expect(html.querySelector("[onerror]")).toBeNull();
    expect(result).toContain("&lt;img src=x onerror");
    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("&quot;");
  });

  it("refuses zero, excessive or remote-image batches", () => {
    expect(() => bulkQrPrintDocument([],"ru")).toThrow();
    expect(() => bulkQrPrintDocument(Array.from({length:31},()=>label()),"ru")).toThrow();
    expect(() => bulkQrPrintDocument([{...label(),image:"https://example.com/a.png"}],"ru")).toThrow();
  });
});

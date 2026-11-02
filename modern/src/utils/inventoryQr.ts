/** Inventory QR routes remain company-scoped after sign-in; QR itself grants no access. */
export function inventoryQrUrl(publicId: string, basePath: string, origin: string): string {
  if (!publicId.trim()) return "";
  const path = basePath.endsWith("/") ? basePath : basePath + "/";
  return new URL(path + "scan/" + encodeURIComponent(publicId), origin).href;
}

export interface PrintableQrLabel {
  publicId: string;
  inventoryNumber: string;
  name: string;
  image: string;
}

const htmlEscape = (value: string): string =>
  value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);

/** Creates a self-contained, printable A4 sheet, never an external-resource document. */
export function bulkQrPrintDocument(labels: PrintableQrLabel[], locale: string): string {
  if (!labels.length || labels.length > 30) throw new Error("Invalid QR batch size");
  const safeLocale = ["ru", "en", "ka"].includes(locale) ? locale : "ru";
  const rows = labels.map(label => {
    // QR images are generated in-app; never embed arbitrary HTTP URLs in a print window.
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(label.image)) {
      throw new Error("Invalid QR image");
    }
    return [
      '<article class="qr-label">',
      '<img alt="QR" src="' + label.image + '">',
      '<div class="detail"><strong class="brand">ITP Inventory</strong>',
      '<strong class="number">' + htmlEscape(label.inventoryNumber) + '</strong>',
      '<span class="name">' + htmlEscape(label.name) + '</span></div>',
      '</article>',
    ].join("");
  }).join("");
  return [
    '<!doctype html><html lang="' + safeLocale + '"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>ITP Inventory QR</title>',
    '<style>',
    '@page{size:A4 portrait;margin:11mm}',
    '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#062739;',
    'font-family:Arial,Helvetica,sans-serif}',
    '.sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm;align-content:start}',
    '.qr-label{width:88mm;height:56mm;padding:3mm;border:1px solid #bac6ce;border-radius:2mm;',
    'display:grid;grid-template-columns:42mm minmax(0,1fr);gap:2mm;',
    'break-inside:avoid;page-break-inside:avoid;overflow:hidden;background:white}',
    '.qr-label img{width:42mm;height:42mm;object-fit:contain;align-self:center}',
    '.detail{display:flex;flex-direction:column;min-width:0;gap:3mm;justify-content:center}',
    '.brand{font-size:9pt}.number{font-size:10pt;overflow-wrap:anywhere}',
    '.name{font-size:8pt;line-height:1.35;max-height:30mm;overflow:hidden;overflow-wrap:anywhere}',
    '@media screen{body{padding:15px}.sheet{max-width:190mm;margin:0 auto}}',
    '</style></head><body><main class="sheet">', rows, '</main></body></html>',
  ].join("");
}

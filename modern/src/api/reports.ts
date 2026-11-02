import { inventoryRequest } from "./client";

export interface SummaryGroup {
  id:string|null;
  name:string|null;
  total:number;
}
export interface WarehouseUnitQuantity {
  unit:string;items:number;quantity_milli:number;
}
export interface WarehouseSummaryRow {
  id:string;name:string|null;items:number;
  // Null when different units coexist; never add kg to pieces.
  quantity_milli:number|null;
  unit?:string|null;
  unit_quantities?:WarehouseUnitQuantity[];
}
export interface InventorySummary {
  generated_at:string;
  company:{id:string;name:string};
  filters:Record<string,string>;
  assets:{
    total:number;
    by_status:SummaryGroup[];
    by_category:SummaryGroup[];
    by_facility:SummaryGroup[];
    by_responsible:SummaryGroup[];
  };
  warehouses:{
    total_items:number;
    low_stock_items:number;
    by_warehouse:WarehouseSummaryRow[];
  };
  stocktakes:Array<{status:string;sessions:number;items:number;counted:number;discrepancies:number}>;
}
export interface SummaryFilters {
  status?:string;
  facility_node_id?:string;
  responsible_person_id?:string;
  statuses?:string[];
  facility_node_ids?:string[];
  responsible_person_ids?:string[];
}
const root=(companyId:string)=>"/api/v1/companies/"+encodeURIComponent(companyId)+"/reports/summary";
const queryOf=(filters:SummaryFilters):string=>{
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(filters)){
    if(Array.isArray(value)){for(const item of value)params.append(key+"[]",item)}
    else if(value)params.set(key,value);
  }
  return params.toString()?"?"+params:"";
};
export async function getInventorySummary(companyId:string,filters:SummaryFilters,signal?:AbortSignal){
  return inventoryRequest<{data:InventorySummary}>(root(companyId)+queryOf(filters),{signal});
}
export const summaryCsvHref=(companyId:string,filters:SummaryFilters)=>
  "/inventory-api"+root(companyId)+".csv"+queryOf(filters);

export type ReportLocale="ru"|"en"|"ka";
const units:Record<ReportLocale,Record<string,string>>={
  ru:{pcs:"шт.",pack:"уп.",kg:"кг",m:"м",l:"л"},
  en:{pcs:"pcs",pack:"pack",kg:"kg",m:"m",l:"L"},
  ka:{pcs:"ც",pack:"შეკ.",kg:"კგ",m:"მ",l:"ლ"},
};
export function warehouseQuantityText(row:WarehouseSummaryRow,locale:ReportLocale):string{
  const parts=row.unit_quantities ??
    (typeof row.quantity_milli==="number"
      ? [{unit:row.unit||"",items:row.items,quantity_milli:row.quantity_milli}]
      : []);
  if(!parts.length)return "—";
  const formatter=new Intl.NumberFormat(locale==="ka"?"ka-GE":locale==="en"?"en-GB":"ru-RU",
    {minimumFractionDigits:0,maximumFractionDigits:3});
  return parts.map(item=>{
    const amount=formatter.format(item.quantity_milli/1000);
    const unit=units[locale][item.unit]||item.unit;
    return amount+(unit?" "+unit:"");
  }).join(" · ");
}
const statusNames:Record<ReportLocale,Record<string,string>>={
  ru:{active:"На учёте",written_off:"Списано",disposed:"Утилизировано",
      in_progress:"В процессе",completed:"Завершена",draft:"Черновик",approved:"Согласовано",submitted:"На согласовании"},
  en:{active:"Active",written_off:"Written off",disposed:"Disposed",
      in_progress:"In progress",completed:"Completed",draft:"Draft",approved:"Approved",submitted:"Submitted"},
  ka:{active:"აღრიცხვაზე",written_off:"ჩამოწერილია",disposed:"უტილიზებულია",
      in_progress:"მიმდინარე",completed:"დასრულებულია",draft:"პროექტი",approved:"დამტკიცებულია",submitted:"გაგზავნილია"},
};
export const summaryStatusLabel=(code:string,locale:ReportLocale):string=>
  statusNames[locale][code]??code;

const escapeHtml=(value:unknown):string=>String(value??"").replace(/[&<>"']/g,character=>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]??character));

/** Print-ready standalone HTML without third-party resources or unsafe interpolations. */
export function summaryPrintDocument(report:InventorySummary,locale:ReportLocale):string{
  const words=locale==="ka"
    ? {title:"ქონების შეჯამება",total:"სულ აქტივები",status:"სტატუსების მიხედვით",category:"კატეგორიების მიხედვით",
      facility:"ობიექტების მიხედვით",person:"პასუხისმგებელი პირები",unassigned:"მითითებული არ არის",
      name:"დასახელება",count:"რაოდენობა",stock:"საწყობები",items:"პოზიციები",quantity:"რაოდენობა",sessions:"ინვენტარიზაციები",
      expected:"გეგმური",counted:"დათვლილი",discrepancies:"სხვაობა",date:"შედგენილია"}
    : locale==="en"
      ? {title:"Inventory summary report",total:"Total assets",status:"By status",category:"By category",
        facility:"By facility",person:"By custodian",unassigned:"Unassigned",name:"Name",count:"Count",
        stock:"Warehouses",items:"SKUs",quantity:"Quantity",sessions:"Stocktakes",
        expected:"Expected",counted:"Counted",discrepancies:"Discrepancies",date:"Generated"}
      : {title:"Сводный отчёт об имуществе",total:"Всего активов",status:"По статусам",category:"По категориям",
        facility:"По объектам",person:"По ответственным",unassigned:"Не назначено",name:"Наименование",count:"Количество",
        stock:"Склады",items:"Позиций",quantity:"Количество",sessions:"Инвентаризации",
        expected:"По плану",counted:"Проверено",discrepancies:"Расхождения",date:"Сформирован"};

  const group=(title:string,rows:SummaryGroup[],isStatus=false):string=>
    "<section><h2>"+escapeHtml(title)+"</h2><table><thead><tr><th>"+escapeHtml(words.name)+"</th><th>"+escapeHtml(words.count)+
    "</th></tr></thead><tbody>"+rows.map(row=>"<tr><td>"+escapeHtml(isStatus&&row.name ? summaryStatusLabel(row.name,locale) : row.name||words.unassigned)+
      "</td><td class=\"num\">"+row.total+"</td></tr>").join("")+"</tbody></table></section>";

  const stockRows=report.warehouses.by_warehouse.map(row=>
    "<tr><td>"+escapeHtml(row.name||words.unassigned)+"</td><td class=\"num\">"+row.items+
    "</td><td class=\"num\">"+escapeHtml(warehouseQuantityText(row,locale))+"</td></tr>").join("");
  const sessionRows=report.stocktakes.map(row=>
    "<tr><td>"+escapeHtml(summaryStatusLabel(row.status,locale))+"</td><td class=\"num\">"+row.sessions+"</td><td class=\"num\">"+
    row.items+"</td><td class=\"num\">"+row.counted+"</td><td class=\"num\">"+row.discrepancies+"</td></tr>").join("");

  return [
    '<!doctype html><html lang="'+locale+'"><head><meta charset="utf-8">',
    '<title>'+escapeHtml(words.title)+' - '+escapeHtml(report.company.name)+'</title>',
    '<style>@page{size:A4 portrait;margin:13mm}*{box-sizing:border-box}body{font:11pt Arial,sans-serif;color:#172b3b;background:#fff;line-height:1.4;margin:0}',
    'header{border-bottom:2px solid #adc5d6;padding-bottom:10px;margin-bottom:15px}h1{font-size:18pt;margin:0 0 5px}h2{font-size:12pt;margin:20px 0 7px}',
    '.meta{font-size:9pt;color:#536b7e}.total{font-size:14pt;font-weight:700;margin:10px 0 18px}',
    'table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt}th,td{border:1px solid #cbd8e2;padding:6px 8px;text-align:left;overflow-wrap:anywhere}',
    'th{background:#eef4f8}.num{text-align:right;white-space:nowrap}section{break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}',
    '@media screen{body{max-width:880px;margin:24px auto;padding:12px}}</style></head><body>',
    '<header><h1>'+escapeHtml(words.title)+'</h1><strong>'+escapeHtml(report.company.name)+'</strong>',
    '<div class="meta">'+escapeHtml(words.date)+': '+escapeHtml(new Date(report.generated_at).toLocaleString(locale==="ka"?"ka-GE":locale==="en"?"en-GB":"ru-RU"))+'</div></header>',
    '<div class="total">'+escapeHtml(words.total)+': '+report.assets.total+'</div>',
    group(words.status,report.assets.by_status,true),
    group(words.category,report.assets.by_category),
    group(words.facility,report.assets.by_facility),
    group(words.person,report.assets.by_responsible),
    '<section><h2>'+escapeHtml(words.stock)+'</h2><table><thead><tr><th>'+escapeHtml(words.name)+'</th><th>'+escapeHtml(words.items)+'</th><th>'+escapeHtml(words.quantity)+'</th></tr></thead><tbody>'+stockRows+'</tbody></table></section>',
    '<section><h2>'+escapeHtml(words.sessions)+'</h2><table><thead><tr><th>'+escapeHtml(words.status)+'</th><th>'+escapeHtml(words.count)+'</th><th>'+escapeHtml(words.expected)+'</th><th>'+escapeHtml(words.counted)+'</th><th>'+escapeHtml(words.discrepancies)+'</th></tr></thead><tbody>'+sessionRows+'</tbody></table></section>',
    '</body></html>',
  ].join("");
}

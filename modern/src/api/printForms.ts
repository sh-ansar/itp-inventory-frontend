import { inventoryRequest } from "./client";
import { summaryStatusLabel } from "./reports";
import type { ReportLocale } from "./reports";

export const PRINT_FORM_KINDS = [
  "asset-register", "by-facility", "by-custodian",
  "warehouse-balances", "stocktake-act", "disposal-register",
] as const;
export type PrintFormKind = typeof PRINT_FORM_KINDS[number];
export type PrintFormFilters = {
  status?:string; search?:string; facility_node_id?:string;
  responsible_person_id?:string; warehouse_node_id?:string;
  session_id?:string; disposal_status?:string;
};
export interface DetailedPrintReport {
  kind:PrintFormKind;
  company:{id:string;name:string};
  generated_at:string;
  filters:PrintFormFilters;
  context:Record<string,unknown>;
  row_count:number;
  limit:number;
  rows:Array<Record<string,unknown>>;
}
export type PrintFilterNames = {facility?:string;custodian?:string;warehouse?:string};

export async function getDetailedPrintReport(
  companyId:string,kind:PrintFormKind,filters:PrintFormFilters,signal?:AbortSignal,
):Promise<DetailedPrintReport>{
  const query=new URLSearchParams();
  for(const [key,val] of Object.entries(filters))if(val)query.set(key,val);
  const url="/api/v1/companies/"+encodeURIComponent(companyId)+"/reports/forms/"+
    encodeURIComponent(kind)+(query.size?"?"+query:"");
  const response=await inventoryRequest<{data:DetailedPrintReport}>(url,{signal});
  if(response.data.kind!==kind||response.data.company.id!==companyId||
    response.data.rows.length!==response.data.row_count)throw new Error("Invalid detailed print response");
  return response.data;
}

const escapeHtml=(value:unknown):string=>String(value??"")
  .replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]??ch));
const getString=(row:Record<string,unknown>,key:string)=>String(row[key]??"");
const getNumber=(row:Record<string,unknown>,key:string):number=>{
  const n=Number(row[key]??0);return Number.isFinite(n)?n:0;
};
const dateLabel=(value:unknown,locale:ReportLocale):string=>{
  if(!value)return "—";
  const date=new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(locale==="ka"?"ka-GE":locale==="en"?"en-GB":"ru-RU") : String(value);
};
const numberLabel=(value:number,locale:ReportLocale)=>new Intl.NumberFormat(
  locale==="ka"?"ka-GE":locale==="en"?"en-GB":"ru-RU",{maximumFractionDigits:3,minimumFractionDigits:0},
).format(value);
const quantity=(milli:unknown,locale:ReportLocale)=>numberLabel(Number(milli??0)/1000,locale);
const nonEmpty=(value:unknown)=>value===null||value===undefined||value===""?"—":String(value);

const labels={
  ru:{
    company:"Организация",made:"Сформировано",formNumber:"№ документа",date:"Дата",
    name:"Наименование",number:"Инв. №",serial:"Серийный №",category:"Тип имущества",
    facility:"Объект / помещение",custodian:"МОЛ / ответственный",status:"Статус",
    count:"Позиций",filter:"Параметры отбора",all:"Все",noData:"Нет записей для выбранных параметров",
    draft:"ПРЕДВАРИТЕЛЬНАЯ ФОРМА",note:"Сформировано системой. Подписи и утверждения не проставлены.",
    author:"Составил",commission:"Члены комиссии",receiver:"Материально ответственное лицо",
    approved:"Утвердил",signature:"Подпись / ФИО",totals:"Итого записей",
    unit:"Ед.",quantity:"Остаток",minimum:"Минимум",shortage:"Контроль остатка",
    low:"Ниже минимума",normal:"В норме",locationExpected:"Местонахождение по учёту",
    locationActual:"Фактическое местонахождение",result:"Результат",matched:"Совпадает",
    discrepancy:"Расхождение",uncounted:"Не проверено",noteColumn:"Примечание",
    reportStatus:"Этап",reason:"Основание",order:"Приказ №",act:"Акт №",
    method:"Метод",createdBy:"Начал",completedBy:"Завершил",period:"Период",
    formTitle:{
      "asset-register":"Реестр имущества",
      "by-facility":"Ведомость имущества по объектам",
      "by-custodian":"Ведомость по материально ответственным лицам",
      "warehouse-balances":"Ведомость складских остатков",
      "stocktake-act":"Акт инвентаризации / сличительная ведомость",
      "disposal-register":"Реестр документов на списание",
    },
  },
  en:{
    company:"Company",made:"Generated",formNumber:"Document No.",date:"Date",
    name:"Description",number:"Inventory No.",serial:"Serial No.",category:"Asset type",
    facility:"Facility / room",custodian:"Custodian",status:"Status",count:"Lines",
    filter:"Filters",all:"All",noData:"No records match the selected criteria",
    draft:"PRELIMINARY / UNAPPROVED",note:"System-generated internal form. No approvals or signatures are implied.",
    author:"Prepared by",commission:"Commission",receiver:"Custodian",approved:"Approved by",signature:"Signature / Name",
    totals:"Total lines",unit:"Unit",quantity:"Balance",minimum:"Minimum",shortage:"Stock check",
    low:"Below minimum",normal:"Normal",locationExpected:"Expected location",
    locationActual:"Actual location",result:"Result",matched:"Matched",discrepancy:"Discrepancy",
    uncounted:"Not checked",noteColumn:"Notes",reportStatus:"Stage",reason:"Reason",
    order:"Order No.",act:"Act No.",method:"Method",createdBy:"Started by",completedBy:"Completed by",period:"Period",
    formTitle:{
      "asset-register":"Asset register",
      "by-facility":"Assets by facility",
      "by-custodian":"Custodian asset register",
      "warehouse-balances":"Warehouse balance statement",
      "stocktake-act":"Stocktake act / reconciliation statement",
      "disposal-register":"Asset disposal register",
    },
  },
  ka:{
    company:"ორგანიზაცია",made:"შედგენილია",formNumber:"დოკუმენტის №",date:"თარიღი",
    name:"დასახელება",number:"საინვენტარო №",serial:"სერიული №",category:"ქონების ტიპი",
    facility:"ობიექტი / ოთახი",custodian:"პასუხისმგებელი",status:"სტატუსი",
    count:"პოზიციები",filter:"ფილტრები",all:"ყველა",noData:"შერჩეული პარამეტრებით ჩანაწერები არ არის",
    draft:"წინასწარი ფორმა",note:"ფორმა შექმნილია სისტემაში. ხელმოწერა ან დამტკიცება არ არის დადასტურებული.",
    author:"შეადგინა",commission:"კომისია",receiver:"პასუხისმგებელი პირი",
    approved:"დაამტკიცა",signature:"ხელმოწერა / სახელი",totals:"სულ პოზიციები",
    unit:"ერთ.",quantity:"ნაშთი",minimum:"მინიმუმი",shortage:"ნაშთის კონტროლი",
    low:"მინიმუმზე ნაკლები",normal:"ნორმაში",locationExpected:"აღრიცხვის ადგილი",
    locationActual:"ფაქტობრივი ადგილი",result:"შედეგი",matched:"ემთხვევა",
    discrepancy:"განსხვავება",uncounted:"შეუმოწმებელია",noteColumn:"შენიშვნა",
    reportStatus:"ეტაპი",reason:"მიზეზი",order:"ბრძანება №",act:"აქტი №",
    method:"მეთოდი",createdBy:"დაიწყო",completedBy:"დაასრულა",period:"პერიოდი",
    formTitle:{
      "asset-register":"ქონების რეესტრი",
      "by-facility":"ქონება ობიექტების მიხედვით",
      "by-custodian":"ქონება პასუხისმგებელი პირების მიხედვით",
      "warehouse-balances":"საწყობის ნაშთების უწყისი",
      "stocktake-act":"ინვენტარიზაციის აქტი / შედარების უწყისი",
      "disposal-register":"ჩამოწერის დოკუმენტების რეესტრი",
    },
  },
};
export const printFormTitle=(kind:PrintFormKind,locale:ReportLocale):string=>
  labels[locale].formTitle[kind];
const disposalStatus=(value:string,locale:ReportLocale)=>{
  const known={
    ru:{draft:"Черновик",submitted:"На согласовании",approved:"Согласовано",disposed:"Завершено"},
    en:{draft:"Draft",submitted:"Submitted",approved:"Approved",disposed:"Disposed"},
    ka:{draft:"პროექტი",submitted:"გაგზავნილია",approved:"დამტკიცებულია",disposed:"ჩამოწერილია"},
  };
  return known[locale][value as keyof typeof known.ru]??value;
};

function dataTable(columns:string[],rows:string[][],empty:string):string{
  return '<table><thead><tr>'+columns.map(x=>'<th>'+escapeHtml(x)+'</th>').join("")+
    '</tr></thead><tbody>'+(
      rows.length?rows.map(cells=>'<tr>'+cells.map((cell,i)=>
        '<td'+(i===0?' class="number"':'')+'>'+cell+'</td>').join("")+'</tr>').join("")
        :'<tr><td colspan="'+columns.length+'" class="empty">'+escapeHtml(empty)+'</td></tr>'
    )+'</tbody></table>';
}
function groupBy(
  rows:Array<Record<string,unknown>>,key:string,unassigned:string,
):Array<{name:string;rows:Array<Record<string,unknown>>}>{
  const groups=new Map<string,Array<Record<string,unknown>>>();
  for(const row of rows){
    const name=String(row[key]??"").trim()||unassigned;
    const list=groups.get(name);
    if(list)list.push(row);else groups.set(name,[row]);
  }
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,items])=>({name,rows:items}));
}

/** Signed forms are NOT created here. This is a print preview populated with factual data. */
export function renderDetailedPrintDocument(
  report:DetailedPrintReport,locale:ReportLocale,selected:PrintFilterNames={},
):string{
  const t=labels[locale];
  const esc=(x:unknown)=>escapeHtml(nonEmpty(x));
  const title=t.formTitle[report.kind];
  const rows=report.rows;
  const assetColumns=[t.number,t.name,t.serial,t.category,t.facility,t.custodian,t.status];
  const assetCells=(row:Record<string,unknown>)=>[
    esc(row.inventory_number),esc(row.name),esc(row.serial_number),esc(row.category_name),
    esc(row.facility_name),esc(row.responsible_person_name),
    escapeHtml(summaryStatusLabel(getString(row,"status"),locale)),
  ];
  let tables="";
  let summary="";
  const isPreliminary=report.kind==="disposal-register"?
    rows.some(row=>getString(row,"case_status")!=="disposed"):
    report.kind==="stocktake-act"&&getString(report.context,"session_status")!=="completed";
  if(report.kind==="asset-register"){
    tables=dataTable(assetColumns,rows.map(assetCells),t.noData);
  }else if(report.kind==="by-facility"||report.kind==="by-custodian"){
    const groupKey=report.kind==="by-facility"?"facility_name":"responsible_person_name";
    const columns=report.kind==="by-facility"
      ?[t.number,t.name,t.serial,t.category,t.custodian,t.status]
      :[t.number,t.name,t.serial,t.category,t.facility,t.status];
    tables=groupBy(rows,groupKey,t.all).map(group=>
      '<section class="group"><h2>'+escapeHtml(group.name)+
      ' <small>('+group.rows.length+')</small></h2>'+
      dataTable(columns,group.rows.map(row=>[
        esc(row.inventory_number),esc(row.name),esc(row.serial_number),
        esc(row.category_name),esc(report.kind==="by-facility"
          ?row.responsible_person_name:row.facility_name),
        escapeHtml(summaryStatusLabel(getString(row,"status"),locale)),
      ]),t.noData)+'</section>').join("");
    if(!tables)tables=dataTable(columns,[],t.noData);
  }else if(report.kind==="warehouse-balances"){
    const columns=[t.number,t.name,t.unit,t.quantity,t.minimum,t.shortage];
    tables=groupBy(rows,"warehouse_name",t.all).map(group=>
      '<section class="group"><h2>'+escapeHtml(group.name)+
      ' <small>('+group.rows.length+')</small></h2>'+
      dataTable(columns,group.rows.map(row=>{
        const low=getNumber(row,"minimum_quantity_milli")>0&&
          getNumber(row,"quantity_milli")<getNumber(row,"minimum_quantity_milli");
        return [esc(row.code),esc(row.name),esc(row.unit),
          escapeHtml(quantity(row.quantity_milli,locale)),
          escapeHtml(quantity(row.minimum_quantity_milli,locale)),
          '<span class="'+(low?"warning":"")+'">'+escapeHtml(low?t.low:t.normal)+'</span>'];
      }),t.noData)+'</section>').join("");
    if(!tables)tables=dataTable(columns,[],t.noData);
  }else if(report.kind==="stocktake-act"){
    const context=report.context;
    summary='<div class="document-context"><strong>'+esc(context.session_name)+'</strong>'+
      '<span>'+escapeHtml(t.status)+': '+
      escapeHtml(getString(context,"session_status")==="completed"?
        (locale==="en"?"Completed":locale==="ka"?"დასრულებულია":"Завершена"):
        (locale==="en"?"In progress":locale==="ka"?"მიმდინარე":"В процессе"))+
      '</span><span>'+escapeHtml(t.facility)+': '+esc(context.scope_name)+'</span>'+
      '<span>'+escapeHtml(t.count)+': '+esc(context.total_items)+
      ' · '+escapeHtml(t.result)+': '+esc(context.counted_items)+
      ' · '+escapeHtml(t.discrepancy)+': '+esc(context.discrepancies)+'</span></div>';
    tables=dataTable([
      t.number,t.name,t.locationExpected,t.locationActual,t.result,t.noteColumn,
    ],rows.map(row=>[
      esc(row.inventory_number),esc(row.name),esc(row.expected_name),
      row.is_counted?esc(row.actual_name):"—",
      escapeHtml(!row.is_counted?t.uncounted:row.is_discrepancy?t.discrepancy:t.matched),
      esc(row.note),
    ]),t.noData);
  }else{
    tables=dataTable([
      t.number,t.name,t.facility,t.custodian,t.reportStatus,
      t.reason,t.order,t.act,
    ],rows.map(row=>[
      esc(row.inventory_number),esc(row.name),esc(row.facility_name),
      esc(row.responsible_person_name),
      escapeHtml(disposalStatus(getString(row,"case_status"),locale)),
      esc(row.reason),esc(row.order_number),esc(row.disposal_act_number),
    ]),t.noData);
  }
  const applied:string[]=[];
  if(report.filters.status)applied.push(t.status+": "+summaryStatusLabel(report.filters.status,locale));
  if(report.filters.disposal_status)applied.push(t.reportStatus+": "+
    disposalStatus(report.filters.disposal_status,locale));
  if(report.filters.facility_node_id)applied.push(t.facility+": "+(selected.facility||"—"));
  if(report.filters.responsible_person_id)applied.push(t.custodian+": "+(selected.custodian||"—"));
  if(report.filters.warehouse_node_id)applied.push(t.facility+": "+(selected.warehouse||"—"));
  if(report.filters.search)applied.push(t.filter+": "+report.filters.search);
  const date=dateLabel(report.generated_at,locale);
  const signatures=[t.author,t.receiver,t.commission,t.approved].map(label=>
    '<div class="signature"><span>'+escapeHtml(label)+'</span><div class="signature-line"></div>'+
    '<small>'+escapeHtml(t.signature)+'</small></div>').join("");
  const isLandscape=report.kind!=="stocktake-act";
  return [
    '<!doctype html><html lang="'+locale+'"><head><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;">',
    '<title>'+escapeHtml(title)+' — '+escapeHtml(report.company.name)+'</title>',
    '<style>',
    '@page{size:A4 '+(isLandscape?"landscape":"portrait")+';margin:13mm 12mm}',
    '*{box-sizing:border-box}html{background:white}body{margin:0;font:10pt Arial,Helvetica,sans-serif;color:#183046;line-height:1.4}',
    '.document{max-width:1150px;margin:0 auto;background:#fff}',
    '.document-head{display:flex;justify-content:space-between;gap:22px;border-bottom:2px solid #197db9;padding-bottom:12px;margin-bottom:14px}',
    '.brand{color:#197db9;font-size:10pt;font-weight:700}.company{margin:3px 0 0;font-size:10pt}',
    'h1{font-size:17pt;line-height:1.2;margin:4px 0 0;font-weight:700;color:#183046}',
    '.doc-number{text-align:right;min-width:135px;color:#42576b;font-size:9pt}',
    '.doc-number div{margin-bottom:5px}.meta{display:flex;gap:14px;flex-wrap:wrap;padding:8px 0 11px;font-size:9pt;color:#42576b}',
    '.draft{padding:7px 12px;margin:8px 0 12px;border:1px solid #d7a85d;background:#fff6e5;color:#865b1c;font-weight:700}',
    '.document-context{display:flex;flex-wrap:wrap;gap:9px 20px;padding:10px 0 15px;font-size:9pt}',
    'h2{font-size:11pt;margin:17px 0 7px;padding:0;font-weight:700}h2 small{font-size:8pt;color:#667c8b}',
    'table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.2pt;margin:0 0 11px}',
    'thead{display:table-header-group}th{background:#ebf3f8;border:1px solid #b8cad6;text-align:left;padding:5px 6px;font-weight:700}',
    'td{border:1px solid #b8cad6;padding:5px 6px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}',
    'tr{break-inside:avoid;page-break-inside:avoid}.number{white-space:normal;font-weight:600}',
    '.warning{color:#9a3d19;font-weight:700}.empty{text-align:center;color:#738796;padding:12px}',
    '.summary{border-top:1px solid #bdced9;font-size:10pt;font-weight:700;margin-top:12px;padding:10px 0}',
    '.disclaimer{font-size:8pt;color:#667c8b;margin:12px 0 18px}',
    '.signatures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 30px;margin-top:26px;break-inside:avoid}',
    '.signature span{display:block;font-weight:600;font-size:9pt}.signature-line{border-bottom:1px solid #617688;height:23px}',
    '.signature small{font-size:7pt;color:#738796}',
    '.group{break-inside:auto}.group h2{break-after:avoid;page-break-after:avoid}',
    '@media screen{body{background:#eef3f7;padding:22px}.document{padding:30px;box-shadow:0 8px 35px #18304618;border-radius:9px}}',
    '@media print{body{background:#fff}.document{max-width:none;padding:0;box-shadow:none}.draft{-webkit-print-color-adjust:exact;print-color-adjust:exact}}',
    '</style></head><body><main class="document">',
    '<div class="document-head"><div><div class="brand">ITP Inventory</div><h1>'+escapeHtml(title)+'</h1>'+
      '<p class="company">'+escapeHtml(t.company)+': <strong>'+escapeHtml(report.company.name)+'</strong></p></div>'+
      '<div class="doc-number"><div>'+escapeHtml(t.formNumber)+': __________</div><div>'+escapeHtml(t.date)+': '+escapeHtml(date)+'</div></div></div>',
    '<div class="meta"><span>'+escapeHtml(t.made)+': '+escapeHtml(date)+'</span>'+
      (applied.length?'<span>'+applied.map(escapeHtml).join(' · ')+'</span>':'')+'</div>',
    isPreliminary?'<div class="draft">'+escapeHtml(t.draft)+'</div>':'',
    summary,tables,
    '<div class="summary">'+escapeHtml(t.totals)+': '+escapeHtml(numberLabel(report.row_count,locale))+'</div>',
    '<div class="signatures">'+signatures+'</div>',
    '<p class="disclaimer">'+escapeHtml(t.note)+'</p>',
    '</main></body></html>',
  ].join("");
}

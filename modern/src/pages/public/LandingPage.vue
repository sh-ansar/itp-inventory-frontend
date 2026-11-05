<script setup lang="ts">
import {computed,reactive,ref} from "vue";
import {useRouter} from "vue-router";
import {Box,Boxes,Building2,Warehouse,ClipboardCheck,QrCode,FileCheck2,
  Users,BookOpen,BarChart3,ArrowRight,Search,RotateCcw,
  Settings,MapPinned,ChevronRight,CheckCircle2,MoveRight} from "lucide-vue-next";
import PublicLayout from "../../components/commercial/PublicLayout.vue";
import PublicTariffs from "../../components/commercial/PublicTariffs.vue";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";

type ModuleId="assets"|"disposals"|"facilities"|"references"|"people"|"warehouses"|"stocktakes"|"reports";
const ui=useUiSettings();
const faviconUrl=import.meta.env.BASE_URL+"favicon.svg";
const router=useRouter();
const t=(key:string)=>commercialT(ui.locale,key);
const icons={assets:Boxes,disposals:FileCheck2,facilities:Building2,references:BookOpen,
  people:Users,warehouses:Warehouse,stocktakes:ClipboardCheck,reports:BarChart3};
const modules:ModuleId[]=["assets","disposals","facilities","references","people","warehouses","stocktakes","reports"];
const groups:Record<ModuleId,string>={
  assets:"catalog",disposals:"operations",facilities:"catalog",references:"catalog",
  people:"catalog",warehouses:"operations",stocktakes:"operations",reports:"analytics",
};
const enabled=reactive<Record<ModuleId,boolean>>({
  assets:true,disposals:true,facilities:true,references:true,
  people:true,warehouses:true,stocktakes:true,reports:true,
});
const filter=ref("all");
const selectedCount=computed(()=>modules.filter(id=>enabled[id]).length);
const shownModules=computed(()=>modules.filter(id=>filter.value==="all"||groups[id]===filter.value));
const demoTab=ref<ModuleId>("assets");
const demoSearch=ref("");
const demoStatus=ref("all");
const accent=ref("#009cde");
const demoAssets=ref([
  {id:1,code:"INV-000142",ru:"Ноутбук Lenovo ThinkPad",en:"Lenovo ThinkPad laptop",ka:"Lenovo ThinkPad ლეპტოპი",loc:"A-201",owner:"А. Нургали",status:"inStock"},
  {id:2,code:"INV-000143",ru:"Монитор Dell 27″",en:"Dell 27″ monitor",ka:"Dell 27″ მონიტორი",loc:"A-201",owner:"Н. Смирнов",status:"inStock"},
  {id:3,code:"INV-000144",ru:"Принтер HP LaserJet",en:"HP LaserJet printer",ka:"HP LaserJet პრინტერი",loc:"B-102",owner:"А. Нургали",status:"checking"},
  {id:4,code:"INV-000145",ru:"Сервер HPE ProLiant",en:"HPE ProLiant server",ka:"HPE ProLiant სერვერი",loc:"SERVER-1",owner:"IT",status:"inStock"},
  {id:5,code:"INV-000146",ru:"Сканер штрих-кодов",en:"Barcode scanner",ka:"შტრიხკოდის სკანერი",loc:"A-105",owner:"К. Алиев",status:"moved"},
]);
const names=computed(()=>demoAssets.value.filter(item=>
  (demoStatus.value==="all"||item.status===demoStatus.value) &&
  (item.code+" "+item[ui.locale]+" "+item.loc+" "+item.owner).toLowerCase().includes(demoSearch.value.toLowerCase().trim())));
const progress=computed(()=>Math.round(100*demoAssets.value.filter(item=>item.status==="inStock").length/demoAssets.value.length));
const cardTypes=[
  {id:"facilities",icon:MapPinned,title:"mapTitle",body:"mapText"},
  {id:"stocktakes",icon:QrCode,title:"scanTitle",body:"scanText"},
  {id:"reports",icon:BarChart3,title:"summaryTitle",body:"summaryText"},
] as const;
function reset(){
 filter.value="all";modules.forEach(id=>enabled[id]=true);
 demoSearch.value="";demoStatus.value="all";demoTab.value="assets";accent.value="#009cde";
 demoAssets.value=demoAssets.value.map(a=>({...a,status:a.id===3?"checking":a.id===5?"moved":"inStock"}));
}
function moveAsset(id:number){
 demoAssets.value=demoAssets.value.map(a=>a.id===id?{...a,status:a.status==="inStock"?"checking":"inStock"}:a);
}
function visitDemo(id:string){
 if(modules.includes(id as ModuleId))demoTab.value=id as ModuleId;
 document.getElementById("demo")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});
}
</script>
<template>
<PublicLayout>
  <section id="product" class="inv-hero">
    <div class="inv-hero-illustration">
      <div class="inv-hero-gradient">
        <div class="inv-hero-floating inv-float-left"><Box :size="65" /></div>
        <div class="inv-hero-floating inv-float-right"><QrCode :size="62" /></div>
        <div class="inv-hero-screenshot">
          <div class="inv-screenshot-header">
            <img :src="faviconUrl" alt="" width="29" height="29"/>
            <b>ITP Inventory</b><span class="inv-faux-search"><Search :size="12" /> {{t("search")}}</span>
            <span class="inv-screenshot-avatar">IT</span>
          </div>
          <div class="inv-screenshot-body">
            <aside>
              <div v-for="id in ['assets','facilities','warehouses','stocktakes','reports']" :key="id"
                  :class="{'inv-mock-active':id==='assets'}">
                <component :is="icons[id as ModuleId]" :size="15"/>{{t(id)}}
              </div>
            </aside>
            <div class="inv-screenshot-table">
              <div class="inv-mock-title"><b>{{t("assets")}}</b><span>+ {{t("create")}}</span></div>
              <div v-for="item in demoAssets.slice(0,4)" :key="item.id" class="inv-mock-row">
                <span class="inv-mock-icon"><Box :size="15"/></span>
                <span>{{item[ui.locale]}}</span>
                <small>{{item.code}}</small>
                <i></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="inv-hero-copy">
      <span class="inv-eyebrow">{{t("brand")}} · {{t("heroSub")}}</span>
      <h1>{{t("heroTitle")}}</h1>
      <p>{{t("heroText")}}</p>
      <div class="inv-hero-actions">
        <RouterLink to="/auth/register" class="inv-btn inv-btn-primary">{{t("create")}} <ArrowRight :size="17"/></RouterLink>
        <a href="#demo" class="inv-btn inv-btn-secondary">{{t("explore")}}</a>
      </div>
    </div>
  </section>

  <section id="modules" class="inv-landing-container inv-possibilities">
    <header class="inv-section-title">
      <span class="inv-eyebrow">{{t("features")}}</span>
      <h2>{{t("cardsTitle")}}</h2>
      <p>{{t("cardsDescription")}}</p>
    </header>
    <div class="inv-bento-grid">
      <div class="inv-bento-config">
        <div class="inv-bento-intro"><h3>{{t("moduleTitle")}}</h3><p>{{t("moduleSubtitle")}}</p></div>
        <div class="inv-module-panel">
          <div class="inv-module-tabs" role="tablist" :aria-label="t('features')">
            <button v-for="id in ['all','catalog','operations','analytics']" :key="id"
              role="tab" type="button" :aria-selected="filter===id" :class="{'is-selected':filter===id}"
              @click="filter=id">{{t(id)}}</button>
          </div>
          <div class="inv-module-label"><strong>{{t("configure")}}</strong><span>{{selectedCount}} {{t("of")}} {{modules.length}}</span></div>
          <div class="inv-module-list">
            <label v-for="id in shownModules" :key="id" class="inv-module-row" :class="{'is-off':!enabled[id]}">
              <span class="inv-module-icon"><component :is="icons[id]" :size="18"/></span>
              <span>{{t(id)}}</span>
              <input v-model="enabled[id]" type="checkbox" :aria-label="t(id)" />
            </label>
          </div>
          <div class="inv-module-actions">
            <button type="button" @click="reset">{{t("reset")}}</button>
            <button type="button" @click="visitDemo('assets')">{{t("preview")}} <ArrowRight :size="16"/></button>
          </div>
        </div>
      </div>
      <button v-for="card in cardTypes" :key="card.id" type="button" class="inv-bento-card"
        :class="'inv-bento-'+card.id" @click="visitDemo(card.id)">
        <span class="inv-card-icon"><component :is="card.icon" :size="27" /></span>
        <div class="inv-card-visual" :class="'inv-visual-'+card.id">
          <template v-if="card.id==='facilities'">
            <div class="inv-building-roof"></div><div class="inv-building-windows">
              <span v-for="i in 12" :key="i"></span></div>
          </template>
          <template v-else-if="card.id==='stocktakes'">
            <QrCode :size="80" /><span>INV-000142</span>
          </template>
          <template v-else><div v-for="(h,i) in [38,68,44,84,57]" :key="i" :style="{height:h+'%'}"></div></template>
        </div>
        <h3>{{t(card.title)}}</h3>
        <p>{{t(card.body)}}</p>
        <span class="inv-feature-link">{{t("explore")}} <ArrowRight :size="15"/></span>
      </button>
    </div>
  </section>

  <section id="demo" class="inv-demo-section">
    <div class="inv-landing-container">
      <div class="inv-demo-header">
        <div><span class="inv-eyebrow">{{t("preview")}}</span><h2>{{t("demoTitle")}}</h2><p>{{t("demoDescription")}}</p></div>
        <button type="button" class="inv-btn inv-btn-secondary" @click="reset"><RotateCcw :size="16"/>{{t("resetDemo")}}</button>
      </div>
      <div class="inv-demo-frame" :style="{'--demo-accent':accent}">
        <div class="inv-demo-tabs" role="tablist" :aria-label="t('preview')">
          <button v-for="id in modules" :key="id" type="button" role="tab" :aria-selected="demoTab===id"
            :class="{'is-selected':demoTab===id}" @click="demoTab=id">
            <component :is="icons[id]" :size="16"/>{{t(id)}}
          </button>
        </div>
        <div class="inv-demo-frame-body">
          <p class="inv-demo-note"><CheckCircle2 :size="15"/>{{t("demoHint")}}</p>
          <template v-if="['assets','stocktakes','warehouses','disposals','references'].includes(demoTab)">
            <div class="inv-demo-actions">
              <label><Search :size="17" /><input v-model="demoSearch" type="search" :placeholder="t('search')" /></label>
              <select v-model="demoStatus" :aria-label="t('status')"><option value="all">{{t("all")}}</option>
                <option v-for="status in ['inStock','checking','moved']" :key="status" :value="status">{{t(status)}}</option>
              </select>
            </div>
            <div class="inv-demo-progress">
              <div><strong>{{t("inStock")}}</strong><span>{{progress}}%</span></div>
              <div role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
                <span :style="{width:progress+'%'}"></span></div>
            </div>
            <div class="inv-demo-table-wrap">
              <table class="inv-demo-table">
                <thead><tr><th>{{t("number")}}</th><th>{{t("assetName")}}</th><th>{{t("location")}}</th>
                  <th>{{t("responsible")}}</th><th>{{t("status")}}</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="item in names" :key="item.id">
                    <td>{{item.code}}</td><td><Box :size="16"/>{{item[ui.locale]}}</td>
                    <td>{{item.loc}}</td><td>{{item.owner}}</td>
                    <td><span class="inv-demo-pill">{{t(item.status)}}</span></td>
                    <td><button type="button" :aria-label="t('edit')+' '+item.code" @click="moveAsset(item.id)">
                      <MoveRight :size="17"/></button></td>
                  </tr>
                  <tr v-if="!names.length"><td colspan="6">{{t("noResults")}}</td></tr>
                </tbody>
              </table>
            </div>
          </template>
          <template v-else-if="demoTab==='facilities'">
            <div class="inv-demo-facilities">
              <div v-for="(floor,i) in 3" :key="floor"><Building2 :size="21"/>
                <div><b>{{t("facilities")}} · {{3-i}}</b><p>{{t("assets")}}: {{8+i*4}}</p></div>
                <ChevronRight :size="20"/></div>
            </div>
          </template>
          <template v-else-if="demoTab==='people'">
            <div class="inv-demo-facilities">
              <div v-for="(name,i) in ['А. Нургали','Н. Смирнов','К. Алиев']" :key="i"><Users :size="22"/>
                <div><b>{{name}}</b><p>{{t("assets")}}: {{i+2}}</p></div><ChevronRight :size="20"/></div>
            </div>
          </template>
          <template v-else-if="demoTab==='reports'">
            <div class="inv-demo-report">
              <h3>{{t("reports")}}</h3>
              <div class="inv-demo-chart">
                <span v-for="(h,i) in [35,69,55,87,63,90,71]" :key="i" :style="{height:h+'%'}"></span>
              </div>
              <div><span>{{t("assets")}}: 145</span><span>{{t("inStock")}}: 132</span><span>{{t("checking")}}: 13</span></div>
            </div>
          </template>
          <div class="inv-demo-footer">
            <span>{{t("onlyDemo")}}</span>
            <label><Settings :size="15" /> <input v-model="accent" type="color" :aria-label="t('configure')"/></label>
            <RouterLink to="/auth/register">{{t("signUp")}} <ArrowRight :size="15"/></RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="how-it-works" class="inv-steps inv-landing-container">
    <h2>{{t("howTitle")}}</h2>
    <ol><li v-for="(key,i) in ['step1','step2','step3','step4']" :key="key">
      <span>{{String(i+1).padStart(2,"0")}}</span><h3>{{t(key)}}</h3>
    </li></ol>
  </section>
  <section id="pricing" class="inv-public-pricing inv-landing-container">
    <div class="inv-section-title"><span class="inv-eyebrow">{{t("pricing")}}</span>
      <h2>{{t("planTitle")}}</h2><p>{{t("planText")}}</p></div>
    <PublicTariffs /><RouterLink class="inv-public-pricing-link" to="/pricing">
      {{t("plans")}} <ArrowRight :size="15" /></RouterLink>
  </section>
  <section class="inv-landing-cta">
    <h2>{{t("cta")}}</h2>
    <RouterLink to="/auth/register" class="inv-btn inv-btn-light">
      {{t("create")}} <ArrowRight :size="18" /></RouterLink>
  </section>
</PublicLayout>
</template>
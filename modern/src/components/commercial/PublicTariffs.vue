<script setup lang="ts">
import {computed,onMounted,ref} from "vue";
import {useRouter} from "vue-router";
import {Check,X} from "lucide-vue-next";
import {commercialApi} from "../../api/commercial";
import type {Plan} from "../../api/commercial";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";

const ui=useUiSettings();
const router=useRouter();
const t=(key:string)=>commercialT(ui.locale,key);
const plans=ref<Plan[]>([]);
const loading=ref(true);
const error=ref(false);
function language():string {return ui.locale==="ka"?"ge":ui.locale;}
function name(plan:Plan):string {return plan.terms.names?.[language()]||plan.terms.names?.en||plan.code;}
function money(plan:Plan):string {
 return new Intl.NumberFormat(ui.locale==="ka"?"ka-GE":ui.locale==="en"?"en-US":"ru-RU",{
  style:"currency",currency:plan.terms.currency,maximumFractionDigits:0,
 }).format(Number(plan.terms.price_minor||0)/100);
}
function limit(value:number|null|undefined,units=1):string {
 return value==null?t("unlimited"):new Intl.NumberFormat(ui.locale==="ka"?"ka-GE":ui.locale).format(value/units);
}
const modules=["assets","facilities","references","people","warehouses","stocktakes","reports","disposals"];
async function load(){
 loading.value=true;error.value=false;
 try {const result=await commercialApi.plans();plans.value=result.data.filter(plan=>plan.is_public&&plan.status==="published");}
 catch {error.value=true;}finally{loading.value=false;}
}
function choose(plan:Plan){
 sessionStorage.setItem("inventory.planCode",plan.code);
 void router.push({path:"/auth/register",query:{plan:plan.code}});
}
onMounted(load);
</script>
<template>
  <div class="inv-tariffs" :aria-busy="loading">
    <p v-if="loading" role="status">{{t("load")}}</p>
    <div v-else-if="error" role="alert" class="inv-error">
      {{t("planError")}} <button class="inv-btn inv-btn-secondary" type="button" @click="load">{{t("retry")}}</button>
    </div>
    <p v-else-if="!plans.length" class="inv-empty-plans">{{t("planEmpty")}}</p>
    <div v-else class="inv-tariff-grid">
      <article v-for="plan in plans" :key="plan.id" class="inv-tariff-card" :data-plan="plan.code">
        <div class="inv-tariff-eyebrow">{{plan.code.toUpperCase()}}</div>
        <h3>{{name(plan)}}</h3>
        <p class="inv-tariff-price">{{money(plan)}}</p>
        <p class="inv-tariff-note">{{t("perMonth")}} · {{plan.terms.period_months}}</p>
        <p v-if="plan.terms.description" class="inv-tariff-description">{{plan.terms.description}}</p>
        <dl class="inv-tariff-limits">
          <div><dt>{{t("users")}}</dt><dd>{{limit(plan.terms.limits?.users)}}</dd></div>
          <div><dt>{{t("companies")}}</dt><dd>{{limit(plan.terms.limits?.companies)}}</dd></div>
          <div><dt>{{t("storage")}}</dt><dd>{{limit(plan.terms.limits?.storage_bytes,1073741824)}} GiB</dd></div>
          <div><dt>{{t("fileLimit")}}</dt><dd>{{limit(plan.terms.limits?.max_file_bytes,1048576)}} MiB</dd></div>
        </dl>
        <ul class="inv-tariff-modules">
          <li v-for="module in modules" :key="module">
            <Check v-if="plan.terms.modules?.[module]" :size="17" aria-hidden="true" />
            <X v-else :size="17" class="inv-module-off" aria-hidden="true" />
            <span>{{t(module)}}</span>
          </li>
        </ul>
        <button type="button" class="inv-btn inv-btn-primary inv-tariff-choose" @click="choose(plan)">
          {{t("planChoose")}}
        </button>
      </article>
    </div>
    <p class="inv-tariff-help">{{t("noCommercial")}} <RouterLink to="/legal/tariff_policy">{{t("tariff_policy")}}</RouterLink></p>
  </div>
</template>
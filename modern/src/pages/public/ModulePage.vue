<script setup lang="ts">
import {computed} from "vue";
import {useRoute} from "vue-router";
import PublicLayout from "../../components/commercial/PublicLayout.vue";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";
const ui=useUiSettings(),route=useRoute();
const t=(k:string)=>commercialT(ui.locale,k);
const type=computed(()=>String(route.params.module||"assets"));
const descriptions:Record<string,string>={
 assets:"heroText",facilities:"mapText",stocktakes:"scanText",reports:"summaryText",
 warehouses:"heroText",people:"heroText",references:"heroText",disposals:"heroText",
};
</script>
<template><PublicLayout>
 <section class="inv-page-intro">
  <div class="inv-breadcrumb"><RouterLink to="/">{{t("home")}}</RouterLink> / {{t("features")}}</div>
  <span class="inv-eyebrow">{{t("brand")}}</span><h1>{{t(type)}}</h1>
  <p>{{t(descriptions[type]||"heroText")}}</p>
 </section>
 <section class="inv-secondary-page">
  <div class="inv-legal-body">
   <h2>{{t("moduleTitle")}}</h2>
   <p>{{t("moduleSubtitle")}}</p>
   <div style="display:flex;gap:12px;flex-wrap:wrap">
     <RouterLink to="/#demo" class="inv-btn inv-btn-secondary">{{t("preview")}}</RouterLink>
     <RouterLink to="/auth/login" class="inv-btn inv-btn-primary">{{t("openRegistry")}}</RouterLink>
   </div>
  </div>
 </section>
</PublicLayout></template>
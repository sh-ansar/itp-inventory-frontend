<script setup lang="ts">
import { useUiSettings } from "../../stores/uiSettings";
import { commercialT } from "../../commercialTranslations";
const ui=useUiSettings();
const t=(k:string)=>commercialT(ui.locale,k);
const modules=["assets","facilities","references","people","warehouses","stocktakes","reports","disposals"];
const docs=["offer","tariff_policy","acceptable_use","personal_data_consent","privacy"];
</script>
<template>
  <footer class="inv-public-footer">
    <div class="inv-footer-cols">
      <nav :aria-label="t('product')">
        <h2>{{t("product")}}</h2>
        <RouterLink to="/">{{t("home")}}</RouterLink>
        <RouterLink to="/#modules">{{t("features")}}</RouterLink>
        <RouterLink to="/pricing">{{t("plans")}}</RouterLink>
      </nav>
      <nav :aria-label="t('footerProducts')">
        <h2>{{t("footerProducts")}}</h2>
        <RouterLink v-for="module in modules.slice(0,4)" :key="module" :to="'/product/modules/'+module">{{t(module)}}</RouterLink>
      </nav>
      <nav :aria-label="t('operations')">
        <h2>{{t("operations")}}</h2>
        <RouterLink v-for="module in modules.slice(4)" :key="module" :to="'/product/modules/'+module">{{t(module)}}</RouterLink>
      </nav>
      <nav :aria-label="t('footerCompany')">
        <h2>{{t("footerCompany")}}</h2>
        <RouterLink to="/#how-it-works">{{t("howTitle")}}</RouterLink>
        <RouterLink to="/auth/register">{{t("signUp")}}</RouterLink>
        <RouterLink to="/auth/login">{{t("signIn")}}</RouterLink>
      </nav>
      <nav :aria-label="t('documents')">
        <h2>{{t("documents")}}</h2>
        <RouterLink v-for="doc in docs" :key="doc" :to="'/legal/'+doc">{{t(doc)}}</RouterLink>
      </nav>
      <nav :aria-label="t('resources')">
        <h2>{{t("resources")}}</h2>
        <RouterLink to="/#demo">{{t("preview")}}</RouterLink>
        <RouterLink to="/#pricing">{{t("pricing")}}</RouterLink>
        <RouterLink to="/legal">{{t("legalLabel")}}</RouterLink>
      </nav>
    </div>
    <div class="inv-footer-bottom">
      <span>© {{ new Date().getFullYear() }} ITP Mining · ITP Inventory</span>
      <RouterLink to="/legal/privacy">{{t("privacy")}}</RouterLink>
    </div>
  </footer>
</template>
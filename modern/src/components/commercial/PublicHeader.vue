<script setup lang="ts">
import { computed,onBeforeUnmount,onMounted,ref,watch } from "vue";
import { useRoute } from "vue-router";
import { Menu,ChevronDown,X } from "lucide-vue-next";
import { useUiSettings } from "../../stores/uiSettings";
import { commercialT } from "../../commercialTranslations";
import BaseDropdownSelect from "../ui/BaseDropdownSelect.vue";
import BaseButton from "../ui/BaseButton.vue";
import type { InventoryLocale } from "../../i18n";

const ui=useUiSettings();
const logoUrl=import.meta.env.BASE_URL+"brand/inventory-logo.svg";
const route=useRoute();
const t=(key:string)=>commercialT(ui.locale,key);
const mobileOpen=ref(false);
const hidden=ref(false);
const scrolled=ref(false);
const localeOptions=computed(()=>[
 {value:"ru",label:"RU"},{value:"en",label:"EN"},{value:"ka",label:"GE"},
]);
let lastY=0;
function scrollHandler(){
 const y=Math.max(0,window.scrollY);
 scrolled.value=y>14;
 if(y<96||mobileOpen.value){hidden.value=false;lastY=y;return;}
 if(Math.abs(y-lastY)<4)return;
 hidden.value=y>lastY;lastY=y;
}
function localeChanged(value:string){if(["ru","en","ka"].includes(value))ui.locale=value as InventoryLocale;}
onMounted(()=>{scrollHandler();window.addEventListener("scroll",scrollHandler,{passive:true})});
onBeforeUnmount(()=>window.removeEventListener("scroll",scrollHandler));
watch(()=>route.fullPath,()=>{mobileOpen.value=false;hidden.value=false});
</script>
<template>
  <header class="inv-public-header" :class="{ 'inv-public-header--hidden':hidden,'inv-public-header--scrolled':scrolled }">
    <RouterLink to="/" class="inv-public-brand" :aria-label="t('brand')">
      <img :src="logoUrl" alt="ITP Inventory" width="213" height="48" />
    </RouterLink>
    <nav class="inv-public-nav" :aria-label="t('product')">
      <RouterLink to="/#product">{{t("product")}}</RouterLink>
      <RouterLink to="/#modules">{{t("features")}}</RouterLink>
      <RouterLink to="/#demo">{{t("preview")}}</RouterLink>
      <RouterLink to="/pricing">{{t("plans")}}</RouterLink>
    </nav>
    <div class="inv-public-actions">
      <div class="inv-public-lang">
        <BaseDropdownSelect :model-value="ui.locale" :options="localeOptions"
          :locale="ui.locale" :label="t('language')" @update:modelValue="localeChanged" />
        <ChevronDown class="inv-public-lang-chevron" :size="15" aria-hidden="true" />
      </div>
      <RouterLink to="/auth/login" class="inv-btn inv-btn-secondary inv-login-link">{{t("signIn")}}</RouterLink>
      <RouterLink to="/auth/register" class="inv-btn inv-btn-primary inv-signup-link">{{t("signUp")}}</RouterLink>
      <button class="inv-public-mobile-toggle" type="button" :aria-expanded="mobileOpen"
        aria-controls="inventory-public-mobile-nav" :aria-label="mobileOpen?t('close'):t('features')"
        @click="mobileOpen=!mobileOpen"><X v-if="mobileOpen" :size="21" /><Menu v-else :size="21" /></button>
    </div>
    <nav v-if="mobileOpen" id="inventory-public-mobile-nav" class="inv-public-mobile-nav"
       :aria-label="t('product')">
      <RouterLink to="/#product">{{t("product")}}</RouterLink>
      <RouterLink to="/#modules">{{t("features")}}</RouterLink>
      <RouterLink to="/#demo">{{t("preview")}}</RouterLink>
      <RouterLink to="/pricing">{{t("plans")}}</RouterLink>
      <RouterLink to="/legal">{{t("documents")}}</RouterLink>
      <RouterLink to="/auth/login">{{t("signIn")}}</RouterLink>
      <RouterLink to="/auth/register">{{t("signUp")}}</RouterLink>
    </nav>
  </header>
</template>
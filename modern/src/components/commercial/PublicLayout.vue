<script setup lang="ts">
import {watch} from "vue";
import PublicHeader from "./PublicHeader.vue";
import PublicFooter from "./PublicFooter.vue";
import {commercialApi} from "../../api/commercial";
import {useUiSettings} from "../../stores/uiSettings";
import {setCommercialSiteText} from "../../commercialTranslations";

const ui=useUiSettings();
let sequence=0;
async function load(){
 const current=++sequence;
 const locale=ui.locale;
 try{
  const result=await commercialApi.siteContent(locale==="ka"?"ge":locale);
  if(current===sequence)setCommercialSiteText(locale,result.data);
 }catch{
  if(current===sequence)setCommercialSiteText(locale,{});
 }
}
watch(()=>ui.locale,load,{immediate:true});
</script>
<template><div class="inventory-public-site"><PublicHeader /><main class="inventory-public-main"><slot /></main><PublicFooter /></div></template>

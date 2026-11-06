<script setup lang="ts">
import PublicLayout from "../../components/commercial/PublicLayout.vue";
import PublicTariffs from "../../components/commercial/PublicTariffs.vue";
import {useUiSettings} from "../../stores/uiSettings";
import {commercialT} from "../../commercialTranslations";
const ui=useUiSettings();
const t=(k:string)=>commercialT(ui.locale,k);
</script>
<template><PublicLayout>
 <div class="inv-page-intro"><div class="inv-breadcrumb"><RouterLink to="/">{{t("home")}}</RouterLink> / {{t("plans")}}</div>
 <h1>{{t("pricing")}}</h1><p>{{t("planText")}}</p></div>
 <div class="inv-secondary-page"><PublicTariffs /></div>
</PublicLayout></template>
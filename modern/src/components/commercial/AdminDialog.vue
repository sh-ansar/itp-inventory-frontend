<script setup lang="ts">
import {onMounted,onBeforeUnmount} from "vue";
import {X} from "lucide-vue-next";
import {commercialT} from "../../commercialTranslations";
import {useUiSettings} from "../../stores/uiSettings";
defineProps<{title:string}>();
const emit=defineEmits<{close:[]}>();
const ui=useUiSettings(),t=(k:string)=>commercialT(ui.locale,k);
function key(e:KeyboardEvent){if(e.key==="Escape")emit("close");}
onMounted(()=>window.addEventListener("keydown",key));
onBeforeUnmount(()=>window.removeEventListener("keydown",key));
</script>
<template>
 <div class="inv-admin-modal-backdrop" @click.self="emit('close')">
  <section class="inv-admin-modal" role="dialog" aria-modal="true" :aria-label="title">
    <header><h2>{{title}}</h2><button type="button" :aria-label="t('close')" @click="emit('close')"><X :size="22"/></button></header>
    <div class="inv-admin-modal-body"><slot /></div>
  </section>
 </div>
</template>
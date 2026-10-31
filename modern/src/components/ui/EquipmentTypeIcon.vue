<script setup lang="ts">
import { computed } from "vue";
import {
  Package, Boxes, Monitor, Laptop, Printer, Server, Network,
  Smartphone, HardDrive, Router, Armchair, Wrench, Factory,
  Cog, Camera, Car, Tablet, Cable, Projector, Keyboard, Mouse,
} from "lucide-vue-next";

const props=withDefaults(defineProps<{
  iconKey?:string|null;iconUrl?:string|null;size?:number;alt?:string;
}>(),{size:22});
const icons:Record<string,unknown>={
  box:Package,boxes:Boxes,monitor:Monitor,laptop:Laptop,printer:Printer,
  server:Server,network:Network,smartphone:Smartphone,
  "hard-drive":HardDrive,router:Router,armchair:Armchair,wrench:Wrench,
  factory:Factory,cog:Cog,camera:Camera,car:Car,tablet:Tablet,
  package:Package,cable:Cable,projector:Projector,keyboard:Keyboard,mouse:Mouse,
};
const selected=computed(()=>icons[props.iconKey??""]??Package);
</script>
<template>
  <img v-if="iconUrl" :src="iconUrl" :alt="alt??''" class="equipment-image"
    :style="{width:size+'px',height:size+'px'}" loading="lazy"/>
  <component :is="selected" v-else :size="size" :aria-label="alt" :aria-hidden="!alt"
    class="equipment-icon"/>
</template>
<style scoped>
.equipment-image{object-fit:contain;flex:none}
.equipment-icon{flex:none}
</style>

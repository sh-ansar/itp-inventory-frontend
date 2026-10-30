<script setup lang="ts">
import { ref } from "vue"
import BaseCard from "./components/ui/BaseCard.vue"
import BaseButton from "./components/ui/BaseButton.vue"
import BaseStatusPill from "./components/ui/BaseStatusPill.vue"
import { Package, Search, ShieldCheck } from "lucide-vue-next"
const query = ref("")
// Foundation only: avoid fabricated production records or silent demo fallback.
const rows = ref<{ id:string; inventory_number:string; name:string; status:string }[]>([])
</script>
<template>
  <div class="shell">
    <aside class="sidebar"><strong>ITP Inventory</strong><p class="muted">Управление активами</p><nav aria-label="Разделы"><p><a href="#assets">Основные средства</a></p><p>Инвентаризации</p><p>Справочники</p></nav></aside>
    <main class="main"><header class="top"><div><h1>Основные средства</h1><p class="muted">Новая версия интерфейса — изолированная разработка</p></div><BaseStatusPill tone="warning"><ShieldCheck :size="16" aria-hidden="true" /> Авторизация: подготовка</BaseStatusPill></header>
      <section class="grid" aria-label="Показатели"><BaseCard><Package :size="22" aria-hidden="true" /><h2>{{ rows.length }}</h2><p class="muted">Загруженных активов</p></BaseCard><article class="card"><h2>—</h2><p class="muted">Инвентаризации</p></article></section>
      <BaseCard id="assets" style="margin-top:20px"><div class="top"><h2>Реестр</h2><label><Search :size="16" aria-hidden="true"/> <input v-model="query" aria-label="Поиск по активам" placeholder="Поиск"/></label></div><div class="table-scroll"><table><thead><tr><th>Инвентарный №</th><th>Название</th><th>Статус</th></tr></thead><tbody><tr v-for="a in rows.filter(a => (a.name+ a.inventory_number).toLowerCase().includes(query.toLowerCase()))" :key="a.id"><td>{{ a.inventory_number }}</td><td>{{ a.name }}</td><td>{{ a.status }}</td></tr><tr v-if="rows.length===0"><td colspan="3">Нет загруженных данных. Подключение API — следующий этап.</td></tr></tbody></table></div></BaseCard>
    </main>
  </div>
</template>

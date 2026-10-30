<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Package, Search, ShieldCheck, Boxes, LogOut } from "lucide-vue-next";
import BaseButton from "./components/ui/BaseButton.vue";
import BaseCard from "./components/ui/BaseCard.vue";
import BaseLoadingState from "./components/ui/BaseLoadingState.vue";
import BaseStatusPill from "./components/ui/BaseStatusPill.vue";
import { health, login, currentUser, logout, companies, companyAssets } from "./api/session";
import type { InventoryUser, CompanyAccess, Asset } from "./api/session";

const user = ref<InventoryUser | null>(null);
const connected = ref(false);
const browserLoginEnabled = ref(false);
const busy = ref(true);
const loginBusy = ref(false);
const error = ref("");
const credentials = reactive({ email: "", password: "" });
const availableCompanies = ref<CompanyAccess[]>([]);
const company = ref("");
const assets = ref<Asset[]>([]);
const query = ref("");
const visible = computed(() => assets.value.filter(a =>
  (a.name + " " + a.inventory_number).toLocaleLowerCase().includes(query.value.toLocaleLowerCase())
));
const selectedCompany = computed(() => availableCompanies.value.find(c => c.id === company.value));

async function loadCompany() {
  assets.value = [];
  if (!company.value) return;
  try { assets.value = (await companyAssets(company.value)).data; }
  catch (e) { error.value = e instanceof Error ? e.message : "Ошибка загрузки активов"; }
}

async function loadSession() {
  try {
    user.value = await currentUser();
    availableCompanies.value = await companies();
    company.value = availableCompanies.value[0]?.id || "";
    await loadCompany();
  } catch { user.value = null; availableCompanies.value = []; company.value = ""; assets.value = []; }
}

async function boot() {
  busy.value = true;
  try {
    const status = await health();
    connected.value = status.status === "ok";
    browserLoginEnabled.value = status.browser_login === true;
    if (connected.value) await loadSession();
  } catch (e) { error.value = "Сервер Inventory пока не подключён."; }
  finally { busy.value = false; }
}

async function signIn() {
  error.value = "";
  loginBusy.value = true;
  try {
    await login(credentials.email.trim(), credentials.password);
    credentials.password = "";
    await loadSession();
  } catch (e) { error.value = e instanceof Error ? e.message : "Ошибка авторизации"; }
  finally { loginBusy.value = false; }
}

async function signOut() {
  error.value = "";
  try { await logout(); }
  catch (e) { error.value = e instanceof Error ? e.message : "Не удалось завершить сессию"; return; }
  user.value = null; company.value = ""; assets.value = []; availableCompanies.value = [];
}
onMounted(boot);
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><Boxes :size="23" aria-hidden="true" /><strong>ITP Inventory</strong></div>
      <p class="muted">Управление основными средствами</p>
      <nav aria-label="Навигация"><a href="#assets">Основные средства</a><span class="nav-disabled">Инвентаризации · следующий этап</span><span class="nav-disabled">Справочники · следующий этап</span></nav>
    </aside>
    <main class="main">
      <header class="top">
        <div><h1>Основные средства</h1><p class="muted">Учёт имущества и инвентаризация</p></div>
        <div class="top-status"><BaseStatusPill :tone="connected ? 'success' : 'warning'"><ShieldCheck :size="16" aria-hidden="true" />{{ connected ? "Laravel API подключён" : "API не подключён" }}</BaseStatusPill><BaseButton v-if="user" variant="secondary" @click="signOut"><LogOut :size="17" /> Выход</BaseButton></div>
      </header>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <BaseLoadingState v-if="busy" label="Проверка API и сессии" />
      <BaseCard v-else-if="!user" class="login-card">
        <h2>Вход в Inventory</h2>
        <p class="muted">Отдельная авторизация, как в HRM. Общий вход будет добавлен позднее.</p>
        <form @submit.prevent="signIn" class="login-form">
          <label>Email <input v-model="credentials.email" type="email" autocomplete="username" required :disabled="!browserLoginEnabled || loginBusy" /></label>
          <label>Пароль <input v-model="credentials.password" type="password" autocomplete="current-password" required :disabled="!browserLoginEnabled || loginBusy" /></label>
          <BaseButton type="submit" :disabled="!browserLoginEnabled || loginBusy">{{ loginBusy ? "Проверка…" : "Войти" }}</BaseButton>
        </form>
        <p v-if="!browserLoginEnabled" class="muted">Вход по паролю не активирован. Он включается только после проверки HTTPS и настроек сессий.</p>
      </BaseCard>
      <template v-else>
        <div class="top company-bar">
          <p class="muted">Пользователь: <strong>{{ user.name }}</strong></p>
          <label>Компания
            <select v-model="company" @change="loadCompany" aria-label="Компания" class="company-select">
              <option v-for="c in availableCompanies" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
        </div>
        <section class="grid" aria-label="Показатели">
          <BaseCard><Package :size="22" aria-hidden="true"/><h2>{{ assets.length }}</h2><p class="muted">Активов на текущей странице</p></BaseCard>
          <BaseCard><h2>{{ selectedCompany?.name || "—" }}</h2><p class="muted">Текущая компания</p></BaseCard>
        </section>
        <BaseCard id="assets" class="registry">
          <div class="top"><h2>Реестр имущества</h2><label class="search"><Search :size="16" aria-hidden="true" /><input v-model="query" aria-label="Поиск по текущей странице" placeholder="Поиск"/></label></div>
          <div class="table-scroll"><table><thead><tr><th>Инвентарный №</th><th>Название</th><th>Статус</th></tr></thead><tbody>
            <tr v-for="a in visible" :key="a.id"><td>{{ a.inventory_number }}</td><td>{{ a.name }}</td><td><BaseStatusPill tone="neutral">{{ a.status }}</BaseStatusPill></td></tr>
            <tr v-if="visible.length===0"><td colspan="3">Нет записей по выбранному условию.</td></tr>
          </tbody></table></div>
          <p class="muted">Это первый функциональный срез: реестр читает настоящий Laravel API. Редактирование, история, QR и инвентаризация переносятся далее.</p>
        </BaseCard>
      </template>
    </main>
  </div>
</template>

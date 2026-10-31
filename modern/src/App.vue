<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { Boxes, ClipboardList, BookOpen, Package, Building2, Users, Warehouse, ExternalLink, LogOut, Sun, Moon, Eye, EyeOff, RefreshCw, Recycle } from "lucide-vue-next";
import BaseButton from "./components/ui/BaseButton.vue";
import BaseCard from "./components/ui/BaseCard.vue";
import BaseLoadingState from "./components/ui/BaseLoadingState.vue";

import { health, login, currentUser, logout, companies } from "./api/session";
import type { InventoryUser, CompanyAccess } from "./api/session";
import { InventoryApiError } from "./api/client";
import { useUiSettings } from "./stores/uiSettings";
import type { InventoryLocale } from "./i18n";

const ui = useUiSettings();
const route = useRoute();
const user = ref<InventoryUser | null>(null);
const availableCompanies = ref<CompanyAccess[]>([]);
const companyId = ref("");
const connected = ref(false);
const browserLoginEnabled = ref(false);
const booting = ref(true);
const loginBusy = ref(false);
const signoutBusy = ref(false);
const error = ref("");
const credentials = reactive({ email:"", password:"" });
const passwordVisible = ref(false);
const currentTitle = computed(() => ui.t(
   route.name === "references" ? "heading.references" :
   route.name === "scan" ? "qr.scanTitle" :
   route.name === "stocktake" || route.name === "stocktakes" ? "heading.stocktakes" :
   route.name === "facilities" ? "topology.title" :
   route.name === "facility-plan" ? "plan.title" :
   route.name === "people" ? "people.title" :
   route.name === "warehouses" ? "stock.warehouseTitle" :
   route.name === "disposals" ? "disposal.title" : "heading.assets"
 ));
const selectedCompany = computed(() =>
  availableCompanies.value.find(c => c.id === companyId.value) ?? null
);

async function loadIdentity(): Promise<void> {
  const [identity, memberships] = await Promise.all([currentUser(), companies()]);
  user.value = identity;
  availableCompanies.value = memberships;
  companyId.value = memberships.some(c => c.id === companyId.value)
    ? companyId.value : memberships[0]?.id ?? "";
}

async function boot() {
  booting.value = true;
  error.value = "";
  try {
    const status = await health();
    connected.value = status.status === "ok";
    browserLoginEnabled.value = status.browser_login === true;
    try { await loadIdentity(); }
    catch (e) {
      if (!(e instanceof InventoryApiError && e.status === 401)) {
        error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
      }
      user.value = null;
      availableCompanies.value = []; companyId.value = "";
    }
  } catch(e) {
    connected.value = false;
    error.value = e instanceof Error ? ui.t("generic.notConnected") : ui.t("auth.unavailable");
  } finally { booting.value = false; }
}

async function signIn() {
  if (loginBusy.value || !browserLoginEnabled.value) return;
  loginBusy.value = true; error.value = "";
  try {
    await login(credentials.email.trim(), credentials.password);
    credentials.password = "";
    await loadIdentity();
  } catch(e) {
    error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
  } finally { loginBusy.value = false; }
}

async function signOut() {
  if (signoutBusy.value) return;
  signoutBusy.value = true; error.value = "";
  try {
    await logout();
    user.value = null;
    availableCompanies.value = [];
    companyId.value = "";
    credentials.password = "";
  } catch(e) { error.value = e instanceof Error ? e.message : ui.t("generic.unknownError"); }
  finally { signoutBusy.value = false; }
}

function switchLocale(event: Event) {
  const next = (event.target as HTMLSelectElement).value;
  if (["ru","en","ka"].includes(next)) ui.locale = next as InventoryLocale;
}
watch(() => [route.name,ui.locale], () => {
  document.title = currentTitle.value + " · ITP Inventory";
});
onMounted(boot);
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><Boxes :size="24" aria-hidden="true"/></div>
        <div class="brand-text"><strong>ITP Inventory</strong><span>{{ ui.t("brand.subtitle") }}</span></div>
      </div>
      <nav v-if="user" class="main-navigation" aria-label="Inventory">
        <RouterLink to="/registry" class="nav-item" active-class="nav-item--active">
          <Package :size="19" aria-hidden="true"/>{{ ui.t("nav.assets") }}
        </RouterLink>
        <RouterLink to="/facilities" class="nav-item" active-class="nav-item--active">
          <Building2 :size="19" aria-hidden="true"/>{{ ui.t("nav.facilities") }}
        </RouterLink>
        <RouterLink to="/references" class="nav-item" active-class="nav-item--active">
          <BookOpen :size="19" aria-hidden="true"/>{{ ui.t("nav.references") }}
        </RouterLink>
        <RouterLink to="/people" class="nav-item" active-class="nav-item--active">
          <Users :size="19" aria-hidden="true"/>{{ ui.t("nav.people") }}
        </RouterLink>
        <RouterLink to="/warehouses" class="nav-item" active-class="nav-item--active">
          <Warehouse :size="19" aria-hidden="true"/>{{ ui.t("nav.warehouses") }}
        </RouterLink>
        <RouterLink to="/disposals" class="nav-item" active-class="nav-item--active">
          <Recycle :size="19" aria-hidden="true"/>{{ ui.t("disposal.nav") }}
        </RouterLink>
        <RouterLink to="/stocktakes" class="nav-item" active-class="nav-item--active">
          <ClipboardList :size="19" aria-hidden="true"/>{{ ui.t("nav.stocktakes") }}
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <a href="https://platform.itpmining.kz/" class="portal-link" :title="ui.t('portal.back')">
          <ExternalLink :size="18" aria-hidden="true"/>
          <span>{{ ui.t("portal.back") }}</span>
        </a>
        <p class="muted">ITP · Inventory</p>
      </div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <div class="topbar-leading">
          <div class="workspace-title"><h1>{{ currentTitle }}</h1>
            <p>{{ ui.t("heading.description") }}</p>
          </div>
        </div>
        <div class="topbar-trailing">
          <a href="https://platform.itpmining.kz/" class="portal-link portal-link--mobile"
            :title="ui.t('portal.back')" :aria-label="ui.t('portal.back')">
            <ExternalLink :size="18" aria-hidden="true"/>
            <span>{{ ui.t("portal.back") }}</span>
          </a>
          <label v-if="user && availableCompanies.length > 0" class="company-switcher">
            <span>{{ ui.t("auth.company") }}</span>
            <select v-model="companyId" :aria-label="ui.t('auth.company')">
              <option v-for="company in availableCompanies" :key="company.id" :value="company.id">{{ company.name }}</option>
            </select>
          </label>
          <select :value="ui.locale" @change="switchLocale" class="locale-select" aria-label="Язык / Language">
            <option value="ru">RU</option><option value="en">EN</option><option value="ka">GE</option>
          </select>
          <button type="button" class="theme-toggle"
            :title="ui.t(ui.theme === 'dark' ? 'generic.light' : 'generic.dark')"
            :aria-label="ui.t(ui.theme === 'dark' ? 'generic.light' : 'generic.dark')"
            @click="ui.toggleTheme">
            <Sun v-if="ui.theme==='dark'" :size="18" aria-hidden="true"/>
            <Moon v-else :size="18" aria-hidden="true"/>
          </button>
          <BaseButton v-if="user" variant="secondary" :disabled="signoutBusy" @click="signOut">
            <LogOut :size="16" aria-hidden="true"/> {{ ui.t("auth.logout") }}
          </BaseButton>
        </div>
      </header>
      <main class="view-content">
        <div v-if="error" role="alert" class="error">{{ error }}
          <BaseButton v-if="!connected" variant="secondary" @click="boot"><RefreshCw :size="16"/>{{ ui.t("actions.retry") }}</BaseButton>
        </div>
        <BaseLoadingState v-if="booting" :label="ui.t('generic.loading')" />
        <BaseCard v-else-if="!user" class="login-card">
          <div class="login-heading"><div class="login-icon"><Boxes :size="25" aria-hidden="true"/></div>
            <div><h2>{{ ui.t("heading.login") }}</h2><p class="muted">{{ ui.t("auth.independent") }}</p></div>
          </div>
          <form class="login-form" @submit.prevent="signIn">
            <label>{{ ui.t("auth.email") }}
              <input v-model="credentials.email" type="email" autocomplete="username"
                :disabled="!browserLoginEnabled || loginBusy || !connected" required/>
            </label>
            <div class="password-field">
              <label for="inventory-password">{{ ui.t("auth.password") }}</label>
              <div class="password-control">
                <input id="inventory-password" v-model="credentials.password" :type="passwordVisible?'text':'password'"
                  autocomplete="current-password" minlength="8"
                  :disabled="!browserLoginEnabled || loginBusy || !connected" required/>
                <button type="button" :aria-label="ui.t(passwordVisible?'actions.hidePassword':'actions.showPassword')"
                  :disabled="loginBusy" @click="passwordVisible=!passwordVisible">
                  <EyeOff v-if="passwordVisible" :size="18" aria-hidden="true"/>
                  <Eye v-else :size="18" aria-hidden="true"/>
                </button>
              </div>
            </div>
            <BaseButton type="submit" :disabled="!browserLoginEnabled || loginBusy || !connected">
              {{ loginBusy ? ui.t("auth.signing") : ui.t("auth.login") }}
            </BaseButton>
          </form>
          <p v-if="!browserLoginEnabled" class="muted login-note">{{ ui.t("auth.disabled") }}</p>
        </BaseCard>
        <div v-else-if="!selectedCompany" class="no-company">
          <Package :size="28" aria-hidden="true"/>
          <h2>{{ ui.t("auth.noCompanies") }}</h2>
        </div>
        <RouterView v-else v-slot="{Component}">
          <component :is="Component" :company-id="selectedCompany.id"
            :company-name="selectedCompany.name" :role="selectedCompany.role_code"/>
        </RouterView>
      </main>
    </div>
  </div>
</template>

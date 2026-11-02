<script setup lang="ts">
import BaseSelect from "./components/ui/BaseSelect.vue";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { Boxes, ClipboardList, BookOpen, Package, Building2, Users, Warehouse, LogOut, Sun, Moon, Eye, EyeOff, RefreshCw, FileCheck2, ShieldCheck, BarChart3 } from "lucide-vue-next";
import BaseButton from "./components/ui/BaseButton.vue";
import BaseCard from "./components/ui/BaseCard.vue";
import BaseLoadingState from "./components/ui/BaseLoadingState.vue";
import PortalHomeLink from "./components/ui/PortalHomeLink.vue";

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
const reportsTitle=computed(()=>ui.locale==="ka"?"ანგარიშები":ui.locale==="en"?"Reports":"Отчёты");
const currentTitle = computed(() => route.name === "reports" ? reportsTitle.value : ui.t(
   route.name === "disposals" ? "disposal.title" :
   route.name === "company-roles" ? "roles.title" :
   route.name === "references" ? "heading.references" :
   route.name === "scan" ? "qr.scanTitle" :
   route.name === "stocktake" || route.name === "stocktakes" ? "heading.stocktakes" :
   route.name === "facilities" ? "topology.title" :
   route.name === "facility-plan" ? "plan.title" :
   route.name === "people" ? "people.title" :
   route.name === "warehouses" ? "stock.warehouseTitle" : "heading.assets"
 ));
const selectedCompany = computed(() =>
  availableCompanies.value.find(c => c.id === companyId.value) ?? null
);
watch(companyId, value => {
  if (value && user.value && availableCompanies.value.some(c => c.id === value) && typeof localStorage !== "undefined") {
    localStorage.setItem("inventory.companyId", value);
  }
});


async function loadIdentity(): Promise<void> {
  const [identity, memberships] = await Promise.all([currentUser(), companies()]);
  user.value = identity;
  availableCompanies.value = memberships;
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("inventory.companyId") : null;
  const demo = memberships.find(c => c.name.startsWith("[DEMO]"));
  companyId.value = memberships.some(c => c.id === companyId.value)
    ? companyId.value : memberships.find(c => c.id === saved)?.id ?? demo?.id ?? memberships[0]?.id ?? "";
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
watch(() => [route.name,ui.locale,!!user.value], () => {
  document.title = (user.value ? currentTitle.value : ui.t("heading.login")) + " · ITP Inventory";
},{immediate:true});
onMounted(boot);
</script>

<template>
  <div class="shell" :class="{'shell--guest':!user&&!booting}">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><Boxes :size="24" aria-hidden="true"/></div>
        <div class="brand-text"><strong>ITP Inventory</strong><span>{{ ui.t("brand.subtitle") }}</span></div>
      </div>
      <nav v-if="user" class="main-navigation" aria-label="Inventory">
        <RouterLink to="/registry" class="nav-item" active-class="nav-item--active">
          <Package :size="19" aria-hidden="true"/>{{ ui.t("nav.assets") }}
        </RouterLink>
        <RouterLink to="/disposals" class="nav-item" active-class="nav-item--active">
          <FileCheck2 :size="19" aria-hidden="true"/>{{ ui.t("nav.disposals") }}
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
        <RouterLink to="/stocktakes" class="nav-item" active-class="nav-item--active">
          <ClipboardList :size="19" aria-hidden="true"/>{{ ui.t("nav.stocktakes") }}
        </RouterLink>
        <RouterLink to="/reports" class="nav-item" active-class="nav-item--active">
          <BarChart3 :size="19" aria-hidden="true"/>{{reportsTitle}}
        </RouterLink>
        <RouterLink v-if="selectedCompany?.role_code==='company_admin'" to="/company-roles" class="nav-item" active-class="nav-item--active">
          <ShieldCheck :size="19" aria-hidden="true"/>{{ ui.t("roles.title") }}
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <PortalHomeLink />
      </div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <div v-if="!user" class="topbar-leading">
          <div class="guest-brand"><div class="brand-mark"><Boxes :size="22" aria-hidden="true"/></div>
            <strong>ITP Inventory</strong>
          </div>
        </div>
        <div class="topbar-trailing">
          <PortalHomeLink compact class="portal-link--mobile" />
          <label v-if="user && availableCompanies.length > 0" class="company-switcher">
            <span>{{ ui.t("auth.company") }}</span>
            <BaseSelect v-model="companyId" :aria-label="ui.t('auth.company')">
              <option v-for="company in availableCompanies" :key="company.id" :value="company.id">{{ company.name }}</option>
            </BaseSelect>
          </label>
          <BaseSelect :value="ui.locale" @change="switchLocale" class="locale-select" aria-label="Язык / Language">
            <option value="ru">RU</option><option value="en">EN</option><option value="ka">GE</option>
          </BaseSelect>
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
            <div><h2>{{ ui.t("heading.login") }}</h2></div>
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

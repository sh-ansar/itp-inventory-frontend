<script setup lang="ts">
import BaseDropdownSelect from "./components/ui/BaseDropdownSelect.vue";
import hrmMenuIcon from "./assets/hrm-menu.svg";
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { Boxes, ClipboardList, BookOpen, Package, Building2, Users, Warehouse, LogOut, Sun, Moon, Eye, EyeOff, RefreshCw, FileCheck2, ShieldCheck, BarChart3, Settings, Menu, X } from "lucide-vue-next";
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
const router=useRouter();
const mobileNavOpen=ref(false);
const menuLabels=computed(()=>ui.locale==="en"
  ?{expand:"Expand menu",collapse:"Collapse menu",open:"Open menu",close:"Close menu"}
  :ui.locale==="ka"
    ?{expand:"მენიუს გაშლა",collapse:"მენიუს აკეცვა",open:"მენიუს გახსნა",close:"მენიუს დახურვა"}
    :{expand:"Развернуть меню",collapse:"Свернуть меню",open:"Открыть меню",close:"Закрыть меню"});
function closeMobileNav(){mobileNavOpen.value=false}
function openMobileNav(){mobileNavOpen.value=true}
function handleMenuKeydown(event:KeyboardEvent){
  if(mobileNavOpen.value&&event.key==="Escape"){
    closeMobileNav();
    void nextTick(()=>document.querySelector<HTMLButtonElement>(".mobile-nav-trigger")?.focus());
  }
}
watch(()=>route.fullPath,closeMobileNav);
watch(mobileNavOpen,opened=>{
  document.body.classList.toggle("inventory-mobile-nav-open",opened);
  if(opened)void nextTick(()=>document.querySelector<HTMLButtonElement>(".mobile-nav-close")?.focus());
});
onMounted(()=>window.addEventListener("keydown",handleMenuKeydown));
onUnmounted(()=>{
  window.removeEventListener("keydown",handleMenuKeydown);
  document.body.classList.remove("inventory-mobile-nav-open");
});
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
const companySettingsTitle=computed(()=>ui.locale==='en'?'Company settings':ui.locale==='ka'?'კომპანიის პარამეტრები':'Настройки компании');
const reportsTitle=computed(()=>ui.locale==="ka"?"ანგარიშები":ui.locale==="en"?"Reports":"Отчёты");
const currentTitle = computed(() => route.name === "company-settings" ? companySettingsTitle.value : route.name === "profile" ? profileTitle.value : route.name === "reports" ? reportsTitle.value : ui.t(
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
const profileTitle=computed(()=>ui.locale==="en"?"My account":ui.locale==="ka"?"პირადი კაბინეტი":"Личный кабинет");
const profileInitials=computed(()=>user.value?.name?.trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join("")||"IT");
const accountCaption=computed(()=>ui.locale==="en"?"Work account":ui.locale==="ka"?"\u10E1\u10D0\u10DB\u10E3\u10E8\u10D0\u10DD \u10D0\u10DC\u10D2\u10D0\u10E0\u10D8\u10E8\u10D8":"\u0420\u0430\u0431\u043E\u0447\u0430\u044F \u0443\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C");
const selectedCompany = computed(() =>
  availableCompanies.value.find(c => c.id === companyId.value) ?? null
);
const companyOptions=computed(()=>availableCompanies.value.map(company=>({
  value:company.id,label:company.name,
})));
const localeOptions=[
  {value:"ru",label:"RU"},
  {value:"en",label:"EN"},
  {value:"ka",label:"GE"},
];
watch(()=>[selectedCompany.value?.role_code,route.name],([role,name])=>{
  if(user.value&&role&&(name==="company-roles"||name==="company-settings")&&role!=="company_admin"){
    void router.replace("/registry");
  }
});
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
  const regular=memberships.find(c=>!c.name.startsWith("[DEMO]"));
  companyId.value = memberships.some(c => c.id === companyId.value)
    ? companyId.value : memberships.find(c => c.id === saved)?.id ?? regular?.id ?? memberships[0]?.id ?? "";
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
    closeMobileNav();
  } catch(e) { error.value = e instanceof Error ? e.message : ui.t("generic.unknownError"); }
  finally { signoutBusy.value = false; }
}

function switchLocale(next:string) {
  if (["ru","en","ka"].includes(next)) ui.locale = next as InventoryLocale;
}
watch(() => [route.name,ui.locale,!!user.value], () => {
  document.title = "ITP Inventory";
},{immediate:true});
onMounted(boot);
</script>

<template>
  <div class="shell" :class="{'shell--guest':!user&&!booting,'shell--collapsed':ui.sidebarCollapsed}">
    <button v-if="user&&mobileNavOpen" class="nav-backdrop" type="button"
      :aria-label="menuLabels.close" @click="closeMobileNav"/>
    <aside class="sidebar" :class="{'sidebar--open':mobileNavOpen}" aria-label="Inventory">
      <div class="sidebar-head">
        <div class="brand">
          <div class="brand-mark"><Boxes :size="24" aria-hidden="true"/></div>
          <div class="brand-text"><strong>ITP Inventory</strong></div>
        </div>
        <button v-if="user" type="button" class="sidebar-collapse icon-control"
          :title="ui.sidebarCollapsed?menuLabels.expand:menuLabels.collapse"
          :aria-label="ui.sidebarCollapsed?menuLabels.expand:menuLabels.collapse"
          :aria-expanded="!ui.sidebarCollapsed" @click="ui.toggleSidebar()">
          <img  :src="hrmMenuIcon" alt="" aria-hidden="true" width="20" height="20"/>
        </button>
        <button v-if="user" type="button" class="mobile-nav-close icon-control"
          :title="menuLabels.close" :aria-label="menuLabels.close" @click="closeMobileNav">
          <X :size="20" aria-hidden="true"/>
        </button>
      </div>
      <nav v-if="user" class="main-navigation" aria-label="Inventory">
        <RouterLink to="/registry" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('nav.assets')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('nav.assets'):undefined" @click="closeMobileNav">
          <Package :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("nav.assets") }}</span>
        </RouterLink>
        <RouterLink to="/disposals" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('nav.disposals')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('nav.disposals'):undefined" @click="closeMobileNav">
          <FileCheck2 :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("nav.disposals") }}</span>
        </RouterLink>
        <RouterLink to="/facilities" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('nav.facilities')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('nav.facilities'):undefined" @click="closeMobileNav">
          <Building2 :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("nav.facilities") }}</span>
        </RouterLink>
        <RouterLink to="/references" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('nav.references')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('nav.references'):undefined" @click="closeMobileNav">
          <BookOpen :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("nav.references") }}</span>
        </RouterLink>
        <RouterLink to="/people" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('nav.people')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('nav.people'):undefined" @click="closeMobileNav">
          <Users :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("nav.people") }}</span>
        </RouterLink>
        <RouterLink to="/warehouses" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('nav.warehouses')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('nav.warehouses'):undefined" @click="closeMobileNav">
          <Warehouse :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("nav.warehouses") }}</span>
        </RouterLink>
        <RouterLink to="/stocktakes" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('nav.stocktakes')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('nav.stocktakes'):undefined" @click="closeMobileNav">
          <ClipboardList :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("nav.stocktakes") }}</span>
        </RouterLink>
        <RouterLink to="/reports" class="nav-item" active-class="nav-item--active" :aria-label="reportsTitle" :title="ui.sidebarCollapsed&&!mobileNavOpen?reportsTitle:undefined" @click="closeMobileNav">
          <BarChart3 :size="19" aria-hidden="true"/><span class="nav-label">{{reportsTitle}}</span>
        </RouterLink>
        <RouterLink v-if="selectedCompany?.role_code==='company_admin'" to="/company-settings" class="nav-item"
          active-class="nav-item--active" :aria-label="companySettingsTitle"
          :title="ui.sidebarCollapsed&&!mobileNavOpen?companySettingsTitle:undefined" @click="closeMobileNav">
          <Settings :size="19" aria-hidden="true"/><span class="nav-label">{{companySettingsTitle}}</span>
        </RouterLink>
        <RouterLink v-if="selectedCompany?.role_code==='company_admin'" to="/company-roles" class="nav-item" active-class="nav-item--active" :aria-label="ui.t('roles.title')" :title="ui.sidebarCollapsed&&!mobileNavOpen?ui.t('roles.title'):undefined" @click="closeMobileNav">
          <ShieldCheck :size="19" aria-hidden="true"/><span class="nav-label">{{ ui.t("roles.title") }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <PortalHomeLink :compact="ui.sidebarCollapsed&&!mobileNavOpen" />
      </div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <button v-if="user" type="button" class="mobile-nav-trigger icon-control"
          :aria-label="menuLabels.open" :title="menuLabels.open" @click="openMobileNav">
          <Menu :size="21" aria-hidden="true"/>
        </button>
        <div v-if="!user" class="topbar-leading">
          <div class="guest-brand"><div class="brand-mark"><Boxes :size="22" aria-hidden="true"/></div>
            <strong>ITP Inventory</strong>
          </div>
        </div>
        <div class="topbar-trailing">
          <PortalHomeLink compact class="portal-link--mobile" />
          <div v-if="user && availableCompanies.length > 0" class="company-switcher">
            <span>{{ ui.t("auth.company") }}</span>
            <BaseDropdownSelect v-model="companyId" class="company-picker"
              :label="ui.t('auth.company')" :options="companyOptions" :locale="ui.locale"
              :searchable="availableCompanies.length>7"/>
          </div>
          <BaseDropdownSelect :model-value="ui.locale" @update:modelValue="switchLocale"
            class="locale-select" label="Язык / Language"
            :options="localeOptions" :locale="ui.locale"/>
          <button type="button" class="theme-toggle"
            :title="ui.t(ui.theme === 'dark' ? 'generic.light' : 'generic.dark')"
            :aria-label="ui.t(ui.theme === 'dark' ? 'generic.light' : 'generic.dark')"
            @click="ui.toggleTheme">
            <Sun v-if="ui.theme==='dark'" :size="18" aria-hidden="true"/>
            <Moon v-else :size="18" aria-hidden="true"/>
          </button>
                    <RouterLink v-if="user" to="/profile" class="profile-summary profile-account-link" :title="profileTitle" :aria-label="profileTitle">
            <span class="user-avatar" aria-hidden="true">{{ profileInitials }}</span>
            <span class="profile-copy"><strong>{{ user.name }}</strong><small>{{ accountCaption }}</small></span>
          </RouterLink>          <BaseButton v-if="user" variant="secondary" :disabled="signoutBusy" @click="signOut">
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
<style scoped>
.profile-account-link{text-decoration:none;color:inherit;cursor:pointer;border-radius:var(--radius-sm)}
.profile-account-link:hover{background:var(--color-hover)}
.profile-account-link:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
</style>
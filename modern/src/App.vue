<script setup lang="ts">
import hrmMenuIcon from "./assets/hrm-menu.svg";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { Boxes, ClipboardList, BookOpen, Package, Building2, Users, Warehouse, Bell, Search, Sun, Moon, RefreshCw, FileCheck2, ShieldCheck, BarChart3, CreditCard, Settings, Menu, X } from "lucide-vue-next";
import BaseButton from "./components/ui/BaseButton.vue";
import InventoryAccountMenu from "./components/InventoryAccountMenu.vue";
import BaseLoadingState from "./components/ui/BaseLoadingState.vue";
import PortalHomeLink from "./components/ui/PortalHomeLink.vue";

import { health, currentUser, logout, companies } from "./api/session";
import type { InventoryUser, CompanyAccess } from "./api/session";
import { InventoryApiError } from "./api/client";
import { commercialApi } from "./api/commercial";
import { commercialT } from "./commercialTranslations";
import { useUiSettings } from "./stores/uiSettings";

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
const canOpenPlatformAdmin = ref(false);
const platformAdminTitle = computed(()=>commercialT(ui.locale,"adminLink"));
function updateAccountName(name:string){if(user.value)user.value={...user.value,name};}
const availableCompanies = ref<CompanyAccess[]>([]);
const companyId = ref("");
const connected = ref(false);
const booting = ref(true);
const signoutBusy = ref(false);
const headerSearch=ref("");
const notificationOpen=ref(false);
const headerInput=ref<HTMLInputElement|null>(null);
const inventoryBrand=computed(()=>ui.locale==="ru"?"ITP Инвентаризация":ui.locale==="ka"?"ITP ინვენტარიზაცია":"ITP Inventory");
const headerCopy=computed(()=>ui.locale==="en"?{search:"Search assets",notifications:"Notifications",empty:"No notifications yet"}:ui.locale==="ka"?{search:"აქტივების ძიება",notifications:"შეტყობინებები",empty:"შეტყობინებები ჯერ არ არის"}:{search:"Поиск по имуществу",notifications:"Уведомления",empty:"Пока нет уведомлений"});
function searchRegistry(){const q=headerSearch.value.trim();notificationOpen.value=false;void router.push({name:"assets",query:q?{search:q}:{}});}
watch(()=>route.query.search, q=>{if(route.name==="assets")headerSearch.value=typeof q==="string"?q:"";},{immediate:true});
const error = ref("");
const companySettingsTitle=computed(()=>ui.locale==='en'?'Company settings':ui.locale==='ka'?'კომპანიის პარამეტრები':'Настройки компании');
const reportsTitle=computed(()=>ui.locale==="ka"?"ანგარიშები":ui.locale==="en"?"Reports":"Отчёты");
const billingTitle=computed(()=>commercialT(ui.locale,"adminPayments"));
const currentTitle = computed(() => route.name === "platform-admin" ? platformAdminTitle.value : route.name === "billing" ? billingTitle.value : route.name === "company-settings" ? companySettingsTitle.value : route.name === "profile" ? profileTitle.value : route.name === "reports" ? reportsTitle.value : ui.t(
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
  try {
    const overview = await commercialApi.overview();
    canOpenPlatformAdmin.value = overview.permissions.length>0;
  } catch {
    // 403 is expected for regular Inventory users. Keep platform UI hidden.
    canOpenPlatformAdmin.value = false;
  }
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
    try { await loadIdentity(); }
    catch (e) {
      if (!(e instanceof InventoryApiError && e.status === 401)) {
        error.value = e instanceof Error ? e.message : ui.t("generic.unknownError");
      }
      user.value = null;
      canOpenPlatformAdmin.value = false;
      availableCompanies.value = []; companyId.value = "";
    }
  } catch(e) {
    connected.value = false;
    error.value = e instanceof Error ? ui.t("generic.notConnected") : ui.t("auth.unavailable");
  } finally { booting.value = false; }
}

async function signOut() {
  if (signoutBusy.value) return;
  signoutBusy.value = true; error.value = "";
  try {
    await logout();
    user.value = null;
    canOpenPlatformAdmin.value = false;
    availableCompanies.value = [];
    companyId.value = "";
    closeMobileNav();
    // Unmount the private workspace. The public login page is the ONLY login form.
    await router.replace("/auth/login");
  } catch(e) { error.value = e instanceof Error ? e.message : ui.t("generic.unknownError"); }
  finally { signoutBusy.value = false; }
}

watch(() => [route.name,ui.locale,!!user.value], () => {
  document.title = inventoryBrand.value;
},{immediate:true});
onMounted(async () => {
  await boot();
  // Direct private links with no session must never show a second, inline login.
  if (!user.value) {
    await router.replace({path:"/auth/login",query:{next:route.fullPath}});
  }
});
</script>

<template>
  <BaseLoadingState v-if="booting && !user" :label="ui.t('generic.loading')" />
  <div v-else-if="user" class="shell" :class="{'shell--collapsed':ui.sidebarCollapsed}">
    <button v-if="user&&mobileNavOpen" class="nav-backdrop" type="button"
      :aria-label="menuLabels.close" @click="closeMobileNav"/>
    <aside class="sidebar" :class="{'sidebar--open':mobileNavOpen}" aria-label="Inventory">
      <div class="sidebar-head">
        <div class="brand">
          <div class="brand-mark"><Boxes :size="24" aria-hidden="true"/></div>
          <div class="brand-text"><strong>{{ inventoryBrand }}</strong></div>
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
        <RouterLink v-if="selectedCompany" to="/billing" class="nav-item"
          active-class="nav-item--active" :aria-label="billingTitle"
          :title="ui.sidebarCollapsed&&!mobileNavOpen?billingTitle:undefined" @click="closeMobileNav">
          <CreditCard :size="19" aria-hidden="true"/><span class="nav-label">{{billingTitle}}</span>
        </RouterLink>
        <RouterLink v-if="canOpenPlatformAdmin" to="/admin/companies" class="nav-item"
          active-class="nav-item--active" :aria-label="platformAdminTitle"
          :title="ui.sidebarCollapsed&&!mobileNavOpen?platformAdminTitle:undefined" @click="closeMobileNav">
          <ShieldCheck :size="19" aria-hidden="true"/><span class="nav-label">{{platformAdminTitle}}</span>
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
      <header class="topbar unified-inventory-topbar">
        <button v-if="user" type="button" class="mobile-nav-trigger icon-control"
          :aria-label="menuLabels.open" :title="menuLabels.open" @click="openMobileNav">
          <Menu :size="21" aria-hidden="true"/>
        </button>
        <form class="inventory-header-search" role="search" @submit.prevent="searchRegistry">
          <div class="inventory-header-search-field">
            <Search :size="17" aria-hidden="true"/>
            <input ref="headerInput" v-model="headerSearch" type="search"
              :aria-label="headerCopy.search" :placeholder="headerCopy.search" autocomplete="off"/>
          </div>
          <button type="submit" class="inventory-header-search-submit" :aria-label="headerCopy.search">
            <Search :size="18" aria-hidden="true"/>
          </button>
        </form>
        <div class="topbar-trailing inventory-unified-actions">
          <div class="inventory-notifications-anchor">
            <button class="inventory-unified-icon" type="button" :title="headerCopy.notifications"
              :aria-label="headerCopy.notifications" :aria-expanded="notificationOpen"
              @click="notificationOpen=!notificationOpen">
              <Bell :size="20" aria-hidden="true"/>
            </button>
            <div v-if="notificationOpen" class="inventory-notifications-popover" role="dialog"
              :aria-label="headerCopy.notifications">
              <strong>{{ headerCopy.notifications }}</strong>
              <p>{{ headerCopy.empty }}</p>
            </div>
          </div>
          <button class="inventory-unified-icon" type="button"
            :title="ui.t(ui.theme==='dark'?'generic.light':'generic.dark')"
            :aria-label="ui.t(ui.theme==='dark'?'generic.light':'generic.dark')"
            :aria-pressed="ui.theme==='dark'" @click="ui.toggleTheme">
            <Sun v-if="ui.theme==='dark'" :size="20" aria-hidden="true"/>
            <Moon v-else :size="20" aria-hidden="true"/>
          </button>
          <InventoryAccountMenu v-if="user" :user="user" :locale="ui.locale"
            :companies="availableCompanies" :company-id="companyId"
            :admin="canOpenPlatformAdmin" :signout-busy="signoutBusy"
            @update:companyId="companyId=$event" @logout="signOut"/>
        </div>
      </header>
      <main class="view-content">
        <div v-if="error" role="alert" class="error">{{ error }}
          <BaseButton v-if="!connected" variant="secondary" @click="boot"><RefreshCw :size="16"/>{{ ui.t("actions.retry") }}</BaseButton>
        </div>
        <BaseLoadingState v-if="booting" :label="ui.t('generic.loading')" />
        <div v-else-if="!selectedCompany && route.name!=='profile' && route.name!=='platform-admin'" class="no-company">
          <Package :size="28" aria-hidden="true"/>
          <h2>{{ ui.t("auth.noCompanies") }}</h2>
        </div>
        <RouterView v-else v-slot="{Component}">
          <component :is="Component" :company-id="selectedCompany?.id??''"
            :company-name="selectedCompany?.name??''" :role="selectedCompany?.role_code??''" v-on="route.name==='profile'?{updated:updateAccountName}:{}"/>
        </RouterView>
      </main>
    </div>
  </div>
</template>
<style scoped>
.unified-inventory-topbar{display:flex;align-items:center;flex-wrap:nowrap!important;gap:18px;
 background:transparent!important;min-height:64px;padding:0 24px;position:relative;z-index:28}
.inventory-header-search{display:flex;align-items:center;gap:8px;width:100%;flex:0 1 455px;min-width:0;margin-right:auto}
.inventory-header-search-field{display:flex;align-items:center;gap:9px;flex:1;min-width:0;height:38px;padding:0 11px;
 background:var(--color-surface);border:1px solid var(--color-stroke);border-radius:8px;box-shadow:var(--shadow-control);color:var(--color-muted)}
.inventory-header-search-field:focus-within{border-color:var(--color-primary-stroke)}
.inventory-header-search-field input{width:100%;min-width:0;height:100%;border:0;outline:0;background:transparent;
 color:var(--color-text);font:inherit;font-size:13px;box-shadow:none;padding:0}
.inventory-header-search-submit{display:grid;place-items:center;width:38px;height:38px;flex:none;
 border:1px solid var(--color-primary);border-radius:7px;background:var(--color-primary);color:var(--color-on-primary);cursor:pointer}
.inventory-unified-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none;margin-left:auto}
.inventory-unified-icon{display:grid;place-items:center;width:38px;height:38px;background:transparent;border:1px solid transparent;
 border-radius:8px;color:var(--color-muted);cursor:pointer}
.inventory-unified-icon:hover{background:var(--color-hover);color:var(--color-primary)}
.inventory-notifications-anchor{position:relative}
.inventory-notifications-popover{position:absolute;z-index:120;right:-76px;top:calc(100% + 12px);
 width:min(320px,calc(100vw - 24px));padding:20px;border:1px solid var(--color-stroke);
 border-radius:12px;background:color-mix(in srgb,var(--color-surface-raised) 85%,transparent);
 -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 14px 36px rgba(13,40,56,.16)}
.inventory-notifications-popover strong{font-size:14px}
.inventory-notifications-popover p{font-size:12px;color:var(--color-muted);margin:25px 0}
@media(max-width:860px){.unified-inventory-topbar{gap:8px;padding:0 14px}
 .inventory-header-search{flex:1 1 0;width:auto;margin-right:0}
 .inventory-unified-actions{gap:3px}}
@media(max-width:520px){.unified-inventory-topbar{gap:5px;padding:0 10px}
 .inventory-header-search{gap:5px}
 .inventory-header-search-field{height:36px;padding:0 7px}
 .inventory-header-search-submit{width:36px;height:36px}
 .inventory-unified-actions{gap:0}
 .inventory-unified-icon{width:32px;height:34px}}
.profile-account-link{text-decoration:none;color:inherit;cursor:pointer;border-radius:var(--radius-sm)}
.profile-account-link:hover{background:var(--color-hover)}
.profile-account-link:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
</style>
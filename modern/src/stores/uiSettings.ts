import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { translate } from "../i18n";
import type { InventoryLocale } from "../i18n";

const supported = new Set<InventoryLocale>(["ru", "en", "ka"]);
function initialLocale(): InventoryLocale {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("inventory.locale") : null;
  return supported.has(saved as InventoryLocale) ? saved as InventoryLocale : "ru";
}
function initialSidebarCollapsed(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem("inventory.sidebarCollapsed")==="true"; }
  catch { return false; }
}
function initialTheme(): "dark" | "light" {
  return typeof localStorage !== "undefined" && localStorage.getItem("inventory.theme") === "dark" ? "dark" : "light";
}

export const useUiSettings = defineStore("inventory.ui-settings", () => {
  const locale = ref<InventoryLocale>(initialLocale());
  const theme = ref<"dark" | "light">(initialTheme());
  // Match HRM: keep desktop collapse preference between visits, not mobile drawer state.
  const sidebarCollapsed=ref(initialSidebarCollapsed());
  const toggleSidebar=()=>{sidebarCollapsed.value=!sidebarCollapsed.value};

  watch(locale, (value) => {
    if (typeof document !== "undefined") document.documentElement.lang = value;
    if (typeof localStorage !== "undefined") localStorage.setItem("inventory.locale", value);
  }, { immediate: true });

  watch(theme, (value) => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = value;
    if (typeof localStorage !== "undefined") localStorage.setItem("inventory.theme", value);
  }, { immediate: true });

  watch(sidebarCollapsed,(collapsed)=>{
    try{localStorage.setItem("inventory.sidebarCollapsed",String(collapsed))}
    catch{/* Restricted storage: keep in-memory preference. */}
  });

  const t = (key: string): string => translate(locale.value, key);
  const toggleTheme = () => { theme.value = theme.value === "dark" ? "light" : "dark"; };
  return { locale, theme, t, toggleTheme, sidebarCollapsed, toggleSidebar };
});
import { createRouter, createWebHistory } from "vue-router";
import AssetsPage from "../pages/AssetsPage.vue";

/**
 * Keep the registry eager as the entry route; every other page is split into
 * an independently cached Vite chunk. Names/URLs are public navigation
 * contracts: change them only together with E2E route tests and deep links.
 */
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/registry" },
    { path: "/registry", component: AssetsPage, name: "assets" },
    { path: "/profile", component: () => import("../pages/ProfilePage.vue"), name: "profile" },
    { path: "/company-settings", component: () => import("../pages/CompanySettingsPage.vue"), name: "company-settings" },
    { path: "/company-roles", component: () => import("../pages/CompanyRolesPage.vue"), name: "company-roles" },
    { path: "/disposals", component: () => import("../pages/DisposalCasesPage.vue"), name: "disposals" },
    { path: "/references", component: () => import("../pages/ReferencesPage.vue"), name: "references" },
    { path: "/facilities", component: () => import("../pages/FacilitiesPage.vue"), name: "facilities" },
    { path: "/facilities/:nodeId/plan", component: () => import("../pages/FacilityPlanPage.vue"), name: "facility-plan" },
    { path: "/people", component: () => import("../pages/ResponsiblePeoplePage.vue"), name: "people" },
    { path: "/warehouses", component: () => import("../pages/WarehousesPage.vue"), name: "warehouses" },
    { path: "/reports", component: () => import("../pages/ReportsPage.vue"), name: "reports" },
    { path: "/stocktakes", component: () => import("../pages/StocktakesPage.vue"), name: "stocktakes" },
    { path: "/stocktakes/:sessionId", component: () => import("../pages/StocktakeDetailPage.vue"), name: "stocktake" },
    { path: "/scan/:publicId", component: () => import("../pages/ScanPage.vue"), name: "scan" },
    { path: "/:pathMatch(.*)*", redirect: "/registry" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

import { createRouter, createWebHistory } from "vue-router";
import AssetsPage from "../pages/AssetsPage.vue";

/**
 * /inventory/ is now the public landing (Portal parity).
 * All existing /inventory/{registry,...} URLs remain unchanged.
 * Public routes are marked only to choose the layout, never to grant API access.
 */
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", component: () => import("../pages/public/LandingPage.vue"), name:"landing", meta:{public:true} },
    { path: "/pricing", component: () => import("../pages/public/PricingPage.vue"), name:"pricing", meta:{public:true} },
    { path: "/auth/login", component: () => import("../pages/public/AuthPage.vue"), name:"public-login", meta:{public:true} },
    { path: "/auth/register", component: () => import("../pages/public/AuthPage.vue"), name:"public-register", meta:{public:true} },
    { path: "/verify-email", component: () => import("../pages/public/AuthPage.vue"), name:"verify-email", meta:{public:true} },
    { path: "/legal/:document?", component: () => import("../pages/public/LegalPage.vue"), name:"public-legal", meta:{public:true} },
    { path: "/product/modules/:module", component: () => import("../pages/public/ModulePage.vue"), name:"public-module", meta:{public:true} },
    { path: "/admin/:section?", component: () => import("../pages/PlatformAdminPage.vue"), name:"platform-admin", meta:{platformAdmin:true} },
    { path: "/registry", component: AssetsPage, name: "assets" },
    { path: "/profile", component: () => import("../pages/ProfilePage.vue"), name: "profile" },
    { path: "/company-settings", component: () => import("../pages/CompanySettingsPage.vue"), name: "company-settings" },
    { path: "/billing", component: () => import("../pages/CompanyBillingPage.vue"), name: "billing" },
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
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior: (to) => to.hash ? ({el:to.hash,behavior:"smooth"}) : ({top:0}),
});
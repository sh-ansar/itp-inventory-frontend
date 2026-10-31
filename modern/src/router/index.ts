import { createRouter, createWebHistory } from "vue-router";
import AssetsPage from "../pages/AssetsPage.vue";
import ReferencesPage from "../pages/ReferencesPage.vue";
import ScanPage from "../pages/ScanPage.vue";
import StocktakesPage from "../pages/StocktakesPage.vue";
import StocktakeDetailPage from "../pages/StocktakeDetailPage.vue";
import FacilitiesPage from "../pages/FacilitiesPage.vue";
import FacilityPlanPage from "../pages/FacilityPlanPage.vue";
import ResponsiblePeoplePage from "../pages/ResponsiblePeoplePage.vue";
import WarehousesPage from "../pages/WarehousesPage.vue";
import DisposalsPage from "../pages/DisposalsPage.vue";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/registry" },
    { path: "/registry", component: AssetsPage, name: "assets" },
    { path: "/references", component: ReferencesPage, name: "references" },
    { path: "/facilities", component: FacilitiesPage, name: "facilities" },
    { path: "/facilities/:nodeId/plan", component: FacilityPlanPage, name: "facility-plan" },
    { path: "/people", component: ResponsiblePeoplePage, name: "people" },
    { path: "/warehouses", component: WarehousesPage, name: "warehouses" },
    { path: "/disposals", component: DisposalsPage, name: "disposals" },
    { path: "/stocktakes", component: StocktakesPage, name: "stocktakes" },
    { path: "/stocktakes/:sessionId", component: StocktakeDetailPage, name: "stocktake" },
    { path: "/scan/:publicId", component: ScanPage, name: "scan" },
    { path: "/:pathMatch(.*)*", redirect: "/registry" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

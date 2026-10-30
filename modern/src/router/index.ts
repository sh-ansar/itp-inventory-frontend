import { createRouter, createWebHistory } from "vue-router";
import AssetsPage from "../pages/AssetsPage.vue";
import ReferencesPage from "../pages/ReferencesPage.vue";
import ScanPage from "../pages/ScanPage.vue";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/registry" },
    { path: "/registry", component: AssetsPage, name: "assets" },
    { path: "/references", component: ReferencesPage, name: "references" },
    { path: "/scan/:publicId", component: ScanPage, name: "scan" },
    { path: "/:pathMatch(.*)*", redirect: "/registry" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
import { createRouter, createWebHistory } from "vue-router";
import AssetsPage from "../pages/AssetsPage.vue";
import ReferencesPage from "../pages/ReferencesPage.vue";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/assets" },
    { path: "/assets", component: AssetsPage, name: "assets" },
    { path: "/references", component: ReferencesPage, name: "references" },
    { path: "/:pathMatch(.*)*", redirect: "/assets" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
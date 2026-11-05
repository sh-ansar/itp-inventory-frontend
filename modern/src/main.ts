import { createApp } from "vue";
import { createPinia } from "pinia";
import Root from "./Root.vue";
import { router } from "./router";
import "./styles/tokens.css";
import "./style.css";
import "./styles/commercial.css";

createApp(Root).use(createPinia()).use(router).mount("#app");
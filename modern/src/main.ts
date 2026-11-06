import '@itpmining/vue-basic-components/shared.css'
import { createApp } from "vue";
import { createPinia } from "pinia";
import Root from "./Root.vue";
import { router } from "./router";
import "./styles/tokens.css";
import "./style.css";
import "./styles/commercial.css";

const app = createApp(Root).use(createPinia()).use(router);
void router.isReady().then(() => app.mount("#app"));

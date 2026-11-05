<script setup lang="ts">
import {useRoute} from "vue-router";
import App from "./App.vue";
import AdminGate from "./components/commercial/AdminGate.vue";
const route=useRoute();
</script>
<template>
 <!-- Public pages and private workspace never share a layout, identity or sidebar.
      Existing App.vue remains the authenticated workspace's single owner. -->
 <RouterView v-if="route.meta.public" />
 <AdminGate v-else-if="route.meta.platformAdmin" />
 <App v-else />
</template>
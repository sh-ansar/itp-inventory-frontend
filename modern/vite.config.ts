import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  base: process.env.VITE_APP_BASE_PATH || "/inventory/",
  plugins: [vue()],
  server: { port: 5174, proxy: { "/inventory-api": { target: "http://127.0.0.1:18090", changeOrigin: false, rewrite: p => p.replace(/^\/inventory-api/, "") } } },
})

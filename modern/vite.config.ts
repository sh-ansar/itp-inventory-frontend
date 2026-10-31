import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig(({ mode }) => { const env = loadEnv(mode, ".", "VITE_"); return {
  base: env.VITE_APP_BASE_PATH || "/inventory/",
  plugins: [vue()],
  server: { port: 5174, proxy: { "/inventory-api": { target: process.env.INVENTORY_LOCAL_API_TARGET || "http://127.0.0.1:18090", changeOrigin: false, rewrite: p => p.replace(/^\/inventory-api/, "") } } },
} })

import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"tests/smoke",
  timeout:30000,
  retries:0,
  workers:1,
  reporter:[["list"]],
  use:{
    baseURL:"http://127.0.0.1:5174/inventory/",
    browserName:"chromium",
    headless:true,
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
  },
  webServer:{
    command:"npm run dev -- --host 127.0.0.1 --port 5174 --strictPort",
    url:"http://127.0.0.1:5174/inventory/",
    timeout:60000,
    reuseExistingServer:false,
  },
});

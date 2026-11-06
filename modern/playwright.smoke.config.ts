import {defineConfig} from "@playwright/test";

// CI uses 5174; independent QA worktrees can choose an unused loopback port.
// Never enable reuseExistingServer here: a passing smoke run must test this build.
const port=Number(process.env.INVENTORY_SMOKE_PORT ?? "5174");
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid INVENTORY_SMOKE_PORT");
const baseURL="http://127.0.0.1:"+port+"/inventory/";

export default defineConfig({
  testDir:"tests/smoke",
  timeout:30000,
  retries:0,
  workers:1,
  reporter:[["list"]],
  use:{
    baseURL,
    browserName:"chromium",
    headless:true,
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
  },
  webServer:{
    command:"npm run dev -- --host 127.0.0.1 --port "+port+" --strictPort",
    url:baseURL,
    timeout:60000,
    reuseExistingServer:false,
  },
});

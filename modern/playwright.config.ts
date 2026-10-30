import { defineConfig } from "@playwright/test";

const qa = Boolean(process.env.INVENTORY_QA_SECRET_FILE);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  globalTeardown: qa ? "./tests/e2e/auth.teardown.ts" : undefined,
  use: {
    baseURL: "http://127.0.0.1:5174/inventory/",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: qa ? [
    { name: "auth-setup", testMatch: /auth\.setup\.ts/, use: { trace: "off", screenshot: "off", video: "off" } },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["auth-setup"],
      use: { storageState: "test-results/.auth/admin.json" },
    },
  ] : [{ name: "chromium", testIgnore: /auth\.setup\.ts/ }],
});
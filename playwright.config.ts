import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:5173", channel: "chrome", headless: true },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
    },
    {
      command: "npm run db:local && npm run dev:worker",
      url: "http://localhost:8787",
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
  reporter: "list",
});

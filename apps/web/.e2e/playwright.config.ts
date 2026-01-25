import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "https://newsfeed-ai.ryo-o.dev";

// NixOS: Use system Chromium instead of Playwright-managed browsers
const executablePath =
  process.env.CHROME_PATH || "/run/current-system/sw/bin/chromium";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.CI ? undefined : executablePath,
        },
      },
    },
  ],
});

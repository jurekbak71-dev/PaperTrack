declare const process: { env: Record<string, string | undefined> };
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:4173/PaperTrack/" },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173/PaperTrack/",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.SYSTEM_CHROMIUM
          ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
          : {},
      },
    },
    {
      name: "iphone",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 844, height: 390 },
        defaultBrowserType: process.env.SYSTEM_CHROMIUM ? "chromium" : "webkit",
        launchOptions: process.env.SYSTEM_CHROMIUM
          ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
          : {},
      },
    },
    {
      name: "ipad",
      use: {
        ...devices["iPad (gen 7)"],
        viewport: { width: 1024, height: 768 },
        defaultBrowserType: process.env.SYSTEM_CHROMIUM ? "chromium" : "webkit",
        launchOptions: process.env.SYSTEM_CHROMIUM
          ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
          : {},
      },
    },
  ],
});

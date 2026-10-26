import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const localBrowser = process.platform === "win32" ? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync) : undefined;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: "workflows.spec.ts",
  fullyParallel: true,
  use: { baseURL, launchOptions: { ...(localBrowser ? { executablePath: localBrowser } : {}) }, trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: "npm run dev", url: baseURL, reuseExistingServer: !process.env.CI },
});

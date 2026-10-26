import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const executablePath=process.platform==="win32"?["C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync):undefined;
export default defineConfig({
 testDir:"./tests/browser",testMatch:"workflows.spec.ts",workers:1,
 use:{baseURL:"http://localhost:3107",launchOptions:{...(executablePath?{executablePath}:{})},trace:"retain-on-failure"},
 projects:[{name:"desktop",use:{...devices["Desktop Chrome"]}},{name:"mobile",use:{...devices["iPhone 13"],defaultBrowserType:"chromium"}}],
 webServer:[
  {command:"node scripts/mock-workflow-server.mjs",url:"http://127.0.0.1:54329/health",reuseExistingServer:false},
  {command:"npm run dev -- --port 3107",url:"http://localhost:3107/login",reuseExistingServer:false,env:{ARRIE_UI_FIXTURE:"1",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54329",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-public-key",NEXT_PUBLIC_SITE_URL:"http://localhost:3107"}},
 ],
});

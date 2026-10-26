import { defineConfig } from "@playwright/test";
import workflows from "./playwright.workflows.config";
export default defineConfig({...workflows,testMatch:["shop.spec.ts","gallery.spec.ts","loading.spec.ts"]});

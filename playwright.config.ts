import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
const passcode = process.env.CARESLOT_E2E_PASSCODE ?? randomBytes(24).toString("hex");
process.env.CARESLOT_E2E_PASSCODE = passcode;
export default defineConfig({
  testDir: "./tests/browser", timeout: 30_000, workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", headless: true, screenshot: "only-on-failure", trace: "retain-on-failure" },
  reporter: "list",
  webServer: {
    command: "node node_modules/next/dist/bin/next start -p 3100 -H 127.0.0.1",
    url: "http://127.0.0.1:3100/api/health", reuseExistingServer: false, timeout: 60_000,
    env: { APP_PASSCODE: passcode, GEMINI_API_KEY: "", GEMINI_MODEL: "", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
  },
});

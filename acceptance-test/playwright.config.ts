import fs from "fs";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

/** Playwright TS derlemesinde `__dirname` güvenilir olmayabiliyor; cwd’ye göre çöz. */
function resolveFrontendDir(): string {
  const fromAcceptance = path.resolve(process.cwd(), "..", "frontend");
  const fromRoot = path.resolve(process.cwd(), "frontend");
  if (fs.existsSync(path.join(process.cwd(), "playwright.config.ts"))) {
    return fromAcceptance;
  }
  if (fs.existsSync(path.join(fromRoot, "package.json"))) {
    return fromRoot;
  }
  return fromAcceptance;
}

export default defineConfig({
  testDir: "./tests",
  /** Tek seferde tek test: VS Code’da “hepsi aynı anda” görünmesin. Paralel istersen: PW_PARALLEL=1 */
  fullyParallel: process.env.PW_PARALLEL === "1",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.PW_PARALLEL === "1" ? undefined : 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    cwd: resolveFrontendDir(),
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

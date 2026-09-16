import { defineConfig, devices } from "@playwright/test";

// Jornada E2E ponta a ponta contra o stack real (docker compose: db + backend +
// frontend). Ver frontend/e2e/journey.spec.ts e o relatorio da Task 5 para os
// comandos operacionais completos de como subir o stack e rodar esta suite.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});

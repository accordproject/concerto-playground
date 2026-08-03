import { defineConfig, devices } from '@playwright/test';

// Config for the report-only performance spec. Kept separate from
// playwright.config.ts so `npm run test:e2e` stays fast and deterministic
// while `npm run perf:e2e` runs only the measurement spec, always serially.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/perf.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});

import { defineConfig, devices } from '@playwright/test';
import { TOUR_SEEN_KEY } from './src/tour/tourSteps';

export default defineConfig({
  testDir: './e2e',
  // The report-only performance spec runs via playwright.perf.config.ts
  // (npm run perf:e2e), not as part of the regular e2e suite.
  testIgnore: '**/perf.spec.ts',
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // Every context starts with the onboarding tour marked as seen so its
    // overlay never sits on top of unrelated specs; tour.spec.ts opts back
    // into fresh storage to exercise the first-visit auto-start.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [{ name: TOUR_SEEN_KEY, value: 'e2e' }],
        },
      ],
    },
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
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

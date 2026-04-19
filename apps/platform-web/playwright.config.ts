import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Sequential — more reliable across African network conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3005',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...(process.env.CI && { launchOptions: { slowMo: 100 } }),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 5'] }, // Common African Android device
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm run dev',
        url: 'http://localhost:3005',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

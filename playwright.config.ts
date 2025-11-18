import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, 'playwright/.auth/user.json');

// Support production testing via TEST_ENV=production
const baseURL = process.env.TEST_ENV === 'production'
  ? 'https://reminder-mvp.vercel.app'
  : 'http://localhost:3001';

console.log(`🎯 Playwright configured for: ${baseURL}`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Production testing requires accepting HTTPS certificates
    ignoreHTTPSErrors: process.env.TEST_ENV === 'production',
  },

  projects: [
    // Main test project - uses mock auth (no setup needed)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      testIgnore: /auth-flow\.spec\.ts|auth\.setup\.ts/, // Skip real auth tests
    },
  ],

  // Only start local server if not testing production
  webServer: process.env.TEST_ENV === 'production' ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
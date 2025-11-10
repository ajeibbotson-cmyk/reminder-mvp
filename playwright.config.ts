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
  },

  projects: [
    // Setup project - runs first to create auth state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Authenticated tests - most E2E tests need authentication
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /auth-flow\.spec\.ts/, // Auth flow tests don't need pre-auth
    },

    // Public/unauthenticated tests (auth flow, homepage)
    {
      name: 'chromium-unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth-flow\.spec\.ts/,
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /auth-flow\.spec\.ts/,
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /auth-flow\.spec\.ts/,
    },

    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /auth-flow\.spec\.ts/,
    },

    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /auth-flow\.spec\.ts/,
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
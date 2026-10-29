/**
 * Playwright configuration for SOSMesh UX accessibility tests
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/ux',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `file://${__dirname}/prototypes/ux`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-light-tr',
      use: {
        ...devices['iPhone 13 Pro'],
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
        locale: 'tr-TR',
      },
    },
    {
      name: 'mobile-dark-tr',
      use: {
        ...devices['iPhone 13 Pro'],
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
        locale: 'tr-TR',
      },
    },
    {
      name: 'desktop-light-en',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
        locale: 'en-US',
      },
    },
    {
      name: 'desktop-dark-en',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
        locale: 'en-US',
      },
    },
  ],
});

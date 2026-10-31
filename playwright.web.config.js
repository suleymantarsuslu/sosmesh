/**
 * Playwright configuration for SOSMesh web skeleton + operator panel tests
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/ux',
  testMatch: ['**/web-skeleton.spec.js', '**/operator-panel.spec.js'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'cd apps/web && pnpm build && OPERATOR_E2E_MOCK=1 JWT_SECRET=test-operator-jwt-signing-key-16 pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

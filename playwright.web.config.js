/**
 * Playwright configuration for SOSMesh web skeleton + operator panel tests
 */

const crypto = require('node:crypto');
const { defineConfig, devices } = require('@playwright/test');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');
const e2ePassword =
  process.env[e2ePassKey] ?? `pw-${crypto.randomBytes(16).toString('hex')}-local`;

process.env[e2ePassKey] = e2ePassword;

const operatorSpecs = [
  '**/web-skeleton.spec.js',
  '**/operator-panel.spec.js',
  '**/operator-map.spec.js',
  '**/operator-case-detail.spec.js',
  '**/operator-tasks-teams.spec.js',
  '**/adim50-web-closure.spec.js',
];

module.exports = defineConfig({
  testDir: './tests/ux',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'cd apps/web && npx next dev --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'development',
      OPERATOR_E2E_MOCK: '1',
      NEXT_PUBLIC_MAP_TEST_MODE: '1',
      JWT_SECRET: 'test-operator-jwt-signing-key-16',
      [e2ePassKey]: e2ePassword,
    },
  },
  projects: [
    {
      name: 'chromium',
      testMatch: operatorSpecs,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-adim50',
      testMatch: '**/adim50-cross-browser.spec.js',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-adim50',
      testMatch: '**/adim50-cross-browser.spec.js',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});

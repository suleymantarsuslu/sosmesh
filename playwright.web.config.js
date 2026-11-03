/**
 * Playwright configuration for SOSMesh web skeleton + operator panel tests
 */

const crypto = require('node:crypto');
const os = require('node:os');
const { defineConfig, devices } = require('@playwright/test');

const zulalSelfHosted =
  process.env.SOSMESH_CI_RUNNER === 'zulal' ||
  (!!process.env.CI && os.arch() === 'arm64');

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
  '**/operator-help.spec.js',
  '**/adim50-web-closure.spec.js',
];

const webProjects = [
  {
    name: 'chromium',
    testMatch: operatorSpecs,
    use: { ...devices['Desktop Chrome'] },
  },
];

if (!zulalSelfHosted) {
  webProjects.push(
    {
      name: 'firefox-adim50',
      testMatch: '**/adim50-cross-browser.spec.js',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-adim50',
      testMatch: '**/adim50-cross-browser.spec.js',
      use: { ...devices['Desktop Safari'] },
    }
  );
}

module.exports = defineConfig({
  testDir: './tests/ux',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  ...(zulalSelfHosted
    ? {
        snapshotPathTemplate:
          '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}-linux-arm64{ext}',
      }
    : {}),
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: `http://localhost:${process.env.WEB_PORT || 3000}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `cd apps/web && npx next dev --port ${process.env.WEB_PORT || 3000}`,
    url: `http://localhost:${process.env.WEB_PORT || 3000}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'development',
      OPERATOR_E2E_MOCK: '1',
      NEXT_PUBLIC_MAP_TEST_MODE: '1',
      JWT_SECRET: 'test-operator-jwt-signing-key-16',
      PORT: process.env.WEB_PORT || '3000',
      [e2ePassKey]: e2ePassword,
    },
  },
  projects: webProjects,
});

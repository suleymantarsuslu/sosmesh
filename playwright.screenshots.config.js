/** One-off config for marketing/operator screenshot capture (not in CI testMatch). */

const crypto = require('node:crypto');
const { defineConfig, devices } = require('@playwright/test');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');
const e2ePassword =
  process.env[e2ePassKey] ?? `pw-${crypto.randomBytes(16).toString('hex')}-local`;
process.env[e2ePassKey] = e2ePassword;

module.exports = defineConfig({
  testDir: './tests/ux',
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'cd apps/web && pnpm exec next build && cp -r public .next/standalone/apps/web/public && cp -r .next/static .next/standalone/apps/web/.next/static && cd .next/standalone/apps/web && node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 300000,
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      HOSTNAME: '127.0.0.1',
      SOSMESH_SCREENSHOT_CAPTURE: '1',
      OPERATOR_E2E_MOCK: '1',
      JWT_SECRET: process.env.JWT_SECRET || 'e2e-local-jwt-secret-32chars-min!!',
      [e2ePassKey]: e2ePassword,
    },
  },
});

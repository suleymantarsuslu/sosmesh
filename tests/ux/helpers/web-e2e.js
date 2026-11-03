/**
 * Shared helpers for SOSMesh operator web E2E / ADIM 50.
 */

const AxeBuilder = require('@axe-core/playwright').default;
const { expect } = require('@playwright/test');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');

const E2E_OPERATOR_EMAIL = 'e2e-operator@sosmesh.example';
const E2E_ADMIN_EMAIL = 'e2e-admin@sosmesh.example';
const E2E_CASE_GPS_ID = 'e2e11111-1111-4111-8111-111111111101';

const AXE_WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

function requireE2ePassword() {
  const pass = process.env[e2ePassKey];
  if (!pass) {
    throw new Error(`${e2ePassKey} must be set (see playwright.web.config.js)`);
  }
  return pass;
}

async function loginWithEmail(page, email) {
  const password = requireE2ePassword();
  await page.goto('/operator/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/operator\/dashboard/);
}

async function loginAsOperator(page) {
  await loginWithEmail(page, E2E_OPERATOR_EMAIL);
}

async function loginAsAdmin(page) {
  await loginWithEmail(page, E2E_ADMIN_EMAIL);
}

async function analyzeAxe(page) {
  return new AxeBuilder({ page }).withTags(AXE_WCAG_TAGS).analyze();
}

async function expectNoBlockerAxeViolations(page) {
  const results = await analyzeAxe(page);
  const blockers = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  if (blockers.length > 0) {
    const summary = blockers.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('; ');
    throw new Error(`axe blocker violations: ${summary}`);
  }
  expect(blockers).toHaveLength(0);
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(overflow).toBe(false);
}

function attachHydrationListeners(page, bucket) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && /hydration|Hydration failed/i.test(text)) {
      bucket.push(text);
    }
  });
  page.on('pageerror', (err) => {
    if (/hydration/i.test(err.message)) {
      bucket.push(err.message);
    }
  });
}

module.exports = {
  AXE_WCAG_TAGS,
  E2E_ADMIN_EMAIL,
  E2E_CASE_GPS_ID,
  E2E_OPERATOR_EMAIL,
  analyzeAxe,
  attachHydrationListeners,
  e2ePassKey,
  expectNoBlockerAxeViolations,
  expectNoHorizontalOverflow,
  loginAsAdmin,
  loginAsOperator,
  loginWithEmail,
  requireE2ePassword,
};

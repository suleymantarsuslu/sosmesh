/**
 * Operator tasks/teams screens (ADIM 27/28) — 1440 screenshot evidence.
 */

const { test, expect } = require('@playwright/test');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');
const E2E_EMAIL = 'e2e-operator@sosmesh.example';
const E2E_PASS = process.env[e2ePassKey];

if (!E2E_PASS) {
  throw new Error(`${e2ePassKey} must be set (see playwright.web.config.js)`);
}

async function login(page) {
  await page.goto('/operator/login');
  await page.getByLabel('E-posta').fill(E2E_EMAIL);
  await page.getByLabel('Şifre').fill(E2E_PASS);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/operator\/dashboard/);
}

test.describe('Operator tasks and teams (ADIM 27/28)', () => {
  test('tasks page shows screen state shell', async ({ page }) => {
    await login(page);
    await page.goto('/operator/tasks');
    await expect(page.getByTestId('operator-tasks')).toBeVisible();
  });

  test('teams page shows screen state shell', async ({ page }) => {
    await login(page);
    await page.goto('/operator/teams');
    await expect(page.getByTestId('operator-teams')).toBeVisible();
  });

  test('activity page shows screen state shell', async ({ page }) => {
    await login(page);
    await page.goto('/operator/activity');
    await expect(page.getByTestId('operator-activity')).toBeVisible();
  });

  test('tasks screenshot 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto('/operator/tasks');
    await expect(page.getByTestId('operator-tasks')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-tasks-1440.png', fullPage: true });
  });
});

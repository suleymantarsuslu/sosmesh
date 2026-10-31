/**
 * SOSMesh operator panel auth and dashboard E2E (mock API via OPERATOR_E2E_MOCK=1).
 */

const { test, expect } = require('@playwright/test');

const E2E_EMAIL = 'e2e-operator@sosmesh.test';
const E2E_PASSWORD = 'e2e-password-16chars';

test.describe('Operator panel', () => {
  test('redirects unauthenticated /operator/dashboard to login', async ({ page }) => {
    await page.goto('/operator/dashboard');
    await expect(page).toHaveURL(/\/operator\/login/);
  });

  test('login redirects to dashboard', async ({ page }) => {
    await page.goto('/operator/login');
    await page.getByLabel('E-posta').fill(E2E_EMAIL);
    await page.getByLabel('Şifre').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page).toHaveURL(/\/operator\/dashboard/);
    await expect(page.getByTestId('operator-dashboard')).toBeVisible();
  });

  test('shows veri yok when dashboard has no data', async ({ page }) => {
    await page.goto('/operator/login');
    await page.getByLabel('E-posta').fill(E2E_EMAIL);
    await page.getByLabel('Şifre').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByTestId('dashboard-no-data')).toHaveText('Henüz veri yok');
    const emptyStats = page.locator('[data-empty="true"]');
    await expect(emptyStats.first()).toBeVisible();
  });

  test('role denied screen for non-admin admin route', async ({ page }) => {
    await page.goto('/operator/login');
    await page.getByLabel('E-posta').fill(E2E_EMAIL);
    await page.getByLabel('Şifre').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await page.goto('/operator/admin');
    await expect(page.getByTestId('role-denied')).toBeVisible();
  });

  test('dashboard screenshot 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/operator/login');
    await page.getByLabel('E-posta').fill(E2E_EMAIL);
    await page.getByLabel('Şifre').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByTestId('operator-dashboard')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-dashboard-1440.png', fullPage: true });
  });
});

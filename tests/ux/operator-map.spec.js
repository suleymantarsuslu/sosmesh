/**
 * ADIM 22 — operator map, filters, live feed E2E (mock API).
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
  await page.getByTestId('login-email').fill(E2E_EMAIL);
  await page.getByTestId('login-password').fill(E2E_PASS);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/operator\/dashboard/);
}

test.describe('Operator map and case list', () => {
  test('null GPS case appears only in unknown queue', async ({ page }) => {
    await login(page);
    await page.goto('/operator/cases');
    await expect(page.getByTestId('operator-cases-view')).toBeVisible();
    await expect(page.getByTestId('unknown-location-queue')).toBeVisible();
    await expect(page.getByTestId('unknown-queue-item-e2e22222')).toBeVisible();
    await expect(page.getByTestId('map-pin-e2e22222')).toHaveCount(0);
    await expect(page.getByTestId('map-pin-e2e11111')).toBeVisible({ timeout: 15000 });
  });

  test('search filter narrows list', async ({ page }) => {
    await login(page);
    await page.goto('/operator/cases');
    await page.getByTestId('case-filter-search').fill('e2e-msg-gps');
    await expect(page.getByTestId('case-list-item-e2e11111')).toBeVisible();
    await expect(page.getByTestId('unknown-queue-item-e2e22222')).toHaveCount(0);
  });

  test('live feed adds a new case row', async ({ page }) => {
    await login(page);
    await page.goto('/operator/cases');
    await expect(page.getByTestId('live-feed-status')).toContainText('Live feed');
    await expect(page.getByTestId('cases-a11y-table')).toContainText(/e2e33333|e2e44444/, {
      timeout: 15000,
    });
  });

  test('1000 seeded cases render under budget', async ({ page }) => {
    await login(page);
    const start = Date.now();
    await page.goto('/operator/cases?seedCount=1000');
    await expect(page.getByTestId('operator-cases-view')).toBeVisible();
    await expect(page.getByTestId('cases-a11y-table').locator('tbody tr').first()).toBeVisible();
    const elapsedMs = Date.now() - start;
    test.info().annotations.push({ type: 'render_ms', description: String(elapsedMs) });
    expect(elapsedMs).toBeLessThan(15000);
  });

  test('map screenshot 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto('/operator/cases');
    await expect(page.getByTestId('operator-map')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-map-cases-1440.png', fullPage: true });
  });

  test('map screenshot 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('/operator/cases');
    await expect(page.getByTestId('operator-cases-view')).toBeVisible();
    await expect(page.getByTestId('unknown-location-queue')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-map-cases-390.png', fullPage: true });
  });

  test('map screenshot 768', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto('/operator/cases');
    await expect(page.getByTestId('operator-cases-view')).toBeVisible();
    await expect(page.getByTestId('unknown-location-queue')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-map-cases-768.png', fullPage: true });
  });
});

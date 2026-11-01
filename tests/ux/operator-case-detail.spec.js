/**
 * ADIM 23 — case detail, AI draft panel, audit, XSS escape, version conflict (mock API).
 */

const { test, expect } = require('@playwright/test');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');
const E2E_EMAIL = 'e2e-operator@sosmesh.example';
const E2E_PASS = process.env[e2ePassKey];
const E2E_CASE_GPS_ID = 'e2e11111-1111-4111-8111-111111111101';

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

test.describe('Operator case detail ADIM 23', () => {
  test('correction click creates visible audit entry', async ({ page }) => {
    await login(page);
    await page.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    await expect(page.getByTestId('operator-case-detail')).toBeVisible();
    await page.getByTestId('case-person-count-input').fill('4');
    await page.getByTestId('case-save-correction').click();
    await expect(page.getByTestId('case-audit-METADATA_CORRECTION')).toBeVisible();
  });

  test('XSS payload renders as escaped text', async ({ page }) => {
    await login(page);
    await page.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    const original = page.getByTestId('case-original-text');
    await expect(original).toContainText('<script>');
    await expect(original).toContainText('onerror');
    const html = await original.innerHTML();
    expect(html).not.toMatch(/<script/i);
  });

  test('version conflict shows operator warning', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await login(pageA);
    await login(pageB);
    await pageA.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    await pageB.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    await expect(pageA.getByTestId('operator-case-detail')).toBeVisible();
    await pageA.getByTestId('case-person-count-input').fill('5');
    await pageA.getByTestId('case-save-correction').click();
    await expect(pageA.getByTestId('case-audit-METADATA_CORRECTION')).toBeVisible();
    await pageB.getByTestId('case-person-count-input').fill('6');
    await pageB.getByTestId('case-save-correction').click();
    await expect(pageB.getByTestId('case-version-conflict')).toBeVisible();
    await contextA.close();
    await contextB.close();
  });

  test('AI panel always shows unverified draft badge', async ({ page }) => {
    await login(page);
    await page.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    await expect(page.getByTestId('case-ai-draft-badge')).toHaveText('öneri/taslak, doğrulanmadı');
  });

  test('case detail screenshot 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    await expect(page.getByTestId('operator-case-detail')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-case-detail-1440.png', fullPage: true });
  });

  test('case detail screenshot 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    await expect(page.getByTestId('operator-case-detail')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-case-detail-390.png', fullPage: true });
  });

  test('case detail screenshot 768', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    await expect(page.getByTestId('operator-case-detail')).toBeVisible();
    await page.screenshot({ path: 'reports/operator-case-detail-768.png', fullPage: true });
  });
});

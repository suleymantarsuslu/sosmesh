/**
 * Capture walkthrough screenshots (run explicitly; not part of default CI match).
 */

const { test, expect } = require('@playwright/test');
const path = require('node:path');

const { loginAsOperator } = require('./helpers/web-e2e');

const ARTIFACTS = path.join(__dirname, '../../artifacts/web-modern');

test.describe('Web modern screenshots', () => {
  test('capture marketing and operator views', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(ARTIFACTS, 'marketing-home-en-1440.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.screenshot({
      path: path.join(ARTIFACTS, 'marketing-home-en-375.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByTestId('locale-switcher-select').selectOption('tr');
    await page.screenshot({
      path: path.join(ARTIFACTS, 'marketing-home-tr-1440.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/operator/login');
    await page.screenshot({
      path: path.join(ARTIFACTS, 'operator-login-en-1440.png'),
      fullPage: true,
    });

    await loginAsOperator(page);
    await page.goto('/operator/dashboard');
    await expect(page.getByTestId('operator-dashboard')).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACTS, 'operator-dashboard-en-1440.png'),
      fullPage: true,
    });

    await page.goto('/operator/cases');
    await expect(page.getByTestId('operator-cases-view')).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACTS, 'operator-cases-en-1440.png'),
      fullPage: true,
    });
  });
});

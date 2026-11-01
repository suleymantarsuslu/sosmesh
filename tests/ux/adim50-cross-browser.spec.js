/**
 * ADIM 50 — minimal axe smoke on login for Firefox / WebKit projects.
 */

const { test } = require('@playwright/test');

const { expectNoBlockerAxeViolations } = require('./helpers/web-e2e');

test.describe('ADIM 50 cross-browser axe smoke', () => {
  test('operator login has no blocker axe violations', async ({ page }) => {
    await page.goto('/operator/login');
    await page.waitForLoadState('domcontentloaded');
    await expectNoBlockerAxeViolations(page);
  });
});

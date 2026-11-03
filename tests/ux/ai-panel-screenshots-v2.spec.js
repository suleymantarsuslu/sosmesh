/**
 * AI Panel Screenshots for Work Package E
 */

const { test, expect } = require('@playwright/test');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');
const E2E_EMAIL = 'e2e-operator@sosmesh.example';
const E2E_PASS = process.env[e2ePassKey];

if (!E2E_PASS) {
  throw new Error(`${e2ePassKey} must be set`);
}

test.describe('AI Panel Screenshots', () => {
  test('case detail AI panel 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/operator/login');
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/operator/dashboard');

    await page.goto('/operator/cases/mock-incident-1');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-triage-card"]');
    await page.waitForSelector('[data-testid="ai-transcript-card"]');
    await page.waitForSelector('[data-testid="ai-fusion-card"]');

    await page.screenshot({
      path: 'artifacts/screenshots/ai-panel/case-detail-ai-panel-1440.png',
      fullPage: true,
    });
  });

  test('case detail AI panel 375', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/operator/login');
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/operator/dashboard');

    await page.goto('/operator/cases/mock-incident-1');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-triage-card"]');

    await page.screenshot({
      path: 'artifacts/screenshots/ai-panel/case-detail-ai-panel-375.png',
      fullPage: true,
    });
  });

  test('photo SAM overlay 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/operator/login');
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/operator/dashboard');

    await page.goto('/operator/cases/mock-incident-1');
    await page.waitForSelector('[data-testid="ai-photo-card"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-photo-image"]');
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="ai-photo-image"]');
      return img && img.complete && img.naturalHeight > 0;
    });
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="ai-photo-card"]').scrollIntoViewIfNeeded();
    const photoCard = await page.locator('[data-testid="ai-photo-card"]');
    await photoCard.screenshot({
      path: 'artifacts/screenshots/ai-panel/photo-sam-overlay-1440.png',
    });
  });

  test('photo SAM overlay 375', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/operator/login');
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/operator/dashboard');

    await page.goto('/operator/cases/mock-incident-1');
    await page.waitForSelector('[data-testid="ai-photo-card"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-photo-image"]');
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="ai-photo-image"]');
      return img && img.complete && img.naturalHeight > 0;
    });
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="ai-photo-card"]').scrollIntoViewIfNeeded();
    const photoCard = await page.locator('[data-testid="ai-photo-card"]');
    await photoCard.screenshot({
      path: 'artifacts/screenshots/ai-panel/photo-sam-overlay-375.png',
    });
  });

  test('AI dashboard 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/operator/login');
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/operator/dashboard');

    await page.goto('/operator/ai');
    await page.waitForSelector('[data-testid="ai-dashboard"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-status-card"]');
    await page.waitForSelector('[data-testid="ai-copilot-card"]');
    await page.waitForSelector('[data-testid="ai-demo-form"]');

    await page.screenshot({
      path: 'artifacts/screenshots/ai-panel/ai-dashboard-1440.png',
      fullPage: true,
    });
  });

  test('AI dashboard 375', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/operator/login');
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/operator/dashboard');

    await page.goto('/operator/ai');
    await page.waitForSelector('[data-testid="ai-dashboard"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-status-card"]');

    await page.screenshot({
      path: 'artifacts/screenshots/ai-panel/ai-dashboard-375.png',
      fullPage: true,
    });
  });
});

/**
 * AI Panel Work Package E Screenshots
 * Captures 6 screenshots: Case detail with AI panel, Photo with SAM overlay, AI Dashboard at 1440px and 375px
 */

const { test, expect } = require('@playwright/test');
const { mkdir } = require('fs/promises');
const { join } = require('path');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');
const E2E_EMAIL = 'e2e-operator@sosmesh.example';
const E2E_PASS = process.env[e2ePassKey];

if (!E2E_PASS) {
  throw new Error(`${e2ePassKey} must be set (see playwright config)`);
}

const SCREENSHOTS_DIR = join(process.cwd(), 'artifacts', 'screenshots', 'ai-panel');

test.beforeAll(async () => {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
});

async function login(page) {
  await page.goto('/operator/login');
  await page.getByTestId('login-email').fill(E2E_EMAIL);
  await page.getByTestId('login-password').fill(E2E_PASS);
  await page.getByTestId('login-submit').click();
}

test.describe('AI Panel WP-E Screenshots', () => {
  test('Case detail with AI panel - 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    
    // Navigate to case with AI data
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    
    // Wait for AI data to load
    await page.waitForTimeout(3000);
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'case-detail-ai-panel-1440.png'),
      fullPage: true
    });
  });

  test('Case detail with AI panel - 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'case-detail-ai-panel-375.png'),
      fullPage: true
    });
  });

  test('Photo with SAM overlay - 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'photo-sam-overlay-1440.png'),
      fullPage: true
    });
  });

  test('Photo with SAM overlay - 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'photo-sam-overlay-375.png'),
      fullPage: true
    });
  });

  test('AI Dashboard - 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    
    await page.goto('/operator/ai', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'ai-dashboard-1440.png'),
      fullPage: true
    });
  });

  test('AI Dashboard - 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    
    await page.goto('/operator/ai', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'ai-dashboard-375.png'),
      fullPage: true
    });
  });
});

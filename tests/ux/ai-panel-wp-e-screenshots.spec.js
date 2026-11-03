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

const SCREENSHOTS_DIR = '/opt/cursor/artifacts/ai-panel';

test.beforeAll(async () => {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
});

async function login(page) {
  await page.goto('/operator/login');
  await expect(page.getByTestId('login-form')).toBeVisible();
  await page.getByTestId('login-email').fill(E2E_EMAIL);
  await page.getByTestId('login-password').fill(E2E_PASS);
  await page.getByTestId('login-submit').click();
  // Wait for redirect to complete
  await page.waitForURL(/\/operator\/dashboard/, { timeout: 10000 });
  await expect(page.getByTestId('operator-dashboard')).toBeVisible({ timeout: 5000 });
}

test.describe('AI Panel WP-E Screenshots', () => {
  test('Case detail with AI panel - 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    
    // Navigate to case with AI data
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    
    // Verify not on login page
    await expect(page.getByTestId('login-form')).not.toBeVisible();
    
    // Wait for AI intelligence panel
    await expect(page.getByTestId('ai-intelligence-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('ai-triage-card')).toBeVisible({ timeout: 5000 });
    
    // Verify triage summary is loaded
    const triageSummary = page.locator('[data-testid="ai-triage-card"]').locator('text=/trapped|collapse|building/i');
    await expect(triageSummary.first()).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'case-detail-ai-panel-1440.png'),
      fullPage: true
    });
  });

  test('Case detail with AI panel - 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    
    // Verify not on login page
    await expect(page.getByTestId('login-form')).not.toBeVisible();
    
    // Wait for AI intelligence panel
    await expect(page.getByTestId('ai-intelligence-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('ai-triage-card')).toBeVisible({ timeout: 5000 });
    
    const triageSummary = page.locator('[data-testid="ai-triage-card"]').locator('text=/trapped|collapse|building/i');
    await expect(triageSummary.first()).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'case-detail-ai-panel-375.png'),
      fullPage: true
    });
  });

  test('Photo with SAM overlay - 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    
    // Verify not on login page
    await expect(page.getByTestId('login-form')).not.toBeVisible();
    
    // Wait for photo analysis card to be visible
    await expect(page.getByTestId('ai-photo-card')).toBeVisible({ timeout: 10000 });
    
    // Verify canvas overlay is present
    const canvas = page.getByTestId('ai-photo-canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });
    
    // Verify at least one concept label (person or debris from mock data)
    const conceptLabel = page.locator('[data-testid="ai-photo-card"]').locator('text=/person|debris/i');
    await expect(conceptLabel.first()).toBeVisible({ timeout: 5000 });
    
    // Wait for canvas to be drawn (retry until content appears)
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-testid="ai-photo-canvas"]');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let nonZeroPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) nonZeroPixels++;
      }
      const nonZeroRatio = nonZeroPixels / (canvas.width * canvas.height);
      return nonZeroRatio > 0.05;
    }, { timeout: 10000 });
    
    // Screenshot just the photo card element
    await page.getByTestId('ai-photo-card').screenshot({
      path: join(SCREENSHOTS_DIR, 'photo-sam-overlay-1440.png')
    });
  });

  test('Photo with SAM overlay - 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    
    await page.goto('/operator/cases/mock-incident-1', { waitUntil: 'networkidle' });
    
    // Verify not on login page
    await expect(page.getByTestId('login-form')).not.toBeVisible();
    
    // Wait for photo analysis card
    await expect(page.getByTestId('ai-photo-card')).toBeVisible({ timeout: 10000 });
    
    // Verify canvas and concept label
    const canvas = page.getByTestId('ai-photo-canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });
    const conceptLabel = page.locator('[data-testid="ai-photo-card"]').locator('text=/person|debris/i');
    await expect(conceptLabel.first()).toBeVisible({ timeout: 5000 });
    
    // Wait for canvas to be drawn
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-testid="ai-photo-canvas"]');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let nonZeroPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) nonZeroPixels++;
      }
      const nonZeroRatio = nonZeroPixels / (canvas.width * canvas.height);
      return nonZeroRatio > 0.05;
    }, { timeout: 10000 });
    
    // Screenshot just the photo card element
    await page.getByTestId('ai-photo-card').screenshot({
      path: join(SCREENSHOTS_DIR, 'photo-sam-overlay-375.png')
    });
  });

  test('AI Dashboard - 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    
    await page.goto('/operator/ai', { waitUntil: 'networkidle' });
    
    // Verify not on login page
    await expect(page.getByTestId('login-form')).not.toBeVisible();
    
    // Wait for AI dashboard elements
    await expect(page.getByTestId('ai-dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: /AI Dashboard|Yapay Zeka/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('ai-status-card')).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'ai-dashboard-1440.png'),
      fullPage: true
    });
  });

  test('AI Dashboard - 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    
    await page.goto('/operator/ai', { waitUntil: 'networkidle' });
    
    // Verify not on login page
    await expect(page.getByTestId('login-form')).not.toBeVisible();
    
    // Wait for AI dashboard elements
    await expect(page.getByTestId('ai-dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: /AI Dashboard|Yapay Zeka/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('ai-status-card')).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'ai-dashboard-375.png'),
      fullPage: true
    });
  });
});

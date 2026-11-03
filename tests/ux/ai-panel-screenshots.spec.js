/**
 * AI Panel Screenshots for Work Package E
 * Takes screenshots at 1440px and 375px widths
 */

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

const SCREENSHOTS_DIR = path.join(
  process.cwd(),
  'artifacts/screenshots/ai-panel'
);

async function loginAsOperator(page) {
  await page.goto(`${BASE_URL}/operator/login`);
  await page.fill('input[type="email"]', 'e2e-operator@sosmesh.example');
  await page.fill('input[type="password"]', process.env.OPERATOR_E2E_PASSWORD || 'e2e-password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/operator/dashboard');
}

test.describe('AI Panel Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
  });

  test('Case detail with AI panel at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    
    // Navigate to case detail
    await page.goto(`${BASE_URL}/operator/cases/mock-incident-1`);
    
    // Wait for AI panel to load
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 10000 });
    
    // Wait for all cards to be visible
    await page.waitForSelector('[data-testid="ai-triage-card"]');
    await page.waitForSelector('[data-testid="ai-transcript-card"]');
    await page.waitForSelector('[data-testid="ai-fusion-card"]');
    
    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'case-detail-ai-panel-1440.png'),
      fullPage: true,
    });
  });

  test('Case detail with AI panel at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to case detail
    await page.goto(`${BASE_URL}/operator/cases/mock-incident-1`);
    
    // Wait for AI panel to load
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 10000 });
    
    // Wait for triage card
    await page.waitForSelector('[data-testid="ai-triage-card"]');
    
    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'case-detail-ai-panel-375.png'),
      fullPage: true,
    });
  });

  test('Photo with SAM overlay at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    
    // Navigate to case detail
    await page.goto(`${BASE_URL}/operator/cases/mock-incident-1`);
    
    // Wait for photo analysis card
    await page.waitForSelector('[data-testid="ai-photo-card"]', { timeout: 10000 });
    
    // Wait for image to load
    await page.waitForSelector('[data-testid="ai-photo-image"]');
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="ai-photo-image"]');
      return img && img.complete && img.naturalHeight > 0;
    });
    
    // Wait for canvas overlay to render
    await page.waitForTimeout(1000);
    
    // Scroll to photo card
    await page.locator('[data-testid="ai-photo-card"]').scrollIntoViewIfNeeded();
    
    // Take screenshot of just the photo card
    const photoCard = await page.locator('[data-testid="ai-photo-card"]');
    await photoCard.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'photo-sam-overlay-1440.png'),
    });
  });

  test('Photo with SAM overlay at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to case detail
    await page.goto(`${BASE_URL}/operator/cases/mock-incident-1`);
    
    // Wait for photo analysis card
    await page.waitForSelector('[data-testid="ai-photo-card"]', { timeout: 10000 });
    
    // Wait for image to load
    await page.waitForSelector('[data-testid="ai-photo-image"]');
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-testid="ai-photo-image"]');
      return img && img.complete && img.naturalHeight > 0;
    });
    
    // Wait for canvas to render
    await page.waitForTimeout(1000);
    
    // Scroll to photo card
    await page.locator('[data-testid="ai-photo-card"]').scrollIntoViewIfNeeded();
    
    // Take screenshot
    const photoCard = await page.locator('[data-testid="ai-photo-card"]');
    await photoCard.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'photo-sam-overlay-375.png'),
    });
  });

  test('AI Dashboard at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    
    // Navigate to AI dashboard
    await page.goto(`${BASE_URL}/operator/ai`);
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="ai-dashboard"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-status-card"]');
    await page.waitForSelector('[data-testid="ai-copilot-card"]');
    await page.waitForSelector('[data-testid="ai-demo-form"]');
    
    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'ai-dashboard-1440.png'),
      fullPage: true,
    });
  });

  test('AI Dashboard at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to AI dashboard
    await page.goto(`${BASE_URL}/operator/ai`);
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="ai-dashboard"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="ai-status-card"]');
    
    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'ai-dashboard-375.png'),
      fullPage: true,
    });
  });
});
